"""Validate a credential-free HTTPS, DNS, and transactional-email contract."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]


def validate(contract: dict[str, object], *, allow_placeholders: bool = False) -> list[str]:
    errors: list[str] = []
    if contract.get("schema_version") != 1 or contract.get("environment") not in {"staging", "production"}:
        errors.append("schema_version and environment are required")
    url = urlsplit(str(contract.get("public_base_url", "")))
    if url.scheme != "https" or not url.hostname or "." not in url.hostname:
        errors.append("public_base_url must use a HTTPS FQDN")
    mail_domain = str(contract.get("mail_from_domain", "")).lower().strip()
    if not mail_domain or "." not in mail_domain or (url.hostname and not mail_domain.endswith(url.hostname.lower())):
        errors.append("mail_from_domain must be a subdomain of the public hostname")
    dns = contract.get("dns")
    if not isinstance(dns, dict):
        errors.append("dns settings are required")
    else:
        if not str(dns.get("spf", "")).lower().startswith("v=spf1") or not str(dns.get("spf", "")).rstrip().endswith(("-all", "~all")):
            errors.append("SPF must have a terminating all policy")
        if len(str(dns.get("dkim_selector", "")).strip()) < 2:
            errors.append("DKIM selector is required")
        if not str(dns.get("dmarc", "")).lower().startswith("v=dmarc1") or "p=none" in str(dns.get("dmarc", "")).lower():
            errors.append("DMARC must enforce quarantine or reject")
        if dns.get("caa_present") is not True:
            errors.append("CAA evidence is required")
    for field in ("mail_provider_secret_reference", "test_recipient_reference"):
        if not str(contract.get(field, "")).startswith("secret-manager:"):
            errors.append(f"{field} must be a secret-manager reference")
    if not allow_placeholders and "replace" in json.dumps(contract).lower():
        errors.append("live contract contains placeholders")
    return errors


def self_test() -> int:
    valid = {
        "schema_version": 1, "environment": "staging", "public_base_url": "https://staging.example.com", "mail_from_domain": "mail.staging.example.com",
        "dns": {"spf": "v=spf1 include:mail.example.net -all", "dkim_selector": "s1", "dmarc": "v=DMARC1; p=quarantine", "caa_present": True},
        "mail_provider_secret_reference": "secret-manager:staging/mail/provider", "test_recipient_reference": "secret-manager:staging/mail/test",
    }
    assert validate(valid) == []
    assert validate({**valid, "public_base_url": "http://staging.example.com"})
    assert validate({**valid, "dns": {**valid["dns"], "dmarc": "v=DMARC1; p=none"}})
    print("Domain and email contract: OK")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--contract", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    if not args.contract or not args.contract.is_file():
        parser.error("--contract must reference a credential-free live domain/email contract")
    errors = validate(json.loads(args.contract.read_text(encoding="utf-8")))
    if errors:
        print("Domain and email contract failed:\n" + "\n".join(f"- {error}" for error in errors))
        return 1
    print("Domain and email contract: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
