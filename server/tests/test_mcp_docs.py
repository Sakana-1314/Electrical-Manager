"""校验「MCP 服务」文档与代码一致。

文档：`docs/websites/pages/dev-architecture.md` 的「MCP 服务」小节（工具清单、操作目录排除项）。
代码：`server/app/mcp_server.py` 的工具注册与 `EXCLUDED_PATHS` / `EXCLUDED_PREFIXES`。

做的事：
1. 代码里注册的每个 MCP 工具都必须在文档里出现，且文档写明请求头传参与附件上限；
2. 文档里写的排除清单必须与代码的排除清单完全一致（多一个少一个都失败）。

新增/删除 MCP 工具、改动排除清单时忘了同步文档，CI 会在这里失败。
"""

from __future__ import annotations

import re
from pathlib import Path

import app  # noqa: F401  （确保 server/ 在 sys.path 上）
from app.main import app as fastapi_app
from app.mcp_server import EXCLUDED_PATHS, EXCLUDED_PREFIXES, mcp

SERVER_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = SERVER_DIR.parent
ARCHITECTURE_DOC = REPO_ROOT / "docs" / "websites" / "pages" / "dev-architecture.md"
SECTION_START = "#### MCP 服务（`server/app/mcp_server.py`）"
SECTION_END = "#### 健康检查与接口文档"


def _architecture_text() -> str:
    return ARCHITECTURE_DOC.read_text(encoding="utf-8")


def _mcp_section() -> str:
    text = _architecture_text()
    assert SECTION_START in text, f"{ARCHITECTURE_DOC.name} 缺少 MCP 小节标题"
    section = text.split(SECTION_START, 1)[1]
    assert SECTION_END in section, f"{ARCHITECTURE_DOC.name} 的 MCP 小节缺少结束标题"
    return section.split(SECTION_END, 1)[0]


def _tool_names() -> set[str]:
    """已注册的 MCP 工具名。

    `MCPServer.list_tools()` 是 async，但底层 ToolManager 的清单是同步的：这里刻意不套
    `asyncio.run()`——它会清掉线程的 current event loop，让本仓库后面那些依赖
    `asyncio.get_event_loop()` 的同步用例连带失败（事件循环按 session 共享）。
    """
    return {info.name for info in mcp._tool_manager.list_tools()}


def test_documented_mcp_tools_match_code() -> None:
    """代码里注册的工具都要在文档里出现，且文档要写明请求头传参与附件大小上限。"""
    section = _mcp_section()
    tool_names = sorted(_tool_names())

    assert tool_names, "MCP 服务没有注册任何工具"
    missing = [name for name in tool_names if f"`{name}`" not in section]
    assert not missing, f"dev-architecture.md 的 MCP 小节没有列出工具：{missing}"
    for keyword in ("headers", "If-Match", "file.content_base64"):
        assert keyword in section, f"dev-architecture.md 的 MCP 小节缺少「{keyword}」说明"


def test_documented_mcp_exclusions_match_code() -> None:
    """操作目录的排除清单必须与代码逐项一致，且排除项还得真的能命中存活路由。"""
    row = next(
        (line for line in _mcp_section().splitlines() if line.startswith("| 操作目录 |")),
        None,
    )
    assert row is not None, "dev-architecture.md 的 MCP 小节缺少「操作目录」行"
    documented = set(re.findall(r"`(/api/v1/[^`]+)`", row))
    excluded = set(EXCLUDED_PATHS) | set(EXCLUDED_PREFIXES)

    assert documented == excluded, (
        f"文档写的排除项 {sorted(documented)} 与代码 {sorted(excluded)} 不一致"
    )
    paths = list(fastapi_app.openapi()["paths"])
    for prefix in EXCLUDED_PREFIXES:
        assert any(path.startswith(prefix) for path in paths), (
            f"代码里的排除前缀 {prefix} 已匹配不到任何路由，请同步清理代码与文档"
        )
