import json
from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image

from services.media_optimization import MediaOptimizationError, optimize_media_content


PROJECT_ROOT = Path(__file__).resolve().parents[2]
CONTRACT = json.loads(
    (PROJECT_ROOT / "shared" / "contracts" / "media-optimization-contract.json").read_text(encoding="utf-8")
)


def _png_bytes(width: int = 250, height: int = 250) -> bytes:
    image = Image.effect_noise((width, height), 80).convert("RGB")
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def test_png_is_replaced_by_one_verified_webp_when_savings_clear_threshold():
    content = _png_bytes()
    result = optimize_media_content(
        file_name="expert.png",
        kind="image",
        mime_type="image/png",
        suffix=".png",
        content=content,
        contract=CONTRACT,
    )

    assert result.status == "optimized"
    assert result.file_name == "expert.webp"
    assert result.mime_type == "image/webp"
    assert result.suffix == ".webp"
    assert result.savings_ratio >= CONTRACT["storageLifecycle"]["minimumSavingsRatio"]
    assert result.metadata()["originalRetained"] is False
    with Image.open(BytesIO(result.content)) as image:
        assert image.format == "WEBP"
        assert image.size == (250, 250)


def test_preferred_webp_is_not_reencoded_or_duplicated():
    original = optimize_media_content(
        file_name="expert.png",
        kind="image",
        mime_type="image/png",
        suffix=".png",
        content=_png_bytes(),
        contract=CONTRACT,
    )
    result = optimize_media_content(
        file_name=original.file_name,
        kind="image",
        mime_type=original.mime_type,
        suffix=original.suffix,
        content=original.content,
        contract=CONTRACT,
    )

    assert result.status == "kept-preferred-format"
    assert result.content == original.content
    assert result.space_saved_bytes == 0


def test_video_is_kept_in_preferred_delivery_format_without_browser_transcode():
    content = b"bounded-video-bytes"
    result = optimize_media_content(
        file_name="avatar.mp4",
        kind="video",
        mime_type="video/mp4",
        suffix=".mp4",
        content=content,
        contract=CONTRACT,
    )

    assert result.status == "preferred-delivery-format"
    assert result.content == content
    assert result.metadata()["originalRetained"] is False


def test_corrupt_image_is_rejected_instead_of_persisted():
    with pytest.raises(MediaOptimizationError, match="无法完成安全优化"):
        optimize_media_content(
            file_name="broken.png",
            kind="image",
            mime_type="image/png",
            suffix=".png",
            content=b"not-a-real-png",
            contract=CONTRACT,
        )
