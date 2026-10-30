from __future__ import annotations

import re
from pathlib import Path

from sqlalchemy import Enum
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

import app.models  # noqa: F401
from app.core.database import Base

INIT_SQL = Path(__file__).parents[2] / "docs" / "references" / "database" / "init.sql"
CREATE_TABLE = "CREATE TABLE IF NOT EXISTS "
CREATE_TYPE = re.compile(
    r"CREATE TYPE (\w+) AS ENUM \((.*?)\);", re.DOTALL
)
CREATE_INDEX = re.compile(
    r"CREATE INDEX IF NOT EXISTS (\w+)\s+ON\s+(\w+)\s+\(([^)]*)\)", re.DOTALL
)
IDENTIFIER = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def _sql() -> str:
    return INIT_SQL.read_text(encoding="utf-8")


def _read_identifier(sql: str, start: int) -> tuple[str, int]:
    """读取 `start` 处的标识符，允许双引号包裹（`"user"` 是保留字，建表必须加引号）。"""
    if sql[start] == '"':
        end = sql.index('"', start + 1)
        return sql[start + 1 : end], end + 1
    match = IDENTIFIER.match(sql, start)
    assert match is not None, f"无法解析标识符：{sql[start:start + 30]!r}"
    return match.group(0), match.end()


def _table_blocks() -> dict[str, str]:
    """按括号配对提取每张表的列/约束定义（CHECK、FK 内部还有括号，不能用正则一刀切）。"""
    sql = _sql()
    blocks: dict[str, str] = {}
    position = 0
    while True:
        start = sql.find(CREATE_TABLE, position)
        if start < 0:
            break
        name, cursor = _read_identifier(sql, start + len(CREATE_TABLE))
        while sql[cursor].isspace():
            cursor += 1
        assert sql[cursor] == "(", f"{name} 的建表语句格式不符合预期"
        depth = 0
        index = cursor
        while index < len(sql):
            char = sql[index]
            if char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
                if depth == 0:
                    break
            index += 1
        blocks[name] = sql[cursor + 1 : index]
        position = index + 1
    return blocks


def _column_definitions(block: str) -> dict[str, str]:
    definitions: dict[str, str] = {}
    for line in block.splitlines():
        if not line.startswith("  ") or line.startswith("   "):
            continue
        content = line[2:]
        if content.startswith('"'):
            end = content.index('"', 1)
            column = content[1:end]
            rest = content[end + 1 :]
        else:
            match = IDENTIFIER.match(content)
            if match is None:
                continue
            column = match.group(0)
            rest = content[match.end() :]
        if not rest.strip():
            continue
        definitions[column] = rest.strip()
    return definitions


def _column_definition(block: str, column: str) -> str:
    definitions = _column_definitions(block)
    assert column in definitions, f"init.sql 中缺少列定义：{column}"
    return definitions[column]


def _enum_types() -> dict[str, list[str]]:
    return {
        name: re.findall(r"'([^']*)'", values)
        for name, values in CREATE_TYPE.findall(_sql())
    }


def _indexes() -> dict[str, dict[str, list[str]]]:
    indexes: dict[str, dict[str, list[str]]] = {}
    for name, table, columns in CREATE_INDEX.findall(_sql()):
        indexes.setdefault(table, {})[name] = [
            column.strip().strip('"') for column in columns.split(",") if column.strip()
        ]
    return indexes


def test_init_sql_matches_current_model_schema() -> None:
    blocks = _table_blocks()
    model_tables = {table.name: table for table in Base.metadata.sorted_tables}
    enum_types = _enum_types()

    assert set(blocks) == set(model_tables)

    sql_indexes = _indexes()
    for table_name, table in model_tables.items():
        block = blocks[table_name]
        definitions = _column_definitions(block)
        # 去掉约束行（CONSTRAINT / PRIMARY KEY / FOREIGN KEY / UNIQUE / CHECK），只留列定义
        sql_columns = {
            name
            for name in definitions
            if name
            not in {"CONSTRAINT", "PRIMARY", "FOREIGN", "UNIQUE", "CHECK", "INDEX", "EXCLUDE"}
        }
        assert sql_columns == set(table.columns.keys()), f"{table_name} 的列与 ORM 不一致"

        sql_constraint_names = set(re.findall(r"CONSTRAINT (\w+)", block))
        model_ddl = str(CreateTable(table).compile(dialect=postgresql.dialect()))
        model_constraint_names = set(re.findall(r"CONSTRAINT (\w+)", model_ddl))
        assert sql_constraint_names == model_constraint_names, (
            f"{table_name} 的约束与 ORM 不一致："
            f"init.sql 多 {sorted(sql_constraint_names - model_constraint_names)}，"
            f"init.sql 少 {sorted(model_constraint_names - sql_constraint_names)}"
        )

        sql_table_indexes = sql_indexes.get(table_name, {})
        model_index_names = {index.name for index in table.indexes}
        assert set(sql_table_indexes) == model_index_names, (
            f"{table_name} 的索引与 ORM 不一致："
            f"init.sql 多 {sorted(set(sql_table_indexes) - model_index_names)}，"
            f"init.sql 少 {sorted(model_index_names - set(sql_table_indexes))}"
        )
        for index in table.indexes:
            assert sql_table_indexes[index.name] == [column.name for column in index.columns], (
                f"{table_name}.{index.name} 的索引列与 ORM 不一致"
            )

        for column in table.columns:
            definition = _column_definition(block, column.name)
            assert ("NOT NULL" in definition) is (not column.nullable), (
                f"{table_name}.{column.name} 的 NULL 约束与 ORM 不一致"
            )
            if isinstance(column.type, Enum):
                type_name = column.type.name
                assert type_name in enum_types, f"init.sql 缺少枚举类型：{type_name}"
                assert definition.startswith(type_name), (
                    f"{table_name}.{column.name} 的枚举类型应为 {type_name}"
                )
                assert enum_types[type_name] == list(column.type.enums), (
                    f"{table_name}.{column.name} 的 ENUM 值与 ORM 不一致"
                )

        sql_foreign_keys = {
            (column, target_table, target_column, (on_delete or "").upper() or None)
            for column, target_table, target_column, on_delete in re.findall(
                r'FOREIGN KEY \("?([^")\s]+)"?\) REFERENCES "?([^"\s(]+)"? \("?([^")\s]+)"?\)'
                r"(?: ON DELETE ([A-Z]+(?: [A-Z]+)?))?",
                block,
            )
        }
        model_foreign_keys = {
            (
                fk.parent.name,
                fk.column.table.name,
                fk.column.name,
                (fk.ondelete or "").upper() or None,
            )
            for fk in table.foreign_keys
        }
        assert sql_foreign_keys == model_foreign_keys, f"{table_name} 的外键与 ORM 不一致"


def test_init_sql_seeds_required_accounts() -> None:
    sql = _sql()

    for username in ("admin", "warehouse", "purchase", "readonly"):
        assert f"('{username}', '$argon2id$" in sql
    assert "gen_random_uuid()" in sql
    assert "measurement_unit" not in sql


def test_file_identifiers_are_uuid_strings() -> None:
    blocks = _table_blocks()

    assert _column_definition(blocks["file_object"], "id").startswith("VARCHAR(36) NOT NULL")
    assert _column_definition(blocks["stock_material_image"], "file_id").startswith(
        "VARCHAR(36) NOT NULL"
    )
    assert _column_definition(blocks["purchase_material_image"], "file_id").startswith(
        "VARCHAR(36) NOT NULL"
    )


def test_excel_templates_are_json_specs_not_binary_workbooks() -> None:
    template_dir = Path(__file__).parents[1] / "app" / "templates"
    assert {path.name for path in template_dir.iterdir()} == {
        "material-code-application.json",
        "purchase-application.json",
        "purchase-approval.json",
    }
