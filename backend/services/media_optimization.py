from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps, UnidentifiedImageError, features


class MediaOptimizationError(ValueError):
    """Raised when uploaded image bytes cannot be decoded safely."""


@dataclass(frozen=True)
class MediaOptimizationResult:
    content: bytes
    file_name: str
    mime_type: str
    suffix: str
    status: str
    original_size_bytes: int
    optimized_size_bytes: int
    original_mime_type: str

    @property
    def space_saved_bytes(self) -> int:
        return max(0, self.original_size_bytes - self.optimized_size_bytes)

    @property
    def savings_ratio(self) -> float:
        if self.original_size_bytes <= 0:
            return 0.0
        return self.space_saved_bytes / self.original_size_bytes

    def metadata(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "originalSizeBytes": self.original_size_bytes,
            "optimizedSizeBytes": self.optimized_size_bytes,
            "spaceSavedBytes": self.space_saved_bytes,
            "savingsRatio": round(self.savings_ratio, 6),
            "originalMimeType": self.original_mime_type,
            "outputMimeType": self.mime_type,
            "originalRetained": False,
        }


def _passthrough_result(
    *,
    file_name: str,
    mime_type: str,
    suffix: str,
    content: bytes,
    status: str,
) -> MediaOptimizationResult:
    return MediaOptimizationResult(
        content=content,
        file_name=file_name,
        mime_type=mime_type,
        suffix=suffix,
        status=status,
        original_size_bytes=len(content),
        optimized_size_bytes=len(content),
        original_mime_type=mime_type,
    )


def optimize_media_content(
    *,
    file_name: str,
    kind: str,
    mime_type: str,
    suffix: str,
    content: bytes,
    contract: dict[str, Any],
) -> MediaOptimizationResult:
    """Return the single durable representation selected by the shared contract.

    Upload bytes stay in memory while the candidate is encoded and verified. The
    caller persists only ``result.content``; there is no second original file.
    """
    if kind != "image":
        return _passthrough_result(
            file_name=file_name,
            mime_type=mime_type,
            suffix=suffix,
            content=content,
            status="preferred-delivery-format" if kind == "video" else "passthrough",
        )

    image_policy = contract.get("optimization", {}).get("image", {})
    convert_mime_types = {
        str(value).strip().lower()
        for value in image_policy.get("convertMimeTypes", [])
        if str(value).strip()
    }
    normalized_mime_type = str(mime_type or "").strip().lower()
    if normalized_mime_type not in convert_mime_types:
        return _passthrough_result(
            file_name=file_name,
            mime_type=normalized_mime_type,
            suffix=suffix,
            content=content,
            status="kept-preferred-format",
        )
    if not features.check("webp"):
        return _passthrough_result(
            file_name=file_name,
            mime_type=normalized_mime_type,
            suffix=suffix,
            content=content,
            status="kept-encoder-unavailable",
        )

    try:
        with Image.open(BytesIO(content)) as source:
            if bool(getattr(source, "is_animated", False)) and int(getattr(source, "n_frames", 1)) > 1:
                return _passthrough_result(
                    file_name=file_name,
                    mime_type=normalized_mime_type,
                    suffix=suffix,
                    content=content,
                    status="kept-animated-source",
                )
            normalized = ImageOps.exif_transpose(source)
            normalized.load()
            has_alpha = "A" in normalized.getbands() or "transparency" in normalized.info
            prepared = normalized.convert("RGBA" if has_alpha else "RGB")
            output = BytesIO()
            quality_value = float(image_policy.get("quality", 0.82))
            quality = max(1, min(100, round(quality_value * 100 if quality_value <= 1 else quality_value)))
            method = max(0, min(6, int(image_policy.get("encoderMethod", 6))))
            prepared.save(output, format="WEBP", quality=quality, method=method)
            optimized = output.getvalue()
    except (OSError, UnidentifiedImageError, ValueError) as exc:
        raise MediaOptimizationError("图片内容无法完成安全优化") from exc

    try:
        with Image.open(BytesIO(optimized)) as verification:
            verification.verify()
    except (OSError, UnidentifiedImageError, ValueError) as exc:
        raise MediaOptimizationError("优化后的图片校验失败") from exc

    minimum_savings_ratio = max(
        0.0,
        min(0.95, float(contract.get("storageLifecycle", {}).get("minimumSavingsRatio", 0.1))),
    )
    savings_ratio = (len(content) - len(optimized)) / len(content) if content else 0.0
    if savings_ratio < minimum_savings_ratio:
        return _passthrough_result(
            file_name=file_name,
            mime_type=normalized_mime_type,
            suffix=suffix,
            content=content,
            status="kept-no-size-benefit",
        )

    output_mime_type = str(image_policy.get("outputMimeType") or "image/webp").strip().lower()
    output_suffix = str(image_policy.get("outputExtension") or ".webp").strip().lower()
    output_name = f"{Path(file_name).stem or 'image'}{output_suffix}"
    return MediaOptimizationResult(
        content=optimized,
        file_name=output_name,
        mime_type=output_mime_type,
        suffix=output_suffix,
        status="optimized",
        original_size_bytes=len(content),
        optimized_size_bytes=len(optimized),
        original_mime_type=normalized_mime_type,
    )
