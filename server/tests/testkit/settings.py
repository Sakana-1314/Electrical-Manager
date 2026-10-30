"""被测服务的连接配置（环境变量由 tools/run_contract_tests.sh 设置）。

- API_BASE_URL：被测服务地址，如 http://127.0.0.1:18080
- API_DATABASE_URL：被测服务使用的 PostgreSQL（SQLAlchemy 异步 URL：postgresql+asyncpg://…）
- API_UPLOAD_DIR：被测服务的上传目录（附件用例要核对磁盘文件）
- API_JWT_SECRET / API_FERNET_KEY：与服务端一致的 JWT 密钥与 Fernet 密钥（直接签发令牌、
  加密种子数据时使用），默认值与 run_contract_tests.sh 一致
"""

from __future__ import annotations

import os
from pathlib import Path

API_BASE_URL = os.environ.get("API_BASE_URL", "").rstrip("/")
API_DATABASE_URL = os.environ.get("API_DATABASE_URL", "")
API_UPLOAD_DIR = Path(os.environ["API_UPLOAD_DIR"]) if os.environ.get("API_UPLOAD_DIR") else None
JWT_SECRET = os.environ.get("API_JWT_SECRET", "test-secret-that-is-long-enough-123456")
FERNET_KEY = os.environ.get("API_FERNET_KEY", "")

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 30


def missing_settings() -> list[str]:
    """契约测试必需而未设置的环境变量（为空表示可以运行）。"""
    required = {
        "API_BASE_URL": API_BASE_URL,
        "API_DATABASE_URL": API_DATABASE_URL,
        "API_UPLOAD_DIR": API_UPLOAD_DIR,
    }
    return [name for name, value in required.items() if not value]


def upload_dir() -> Path:
    assert API_UPLOAD_DIR is not None, "API_UPLOAD_DIR 未设置"
    return API_UPLOAD_DIR
