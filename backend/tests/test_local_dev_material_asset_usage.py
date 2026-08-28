from routers.local_dev import _material_asset_source_belongs_to_namespace


def test_product_market_legacy_usage_keys_belong_to_product_market_namespace():
    assert _material_asset_source_belongs_to_namespace(
        "product-market-config:hq:default",
        {},
        "product-market",
    )
    assert _material_asset_source_belongs_to_namespace(
        "product-market-live-store",
        {},
        "product-market",
    )


def test_explicit_material_usage_namespace_takes_priority_over_legacy_prefixes():
    assert _material_asset_source_belongs_to_namespace(
        "site_56",
        {"sourceNamespace": "website-content"},
        "website-content",
    )
    assert not _material_asset_source_belongs_to_namespace(
        "product-market-config:hq:current",
        {"sourceNamespace": "another-producer"},
        "product-market",
    )

