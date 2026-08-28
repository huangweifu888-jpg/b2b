from io import BytesIO

import pytest
from PIL import Image
from starlette.datastructures import Headers, UploadFile

import routers.local_dev as local_dev


def _png_bytes() -> bytes:
    image = Image.effect_noise((250, 250), 80).convert("RGB")
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def _upload_file(name: str, mime_type: str, content: bytes) -> UploadFile:
    return UploadFile(
        BytesIO(content),
        filename=name,
        headers=Headers({"content-type": mime_type}),
    )


@pytest.fixture
def isolated_material_library(tmp_path, monkeypatch: pytest.MonkeyPatch):
    root = tmp_path / "materials"
    monkeypatch.setattr(local_dev, "MATERIAL_ASSET_ROOT", root)
    monkeypatch.setattr(local_dev, "MATERIAL_ASSET_FILE_ROOT", root / "files")
    monkeypatch.setattr(local_dev, "MATERIAL_ASSET_INDEX_PATH", root / "_material_index.json")
    monkeypatch.setattr(local_dev, "MATERIAL_ASSET_USAGE_PATH", root / "_material_usage.json")
    monkeypatch.setattr(
        local_dev,
        "MATERIAL_ASSET_BUILTIN_AVATAR_SEED_MARKER_PATH",
        root / "_customer_service_builtin_avatars_seeded.json",
    )
    return root


@pytest.mark.asyncio
async def test_upload_keeps_only_webp_and_reuses_identical_content(isolated_material_library):
    source = _png_bytes()
    first = await local_dev.upload_material_asset(_upload_file("expert.png", "image/png", source))
    second = await local_dev.upload_material_asset(_upload_file("same-expert.png", "image/png", source))

    assert first["mediaMimeType"] == "image/webp"
    assert first["fileName"] == "expert.webp"
    assert first["optimization"]["status"] == "optimized"
    assert first["optimization"]["originalRetained"] is False
    assert second["deduplicated"] is True
    assert second["assetId"] == first["assetId"]
    assert second["optimization"]["status"] == "deduplicated"

    items = local_dev._read_material_asset_index()
    stored_files = list((isolated_material_library / "files").iterdir())
    assert len(items) == 1
    assert len(stored_files) == 1
    assert stored_files[0].suffix == ".webp"
    assert not list((isolated_material_library / "files").glob("*.png"))


@pytest.mark.asyncio
async def test_upload_does_not_reuse_stale_hash_when_stored_bytes_are_corrupt(isolated_material_library):
    source = _png_bytes()
    first = await local_dev.upload_material_asset(_upload_file("expert.png", "image/png", source))
    first_item = local_dev._read_material_asset_index()[0]
    first_path = local_dev._material_asset_storage_path(first_item["relativePath"])
    first_path.write_bytes(b"x" * first_path.stat().st_size)

    second = await local_dev.upload_material_asset(_upload_file("same-expert.png", "image/png", source))

    assert second["deduplicated"] is False
    assert second["assetId"] != first["assetId"]
    assert len(local_dev._read_material_asset_index()) == 2
    assert len(list((isolated_material_library / "files").iterdir())) == 2


def test_cleanup_preserves_equivalent_referenced_path(isolated_material_library):
    local_dev._ensure_material_asset_storage()
    stored = isolated_material_library / "files" / "shared.webp"
    stored.write_bytes(b"shared")

    local_dev._remove_material_asset_file_if_unreferenced(
        "files/shared.webp",
        [{"relativePath": "files/./shared.webp"}],
    )

    assert stored.is_file()


@pytest.mark.asyncio
async def test_delete_normalizes_asset_id_before_filtering_index(isolated_material_library):
    created = await local_dev.upload_material_asset(_upload_file("expert.png", "image/png", _png_bytes()))
    response = await local_dev.delete_material_asset(f"  {created['assetId']}  ")

    assert response == {"deleted": True, "assetId": created["assetId"]}
    assert local_dev._read_material_asset_index() == []
    assert list((isolated_material_library / "files").iterdir()) == []


def test_fresh_builtin_avatar_seed_uses_only_verified_webp(isolated_material_library):
    local_dev._ensure_customer_service_builtin_avatar_materials()

    items = local_dev._read_material_asset_index()
    assert len(items) == 9
    assert all(item["mimeType"] == "image/webp" for item in items)
    assert all(item["fileName"].endswith(".webp") for item in items)
    assert all(item["contentHash"] for item in items)
    assert all(item["optimization"]["originalRetained"] is False for item in items)
    assert len(list((isolated_material_library / "files").glob("*.webp"))) == 9
    assert not list((isolated_material_library / "files").glob("*.png"))


@pytest.mark.asyncio
async def test_safe_existing_material_run_previews_then_atomically_removes_png(
    isolated_material_library,
    monkeypatch: pytest.MonkeyPatch,
):
    local_dev._ensure_material_asset_storage()
    source = _png_bytes()
    old_relative_path = "files/customer-service-avatar-expert-07.png"
    old_path = isolated_material_library / old_relative_path
    old_path.write_bytes(source)
    local_dev._write_material_asset_index([{
        "assetId": "customer-service-avatar-expert-07",
        "fileName": "07.us-expert.png",
        "mimeType": "image/png",
        "sizeBytes": len(source),
        "createdAt": "2026-08-28T00:00:00Z",
        "updatedAt": "2026-08-28T00:00:00Z",
        "relativePath": old_relative_path,
        "contentHash": local_dev.hashlib.sha256(source).hexdigest(),
        "seededCustomerServiceAvatar": True,
        "applyCount": 0,
    }])
    monkeypatch.setattr(local_dev, "_ensure_customer_service_builtin_avatar_materials", lambda: None)

    preview = await local_dev.run_material_asset_optimization(
        local_dev.MaterialAssetOptimizationRunPayload(dryRun=True, safeTestAssetsOnly=True)
    )
    assert preview["summary"]["candidateCount"] == 1
    assert preview["summary"]["potentialSavedBytes"] > 0
    assert old_path.is_file()

    result = await local_dev.run_material_asset_optimization(
        local_dev.MaterialAssetOptimizationRunPayload(dryRun=False, safeTestAssetsOnly=True)
    )
    assert result["run"]["optimizedCount"] == 1
    assert result["run"]["savedBytes"] > 0
    assert result["summary"]["candidateCount"] == 0
    assert not old_path.exists()

    item = local_dev._read_material_asset_index()[0]
    next_path = local_dev._material_asset_storage_path(item["relativePath"])
    assert item["fileName"] == "07.us-expert.webp"
    assert item["mimeType"] == "image/webp"
    assert item["optimization"]["originalRetained"] is False
    assert next_path.is_file()
    assert next_path.suffix == ".webp"
