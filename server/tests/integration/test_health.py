from __future__ import annotations

from httpx import AsyncClient

# 数据库不可用时返回 503 DATABASE_UNAVAILABLE、访问日志取代理头里的真实 IP，
# 需要替换服务内部依赖或读取进程日志，由 Go 单测覆盖（internal/app/health_test.go、
# internal/middleware/middleware_test.go）。


async def test_health_checks_database(client: AsyncClient) -> None:
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}
