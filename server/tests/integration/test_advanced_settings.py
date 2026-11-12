from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, project_session
from tests.testkit.models import SystemSetting


@pytest.mark.asyncio
async def test_advanced_settings_permissions_and_round_trip(client: AsyncClient) -> None:
    unauthorized = await client.get("/api/v1/system-settings/advanced-settings")
    assert unauthorized.status_code == 401

    readonly = await auth_headers(client, "readonly")
    forbidden = await client.get(
        "/api/v1/system-settings/advanced-settings", headers=readonly
    )
    assert forbidden.status_code == 403

    admin = await auth_headers(client, "admin")
    initial = await client.get(
        "/api/v1/system-settings/advanced-settings", headers=admin
    )
    assert initial.status_code == 200, initial.text
    assert initial.json() == {
        "mini_program_registration_enabled": True,
        "mini_program_new_user_enabled": True,
        "secondary_warehouse_mode": "full",
        "default_permissions": ["warehouse:read", "purchase:read", "huaxing:read"],
        "updated_at": None,
        "version": 0,
    }

    saved = await client.put(
        "/api/v1/system-settings/advanced-settings",
        headers=admin,
        json={
            "mini_program_registration_enabled": False,
            "mini_program_new_user_enabled": False,
            "secondary_warehouse_mode": "lite",
            "version": 0,
        },
    )
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert body["mini_program_registration_enabled"] is False
    assert body["mini_program_new_user_enabled"] is False
    assert body["secondary_warehouse_mode"] == "lite"
    assert body["version"] == 1
    assert body["updated_at"] is not None

    public_features = await client.get(
        "/api/v1/system-settings/mini-program-features"
    )
    assert public_features.json() == {"secondary_warehouse_mode": "lite"}

    invalid = await client.put(
        "/api/v1/system-settings/advanced-settings",
        headers=admin,
        json={
            "mini_program_registration_enabled": True,
            "mini_program_new_user_enabled": True,
            "secondary_warehouse_mode": "bogus",
            "version": 1,
        },
    )
    assert invalid.status_code == 422
    assert invalid.json()["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_advanced_settings_reads_legacy_ai_search_config(client: AsyncClient) -> None:
    """旧库升级前三个字段仍能读到；首次保存写入新的 runtime_settings。"""
    admin = await auth_headers(client, "admin")
    async with project_session() as session:
        session.add(
            SystemSetting(
                setting_key="ai_search_config",
                setting_value={
                    "mini_program_registration_enabled": False,
                    "mini_program_new_user_enabled": False,
                    "secondary_warehouse_mode": "lite",
                    "endpoint": "https://legacy.test/v1",
                    "web_features": {"work": False},
                },
                version=4,
            )
        )
        await session.commit()

    loaded = await client.get(
        "/api/v1/system-settings/advanced-settings", headers=admin
    )
    assert loaded.status_code == 200, loaded.text
    assert loaded.json()["mini_program_registration_enabled"] is False
    assert loaded.json()["mini_program_new_user_enabled"] is False
    assert loaded.json()["secondary_warehouse_mode"] == "lite"
    assert loaded.json()["version"] == 4

    saved = await client.put(
        "/api/v1/system-settings/advanced-settings",
        headers=admin,
        json={
            "mini_program_registration_enabled": True,
            "mini_program_new_user_enabled": True,
            "secondary_warehouse_mode": "full",
            "version": 4,
        },
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["version"] == 5

    async with project_session() as session:
        row = await session.get(SystemSetting, "runtime_settings")
        assert row is not None
        assert row.setting_value["secondary_warehouse_mode"] == "full"
        assert row.version == 5


@pytest.mark.asyncio
async def test_default_permissions_apply_to_new_users_and_validate_keys(
    client: AsyncClient,
) -> None:
    """默认用户权限可在高级设置里配置，新建用户未显式传权限时使用它。"""
    admin = await auth_headers(client, "admin")
    current = await client.get(
        "/api/v1/system-settings/advanced-settings", headers=admin
    )
    saved = await client.put(
        "/api/v1/system-settings/advanced-settings",
        headers=admin,
        json={
            "mini_program_registration_enabled": True,
            "mini_program_new_user_enabled": True,
            "secondary_warehouse_mode": "full",
            "default_permissions": ["warehouse:read", "purchase:read"],
            "version": current.json()["version"],
        },
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["default_permissions"] == ["warehouse:read", "purchase:read"]

    created = await client.post(
        "/api/v1/users",
        headers=admin,
        json={
            "username": "default-perm-user",
            "password": "123456",
            "display_name": "默认权限用户",
            "enabled": True,
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["permissions"] == ["warehouse:read", "purchase:read"]

    invalid = await client.put(
        "/api/v1/system-settings/advanced-settings",
        headers=admin,
        json={
            "mini_program_registration_enabled": True,
            "mini_program_new_user_enabled": True,
            "secondary_warehouse_mode": "full",
            "default_permissions": ["bogus:read"],
            "version": saved.json()["version"],
        },
    )
    assert invalid.status_code == 422
    assert invalid.json()["code"] == "INVALID_PERMISSIONS"
