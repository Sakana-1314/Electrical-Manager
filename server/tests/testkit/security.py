"""与服务端一致的口令哈希、令牌签发与 Fernet 加密（造种子数据时使用）。"""

from __future__ import annotations

import base64
import hashlib
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from cryptography.fernet import Fernet

from tests.testkit import settings

_password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def fernet() -> Fernet:
    """优先用独立的 Fernet 密钥，未配置时由 JWT 密钥派生（都经 SHA-256 固定为 32 字节）。"""
    secret = settings.FERNET_KEY or settings.JWT_SECRET
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(value: str) -> str:
    return fernet().encrypt(value.encode("utf-8")).decode("ascii")


def _token(subject: int | str, token_type: str, expires_minutes: int, **claims: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(subject),
        "token_type": token_type,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
        **claims,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_mini_program_access_token(user_id: int) -> str:
    return _token(user_id, "mini_program", settings.ACCESS_TOKEN_MINUTES)


def create_mini_program_registration_token(app_id: str, openid: str) -> str:
    return _token(openid, "mini_program_registration", 10, app_id=app_id)
