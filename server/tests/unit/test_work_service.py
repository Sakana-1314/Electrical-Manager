"""工作管理纯逻辑单测：半日占用判定、按天展开、参与人员规范化、查询参数解析。

这些函数不碰数据库（service 里只有它们与视图聚合是纯逻辑），因此直接用轻量对象断言；
数据库路径由 `tests/integration/test_work.py` 覆盖。
"""

from __future__ import annotations

from datetime import date
from types import SimpleNamespace

from app.domain.enums import WorkHalfDay, WorkTaskStatus
from app.services import work_service


def _record(
    start: str,
    start_half: WorkHalfDay,
    end: str,
    end_half: WorkHalfDay,
) -> SimpleNamespace:
    """只带日期字段的轻量记录对象（纯逻辑函数只读这几个字段）。"""
    return SimpleNamespace(
        start_date=date.fromisoformat(start),
        start_half=start_half,
        end_date=date.fromisoformat(end),
        end_half=end_half,
    )


def test_same_day_slots() -> None:
    whole = _record("2026-09-01", WorkHalfDay.AM, "2026-09-01", WorkHalfDay.PM)
    assert work_service.occupied_halves(whole, date(2026, 9, 1)) == (True, True)
    assert work_service.record_slots(whole, date(2026, 9, 1)) == "全天"

    morning = _record("2026-09-01", WorkHalfDay.AM, "2026-09-01", WorkHalfDay.AM)
    assert work_service.record_slots(morning, date(2026, 9, 1)) == "上午"

    afternoon = _record("2026-09-01", WorkHalfDay.PM, "2026-09-01", WorkHalfDay.PM)
    assert work_service.record_slots(afternoon, date(2026, 9, 1)) == "下午"

    # 区间之外没有占用
    assert work_service.occupied_halves(morning, date(2026, 9, 2)) == (False, False)
    assert work_service.record_slots(morning, date(2026, 9, 2)) is None


def test_multi_day_slots_and_expansion() -> None:
    """9/1 下午 → 9/3 上午：首日下午、末日只有上午、中间那天全天。"""
    record = _record("2026-09-01", WorkHalfDay.PM, "2026-09-03", WorkHalfDay.AM)
    assert work_service.record_slots(record, date(2026, 9, 1)) == "下午"
    assert work_service.record_slots(record, date(2026, 9, 2)) == "全天"
    assert work_service.record_slots(record, date(2026, 9, 3)) == "上午"

    rows = work_service.record_days(record, date(2026, 9, 1), date(2026, 9, 10))
    assert rows == [
        (date(2026, 9, 1), "下午"),
        (date(2026, 9, 2), "全天"),
        (date(2026, 9, 3), "上午"),
    ]

    # 查询区间收窄后只展开落在区间内的天，且首尾仍按半日档判定
    clipped = work_service.record_days(record, date(2026, 9, 2), date(2026, 9, 2))
    assert clipped == [(date(2026, 9, 2), "全天")]

    # 跨月的连续记录：9/30 上午 → 10/02 下午
    cross_month = _record("2026-09-30", WorkHalfDay.AM, "2026-10-02", WorkHalfDay.PM)
    assert work_service.record_days(cross_month, date(2026, 9, 1), date(2026, 10, 31)) == [
        (date(2026, 9, 30), "全天"),
        (date(2026, 10, 1), "全天"),
        (date(2026, 10, 2), "全天"),
    ]


def test_participants_parsing_and_formatting() -> None:
    assert work_service.parse_participants("李建军、王海涛") == ["李建军", "王海涛"]
    # 混合分隔符、重复姓名、多余空白都能规范化
    assert work_service.parse_participants(" 李建军,王海涛; 李建军 |陈志远 ") == [
        "李建军",
        "王海涛",
        "陈志远",
    ]
    assert work_service.parse_participants("") == []
    assert work_service.parse_participants(None) == []
    assert (
        work_service.format_participants(["李建军", " 王海涛 ", "李建军", ""]) == "李建军、王海涛"
    )
    # 写出去再读回来必须稳定（落库格式与解析口径一致）
    assert work_service.parse_participants(
        work_service.format_participants(["李建军", "王海涛"])
    ) == ["李建军", "王海涛"]


def test_query_param_parsing() -> None:
    assert work_service.parse_id_list("3, 12,12,abc,0") == [3, 12]
    assert work_service.parse_id_list(None) == []
    assert work_service.parse_names("李建军, 王海涛 ,李建军") == ["李建军", "王海涛"]
    assert work_service.parse_names(None) == []
    assert work_service.parse_statuses("进行中,已完成,乱填") == [
        WorkTaskStatus.IN_PROGRESS,
        WorkTaskStatus.DONE,
    ]
    assert work_service.parse_statuses(None) == []


def test_participant_name_keyword_is_or_search() -> None:
    assert work_service._matches_keyword("李建军", None) is True
    assert work_service._matches_keyword("李建军", "王|李") is True
    assert work_service._matches_keyword("李建军", "王|张") is False
    # 全角竖线同样按「或」处理
    assert work_service._matches_keyword("李建军", "王｜李") is True
