from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings
from app.core.exceptions import ValidationAppError


def _build_fernet() -> Fernet:
    key = settings.secret_key.encode("utf-8")
    if len(key) < 32:
        key = key.ljust(32, b"0")
    normalized = key[:32]
    return Fernet(_urlsafe_key(normalized))


def _urlsafe_key(raw: bytes) -> bytes:
    import base64

    return base64.urlsafe_b64encode(raw)


def encrypt_secret(value: str) -> str:
    if not value:
        raise ValidationAppError("API Key 不能为空", code=4004)
    return _build_fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: str) -> str:
    try:
        return _build_fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValidationAppError("API Key 解密失败，请检查 SECRET_KEY 是否一致", code=4004) from exc


def mask_secret(value: str) -> str:
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:3]}****{value[-4:]}"
