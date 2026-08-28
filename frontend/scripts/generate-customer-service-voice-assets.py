from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPOSITORY_ROOT / "backend"

sys.path.insert(0, str(BACKEND_ROOT))

from services.aihub import AIHubService  # noqa: E402
from routers.local_dev import (  # noqa: E402
    MATERIAL_ASSET_FILE_ROOT,
    MATERIAL_ASSET_ROOT,
    _material_asset_public_url,
    _read_material_asset_index,
    _write_material_asset_index,
)


OUTPUT_DIRECTORY = MATERIAL_ASSET_FILE_ROOT
MANIFEST_PATH = MATERIAL_ASSET_ROOT / "_customer_service_voice_manifest.json"


VOICE_ASSETS = (
    ("expert-01", "female", "01.xushi-nvsheng.wav", "您好，我是蓄势专家，机会判断交我！"),
    ("expert-02", "female", "02.buchang-nvsheng.wav", "嗨呀，我是布场专家，内容点亮交我！"),
    ("expert-03", "male", "03.yingsou-nansheng.wav", "幸会，我是营搜专家，信任建立交我！"),
    ("expert-04", "female", "04.zhanxin-nvsheng.wav", "收到，我是占新专家，推荐匹配交我！"),
    ("expert-05", "female", "05.quanyang-nvsheng.wav", "嗨喽，我是圈养专家，社媒互动交我！"),
    ("expert-06", "male", "06.suoke-nansheng.wav", "你好，我是锁客专家，客户画像交我！"),
    ("expert-07", "female", "07.jingtou-nvsheng.wav", "来啦，我是精投专家，获客投放交我！"),
    ("expert-08", "female", "08.chengzhuan-nvsheng.wav", "放心，我是承转专家，成交推进交我！"),
    ("expert-09", "male", "09.qianglian-nansheng.wav", "稳住，我是强链专家，履约交付交我！"),
    ("expert-10", "female", "10.shenyang-nvsheng.wav", "暖心，我是深养专家，客户关怀交我！"),
    ("expert-11", "female", "11.yushu-nvsheng.wav", "明白，我是驭数专家，数据决策交我！"),
    ("expert-12", "male", "12.guben-nansheng.wav", "好的，我是固本专家，经营闭环交我！"),
)


def validate_wave(path: Path) -> tuple[float, str]:
    with wave.open(str(path), "rb") as audio:
        if audio.getnchannels() != 1:
            raise RuntimeError(f"{path.name} must be mono")
        if audio.getsampwidth() != 2:
            raise RuntimeError(f"{path.name} must be 16-bit PCM")
        if audio.getframerate() != 22_050:
            raise RuntimeError(f"{path.name} must use 22050Hz")
        duration = audio.getnframes() / audio.getframerate()
        if not 2 <= duration <= 12:
            raise RuntimeError(f"{path.name} duration {duration:.2f}s is outside the preview contract")
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return duration, digest


def read_previous_manifest_items() -> dict[str, dict[str, object]]:
    if not MANIFEST_PATH.exists():
        return {}
    try:
        payload = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    items = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(items, list):
        return {}
    return {
        str(item.get("assetId") or "").strip(): item
        for item in items
        if isinstance(item, dict) and str(item.get("assetId") or "").strip()
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate protected local customer-service voice samples.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Explicitly rebuild the protected default WAV files instead of preserving existing files.",
    )
    parser.add_argument(
        "--force-style",
        action="append",
        choices=[style_key for style_key, *_ in VOICE_ASSETS],
        default=[],
        help="Rebuild only the named protected style; repeat the flag to select multiple numbered slots.",
    )
    args = parser.parse_args()
    forced_styles = set(args.force_style)
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    helper: Path | None = None
    hashes: set[str] = set()
    material_items = _read_material_asset_index()
    material_by_id = {
        str(item.get("assetId") or "").strip(): item
        for item in material_items
        if str(item.get("assetId") or "").strip()
    }
    previous_manifest_by_id = read_previous_manifest_items()
    manifest_items: list[dict[str, object]] = []

    for style_key, gender, file_name, transcript in VOICE_ASSETS:
        force_style = args.force or style_key in forced_styles
        asset_id = f"customer-service-voice-{style_key}"
        target = OUTPUT_DIRECTORY / file_name
        expected_relative_path = f"files/{file_name}"
        existing_item = material_by_id.get(asset_id, {})
        existing_relative_path = str(existing_item.get("relativePath") or "").strip()
        if existing_item and existing_relative_path and existing_relative_path != expected_relative_path and not force_style:
            raise RuntimeError(
                f"{asset_id} points to {existing_relative_path}; use --force or --force-style {style_key} "
                "only when intentionally restoring the system default"
            )

        preserve_existing = bool(existing_item and target.exists() and not force_style)
        if preserve_existing:
            duration, digest = validate_wave(target)
            voice_name = str(previous_manifest_by_id.get(asset_id, {}).get("voice") or "Windows local TTS")
            action = "kept"
        else:
            helper = helper or AIHubService._ensure_local_tts_helper()
            temporary_target = OUTPUT_DIRECTORY / f".{file_name}.tmp.wav"
            temporary_target.unlink(missing_ok=True)
            with tempfile.NamedTemporaryFile("w", suffix=".txt", encoding="utf-8", delete=False) as handle:
                handle.write(transcript)
                text_path = Path(handle.name)
            try:
                completed = subprocess.run(
                    [str(helper), str(temporary_target), str(text_path), gender, style_key],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="ignore",
                    check=False,
                )
                if completed.returncode != 0 or not temporary_target.exists():
                    raise RuntimeError(
                        f"Failed to generate {file_name}: "
                        f"{(completed.stderr or completed.stdout or 'unknown error').strip()}"
                    )

                actual_gender, voice_name = AIHubService._parse_local_tts_helper_result(completed.stdout or "")
                if actual_gender != gender:
                    raise RuntimeError(
                        f"Failed to generate {file_name}: helper selected {actual_gender} voice "
                        f"{voice_name!r} for requested {gender} speech"
                    )

                duration, digest = validate_wave(temporary_target)
                temporary_target.replace(target)
            finally:
                text_path.unlink(missing_ok=True)
                temporary_target.unlink(missing_ok=True)
            action = "generated"

        if digest in hashes:
            raise RuntimeError(f"{file_name} duplicates another generated voice file")
        hashes.add(digest)
        created_at = str(existing_item.get("createdAt") or AIHubService._iso_now())
        updated_at = str(existing_item.get("updatedAt") or created_at) if preserve_existing else AIHubService._iso_now()
        material_item = {
            **existing_item,
            "assetId": asset_id,
            "fileName": file_name,
            "mimeType": "audio/wav",
            "sizeBytes": target.stat().st_size,
            "createdAt": created_at,
            "updatedAt": updated_at,
            "relativePath": expected_relative_path,
            "systemManaged": True,
        }
        if asset_id in material_by_id:
            material_by_id[asset_id].update(material_item)
        else:
            material_items.append(material_item)
            material_by_id[asset_id] = material_item
        manifest_items.append(
            {
                "assetId": asset_id,
                "styleKey": style_key,
                "gender": gender,
                "synthetic": True,
                "engine": "Windows OneCore/SAPI",
                "voice": voice_name,
                "transcript": transcript,
                "fileName": file_name,
                "url": _material_asset_public_url(asset_id),
                "sampleRate": 22_050,
                "channels": 1,
                "bitDepth": 16,
                "durationSeconds": round(duration, 3),
                "sha256": digest,
                "distributionScope": "local-private-material-library",
                "systemManaged": True,
            }
        )
        print(f"{action} {style_key} {file_name} {duration:.2f}s {voice_name} {asset_id}")

    _write_material_asset_index(material_items)
    MANIFEST_PATH.write_text(
        json.dumps(
            {
                "contractVersion": "expert-voice-local-assets-v2",
                "generatedAt": AIHubService._iso_now(),
                "syntheticDisclosure": "这些朗音由本地合成语音生成，不代表真人。",
                "items": manifest_items,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Generated {len(VOICE_ASSETS)} private local customer-service voice samples in {OUTPUT_DIRECTORY}")


if __name__ == "__main__":
    main()
