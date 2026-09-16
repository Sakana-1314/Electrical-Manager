"""校验「数据模型」文档与数据库结构一致。

文档：`docs/websites/pages/dev-data-model.md`
代码：`docs/references/database/init.sql` 与 ORM（`server/app/models/__init__.py`）。

做的事：
1. 文档里出现的约束名（`uq_` / `ix_` / `fk_` / `pk_` / `ck_`）必须在 `init.sql` 里真实存在
   ——改库时忘改文档、或文档里写着手改前的旧名字，都会在这里失败；
2. 「共 38 张表」「项目域表（28 张）」「全局表（10 张）」三处计数，以及项目域表 / 全局表的名单，
   必须与 `init.sql` 的建表语句和 `PROJECT_SCOPED_MODELS` 一致。
"""

from __future__ import annotations

import re
from pathlib import Path

import app  # noqa: F401  （确保 server/ 在 sys.path 上）
from app.models import PROJECT_SCOPED_MODELS, Base

SERVER_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = SERVER_DIR.parent
DATA_MODEL_DOC = REPO_ROOT / "docs" / "websites" / "pages" / "dev-data-model.md"
INIT_SQL = REPO_ROOT / "docs" / "references" / "database" / "init.sql"
CONSTRAINT_NAME = re.compile(r"(?:uq|ix|fk|pk|ck)_[a-z_0-9]+")


def _doc() -> str:
    return DATA_MODEL_DOC.read_text(encoding="utf-8")


def _table_names(section: str) -> set[str]:
    return set(re.findall(r"`([a-z_0-9]+)`", section))


def test_documented_constraint_names_exist_in_init_sql() -> None:
    sql = INIT_SQL.read_text(encoding="utf-8")
    documented = set(CONSTRAINT_NAME.findall(_doc()))
    unknown = sorted(name for name in documented if name not in sql)

    assert documented, "dev-data-model.md 里没有引用任何约束名，解析可能失效"
    assert not unknown, (
        f"dev-data-model.md 引用了 init.sql 里不存在的约束名：{unknown}；"
        "改库时请同步文档里的索引 / 外键名字"
    )


def test_documented_table_counts_and_lists_match_schema() -> None:
    doc = _doc()
    declared_total = int(re.search(r"共 \*\*(\d+) 张表\*\*", doc).group(1))
    declared_scoped = int(re.search(r"### 项目域表（(\d+) 张）", doc).group(1))
    declared_global = int(re.search(r"### 全局表（(\d+) 张", doc).group(1))

    sql_text = INIT_SQL.read_text(encoding="utf-8")
    sql_tables = set(re.findall(r"CREATE TABLE IF NOT EXISTS `([a-z_0-9]+)`", sql_text))
    scoped_names = {model.__tablename__ for model in PROJECT_SCOPED_MODELS}
    all_names = set(Base.metadata.tables)

    assert declared_total == len(sql_tables), (
        f"文档写共 {declared_total} 张表，init.sql 建了 {len(sql_tables)} 张"
    )
    assert declared_scoped == len(scoped_names), (
        f"文档写项目域表 {declared_scoped} 张，PROJECT_SCOPED_MODELS 有 {len(scoped_names)} 张"
    )
    assert declared_global == len(all_names) - len(scoped_names), (
        f"文档写全局表 {declared_global} 张，实际 {len(all_names) - len(scoped_names)} 张"
    )

    documented_scoped = _table_names(doc.split("### 项目域表（", 1)[1].split("每张表都有", 1)[0])
    assert documented_scoped == scoped_names, (
        f"项目域表名单不一致：文档多 {sorted(documented_scoped - scoped_names)}，"
        f"文档少 {sorted(scoped_names - documented_scoped)}"
    )

    global_section = doc.split("### 全局表（", 1)[1].split("### 项目域唯一键", 1)[0]
    # 该小节第一段是表名清单，随后才是「不隔离的原因」表格（表里还提到别的列名，不能一起收）
    global_paragraphs = [part.strip() for part in global_section.split("\n\n") if part.strip()]
    documented_global = _table_names(global_paragraphs[1])
    expected_global = all_names - scoped_names
    assert documented_global == expected_global, (
        f"全局表名单不一致：文档多 {sorted(documented_global - expected_global)}，"
        f"文档少 {sorted(expected_global - documented_global)}"
    )
