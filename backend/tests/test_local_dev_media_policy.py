import struct
import zlib
from io import BytesIO

import pytest
from fastapi import HTTPException
from starlette.datastructures import Headers, UploadFile

import routers.local_dev as local_dev
from routers.local_dev import (
    _material_asset_metadata_policy_issues,
    _material_asset_probe_metadata,
    _material_asset_signature_matches,
    _material_asset_validate_content,
)


IMAGE_RULE = {"maxWidth": 2560, "maxHeight": 2560}
VIDEO_RULE = {"maxWidth": 1920, "maxHeight": 1080, "maxDurationSeconds": 15}


@pytest.fixture(autouse=True)
def _use_deterministic_in_process_video_probe(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(local_dev, "_material_asset_ffprobe_path", lambda: None)


def _box(box_type: bytes, payload: bytes) -> bytes:
    return struct.pack(">I4s", len(payload) + 8, box_type) + payload


def _png(width: int, height: int) -> bytes:
    def chunk(chunk_type: bytes, payload: bytes) -> bytes:
        checksum = zlib.crc32(chunk_type + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + chunk_type + payload + struct.pack(">I", checksum)

    row = b"\x00" + bytes((width + 7) // 8)
    ihdr = struct.pack(">IIBBBBB", width, height, 1, 0, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(row * height))
        + chunk(b"IEND", b"")
    )


def _avif(width: int, height: int) -> bytes:
    ftyp = _box(b"ftyp", b"avif" + b"\x00\x00\x00\x00" + b"avif" + b"mif1")
    ispe = _box(b"ispe", b"\x00\x00\x00\x00" + struct.pack(">II", width, height))
    meta = _box(b"meta", b"\x00\x00\x00\x00" + _box(b"iprp", _box(b"ipco", ispe)))
    return ftyp + meta


def _mp4(width: int, height: int, duration_seconds: float) -> bytes:
    timescale = 1000
    duration = round(duration_seconds * timescale)
    full_header = b"\x00\x00\x00\x00"
    time_fields = b"\x00" * 8 + struct.pack(">II", timescale, duration)
    mvhd = _box(b"mvhd", full_header + time_fields)
    mdhd = _box(b"mdhd", full_header + time_fields)
    hdlr = _box(b"hdlr", full_header + b"\x00" * 4 + b"vide")
    tkhd = _box(b"tkhd", b"\x00" * 8 + struct.pack(">II", width << 16, height << 16))
    trak = _box(b"trak", tkhd + _box(b"mdia", mdhd + hdlr))
    return _box(b"ftyp", b"isom" + b"\x00\x00\x00\x00" + b"isom" + b"mp42") + _box(b"moov", mvhd + trak)


def _ebml_id(value: int) -> bytes:
    return value.to_bytes((value.bit_length() + 7) // 8, "big")


def _ebml_size(value: int) -> bytes:
    if value >= 127:
        raise ValueError("test fixture only supports single-byte EBML sizes")
    return bytes((0x80 | value,))


def _ebml_element(element_id: int, payload: bytes) -> bytes:
    return _ebml_id(element_id) + _ebml_size(len(payload)) + payload


def _uint_payload(value: int) -> bytes:
    return value.to_bytes(max(1, (value.bit_length() + 7) // 8), "big")


def _webm(width: int, height: int, duration_seconds: float) -> bytes:
    info = _ebml_element(0x2AD7B1, _uint_payload(1_000_000)) + _ebml_element(0x4489, struct.pack(">d", duration_seconds * 1000))
    video = _ebml_element(0xB0, _uint_payload(width)) + _ebml_element(0xBA, _uint_payload(height))
    track = _ebml_element(0x83, b"\x01") + _ebml_element(0xE0, video)
    segment = _ebml_element(0x1549A966, info) + _ebml_element(0x1654AE6B, _ebml_element(0xAE, track))
    return _ebml_element(0x1A45DFA3, b"") + _ebml_element(0x18538067, segment)


def test_image_dimensions_are_enforced_from_bytes():
    assert _material_asset_validate_content("image", "image/png", _png(2560, 2560), IMAGE_RULE) == {
        "width": 2560,
        "height": 2560,
    }
    with pytest.raises(HTTPException) as exc_info:
        _material_asset_validate_content("image", "image/png", _png(2561, 10), IMAGE_RULE)
    assert exc_info.value.status_code == 400


def test_avif_is_accepted_as_image_but_rejected_as_mp4_video():
    content = _avif(640, 480)
    assert _material_asset_signature_matches("image/avif", content)
    assert not _material_asset_signature_matches("video/mp4", content)
    assert _material_asset_probe_metadata("image", "image/avif", content) == {"width": 640, "height": 480}


@pytest.mark.parametrize("content", [_mp4(1921, 1080, 15), _mp4(1920, 1081, 15), _mp4(1920, 1080, 15.001)])
def test_mp4_dimensions_and_duration_cannot_exceed_contract(content: bytes):
    with pytest.raises(HTTPException) as exc_info:
        _material_asset_validate_content("video", "video/mp4", content, VIDEO_RULE)
    assert exc_info.value.status_code == 400


def test_mp4_at_contract_boundary_is_accepted():
    assert _material_asset_validate_content("video", "video/mp4", _mp4(1920, 1080, 15), VIDEO_RULE) == {
        "width": 1920,
        "height": 1080,
        "durationSeconds": 15.0,
    }


def test_webm_dimensions_and_duration_are_read_from_ebml_metadata():
    content = _webm(1280, 720, 12.5)
    assert _material_asset_signature_matches("video/webm", content)
    assert _material_asset_validate_content("video", "video/webm", content, VIDEO_RULE) == {
        "width": 1280,
        "height": 720,
        "durationSeconds": 12.5,
    }


def test_non_finite_webm_duration_is_rejected():
    with pytest.raises(HTTPException) as exc_info:
        _material_asset_validate_content("video", "video/webm", _webm(1280, 720, float("nan")), VIDEO_RULE)
    assert exc_info.value.status_code == 400


def test_audit_policy_uses_the_same_metadata_limits_as_uploads():
    assert _material_asset_metadata_policy_issues(
        {"width": 2000, "height": 1081, "durationSeconds": 15.1},
        VIDEO_RULE,
    ) == ["over-width-limit", "over-height-limit", "over-duration-limit"]


def _upload_file(name: str, mime_type: str, content: bytes) -> UploadFile:
    return UploadFile(
        BytesIO(content),
        filename=name,
        headers=Headers({"content-type": mime_type}),
    )


@pytest.mark.asyncio
async def test_direct_upload_api_cannot_bypass_image_dimension_policy(monkeypatch: pytest.MonkeyPatch):
    wrote_content = False

    def fail_if_written(*_args, **_kwargs):
        nonlocal wrote_content
        wrote_content = True

    monkeypatch.setattr(local_dev, "_write_material_asset_content_atomic", fail_if_written)
    with pytest.raises(HTTPException) as exc_info:
        await local_dev.upload_material_asset(_upload_file("oversized.png", "image/png", _png(2561, 100)))
    assert exc_info.value.status_code == 400
    assert not wrote_content


@pytest.mark.asyncio
async def test_direct_replace_api_cannot_bypass_video_duration_policy(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(local_dev, "_read_material_asset_index", lambda: [{
        "assetId": "existing",
        "fileName": "existing.mp4",
        "mimeType": "video/mp4",
        "relativePath": "files/existing.mp4",
    }])
    wrote_content = False

    def fail_if_written(*_args, **_kwargs):
        nonlocal wrote_content
        wrote_content = True

    monkeypatch.setattr(local_dev, "_write_material_asset_content_atomic", fail_if_written)
    with pytest.raises(HTTPException) as exc_info:
        await local_dev.replace_material_asset(
            "existing",
            _upload_file("replacement.mp4", "video/mp4", _mp4(1920, 1080, 15.5)),
        )
    assert exc_info.value.status_code == 400
    assert not wrote_content


def test_material_storage_path_cannot_escape_root(tmp_path, monkeypatch: pytest.MonkeyPatch):
    root = tmp_path / "materials"
    root.mkdir()
    monkeypatch.setattr(local_dev, "MATERIAL_ASSET_ROOT", root)
    assert local_dev._material_asset_storage_path("files/safe.png") == (root / "files" / "safe.png").resolve()
    with pytest.raises(HTTPException) as exc_info:
        local_dev._material_asset_storage_path("../outside.png")
    assert exc_info.value.status_code == 400
    with pytest.raises(HTTPException):
        local_dev._material_asset_storage_path(str((tmp_path / "absolute-outside.png").resolve()))


def test_ffprobe_is_timeout_bounded_and_network_protocols_are_disabled(tmp_path, monkeypatch: pytest.MonkeyPatch):
    fake_executable = tmp_path / "ffprobe.exe"
    fake_executable.write_bytes(b"")
    monkeypatch.setattr(local_dev, "_material_asset_ffprobe_path", lambda: str(fake_executable))
    captured: dict[str, object] = {}

    class Completed:
        returncode = 0
        stdout = '{"streams":[{"codec_type":"video","width":640,"height":360,"duration":"2.5"}],"format":{"duration":"2.5"}}'
        stderr = ""

    def fake_run(command, **kwargs):
        captured["command"] = command
        captured["kwargs"] = kwargs
        assert local_dev.Path(command[-1]).is_file()
        return Completed()

    monkeypatch.setattr(local_dev.subprocess, "run", fake_run)
    assert local_dev._probe_video_with_ffprobe("video/mp4", b"bounded-local-bytes") == (640, 360, 2.5)
    command = captured["command"]
    kwargs = captured["kwargs"]
    protocol_index = command.index("-protocol_whitelist")
    assert command[protocol_index + 1] == "file,pipe"
    assert kwargs["timeout"] == local_dev._MEDIA_METADATA_PROBE_TIMEOUT_SECONDS
    assert not local_dev.Path(command[-1]).exists()


@pytest.mark.asyncio
async def test_replace_commits_hash_path_before_index_and_then_cleans_old_revision(tmp_path, monkeypatch: pytest.MonkeyPatch):
    root = tmp_path / "materials"
    old_content = _png(100, 100)
    new_content = _png(101, 100)
    old_relative_path = "files/existing.png"
    old_path = root / old_relative_path
    old_path.parent.mkdir(parents=True)
    old_path.write_bytes(old_content)
    item = {
        "assetId": "existing",
        "fileName": "existing.png",
        "mimeType": "image/png",
        "sizeBytes": len(old_content),
        "createdAt": "2026-08-27T00:00:00Z",
        "updatedAt": "2026-08-27T00:00:00Z",
        "relativePath": old_relative_path,
        "contentHash": "0" * 64,
        "applyCount": 0,
    }
    items = [item]
    monkeypatch.setattr(local_dev, "MATERIAL_ASSET_ROOT", root)
    monkeypatch.setattr(local_dev, "_ensure_material_asset_storage", lambda: None)
    monkeypatch.setattr(local_dev, "_read_material_asset_index", lambda: items)
    monkeypatch.setattr(local_dev, "_read_material_asset_usage", lambda: {})

    committed_paths: list[str] = []

    def commit_index(candidate_items):
        next_relative_path = candidate_items[0]["relativePath"]
        next_path = local_dev._material_asset_storage_path(next_relative_path)
        assert next_path.read_bytes() == new_content
        assert old_path.read_bytes() == old_content
        committed_paths.append(next_relative_path)

    monkeypatch.setattr(local_dev, "_write_material_asset_index", commit_index)
    response = await local_dev.replace_material_asset(
        "existing",
        _upload_file("replacement.png", "image/png", new_content),
    )
    expected_hash = local_dev.hashlib.sha256(new_content).hexdigest()
    assert len(committed_paths) == 1
    assert expected_hash in committed_paths[0]
    assert response["publicUrl"].endswith(f"?v={expected_hash}")
    assert not old_path.exists()
    assert local_dev._material_asset_storage_path(committed_paths[0]).read_bytes() == new_content


@pytest.mark.asyncio
async def test_replace_index_failure_keeps_old_revision_and_removes_uncommitted_file(tmp_path, monkeypatch: pytest.MonkeyPatch):
    root = tmp_path / "materials"
    old_content = _png(80, 80)
    new_content = _png(81, 80)
    old_relative_path = "files/existing.png"
    old_path = root / old_relative_path
    old_path.parent.mkdir(parents=True)
    old_path.write_bytes(old_content)
    item = {
        "assetId": "existing",
        "fileName": "existing.png",
        "mimeType": "image/png",
        "sizeBytes": len(old_content),
        "createdAt": "2026-08-27T00:00:00Z",
        "updatedAt": "2026-08-27T00:00:00Z",
        "relativePath": old_relative_path,
        "contentHash": "0" * 64,
        "applyCount": 0,
    }
    items = [item]
    monkeypatch.setattr(local_dev, "MATERIAL_ASSET_ROOT", root)
    monkeypatch.setattr(local_dev, "_ensure_material_asset_storage", lambda: None)
    monkeypatch.setattr(local_dev, "_read_material_asset_index", lambda: items)
    monkeypatch.setattr(local_dev, "_write_material_asset_index", lambda _items: (_ for _ in ()).throw(OSError("index unavailable")))

    with pytest.raises(OSError, match="index unavailable"):
        await local_dev.replace_material_asset(
            "existing",
            _upload_file("replacement.png", "image/png", new_content),
        )
    assert old_path.read_bytes() == old_content
    assert item["relativePath"] == old_relative_path
    assert list((root / "files").iterdir()) == [old_path]
