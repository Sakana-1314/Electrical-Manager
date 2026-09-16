"""项目隔离的两个结构性保证（不依赖具体业务接口，纯静态校验）。

「已有数据的项目不能删除」靠三层保护实现，其中第一层要求**项目域表的清单是完整的**：

1. `project_service.count_project_rows` 遍历 `PROJECT_SCOPED_MODELS` 统计项目下是否有数据，
   有数据即 409 `PROJECT_IN_USE`；清单漏登记一张表，该表的数据就统计不到。
2. `project` 的外键无 `ON DELETE` 级联（RESTRICT）：只要项目下任何一张项目域表还有行，
   `DELETE FROM project` 就会被 MySQL 拒绝，service 把 `IntegrityError` 也映射成 `PROJECT_IN_USE`。
3. `PROJECT_IS_DEFAULT`：默认项目不论有没有数据都不允许删除。

因此这里断言「继承 ProjectScoped 的表 == 登记表清单」，以及「项目域表到 project 的外键都是
RESTRICT」，让新增业务表时的遗漏在 CI 里立刻暴露，而不是等到线上删库才发现。
"""

from __future__ import annotations

import re
from pathlib import Path

import app.models  # noqa: F401
from app.models import PROJECT_SCOPED_MODELS, Project, ProjectScoped

INIT_SQL = Path(__file__).parents[2] / "docs" / "references" / "database" / "init.sql"
CREATE_TABLE = re.compile(
    r"CREATE TABLE IF NOT EXISTS `([^`]+)` \((.*?)\) ENGINE=",
    re.DOTALL,
)


def _table_blocks() -> dict[str, str]:
    return dict(CREATE_TABLE.findall(INIT_SQL.read_text(encoding="utf-8")))


def test_every_project_scoped_model_is_registered_for_delete_guard() -> None:
    declared = set(ProjectScoped.__subclasses__())
    registered = set(PROJECT_SCOPED_MODELS)

    missing = sorted(model.__tablename__ for model in declared - registered)
    unknown = sorted(model.__tablename__ for model in registered - declared)
    assert not missing, f"这些表继承了 ProjectScoped 但没登记到 PROJECT_SCOPED_MODELS：{missing}"
    assert not unknown, f"PROJECT_SCOPED_MODELS 里有未继承 ProjectScoped 的模型：{unknown}"
    # 清单非空且不重复，避免统计时漏表或重复计数
    assert len(PROJECT_SCOPED_MODELS) == len(registered) >= 20


def test_every_project_scoped_model_has_project_id_column() -> None:
    blocks = _table_blocks()
    for model in PROJECT_SCOPED_MODELS:
        columns = set(re.findall(r"^  `([^`]+)`", blocks[model.__tablename__], re.MULTILINE))
        assert "project_id" in columns, f"{model.__tablename__} 缺少 project_id 列"
        assert "project_id" in {column.name for column in model.__table__.columns}


def test_project_foreign_keys_never_cascade() -> None:
    """项目域表 → `project` 的外键必须是 RESTRICT：删项目不能被级联带走数据。"""
    blocks = _table_blocks()
    for model in PROJECT_SCOPED_MODELS:
        block = blocks[model.__tablename__]
        match = re.search(
            r"FOREIGN KEY \(`project_id`\) REFERENCES `project` \(`id`\)"
            r"(?: ON DELETE ([A-Z]+(?: [A-Z]+)?))?",
            block,
        )
        assert match is not None, f"{model.__tablename__} 没有指向 project 的外键"
        assert match.group(1) is None, (
            f"{model.__tablename__} 的 project 外键带了 ON DELETE {match.group(1)}，"
            "删除项目会连带删数据，必须保持 RESTRICT"
        )


def test_delete_guard_counts_every_registered_table() -> None:
    """删除前的存在性统计必须覆盖清单里的每一张表（而不是只查主表）。"""
    source = (
        Path(__file__).parents[1] / "app" / "services" / "project_service.py"
    ).read_text(encoding="utf-8")
    guard = source.split("async def count_project_rows", 1)[1].split("\nasync def ", 1)[0]
    assert "with system_scope():" in guard, "统计必须在 system_scope() 下进行，否则会被当前项目收窄"
    assert "for model in PROJECT_SCOPED_MODELS:" in guard, "统计必须遍历全部项目域表"
    assert "model.project_id == project_id" in guard

    delete = source.split("async def delete_project", 1)[1]
    assert "count_project_rows" in delete, "删除前必须调用 count_project_rows"
    assert "PROJECT_IN_USE" in delete
    assert "PROJECT_IS_DEFAULT" in delete
    assert "IntegrityError" in delete, "外键兜底必须把 IntegrityError 也映射成 PROJECT_IN_USE"


def test_project_table_has_no_code_column() -> None:
    """项目只对外显示名称：编码列已删除，标识是内部自增 id。"""
    block = _table_blocks()["project"]
    assert "`code`" not in block
    assert not hasattr(Project, "code")
    assert "uq_project_name" in block
