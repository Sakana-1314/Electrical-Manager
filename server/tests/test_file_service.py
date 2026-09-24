from __future__ import annotations

import hashlib
import io
from pathlib import Path

import pytest
from fastapi import UploadFile
from PIL import Image
from starlette.datastructures import Headers

from app.core.config import settings
from app.services import file_service
from app.services.file_service import save_image


class FailingCommitSession:
    rolled_back = False

    def add(self, item: object) -> None:
        pass

    async def scalars(self, statement: object) -> EmptyScalarResult:
        return EmptyScalarResult()

    async def flush(self) -> None:
        pass

    async def commit(self) -> None:
        raise RuntimeError("commit failed")

    async def rollback(self) -> None:
        self.rolled_back = True


class EmptyScalarResult:
    def all(self) -> list[object]:
        return []


@pytest.mark.asyncio
async def test_upload_removes_disk_file_when_database_commit_fails(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "upload_dir", tmp_path / "uploads")
    source = io.BytesIO()
    Image.new("RGB", (16, 12), "red").save(source, format="PNG")
    upload = UploadFile(
        file=io.BytesIO(source.getvalue()),
        filename="source.png",
        headers=Headers({"content-type": "image/png"}),
    )
    session = FailingCommitSession()

    with pytest.raises(RuntimeError, match="commit failed"):
        await save_image(session, upload)  # type: ignore[arg-type]

    assert session.rolled_back is True
    assert list(settings.upload_dir.glob("*.png")) == []


def _noisy_bytes(size: int) -> bytes:
    """确定性伪随机字节：摘要与窗口都稳定，便于断言。"""
    return bytes((index * 31 + 7) % 256 for index in range(size))


@pytest.mark.parametrize("size", [0, 1, 1024, file_service.DEDUP_MIN_BYTES])
def test_source_fingerprint_skips_files_at_or_below_threshold(size: int) -> None:
    """不超过 1MB 的文件不记挑战材料：前端本来就不会为它们提交摘要。"""
    assert file_service.source_fingerprint(b"\x00" * size) is None


def test_source_fingerprint_records_full_digest_and_middle_windows() -> None:
    raw = _noisy_bytes(file_service.DEDUP_MIN_BYTES + 4096)
    fingerprint = file_service.source_fingerprint(raw)

    assert fingerprint is not None
    assert fingerprint.sha256 == hashlib.sha256(raw).hexdigest()
    probes = fingerprint.probes
    assert probes["size"] == len(raw)

    windows = probes["windows"]
    assert len(windows) == len(file_service.PROBE_FRACTIONS)
    assert len({window["offset"] for window in windows}) == len(windows)
    for window in windows:
        offset, length = window["offset"], window["length"]
        assert length == file_service.PROBE_WINDOW_BYTES
        # 窗口必须整段落在中间一半：头尾是编码器固定字段，猜得到的区域没有校验价值
        assert len(raw) // 4 <= offset
        assert offset + length <= len(raw) - len(raw) // 4
        assert window["sha256"] == hashlib.sha256(raw[offset : offset + length]).hexdigest()


def test_source_fingerprint_is_deterministic() -> None:
    raw = _noisy_bytes(file_service.DEDUP_MIN_BYTES + 1)
    assert file_service.source_fingerprint(raw) == file_service.source_fingerprint(raw)


def test_source_fingerprint_window_shrinks_for_small_files_above_threshold() -> None:
    """刚过阈值时窗口长度按文件 1/4 收缩（仍为 3 个互不相同的窗口）。"""
    raw = _noisy_bytes(file_service.DEDUP_MIN_BYTES + 1)
    fingerprint = file_service.source_fingerprint(raw)

    assert fingerprint is not None
    windows = fingerprint.probes["windows"]
    assert len(windows) == 3
    assert all(window["length"] == file_service.PROBE_WINDOW_BYTES for window in windows)
