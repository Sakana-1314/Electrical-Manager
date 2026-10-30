from __future__ import annotations

import logging

from pytest import LogCaptureFixture
from sqlalchemy.exc import OperationalError, ProgrammingError, SQLAlchemyError, TimeoutError
from starlette.requests import Request

from app.core.exception_handlers import (
    handle_database_error,
    handle_database_programming_error,
    handle_database_unavailable,
)


def request_with_id(request_id: str = "request-123") -> Request:
    request = Request({"type": "http", "method": "GET", "path": "/test", "headers": []})
    request.state.request_id = request_id
    return request


async def test_programming_error_is_not_reported_as_database_unavailable(
    caplog: LogCaptureFixture,
) -> None:
    error = ProgrammingError("SELECT usage FROM purchase_material", {}, Exception("syntax"))

    with caplog.at_level(logging.ERROR, logger="spare_parts.api"):
        response = await handle_database_programming_error(request_with_id(), error)

    assert response.status_code == 500
    assert b'"code":"DATABASE_QUERY_ERROR"' in response.body
    assert "database query error request_id=request-123" in caplog.text
    assert "sqlalchemy.exc.ProgrammingError" in caplog.text


async def test_database_timeout_is_reported_as_unavailable() -> None:
    response = await handle_database_unavailable(request_with_id(), TimeoutError("pool timeout"))

    assert response.status_code == 503
    assert b'"code":"DATABASE_UNAVAILABLE"' in response.body


class PostgreSQLError(Exception):
    """模拟 asyncpg 原始异常：带 SQLSTATE（如 42703 未定义列）。"""

    def __init__(self, sqlstate: str, message: str) -> None:
        super().__init__(message)
        self.sqlstate = sqlstate
        self.pgcode = sqlstate


async def test_postgresql_unknown_column_operational_error_is_reported_as_query_error() -> None:
    error = OperationalError(
        "SELECT material_code FROM purchase_request",
        {},
        PostgreSQLError("42703", 'column "material_code" does not exist'),
    )

    response = await handle_database_unavailable(request_with_id(), error)

    assert response.status_code == 500
    assert b'"code":"DATABASE_QUERY_ERROR"' in response.body


async def test_postgresql_syntax_error_operational_error_is_reported_as_query_error() -> None:
    error = OperationalError(
        "SELECT FROM",
        {},
        PostgreSQLError("42601", 'syntax error at or near "FROM"'),
    )

    response = await handle_database_unavailable(request_with_id(), error)

    assert response.status_code == 500
    assert b'"code":"DATABASE_QUERY_ERROR"' in response.body


async def test_postgresql_connection_error_is_reported_as_unavailable() -> None:
    error = OperationalError(
        "SELECT 1",
        {},
        PostgreSQLError("08006", "connection to server at 127.0.0.1 failed"),
    )

    response = await handle_database_unavailable(request_with_id(), error)

    assert response.status_code == 503
    assert b'"code":"DATABASE_UNAVAILABLE"' in response.body


async def test_other_sqlalchemy_errors_are_internal_database_errors() -> None:
    response = await handle_database_error(request_with_id(), SQLAlchemyError("bad state"))

    assert response.status_code == 500
    assert b'"code":"DATABASE_ERROR"' in response.body
