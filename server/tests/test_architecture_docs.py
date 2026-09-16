"""校验「架构设计」文档里的清单/计数与代码一致。

文档：`docs/websites/pages/dev-architecture.md`（后端目录结构树、前端路由表与各目录清单）。
代码：`server/app/**`、`web/src/**`。

做的事情：
1. 后端目录树里声明的 Python 文件数、`api/v1` 模块数与名单、`repositories` / `services` 数与名单
   必须与文件系统一致（`services` 里文档按惯例省略 `_service` 后缀，比对时两侧都去掉）；
2. 路由表必须与 `web/src/router/index.ts` 的 path 字面量双向一致（多一条少一条都失败）；
3. `stores` / `components` / `composables` / `api` / `utils` / `constants` / `types` / `layouts`
   的计数声明必须与文件数一致，且每个非 `*.spec.ts` 文件至少被文档提到一次。

新增前端文件、增删路由、增删后端模块时忘了同步文档，CI 会在这里失败。
"""

from __future__ import annotations

import re
from pathlib import Path

import app  # noqa: F401  （确保 server/ 在 sys.path 上）

SERVER_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = SERVER_DIR.parent
ARCHITECTURE_DOC = REPO_ROOT / "docs" / "websites" / "pages" / "dev-architecture.md"
ROUTER_TS = REPO_ROOT / "web" / "src" / "router" / "index.ts"
WEB_SRC = REPO_ROOT / "web" / "src"
# 文档里按惯例不逐个点名的文件（确实与「当前实现说明」无关时放这里，并写清原因）
UNDOCUMENTED_ALLOWED: set[str] = set()
# 这些目录下的每个非 spec 文件都要在架构文档里出现一次
WEB_INVENTORY_DIRS = (
    "api",
    "components",
    "composables",
    "constants",
    "layouts",
    "stores",
    "types",
    "utils",
)


def _doc() -> str:
    return ARCHITECTURE_DOC.read_text(encoding="utf-8")


def _server_tree() -> str:
    text = _doc()
    assert "## 后端目录结构" in text, "dev-architecture.md 缺少「后端目录结构」小节"
    block = text.split("## 后端目录结构", 1)[1].split("```text", 1)[1]
    return block.split("```", 1)[0]


def _documented_tree_entry(marker: str) -> tuple[int, list[str]]:
    """读取目录树里 `marker` 那行的「N 个…：a、b、c」并带上后续续行。"""
    lines = _server_tree().splitlines()
    pattern = re.compile(rf"{marker}\s+#\s*(\d+) 个[^：]*：(?P<names>.*)")
    for index, line in enumerate(lines):
        match = pattern.search(line)
        if match is None:
            continue
        chunk = match.group("names")
        for extra in lines[index + 1 :]:
            stripped = extra.lstrip()
            if "#" not in extra or not (stripped.startswith("#") or stripped.startswith("│")):
                break
            chunk += "、" + extra.split("#", 1)[1]
        names = [name.strip() for name in chunk.split("、") if name.strip()]
        return int(match.group(1)), names
    raise AssertionError(f"dev-architecture.md 的目录树里找不到 {marker} 的清单")


def _module_names(directory: Path) -> list[str]:
    return sorted(
        path.stem for path in directory.glob("*.py") if path.stem != "__init__"
    )


def _normalized(names: list[str]) -> set[str]:
    # 文档里的清单允许写「模块名（职责备注）」，也按惯例省略 `_service` 后缀，比对时都抹平
    return {name.split("（", 1)[0].strip().removesuffix("_service") for name in names}


def test_documented_server_inventory_matches_code() -> None:
    text = _doc()
    declared_total = int(re.search(r"`server/app/` 共 (\d+) 个 Python 文件", text).group(1))
    actual_total = len(list((SERVER_DIR / "app").rglob("*.py")))
    assert declared_total == actual_total, (
        f"文档写 server/app/ 共 {declared_total} 个 Python 文件，实际 {actual_total} 个"
    )

    for marker, directory in (
        ("api/v1/", SERVER_DIR / "app" / "api" / "v1"),
        ("repositories/", SERVER_DIR / "app" / "repositories"),
        ("services/", SERVER_DIR / "app" / "services"),
    ):
        declared_count, declared_names = _documented_tree_entry(marker)
        actual_names = _module_names(directory)
        assert declared_count == len(actual_names), (
            f"文档写 {marker} 有 {declared_count} 个模块，实际 {len(actual_names)} 个"
        )
        assert _normalized(declared_names) == _normalized(actual_names), (
            f"{marker} 名单与代码不一致："
            f"文档多 {sorted(_normalized(declared_names) - _normalized(actual_names))}，"
            f"文档少 {sorted(_normalized(actual_names) - _normalized(declared_names))}"
        )


def test_documented_routes_match_router() -> None:
    text = _doc()
    assert "### 路由表" in text and "### 状态管理" in text, "dev-architecture.md 缺少路由表小节"
    section = text.split("### 路由表", 1)[1].split("### 状态管理", 1)[0]
    documented = {
        match.group(1)
        for line in section.splitlines()
        if (match := re.match(r"\| `(/[^`]*)`", line)) is not None
    }
    literals = re.findall(r"path: '([^']+)'", ROUTER_TS.read_text(encoding="utf-8"))
    actual = {literal if literal.startswith("/") else f"/{literal}" for literal in literals}

    assert documented == actual, (
        f"路由表与 {ROUTER_TS.name} 不一致："
        f"文档多 {sorted(documented - actual)}，文档少 {sorted(actual - documented)}"
    )


def test_documented_frontend_inventory_matches_code() -> None:
    text = _doc()

    declared_stores = int(re.search(r"`web/src/stores/` 下只有 (\d+) 个 store", text).group(1))
    actual_stores = len(_spec_free_files(WEB_SRC / "stores"))
    assert declared_stores == actual_stores, (
        f"文档写 stores 有 {declared_stores} 个 store，实际 {actual_stores} 个"
    )

    for directory, pattern, description in (
        ("components", r"`web/src/components/` 下 (\d+) 个 `\.vue`", ".vue 组件"),
        ("composables", r"`web/src/composables/` 下 (\d+) 个 `\.ts`", "composable"),
    ):
        declared = int(re.search(pattern, text).group(1))
        actual = len(_spec_free_files(WEB_SRC / directory))
        assert declared == actual, (
            f"文档写 {directory} 有 {declared} 个{description}，实际 {actual} 个"
        )

    missing: dict[str, list[str]] = {}
    for directory in WEB_INVENTORY_DIRS:
        absent = [
            path.name
            for path in _spec_free_files(WEB_SRC / directory)
            if path.name not in text and path.name not in UNDOCUMENTED_ALLOWED
        ]
        if absent:
            missing[directory] = sorted(absent)
    assert not missing, f"以下前端文件没有在 dev-architecture.md 里出现：{missing}"


def _spec_free_files(directory: Path) -> list[Path]:
    return sorted(
        path
        for path in directory.iterdir()
        if path.is_file()
        and path.suffix in {".ts", ".vue"}
        and not path.name.endswith(".spec.ts")
        and path.name not in {"generated.raw.ts", "generated.ts"}
    )
