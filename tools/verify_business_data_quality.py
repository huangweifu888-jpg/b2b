"""Exercise required fields, duplicate detection, and safe public links."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from services.data_quality import validate_batch, validate_record  # noqa: E402


def main() -> int:
    assert not validate_record("company", {"legal_name": "Trade Co", "contact_email": "ops@trade.example", "country": "CN"})
    assert validate_record("social", {"channel": "LinkedIn", "account_url": "http://linkedin.com/company/trade"})
    assert validate_record("seo", {"page_path": "products", "title": "Products", "description": "Catalog"})
    products = validate_batch("product", [
        {"title": "Valve", "sku": "V-1", "description": "Industrial valve"},
        {"title": "Valve duplicate", "sku": "V-1", "description": "Duplicate SKU"},
    ], unique_field="sku")
    assert not products["valid"] and products["duplicates"] == ["v-1"]
    assert not validate_record("crm", {"customer_name": "Buyer", "owner_id": "sales-1", "stage": "qualified"})
    print("Business data quality rules: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
