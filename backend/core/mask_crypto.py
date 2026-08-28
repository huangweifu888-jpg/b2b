# Used to conceal LLM access
import base64
import hashlib
import os

from cryptography.fernet import Fernet

key_prefix = "mgxkey-"


def _derive_fernet_key(key_material: str) -> bytes:
    """Derive a valid Fernet key from arbitrary string using SHA-256 and urlsafe base64."""
    digest = hashlib.sha256(key_material.encode("utf-8")).digest()  # 32 bytes
    return base64.urlsafe_b64encode(digest)


def _get_fernet(key_str: str) -> Fernet:
    key = _derive_fernet_key(key_str)
    return Fernet(key)


def _mask_key() -> str:
    key = os.environ.get("MASK_KEY", "").strip()
    if key:
        return key
    if os.environ.get("ENVIRONMENT", "dev").strip().lower() in {"dev", "development", "local", "test", "testing"}:
        return "local-development-mask-key-not-for-production"
    raise ValueError("MASK_KEY is required outside local development")


def encrypt_text(plain: str) -> str:
    pwd = _mask_key()
    f = _get_fernet(pwd)
    return key_prefix + f.encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_text(token: str) -> str:
    pwd = _mask_key()
    f = _get_fernet(pwd)
    token = token.removeprefix(key_prefix)
    return f.decrypt(token.encode("utf-8")).decode("utf-8")
