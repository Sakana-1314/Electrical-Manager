"""为导出的 OpenAPI 契约补充示例数据（Mock 数据）。

为什么要做：`docs/openapi.yaml` 由本脚本从后端 App 生成，同时也是 Apifox Mock 与前端类型的
唯一数据来源。Apifox 的「Mock 环境」按 schema 里的 `example` / `examples` 返回数据，所以示例
必须是一套**自洽的业务台账**，而不是 `xxx-示例` 这类占位符；`docs/openapi.yaml` 是生成物，
手改会被 CI 重跑本脚本覆盖。

示例口径：华星镍业（HXNI）检修维护部电气自动化车间的二级库备件台账。
需求人与领用人是车间检修班组员工，申购责任人是车间申购员，业务员 / 合同号 / 船期是外部采购
平台回写的字段。物资数量、流水前后库存、低库存判定、筛选项、分页 `total`、工作台统计全部由
`_MATERIALS` 与 `_OPERATIONS` 推导，不存在两处对不上的假数据。

示例分两层落地到契约：
- `components.schemas.*.examples[0]`：数据模型示例（文档与前端类型注释用）；
- `paths.*.*.responses.*.content.application/json.example`：接口响应示例，Apifox 的
  「功能设置 → Mock 设置 → 响应示例优先」直接用它作为 Mock 返回值（默认的「智能 Mock 优先」
  会按字段名自己编数据，看不到这里写的内容）。

生成规则（按优先级）：
1. `_SCHEMA_EXAMPLES`：手写的业务示例（关键 schema），字段之间保证自洽；
2. schema 自身的 enum，或 `$ref` 指向的枚举 → 取第一个取值；
3. `_FIELD_EXAMPLES` 字段名精确命中；
4. `_SUFFIX_EXAMPLES` 字段名后缀命中；
5. 按 JSON Schema 类型 + format 兜底（date / date-time / uuid / integer / number / …）。

第 5 步兜底值形如 `xxx-示例`，它是「新字段忘了登记示例」的信号而不是可发布内容，
`server/tests/test_openapi_examples.py` 会守住这条线。

确定性：不取当前时间、不用随机数，同一份代码必然生成同一份示例，CI 重跑后 `git diff` 为空。
"""

from __future__ import annotations

import hashlib
from copy import deepcopy
from decimal import Decimal
from typing import Any

# ===========================================================================
# 一、业务台账：示例数据唯一的事实来源
# ===========================================================================
# 时间锚点：示例里「最近」的数据都落在这天附近，避免示例随真实时间漂移。
_LATEST_STAMP = "2026-09-13T10:30:00+08:00"
_LATEST_DATE = "2026-09-13"
# 二级库物资建档时间（期初导入当月）
_STOCK_CREATED_AT = "2026-06-05T09:10:00+08:00"

_DEMAND_DEPARTMENT = "检修维护部电气自动化车间"
# 出库领用单位（车间下辖检修班组）
_OPERATION_UNITS = ["电气检修一班", "电气检修二班", "仪表检修班"]
# 子项号（自由文本，用于标识装置/系统子项）
_SUBITEM_NAMES = {
    "201": "201-冶炼主厂房",
    "202": "202-熔炼车间",
    "301": "301-选矿厂",
    "305": "305-硫酸厂",
    "401": "401-公辅设施",
}
# 车间需求人 / 领用人（检修班组员工）
_DEMAND_PERSONS = ["李建军", "王海涛", "陈志远", "刘振华", "杨明辉", "周立新", "孙浩宇"]
# 车间申购责任人（负责补编码、转申购记录）
_PURCHASE_RESPONSIBLES = ["吴德海", "郑文斌", "黄立群"]
# 采购业务员（外部采购平台回写）
_SALES_PERSONS = ["马晓东", "徐怀志", "何丽娟"]
# 华星总库存（ERP 导出）的采购员 / 采购部门 / 仓库
_HX_PURCHASERS = ["吴冰", "夏军", "李振国"]
_HX_DEPARTMENTS = ["生产调度中心", "HXNI冶炼厂", "设备管理部"]
_HX_WAREHOUSES = ["P01金属仓", "P03电气仓", "P05综合仓", "P06综合仓"]


def _material(
    code: str,
    name: str,
    model_spec: str,
    unit_name: str,
    category: str,
    opening: str,
    minimum_qty: str,
    remark: str,
    *,
    alias: str | None = None,
    images: tuple[tuple[str, int], ...] = (),
) -> dict[str, Any]:
    """一条二级库物资（`opening` 为期初库存，出库领用记在 `_OPERATIONS` 里）。"""
    return {
        "code": code,
        "name": name,
        "alias": alias,
        "model_spec": model_spec,
        "unit_name": unit_name,
        "category": category,
        "opening": opening,
        "minimum_qty": minimum_qty,
        "remark": remark,
        "images": images,
    }


# 二级库物资台账（id 按本列表顺序分配；期初库存 + 流水 = 当前库存）
_MATERIALS: list[dict[str, Any]] = [
    _material(
        "E011-00237", "交流接触器", "CJX2-2510 AC220V", "个", "备品备件", "0", "8",
        "启停控制回路常用，单台控制柜 2 只",
        alias="接触器",
        images=(("交流接触器-CJX2-2510-正面.jpg", 486912), ("交流接触器-CJX2-2510-铭牌.jpg", 372480)),
    ),
    _material(
        "E011-00241", "交流接触器辅助触头", "F4-22", "个", "备品备件", "18", "6",
        "与交流接触器配套", alias="辅助触头",
    ),
    _material("E011-00312", "小型断路器", "C65N-C16/2P", "个", "备品备件", "30", "10", "照明与风机回路", alias="空开"),
    _material("E011-00315", "漏电保护断路器", "DZ47LE-32 C32/2P", "个", "备品备件", "12", "6", "配电箱检修常用", alias="漏保"),
    _material("E011-00327", "热继电器", "JRS1-25/Z 4-6A", "个", "备品备件", "16", "8", "与接触器配套做过载保护", alias="热继"),
    _material("E011-00335", "中间继电器", "MY4N-GS DC24V", "个", "备品备件", "14", "8", "DCS 信号回路", alias="中继"),
    _material("E011-00338", "时间继电器", "ST3PA-B AC220V", "个", "备品备件", "15", "5", "延时启动回路", alias="时间继"),
    _material("E011-00402", "熔断器芯", "RT18-32 10A", "个", "消耗物资", "30", "20", "仪表柜与操作柱保险", alias="熔芯"),
    _material("E011-00405", "熔断器底座", "RT18-32 3P", "个", "备品备件", "28", "10", "与熔断器芯配套", alias="熔座"),
    _material("E011-00451", "智能电机保护器", "M60-2P 5A", "个", "备品备件", "15", "4", "低压电机保护", alias="保护器"),
    _material("E011-00511", "万能转换开关", "LW39-16B", "个", "备品备件", "20", "8", "就地操作箱", alias="转换开关"),
    _material("E011-00521", "指示灯", "AD16-22D AC220V 红色", "个", "消耗物资", "30", "20", "柜门指示", alias="指示灯"),
    _material("E011-00540", "接近开关", "LJ12A3-4-Z/BX", "个", "备品备件", "16", "10", "皮带跑偏与限位检测", alias="接近开关"),
    _material("E011-00602", "接线端子", "UK-2.5B 灰", "个", "消耗物资", "800", "200", "柜内配线耗材", alias="端子"),
    _material("E011-00631", "防爆挠性连接管", "DN20×500mm", "根", "备品备件", "12", "10", "防爆区电缆穿管", alias="防爆管"),
    _material("E011-00644", "万用表保险管", "DMM-11A 10A", "个", "消耗物资", "25", "10", "仪表班万用表备件", alias="保险管"),
    _material("E012-00058", "铜芯控制电缆", "KVV 4×1.5mm²", "米", "备品备件", "400", "100", "控制回路敷设", alias="控制电缆"),
    _material("E012-00071", "铜芯电力电缆", "YJV 3×25+1×16mm²", "米", "备品备件", "120", "60", "动力回路敷设", alias="电力电缆"),
    _material("E012-00083", "铜芯塑料线", "BV 2.5mm² 蓝色", "米", "消耗物资", "1000", "200", "柜内配线耗材", alias="塑料线"),
    _material(
        "E013-00019", "变频器", "ATV310HU22N4A 2.2kW", "台", "备品备件", "3", "1",
        "给料机变频驱动，拆机件需确认参数",
        alias="变频器", images=(("变频器-ATV310-铭牌.jpg", 512640),),
    ),
    _material("E013-00024", "软启动器", "STR022L-3 22kW", "台", "备品备件", "2", "1", "皮带机软启动", alias="软启"),
    _material("E014-00007", "绝缘胶带", "3M 1600 18mm×20m 黑色", "卷", "消耗物资", "80", "20", "日常检修耗材", alias="胶带"),
    _material("E021-00006", "温湿度控制器", "WSK-SH", "个", "备品备件", "8", "4", "配电室除湿控制", alias="温湿度"),
]

# 二级库物资编码 → 型号规格 / 单位 / 分类（申购计划、编码库共用，避免同名物资写法不一致）
_EXTRA_CODES: dict[str, tuple[str, str, str, str]] = {
    "E011-00308": ("塑壳断路器", "NM1-125S/3300 100A", "个", "备品备件"),
    "E011-00518": ("按钮开关", "LA38-11 绿色", "个", "消耗物资"),
}

# 出库/入库流水（按时间回放推导每条明细的 before_qty / after_qty，明细用物资编码引用）
_OPERATIONS: list[dict[str, Any]] = [
    {
        "at": "2026-06-05T09:10:00+08:00",
        "type": "INBOUND",
        "source_type": "INITIALIZATION",
        "reason": "期初库存导入",
        "lines": [("E011-00237", "12")],
    },
    {
        "at": "2026-06-18T09:15:00+08:00",
        "type": "OUTBOUND",
        "reason": "1#回转窑主电机控制柜检修更换",
        "receiver_unit": "电气检修一班",
        "receiver_name": "李建军",
        "subitem_no": "201",
        "lines": [("E011-00237", "4"), ("E011-00327", "2"), ("E011-00402", "6"), ("E011-00451", "8")],
    },
    {
        "at": "2026-07-06T14:20:00+08:00",
        "type": "OUTBOUND",
        "reason": "2#焙烧炉引风机控制柜更换及控制电缆敷设",
        "receiver_unit": "电气检修二班",
        "receiver_name": "王海涛",
        "subitem_no": "201",
        "lines": [("E011-00237", "6"), ("E011-00241", "6"), ("E012-00058", "80")],
    },
    {
        "at": "2026-07-14T08:40:00+08:00",
        "type": "OUTBOUND",
        "reason": "配电室照明回路与 DCS 信号回路改造",
        "receiver_unit": "电气检修一班",
        "receiver_name": "陈志远",
        "subitem_no": "301",
        "lines": [
            ("E011-00312", "12"),
            ("E011-00335", "7"),
            ("E011-00540", "10"),
            ("E012-00083", "200"),
        ],
    },
    {
        "at": "2026-07-18T10:40:00+08:00",
        "type": "OUTBOUND",
        "reason": "高压配电室除湿控制器更换",
        "receiver_unit": "电气检修二班",
        "receiver_name": "刘振华",
        "subitem_no": "401",
        "lines": [("E021-00006", "5")],
    },
    {
        "at": "2026-08-15T09:50:00+08:00",
        "type": "OUTBOUND",
        "reason": "3#破碎机电源电缆及防爆穿管更换",
        "receiver_unit": "电气检修一班",
        "receiver_name": "王海涛",
        "subitem_no": "202",
        "lines": [("E011-00631", "5"), ("E012-00071", "75"), ("E013-00019", "1")],
    },
    {
        "at": "2026-08-22T16:45:00+08:00",
        "type": "OUTBOUND",
        "reason": "仪表柜保险检查批量更换",
        "receiver_unit": "电气检修二班",
        "receiver_name": "周立新",
        "subitem_no": "305",
        "lines": [("E011-00402", "22"), ("E011-00644", "7")],
    },
    {
        "at": "2026-08-27T10:05:00+08:00",
        "type": "INBOUND",
        "reason": "申购到货入库（合同 HX-CG-2026-0157）",
        "lines": [("E011-00237", "4")],
    },
    {
        "at": "2026-09-05T15:30:00+08:00",
        "type": "OUTBOUND",
        "reason": "办公楼配电箱漏电保护器更换",
        "receiver_unit": "电气检修二班",
        "receiver_name": "刘振华",
        "subitem_no": "401",
        "lines": [("E011-00315", "3")],
    },
    {
        "at": "2026-09-06T10:15:00+08:00",
        "type": "INBOUND",
        "source_type": "REVERSAL",
        "reversal_of_at": "2026-09-05T15:30:00+08:00",
        "reason": "领用退回：现场未使用",
        "lines": [("E011-00315", "1")],
    },
    {
        "at": "2026-09-08T11:10:00+08:00",
        "type": "OUTBOUND",
        "reason": "2#皮带机启动回路检修",
        "receiver_unit": "电气检修一班",
        "receiver_name": "杨明辉",
        "subitem_no": "305",
        "lines": [("E011-00338", "4"), ("E013-00024", "1"), ("E021-00006", "3")],
    },
    {
        "at": "2026-09-11T10:20:00+08:00",
        "type": "OUTBOUND",
        "source_type": "MINI_PROGRAM",
        "reason": "就地操作箱检修备件领用",
        "receiver_unit": "电气检修二班",
        "receiver_name": "孙浩宇",
        "subitem_no": "305",
        "lines": [("E011-00511", "4"), ("E011-00521", "22"), ("E014-00007", "25")],
    },
    {
        "at": "2026-09-12T15:40:00+08:00",
        "type": "OUTBOUND",
        "source_type": "MINI_PROGRAM",
        "reason": "现场检修配线耗材领用",
        "receiver_unit": "电气检修二班",
        "receiver_name": "孙浩宇",
        "subitem_no": "305",
        "lines": [("E011-00602", "50")],
    },
]

# 申购计划：date 决定 plan_no（PLAN-YYYYMMDD-NNN），code 为空表示尚未编码
_PURCHASE_PLANS: list[dict[str, Any]] = [
    {
        "date": "2026-08-05", "code": "E011-00237", "qty": "20", "person": "李建军",
        "responsible": "吴德海", "usage": "1#回转窑控制柜检修备件补充", "subitem_no": "201",
        "moved_to_record": True, "version": 3,
    },
    {
        "date": "2026-08-05", "code": "E011-00402", "qty": "20", "person": "王海涛",
        "responsible": "吴德海", "usage": "仪表柜保险批量更换", "subitem_no": "305",
        "moved_to_record": True, "version": 2,
    },
    {
        "date": "2026-08-12", "code": "E013-00019", "qty": "1", "person": "陈志远",
        "responsible": "郑文斌", "usage": "3#破碎机给料机变频器改造", "subitem_no": "202",
        "moved_to_record": True, "version": 2,
    },
    {
        "date": "2026-08-20", "code": "E012-00071", "qty": "80", "person": "陈志远",
        "responsible": "郑文斌", "usage": "3#破碎机电源电缆更换", "subitem_no": "202",
        "moved_to_record": True, "version": 2,
    },
    {
        "date": "2026-09-05", "code": "E011-00631", "qty": "10", "person": "李建军",
        "responsible": "吴德海", "usage": "防爆区域电缆穿管更换", "subitem_no": "305",
        "moved_to_record": True, "version": 1,
    },
    {
        "date": "2026-08-20", "code": "E011-00644", "qty": "10", "person": "刘振华",
        "responsible": "吴德海", "usage": "仪表班万用表保险管补充", "subitem_no": "305",
        "version": 1,
    },
    {
        "date": "2026-08-28", "name": "镀锌线槽", "model_spec": "100×50mm", "unit_name": "米",
        "category": "消耗物资", "qty": "60", "person": "杨明辉", "responsible": "郑文斌",
        "usage": "电缆桥架整改", "subitem_no": "401", "remark": "待采购部门补物资编码", "version": 1,
    },
    {
        "date": "2026-09-02", "code": "E011-00335", "qty": "12", "person": "周立新",
        "responsible": "吴德海", "usage": "DCS 信号回路备件补充", "subitem_no": "201",
        "remark": "低库存补库：现库存 7 个，低于下限 8 个", "version": 1,
    },
    {
        "date": "2026-09-05", "code": "E011-00521", "qty": "30", "person": "孙浩宇",
        "responsible": "黄立群", "usage": "就地操作箱指示灯更换", "subitem_no": "305",
        "remark": "低库存补库：现库存 8 个，低于下限 20 个", "version": 1,
    },
    {
        "date": "2026-09-05", "code": "E011-00540", "qty": "10", "person": "孙浩宇",
        "responsible": "黄立群", "usage": "皮带限位开关备件补充", "subitem_no": "305",
        "remark": "低库存补库：现库存 6 个，低于下限 10 个", "version": 1,
    },
    {
        "date": "2026-09-08", "code": "E021-00006", "qty": "6", "person": "王海涛",
        "responsible": "郑文斌", "usage": "配电室除湿改造", "subitem_no": "401",
        "remark": "低库存补库：现库存 0 个，低于下限 4 个", "version": 1,
    },
    {
        "date": "2026-09-11", "name": "铜接线端子", "model_spec": "DT-70", "unit_name": "个",
        "category": "消耗物资", "qty": "40", "person": "周立新", "responsible": "黄立群",
        "usage": "电缆头制作", "subitem_no": "202", "remark": "待采购部门补物资编码", "version": 1,
    },
    {
        "date": "2026-09-12", "code": "E011-00308", "qty": "4", "person": "杨明辉",
        "responsible": "吴德海", "usage": "配电柜总开关备件（暂不采购）", "subitem_no": "301",
        "status": "暂不申购", "version": 2,
    },
    {
        "date": "2026-06-15", "code": "E011-00241", "qty": "10", "person": "陈志远",
        "responsible": "吴德海", "usage": "6 月检修备件", "subitem_no": "201",
        "status": "已归档", "version": 4,
    },
    {
        "date": "2026-06-15", "code": "E012-00083", "qty": "200", "person": "刘振华",
        "responsible": "郑文斌", "usage": "6 月柜内配线耗材", "subitem_no": "301",
        "status": "已归档", "version": 3,
    },
    {
        "date": "2026-09-13", "code": "E011-00518", "qty": "40", "person": "孙浩宇",
        "responsible": "黄立群", "usage": "就地操作箱按钮更换", "subitem_no": "305",
        "remark": "补库计划：建议申购 3 个，确认计划 40 个", "version": 1,
    },
]

# 申购记录（整单按申购单号分组；明细用计划号引用上表，快照字段随之派生）
_PURCHASE_REQUESTS: list[dict[str, Any]] = [
    {
        "order_no": "申购 2026/8/20",
        "trace_no": "HX20260820001",
        "contract_no": "HX-CG-2026-0157",
        "vessel_no": "MV HXNI 03",
        "consolidation_date": "2026-08-28",
        "consolidation_port": "Morowali",
        "sailing_date": "2026-09-02",
        "date": "2026-08-20",
        "remark": "8 月低压电器备件整单申购",
        "lines": [
            {"plan_no": "PLAN-20260805-001", "status": "已入库", "salesperson": "马晓东", "contract_sign_date": "2026-08-25"},
            {"plan_no": "PLAN-20260805-002", "status": "部分入库", "salesperson": "马晓东", "contract_sign_date": "2026-08-25"},
        ],
    },
    {
        "order_no": "申购 2026/9/2",
        "trace_no": "HX20260902001",
        "contract_no": "HX-CG-2026-0172",
        "vessel_no": "MV HXNI 05",
        "consolidation_date": "2026-09-10",
        "consolidation_port": "Morowali",
        "sailing_date": "2026-09-15",
        "date": "2026-09-02",
        "remark": "变频器专项采购",
        "lines": [
            {"plan_no": "PLAN-20260812-001", "status": "已采购", "salesperson": "徐怀志", "contract_sign_date": "2026-09-04"},
        ],
    },
    {
        "order_no": "申购 2026/9/9",
        "trace_no": "HX20260909001",
        "contract_no": "HX-CG-2026-0183",
        "vessel_no": "MV HXNI 05",
        "consolidation_date": "2026-09-18",
        "consolidation_port": "Morowali",
        "sailing_date": "2026-09-23",
        "date": "2026-09-09",
        "remark": "破碎机与防爆区备件",
        "lines": [
            {"plan_no": "PLAN-20260820-001", "status": "已申购", "salesperson": "何丽娟"},
            {"plan_no": "PLAN-20260905-001", "status": "已申购", "salesperson": "何丽娟"},
        ],
    },
]

# 华星总库存（ERP 导出台账，含电气类与通用物资）
_HX_INVENTORY: list[dict[str, Any]] = [
    ("L012-05048", "内丝三通", "DN15", "个", "25", "P05综合仓", "吴冰", "生产调度中心", "201-冶炼主厂房", "2022-10-28"),
    ("W004-00003", "稀释剂", "20L", "桶", "3", "P06综合仓", "夏军", "HXNI冶炼厂", "201-冶炼主厂房", "2025-11-16"),
    ("E011-00237", "交流接触器", "CJX2-2510 AC220V", "个", "46", "P03电气仓", "李振国", "设备管理部", "305-硫酸厂", "2024-03-12"),
    ("E011-00402", "熔断器芯", "RT18-32 10A", "个", "180", "P03电气仓", "李振国", "设备管理部", "305-硫酸厂", "2023-08-05"),
    ("E011-00335", "中间继电器", "MY4N-GS DC24V", "个", "120", "P03电气仓", "夏军", "HXNI冶炼厂", "201-冶炼主厂房", "2024-06-18"),
    ("E011-00521", "指示灯", "AD16-22D AC220V 红色", "个", "210", "P03电气仓", "李振国", "设备管理部", "305-硫酸厂", "2024-09-09"),
    ("E011-00602", "接线端子", "UK-2.5B 灰", "个", "2600", "P03电气仓", "李振国", "设备管理部", "305-硫酸厂", "2023-05-27"),
    ("E012-00058", "铜芯控制电缆", "KVV 4×1.5mm²", "米", "1450", "P03电气仓", "吴冰", "生产调度中心", "201-冶炼主厂房", "2024-01-16"),
    ("E012-00071", "铜芯电力电缆", "YJV 3×25+1×16mm²", "米", "260", "P03电气仓", "吴冰", "生产调度中心", "202-熔炼车间", "2024-11-21"),
    ("E013-00019", "变频器", "ATV310HU22N4A 2.2kW", "台", "4", "P03电气仓", "李振国", "设备管理部", "202-熔炼车间", "2025-04-02"),
    ("L018-00226", "不锈钢螺栓", "M10×40 304", "套", "800", "P01金属仓", "吴冰", "生产调度中心", "401-公辅设施", "2023-02-14"),
    ("W004-00011", "工业酒精", "500ml", "瓶", "24", "P06综合仓", "夏军", "HXNI冶炼厂", "401-公辅设施", "2025-09-03"),
]

# 精简二级库（lite 模式下只支持导入与查询的简易台账）
_LITE_INVENTORY: list[tuple[str, str, str, str, str]] = [
    ("绝缘胶带", "3M 1600 18mm×20m 黑色", "卷", "60", "日常检修耗材"),
    ("尼龙扎带", "4×200mm 白色", "包", "35", ""),
    ("线号管", "φ2.5 白色", "卷", "12", "柜内配线标识"),
    ("铜接线端子", "DT-70", "个", "40", "电缆头制作"),
    ("镀锌线槽", "100×50mm", "米", "60", "电缆桥架整改"),
    ("砂纸", "400 目", "张", "200", "柜内除锈打磨"),
    ("接线端子", "UK-2.5B 灰", "个", "1500", ""),
    ("万用表保险管", "DMM-11A 10A", "个", "30", "仪表班备件"),
]

# 周期性计划模板（每月固定补充）
_PLAN_TEMPLATES: list[dict[str, Any]] = [
    {
        "code": "E014-00007", "qty": "60", "person": "周立新", "responsible": "郑文斌",
        "usage": "日常检修耗材补充", "subitem_no": "305", "remark": "每月按实际消耗补充",
    },
    {
        "code": "E011-00521", "qty": "30", "person": "孙浩宇", "responsible": "黄立群",
        "usage": "柜门指示灯更换", "subitem_no": "305", "remark": "",
    },
    {
        "code": "E011-00602", "qty": "500", "person": "陈志远", "responsible": "郑文斌",
        "usage": "柜内配线耗材补充", "subitem_no": "201", "remark": "",
    },
    {
        "code": "E011-00644", "qty": "20", "person": "刘振华", "responsible": "吴德海",
        "usage": "仪表班万用表保险管补充", "subitem_no": "305", "remark": "按季度补充",
    },
]

# 备忘录
_MEMOS: list[dict[str, Any]] = [
    {
        "title": "9 月二级库盘点安排",
        "content": "9 月 18 日下班前完成二级库盘点，重点核对熔断器芯、指示灯、温湿度控制器的账实差异；盘点差异在下月 5 日前开出库冲销。",
        "created_at": "2026-09-10T08:40:00+08:00",
        "updated_at": "2026-09-12T16:20:00+08:00",
        "version": 2,
    },
    {
        "title": "低库存物资补库提醒",
        "content": "中间继电器、指示灯、接近开关、温湿度控制器已低于补库下限，已在申购计划里开出补库条目，请申购员本周内完成编码与转申购记录。",
        "created_at": "2026-09-08T09:05:00+08:00",
        "updated_at": "2026-09-08T09:05:00+08:00",
        "version": 1,
    },
    {
        "title": "变频器拆机件登记要求",
        "content": "变频器、软启动器属高价备件，出库前须在备注里写明原设备位号，拆机件入库后单独登记参数（功率、电压等级、使用时长）。",
        "created_at": "2026-08-18T14:10:00+08:00",
        "updated_at": "2026-08-18T14:10:00+08:00",
        "version": 1,
    },
]

# 小程序用户（扫码出库领用人；同一人可能在多个小程序里各有一条身份）
_MINI_PROGRAM_USERS: list[dict[str, Any]] = [
    {
        "display_name": "孙浩宇",
        "department_name": _DEMAND_DEPARTMENT,
        "enabled": True,
        "identities": [
            ("wx9d2f1c8a5b3e4701", "oHXNI-9f3c1d2a8b7e4f5c", "2026-08-14T10:20:00+08:00"),
            ("wx4b7e0a6d2c918f35", "oHXNI-1a2b3c4d5e6f7a8b", "2026-09-02T09:35:00+08:00"),
        ],
        "created_at": "2026-08-14T10:20:00+08:00",
        "updated_at": "2026-09-02T09:35:00+08:00",
        "last_used_at": "2026-09-13T09:12:00+08:00",
        "version": 2,
    },
    {
        "display_name": "李建军",
        "department_name": _DEMAND_DEPARTMENT,
        "enabled": True,
        "identities": [("wx9d2f1c8a5b3e4701", "oHXNI-2c4d6e8f0a1b3c5d", "2026-08-14T10:26:00+08:00")],
        "created_at": "2026-08-14T10:26:00+08:00",
        "updated_at": "2026-08-14T10:26:00+08:00",
        "last_used_at": "2026-09-06T14:05:00+08:00",
        "version": 1,
    },
    {
        "display_name": "王海涛",
        "department_name": _DEMAND_DEPARTMENT,
        "enabled": False,
        "identities": [("wx9d2f1c8a5b3e4701", "oHXNI-3e5f7a9b1c2d4e6f", "2026-08-15T08:12:00+08:00")],
        "created_at": "2026-08-15T08:12:00+08:00",
        "updated_at": "2026-09-04T11:02:00+08:00",
        "last_used_at": "2026-08-15T08:12:00+08:00",
        "version": 2,
    },
]

# 系统登录账号（文档站演示页的登录账号与之一致；密码均为 123456）
_USERS: list[dict[str, Any]] = [
    {
        "username": "admin",
        "display_name": "系统管理员",
        "role": "SUPER_ADMIN",
        "api_token": "6f1c2a34-9b8e-4c11-8a52-7d0e4b1c9a21",
    },
    {
        "username": "warehouse",
        "display_name": "仓库管理员",
        "role": "WAREHOUSE_ADMIN",
        "api_token": "2b7e9d10-3f4a-4c8b-9e12-6a5d3f1c08b7",
    },
    {
        "username": "purchase",
        "display_name": "申购管理员",
        "role": "PURCHASE_ADMIN",
        "api_token": "a4c8e2f6-1b3d-4e7a-8c95-2f6d1a0e4b73",
    },
    {
        "username": "readonly",
        "display_name": "只读用户",
        "role": "READ_ONLY",
        "api_token": "d1b7f3a5-6c2e-49d8-b1a4-3e8c7f2d5a60",
    },
]

# 小程序 appid（同一套系统可挂多个小程序）
_MINI_PROGRAM_APP_IDS = ["wx9d2f1c8a5b3e4701", "wx4b7e0a6d2c918f35"]
_AI_ENDPOINT = "https://api.deepseek.com/v1"
_AI_MODEL = "deepseek-chat"
_AI_API_KEY = "sk-4f2c1a4e8b7d4c1e9f2a5d6e7f8a9b0c"
_IMAGE_SERVER = "https://img.hxni-electrical.com"
_FEISHU_HOOK = "https://open.feishu.cn/open-apis/bot/v2/hook/8f0c2b74-5d19-4a63-9c81-2e7b4a0d5f13"
_DINGTALK_HOOK = "https://oapi.dingtalk.com/robot/send?access_token=9c1d4f7a2b6e8c0d3f5a7b9c1e2d4f60"
# 分享链接 token 与文件 uuid 也都是库里的真实形态（v7 时间序 UUID）
_SHARE_TOKEN = "0198f3a7-2c00-7000-8000-000000000001"
_ACCESS_TOKEN = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJTVVBFUl9BRE1JTiIsImV4cCI6MTc1Nzc2MDYwMH0"
    ".7Ql3Yk8mZ0dW1nXvT4bC2rP6sJ9aH5eF1uG0iO3kM8Q"
)


# ---------------------------------------------------------------------------
# 二、派生台账（保证跨字段自洽：库存 = 期初 + 流水，统计 = rows 聚合）
# ---------------------------------------------------------------------------
def _decimal(value: Any) -> Decimal:
    return Decimal(str(value))


def _qty(value: Any) -> str:
    """按后端 `json_encoders`（`format(value.normalize(), "f")`）序列化数量。"""
    return format(_decimal(value).normalize(), "f")


def _digest(seed: str) -> str:
    """确定性摘要（sha256 十六进制），用来生成形态真实、可复现的 id。"""
    return hashlib.sha256(f"hxni-electrical:{seed}".encode()).hexdigest()


def _uuid(seed: int | str) -> str:
    """确定性 UUID（v4 形态）。"""
    digest = _digest(f"uuid:{seed}")
    return f"{digest[:8]}-{digest[8:12]}-4{digest[13:16]}-a{digest[17:20]}-{digest[20:32]}"


def _file_id(seed: int | str) -> str:
    """确定性文件 UUID（v7 形态，与后端 `file_object.id` 的格式一致）。"""
    digest = _digest(f"file:{seed}")
    return f"{digest[:8]}-{digest[8:12]}-7{digest[13:16]}-8{digest[17:20]}-{digest[20:32]}"


def _file_row(seed: int, original_name: str, size_bytes: int = 486912) -> dict[str, Any]:
    return {
        "id": _file_id(seed),
        "original_name": original_name,
        "mime_type": "image/jpeg",
        "size_bytes": size_bytes,
        "width": 1600,
        "height": 1200,
    }


# 物资编码 → (名称, 型号规格, 单位, 分类)：二级库物资 + 仅存在于编码库的物资
_CODEBOOK: dict[str, tuple[str, str, str, str]] = {
    item["code"]: (item["name"], item["model_spec"], item["unit_name"], item["category"])
    for item in _MATERIALS
}
_CODEBOOK.update(_EXTRA_CODES)
for _row in _HX_INVENTORY:
    # 华星库存里的同名编码必须与编码库一致，否则说明台账写错了
    _existing = _CODEBOOK.get(_row[0])
    assert _existing is None or _existing[:3] == _row[1:4], f"编码 {_row[0]} 的名称/规格/单位在两处不一致"
    _CODEBOOK.setdefault(_row[0], (_row[1], _row[2], _row[3], "备品备件"))

_MATERIAL_IDS = {item["code"]: index for index, item in enumerate(_MATERIALS, start=1)}


def _play_operations() -> dict[str, Any]:
    """按时间回放流水，得出每条明细的前后库存、每个物资的结存与冲销关系。"""
    ordered = sorted(_OPERATIONS, key=lambda step: step["at"])
    rows: list[dict[str, Any]] = []
    balances = {item["code"]: _decimal(item["opening"]) for item in _MATERIALS}
    operated: set[str] = set()
    row_by_at: dict[str, dict[str, Any]] = {}
    for index, step in enumerate(ordered, start=1):
        operation_type = step["type"]
        prefix = "IN" if operation_type == "INBOUND" else "OUT"
        lines: list[dict[str, Any]] = []
        for line_index, (code, quantity) in enumerate(step["lines"], start=1):
            material = next(item for item in _MATERIALS if item["code"] == code)
            amount = _decimal(quantity)
            before = balances[code]
            after = before + amount if operation_type == "INBOUND" else before - amount
            assert after >= 0, f"{code} 的流水把库存冲成负数：{after}"
            balances[code] = after
            operated.add(code)
            lines.append(
                {
                    "id": index * 10 + line_index,
                    "stock_material_id": _MATERIAL_IDS[code],
                    "material_name": material["name"],
                    "model_spec": material["model_spec"],
                    "unit_name": material["unit_name"],
                    "quantity": _qty(amount),
                    "remaining_qty": _qty(amount),
                    "before_qty": _qty(before),
                    "after_qty": _qty(after),
                }
            )
        row = {
            "id": index,
            "operation_no": f"{prefix}{step['at'][:10].replace('-', '')}{index:06d}",
            "operation_type": operation_type,
            "occurred_at": step["at"],
            "business_reason": step["reason"],
            "receiver_unit": step.get("receiver_unit"),
            "receiver_name": step.get("receiver_name"),
            "subitem_no": step.get("subitem_no"),
            "source_type": step.get("source_type", "MANUAL"),
            "reversal_of_id": None,
            "is_reversed": False,
            "client_request_id": _uuid(9000 + index),
            "mini_program_user_name": (
                step.get("receiver_name") if step.get("source_type") == "MINI_PROGRAM" else None
            ),
            "lines": lines,
            "created_at": step["at"],
            "version": 1,
        }
        rows.append(row)
        row_by_at[step["at"]] = row
    # 冲销关系：冲销流水指向原流水，并回写原明细的剩余可冲数量
    for step, row in zip(ordered, rows, strict=True):
        origin_at = step.get("reversal_of_at")
        if origin_at is None:
            continue
        origin = row_by_at[origin_at]
        row["reversal_of_id"] = origin["id"]
        row["is_reversed"] = True
        for line in row["lines"]:
            origin_line = next(
                item for item in origin["lines"] if item["stock_material_id"] == line["stock_material_id"]
            )
            origin_line["remaining_qty"] = _qty(
                _decimal(origin_line["remaining_qty"]) - _decimal(line["quantity"])
            )
    return {"rows": rows, "balances": balances, "operated": operated}


_LEDGER = _play_operations()


def _material_rows() -> list[dict[str, Any]]:
    """二级库物资列表（当前库存、是否有流水、更新时间都由流水推导）。"""
    rows: list[dict[str, Any]] = []
    for index, item in enumerate(_MATERIALS, start=1):
        touched = [row for row in _LEDGER["rows"] if any(
            line["stock_material_id"] == index for line in row["lines"]
        )]
        images = [
            _file_row(index * 10 + offset, name, size)
            for offset, (name, size) in enumerate(item["images"], start=1)
        ]
        rows.append(
            {
                "id": index,
                "uuid": _uuid(index),
                "name": item["name"],
                "name_id": item["code"],
                "alias": item["alias"],
                "model_spec": item["model_spec"],
                "unit_name": item["unit_name"],
                "remark": item["remark"] or None,
                "current_qty": _qty(_LEDGER["balances"][item["code"]]),
                "images": images,
                "replenishment_policy": {
                    "minimum_qty": item["minimum_qty"],
                    "enabled": True,
                    "version": 1,
                },
                "has_operation_records": item["code"] in _LEDGER["operated"],
                "created_at": _STOCK_CREATED_AT,
                "updated_at": touched[-1]["occurred_at"] if touched else _STOCK_CREATED_AT,
                "version": 1 + len(touched),
            }
        )
    return rows


def _balance_rows() -> list[dict[str, Any]]:
    """库存余额（含低库存判定；建议申购量取近 6 个月出库量）。"""
    rows: list[dict[str, Any]] = []
    for material in _material_rows():
        minimum = _decimal(material["replenishment_policy"]["minimum_qty"])
        current = _decimal(material["current_qty"])
        consumed = sum(
            (
                _decimal(line["quantity"])
                for row in _LEDGER["rows"]
                if row["operation_type"] == "OUTBOUND" and row["source_type"] != "REVERSAL"
                for line in row["lines"]
                if line["stock_material_id"] == material["id"]
            ),
            Decimal(0),
        )
        rows.append(
            {
                "stock_material_id": material["id"],
                "name": material["name"],
                "alias": material["alias"],
                "model_spec": material["model_spec"],
                "unit_name": material["unit_name"],
                "current_qty": material["current_qty"],
                "minimum_qty": material["replenishment_policy"]["minimum_qty"],
                "is_low_stock": current <= minimum,
                "suggested_purchase_qty": _qty(consumed),
                "updated_at": material["updated_at"],
            }
        )
    return rows


def _plan_rows() -> list[dict[str, Any]]:
    """申购计划列表；plan_no 按 `PLAN-YYYYMMDD-NNN` 规则按日期顺序生成。"""
    sequence: dict[str, int] = {}
    rows: list[dict[str, Any]] = []
    for index, item in enumerate(_PURCHASE_PLANS, start=1):
        sequence[item["date"]] = sequence.get(item["date"], 0) + 1
        date_compact = item["date"].replace("-", "")
        code = item.get("code")
        if code is None:
            name, model_spec, unit_name, category = (
                item["name"],
                item["model_spec"],
                item["unit_name"],
                item["category"],
            )
        else:
            name, model_spec, unit_name, category = _CODEBOOK[code]
        rows.append(
            {
                "id": index,
                "plan_no": f"PLAN-{date_compact}-{sequence[item['date']]:03d}",
                "plan_date": item["date"],
                "material_code": code,
                "category": category,
                "urgency": item.get("urgency", "正常"),
                "demand_department": _DEMAND_DEPARTMENT,
                "name": name,
                "model_spec": model_spec,
                "unit_name": unit_name,
                "actual_demand_person": item["person"],
                "purchase_responsible": item["responsible"],
                "planned_qty": _qty(item["qty"]),
                "usage": item["usage"],
                "subitem_no": item["subitem_no"],
                "remark": item.get("remark") or None,
                "stock_material_id": _MATERIAL_IDS.get(code),
                "stock_material_name": name if code in _MATERIAL_IDS else None,
                "status": item.get("status", "正常"),
                "moved_to_record": bool(item.get("moved_to_record")),
                "images": [],
                "created_at": f"{item['date']}T08:30:00+08:00",
                "updated_at": f"{item['date']}T08:30:00+08:00",
                "version": item.get("version", 1),
            }
        )
    return rows


def _record_rows() -> list[dict[str, Any]]:
    """申购记录（申购请求明细行，字段全部为转入时的计划快照）。"""
    plans = {row["plan_no"]: row for row in _PLAN_ROWS}
    rows: list[dict[str, Any]] = []
    line_id = 0
    for request_index, request in enumerate(_PURCHASE_REQUESTS, start=1):
        for line in request["lines"]:
            line_id += 1
            plan = plans[line["plan_no"]]
            rows.append(
                {
                    "line_id": line_id,
                    "purchase_request_id": request_index,
                    "purchase_material_id": plan["id"],
                    "plan_no": plan["plan_no"],
                    "plan_date": plan["plan_date"],
                    "purchase_order_no": request["order_no"],
                    "trace_no": request["trace_no"],
                    "contract_no": request["contract_no"],
                    "vessel_no": request["vessel_no"],
                    "consolidation_date": request["consolidation_date"],
                    "consolidation_port": request["consolidation_port"],
                    "sailing_date": request["sailing_date"],
                    "contract_sign_date": line.get("contract_sign_date"),
                    "status": line["status"],
                    "material_code": plan["material_code"],
                    "category": plan["category"],
                    "demand_department": plan["demand_department"],
                    "material_name": plan["name"],
                    "model_spec": plan["model_spec"],
                    "unit_name": plan["unit_name"],
                    "purchase_qty": plan["planned_qty"],
                    "actual_demand_person": plan["actual_demand_person"],
                    "purchase_responsible": plan["purchase_responsible"],
                    "salesperson": line.get("salesperson"),
                    "plan_remark": plan["remark"],
                    "record_remark": request["remark"],
                    "usage": plan["usage"],
                    "subitem_no": plan["subitem_no"],
                    "images": plan["images"],
                    "stock_material_id": plan["stock_material_id"],
                    "purchase_date": request["date"],
                    "created_at": f"{request['date']}T09:00:00+08:00",
                    "updated_at": f"{request['date']}T09:00:00+08:00",
                    "version": 1,
                }
            )
    return rows


def _code_library_rows() -> list[dict[str, Any]]:
    """物资编码库（ERP 导出的编码对照表，编码在台账里出现的都登记）。"""
    return [
        {
            "id": index,
            "material_code": code,
            "name": name,
            "model_spec": model_spec,
            "unit_name": unit_name,
        }
        for index, (code, (name, model_spec, unit_name, _)) in enumerate(_CODEBOOK.items(), start=1)
    ]


def _distinct(values: list[Any]) -> list[str]:
    return sorted({str(value) for value in values if value})


def _page(items: list[Any]) -> dict[str, Any]:
    """一页示例：条数不超过 page_size，total 就是本页条数（不编造不存在的行）。"""
    page_size = 20 if len(items) <= 20 else 50 if len(items) <= 50 else 200
    return {"items": items, "page": 1, "page_size": page_size, "total": len(items)}


_MATERIAL_ROWS = _material_rows()
_BALANCE_ROWS = _balance_rows()
_PLAN_ROWS = _plan_rows()
_RECORD_ROWS = _record_rows()
_CODE_ROWS = _code_library_rows()
_LOW_STOCK_ROWS = [row for row in _BALANCE_ROWS if row["is_low_stock"]]
_CHRONOLOGICAL = _LEDGER["rows"]
_MINI_PROGRAM_OPERATIONS = [row for row in _CHRONOLOGICAL if row["source_type"] == "MINI_PROGRAM"]


def _plan_templates() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for index, item in enumerate(_PLAN_TEMPLATES, start=1):
        name, model_spec, unit_name, category = _CODEBOOK[item["code"]]
        rows.append(
            {
                "id": index,
                "material_code": item["code"],
                "category": category,
                "urgency": "正常",
                "demand_department": _DEMAND_DEPARTMENT,
                "name": name,
                "model_spec": model_spec,
                "unit_name": unit_name,
                "actual_demand_person": item["person"],
                "purchase_responsible": item["responsible"],
                "planned_qty": _qty(item["qty"]),
                "usage": item["usage"],
                "subitem_no": item["subitem_no"],
                "remark": item["remark"] or None,
                "stock_material_id": _MATERIAL_IDS.get(item["code"]),
                "stock_material_name": name if item["code"] in _MATERIAL_IDS else None,
                "images": [],
                "created_at": "2026-06-20T09:00:00+08:00",
                "updated_at": "2026-09-01T09:00:00+08:00",
                "version": 1,
            }
        )
    return rows


_PLAN_TEMPLATE_ROWS = _plan_templates()


def _mini_program_users() -> list[dict[str, Any]]:
    return [
        {
            "id": index,
            "display_name": item["display_name"],
            "department_name": item["department_name"],
            "enabled": item["enabled"],
            "identities": [
                {
                    "id": index * 10 + offset,
                    "app_id": app_id,
                    "wechat_openid": openid,
                    "created_at": created_at,
                }
                for offset, (app_id, openid, created_at) in enumerate(item["identities"], start=1)
            ],
            "created_at": item["created_at"],
            "updated_at": item["updated_at"],
            "last_used_at": item["last_used_at"],
            "version": item["version"],
        }
        for index, item in enumerate(_MINI_PROGRAM_USERS, start=1)
    ]


def _user_rows() -> list[dict[str, Any]]:
    return [
        {
            "id": index,
            "username": item["username"],
            "display_name": item["display_name"],
            "role": item["role"],
            "enabled": True,
            "version": 1,
        }
        for index, item in enumerate(_USERS, start=1)
    ]


_MINI_PROGRAM_USER_ROWS = _mini_program_users()
_USER_ROWS = _user_rows()


# ===========================================================================
# 三、关键 schema 的手写示例
# ===========================================================================
def _ref(name: str) -> dict[str, str]:
    """占位引用，`resolve_refs` 会替换成被引用 schema 的示例。"""
    return {"__ref__": f"#/components/schemas/{name}"}


def _share_row(token: str, share_type: str, item_count: int) -> dict[str, Any]:
    return {
        "token": token,
        "share_type": share_type,
        "item_count": item_count,
        "expires_at": "2026-10-13T10:30:00+08:00",
        "created_at": "2026-09-13T09:40:00+08:00",
        "columns": ["plan_no", "material_code", "material_name", "model_spec", "unit_name", "planned_qty"],
    }


def _mini_program_outbound_read(row: dict[str, Any], line: dict[str, Any]) -> dict[str, Any]:
    """小程序出库回执（物资与数量取该流水明细，避免与台账两处对不上）。"""
    material = _MATERIAL_ROWS[line["stock_material_id"] - 1]
    return {
        "operation_id": row["id"],
        "operation_no": row["operation_no"],
        "material_uuid": material["uuid"],
        "material_name": line["material_name"],
        "model_spec": line["model_spec"],
        "unit_name": line["unit_name"],
        "quantity": line["quantity"],
        "before_qty": line["before_qty"],
        "after_qty": line["after_qty"],
        "occurred_at": row["occurred_at"],
        "business_reason": row["business_reason"],
        "receiver_unit": row["receiver_unit"],
        "receiver_name": row["receiver_name"],
        "subitem_no": row["subitem_no"],
        "executed_by": row["mini_program_user_name"],
    }


def _mini_program_operation_read(row: dict[str, Any]) -> dict[str, Any]:
    """小程序出库记录（取该流水的第一条明细，数量与前后库存直接来自台账）。"""
    line = row["lines"][0]
    return {
        "operation_id": row["id"],
        "operation_no": row["operation_no"],
        "operation_type": row["operation_type"],
        "material_name": line["material_name"],
        "model_spec": line["model_spec"],
        "unit_name": line["unit_name"],
        "quantity": line["quantity"],
        "before_qty": line["before_qty"],
        "after_qty": line["after_qty"],
        "occurred_at": row["occurred_at"],
        "business_reason": row["business_reason"],
        "receiver_unit": row["receiver_unit"],
        "receiver_name": row["receiver_name"],
        "subitem_no": row["subitem_no"],
        "executed_by": row["mini_program_user_name"],
    }


def _build_schema_examples() -> dict[str, Any]:
    material = _MATERIAL_ROWS[0]
    plan = _PLAN_ROWS[0]
    record = _RECORD_ROWS[0]
    outbound = next(row for row in _CHRONOLOGICAL if row["operation_type"] == "OUTBOUND")
    mini = _MINI_PROGRAM_USER_ROWS[0]
    mini_operation = _MINI_PROGRAM_OPERATIONS[-1]
    mini_line = mini_operation["lines"][0]
    return {
        # —— 错误与认证 ——
        "ApiError": {
            "code": "NOT_FOUND",
            "message": "二级库物资不存在",
            "details": {"material_id": 404},
            "request_id": _uuid(5001),
        },
        "LoginRequest": {"username": "admin", "password": "123456"},
        "LoginResponse": {
            "access_token": _ACCESS_TOKEN,
            "refresh_token": _ACCESS_TOKEN,
            "token_type": "bearer",
            "user": _USER_ROWS[0],
        },
        "RefreshTokenRequest": {"refresh_token": _ACCESS_TOKEN},
        "TokenPairResponse": {
            "access_token": _ACCESS_TOKEN,
            "refresh_token": _ACCESS_TOKEN,
            "token_type": "bearer",
        },
        # —— 用户与小程序用户 ——
        "UserRead": _USER_ROWS[0],
        "UserCreate": {
            "username": "warehouse",
            "password": "123456",
            "display_name": "仓库管理员",
            "role": "WAREHOUSE_ADMIN",
            "enabled": True,
        },
        "UserUpdate": {
            "username": "warehouse",
            "display_name": "仓库管理员",
            "password": "123456",
            "role": "WAREHOUSE_ADMIN",
            "enabled": True,
            "version": 2,
        },
        "UserApiTokenRead": {**_USER_ROWS[1], "api_token": _USERS[1]["api_token"]},
        "UserApiTokenRegenerate": {"version": 1},
        "Page_UserApiTokenRead_": _page(
            [{**_USER_ROWS[1], "api_token": _USERS[1]["api_token"]}]
        ),
        "MiniProgramUserRead": mini,
        "MiniProgramIdentityRead": mini["identities"][0],
        "MiniProgramUserUpdate": {
            "display_name": mini["display_name"],
            "department_name": mini["department_name"],
            "enabled": True,
            "version": mini["version"],
        },
        "MiniProgramUserMergeRequest": {"source_user_id": 3, "source_version": 2, "target_version": 2},
        "MiniProgramProfileUpdate": {
            "display_name": mini["display_name"],
            "department_name": mini["department_name"],
        },
        "MiniProgramWechatLoginRequest": {"code": "0a3Fk2ll2xQnkg4YzQml2aGkQp3Fk2lJ", "app_id": _MINI_PROGRAM_APP_IDS[0]},
        "MiniProgramLoginResponse": {
            "access_token": _ACCESS_TOKEN,
            "registration_token": None,
            "token_type": "bearer",
            "user": mini,
            "requires_profile": False,
        },
        "Page_MiniProgramUserRead_": _page(_MINI_PROGRAM_USER_ROWS),
        # —— 二级库物资与库存 ——
        "FileObjectRead": _file_row(1, "交流接触器-CJX2-2510-正面.jpg", 486912),
        "StockMaterialRead": material,
        "StockMaterialCreate": {
            "name": "塑壳断路器",
            "name_id": "E011-00308",
            "alias": "塑壳",
            "model_spec": "NM1-125S/3300 100A",
            "unit_name": "个",
            "remark": "配电柜总开关备件",
            "image_ids": [_file_id(301)],
        },
        "StockMaterialUpdate": {
            "name": "塑壳断路器",
            "name_id": "E011-00308",
            "alias": "塑壳",
            "model_spec": "NM1-125S/3300 100A",
            "unit_name": "个",
            "remark": "配电柜总开关备件",
            "image_ids": [_file_id(301)],
            "version": 2,
        },
        "Page_StockMaterialRead_": _page(_MATERIAL_ROWS),
        "ReplenishmentPolicyRead": material["replenishment_policy"],
        "ReplenishmentPolicyWrite": {
            "minimum_qty": material["replenishment_policy"]["minimum_qty"],
            "enabled": True,
            "version": 1,
        },
        "ReplenishmentDefaultsRead": {
            "purchase_responsible": "吴德海",
            "demand_date": _LATEST_DATE,
        },
        "ReplenishmentDraftCreate": {
            "planned_qty": "12",
            "demand_date": _LATEST_DATE,
            "actual_demand_person": "周立新",
            "purchase_responsible": "吴德海",
        },
        "ReplenishmentDraftRead": {
            "next": "purchase_material",
            "resource_id": len(_PLAN_ROWS) + 1,
        },
        "InventoryBalanceRead": _BALANCE_ROWS[0],
        "Page_InventoryBalanceRead_": _page(_BALANCE_ROWS),
        "LinkStockMaterialRequest": {"stock_material_id": material["id"], "version": plan["version"]},
        # —— 出入库流水 ——
        "StockOperationLineRead": outbound["lines"][0],
        "StockOperationRead": outbound,
        "Page_StockOperationRead_": _page(list(reversed(_LEDGER["rows"]))),
        "OperationLineWrite": {"stock_material_id": material["id"], "quantity": "2"},
        "OperationCreate": {
            "client_request_id": _uuid(7001),
            "occurred_at": "2026-09-12T09:40:00+08:00",
            "source_type": "MANUAL",
            "business_reason": "1#回转窑控制柜检修备件领用",
            "receiver_unit": "电气检修一班",
            "receiver_name": "李建军",
            "subitem_no": "201",
            "lines": [{"stock_material_id": material["id"], "quantity": "2"}],
        },
        "OperationUpdate": {
            "version": outbound["version"],
            "operation_type": outbound["operation_type"],
            "occurred_at": outbound["occurred_at"],
            "source_type": outbound["source_type"],
            "business_reason": outbound["business_reason"],
            "receiver_unit": outbound["receiver_unit"],
            "receiver_name": outbound["receiver_name"],
            "subitem_no": outbound["subitem_no"],
            "lines": [
                {
                    "stock_material_id": line["stock_material_id"],
                    "quantity": line["quantity"],
                }
                for line in outbound["lines"]
            ],
        },
        "ReverseOperationRequest": {
            "client_request_id": _uuid(7002),
            "reason": "领用退回：现场未使用",
            "lines": [{"stock_material_id": outbound["lines"][0]["stock_material_id"], "quantity": "1"}],
        },
        # —— 华星总库存与精简库存 ——
        "HuaXingInventoryRead": {
            "id": 1,
            "first_inbound_date": _HX_INVENTORY[0][9],
            "warehouse": _HX_INVENTORY[0][5],
            "material_code": _HX_INVENTORY[0][0],
            "name": _HX_INVENTORY[0][1],
            "model_spec": _HX_INVENTORY[0][2],
            "quantity": _qty(_HX_INVENTORY[0][4]),
            "unit_name": _HX_INVENTORY[0][3],
            "purchaser": _HX_INVENTORY[0][6],
            "purchase_department": _HX_INVENTORY[0][7],
            "subitem_no_name": _HX_INVENTORY[0][8],
        },
        "Page_HuaXingInventoryRead_": _page(_hua_xing_rows()),
        "HuaXingFilterOptions": {
            "purchase_departments": _distinct([row[7] for row in _HX_INVENTORY]),
            "purchasers": _distinct([row[6] for row in _HX_INVENTORY]),
        },
        "LastImportRead": {"last_import_at": "2026-09-12T18:20:00+08:00"},
        "LiteInventoryRead": {
            "id": 1,
            "name": _LITE_INVENTORY[0][0],
            "model_spec": _LITE_INVENTORY[0][1],
            "unit_name": _LITE_INVENTORY[0][2],
            "quantity": _qty(_LITE_INVENTORY[0][3]),
            "remark": _LITE_INVENTORY[0][4] or None,
        },
        "Page_LiteInventoryRead_": _page(_lite_rows()),
        # —— 物资编码库 ——
        "MaterialCodeLibraryRead": _CODE_ROWS[0],
        "Page_MaterialCodeLibraryRead_": _page(_CODE_ROWS),
        "MaterialCodeExistsRead": {"material_code": _CODE_ROWS[0]["material_code"], "exists": True},
        # —— 申购计划与申购记录 ——
        "PurchaseMaterialRead": plan,
        "Page_PurchaseMaterialRead_": _page(_PLAN_ROWS),
        "PurchaseFilterOptions": {
            "actual_demand_persons": _distinct([row["actual_demand_person"] for row in _PLAN_ROWS]),
            "purchase_responsibles": _distinct([row["purchase_responsible"] for row in _PLAN_ROWS]),
            "subitem_nos": _distinct([row["subitem_no"] for row in _PLAN_ROWS]),
            "categories": _distinct([row["category"] for row in _PLAN_ROWS]),
        },
        "PurchaseMaterialCreate": {
            "plan_date": _LATEST_DATE,
            "material_code": "E011-00518",
            "category": "消耗物资",
            "urgency": "正常",
            "demand_department": _DEMAND_DEPARTMENT,
            "name": "按钮开关",
            "model_spec": "LA38-11 绿色",
            "unit_name": "个",
            "actual_demand_person": "孙浩宇",
            "purchase_responsible": "黄立群",
            "planned_qty": "40",
            "usage": "就地操作箱按钮更换",
            "subitem_no": "305",
            "remark": "",
            "stock_material_id": None,
            "image_ids": [],
            "status": "正常",
        },
        "PurchaseMaterialUpdate": {
            "plan_date": plan["plan_date"],
            "material_code": plan["material_code"],
            "category": plan["category"],
            "urgency": plan["urgency"],
            "demand_department": plan["demand_department"],
            "name": plan["name"],
            "model_spec": plan["model_spec"],
            "unit_name": plan["unit_name"],
            "actual_demand_person": plan["actual_demand_person"],
            "purchase_responsible": plan["purchase_responsible"],
            "planned_qty": plan["planned_qty"],
            "usage": plan["usage"],
            "subitem_no": plan["subitem_no"],
            "remark": plan["remark"] or "",
            "stock_material_id": plan["stock_material_id"],
            "image_ids": [],
            "status": plan["status"],
            "version": plan["version"],
        },
        "PurchasePlanVersion": {"id": plan["id"], "version": plan["version"]},
        "BatchUpdatePurchasePlansRequest": {
            "materials": [{"id": plan["id"], "version": plan["version"]}],
            "plan_date": "2026-09-14",
            "urgency": "紧急",
            "purchase_responsible": "吴德海",
            "status": "正常",
        },
        "MovePurchasePlanRequest": {
            "purchase_order_no": "申购 2026/9/14",
            "trace_no": "HX20260914001",
            "contract_no": "HX-CG-2026-0190",
            "vessel_no": "MV HXNI 05",
            "consolidation_date": "2026-09-24",
            "consolidation_port": "Morowali",
            "sailing_date": "2026-09-29",
            "contract_sign_date": "2026-09-20",
            "purchase_date": "2026-09-14",
            "salesperson": "何丽娟",
            "status": "已申购",
            "record_remark": "9 月低库存补库整单申购",
        },
        "BatchMovePurchasePlansRequest": {
            **_move_request_common(),
            "material_ids": [plan["id"]],
        },
        "PurchaseRecordRead": record,
        "Page_PurchaseRecordRead_": _page(_RECORD_ROWS),
        "PurchaseRecordFilterOptions": {
            "actual_demand_persons": _distinct([row["actual_demand_person"] for row in _RECORD_ROWS]),
            "purchase_responsibles": _distinct([row["purchase_responsible"] for row in _RECORD_ROWS]),
            "subitem_nos": _distinct([row["subitem_no"] for row in _RECORD_ROWS]),
            "categories": _distinct([row["category"] for row in _RECORD_ROWS]),
            "salespersons": _distinct([row["salesperson"] for row in _RECORD_ROWS]),
            "statuses": _distinct([row["status"] for row in _RECORD_ROWS]),
        },
        "PurchaseRecordVersion": {"line_id": record["line_id"], "version": record["version"]},
        "PurchaseRecordUpdate": {
            **_record_update_fields(record),
            "purchase_order_no": record["purchase_order_no"],
            "trace_no": record["trace_no"],
            "contract_no": record["contract_no"],
            "record_remark": record["record_remark"],
        },
        "PurchaseRecordBatchUpdate": {
            "records": [{"line_id": record["line_id"], "version": record["version"]}],
            "status": "部分入库",
            "salesperson": "马晓东",
            "contract_sign_date": "2026-08-25",
        },
        "BatchUpdatePurchaseRecordsRequest": {
            "records": [{"line_id": record["line_id"], "version": record["version"]}],
            "plan_date": record["plan_date"],
            "purchase_order_no": record["purchase_order_no"],
            "trace_no": record["trace_no"],
            "contract_no": record["contract_no"],
            "vessel_no": record["vessel_no"],
            "consolidation_date": record["consolidation_date"],
            "consolidation_port": record["consolidation_port"],
            "sailing_date": record["sailing_date"],
            "contract_sign_date": record["contract_sign_date"],
            "purchase_date": record["purchase_date"],
            "actual_demand_person": record["actual_demand_person"],
            "purchase_responsible": record["purchase_responsible"],
            "salesperson": record["salesperson"],
            "status": "已采购",
            "record_remark": record["record_remark"],
        },
        # —— 周期性计划 ——
        "PurchasePlanTemplateRead": _PLAN_TEMPLATE_ROWS[0],
        "Page_PurchasePlanTemplateRead_": _page(_PLAN_TEMPLATE_ROWS),
        "PurchasePlanTemplateCreate": _template_write(_PLAN_TEMPLATE_ROWS[0]),
        "PurchasePlanTemplateUpdate": {**_template_write(_PLAN_TEMPLATE_ROWS[0]), "version": 1},
        "PurchasePlanTemplateFilterOptions": {
            "actual_demand_persons": _distinct(
                [row["actual_demand_person"] for row in _PLAN_TEMPLATE_ROWS]
            ),
            "purchase_responsibles": _distinct(
                [row["purchase_responsible"] for row in _PLAN_TEMPLATE_ROWS]
            ),
            "categories": _distinct([row["category"] for row in _PLAN_TEMPLATE_ROWS]),
        },
        # —— 分享链接 ——
        "ShareRead": _share_row(_SHARE_TOKEN, "purchase_plan", 2),
        "ShareListRead": {
            **_share_row(_SHARE_TOKEN, "purchase_plan", 2),
            "created_by": _USER_ROWS[2]["id"],
            "created_by_name": _USER_ROWS[2]["display_name"],
        },
        "Page_ShareListRead_": _page(
            [
                {
                    **_share_row(_SHARE_TOKEN, "purchase_plan", 2),
                    "created_by": _USER_ROWS[2]["id"],
                    "created_by_name": _USER_ROWS[2]["display_name"],
                }
            ]
        ),
        "ShareCreateRequest": {
            "share_type": "purchase_plan",
            "item_ids": [plan["id"], _PLAN_ROWS[7]["id"]],
            "expires_in": "7d",
            "columns": ["plan_no", "material_code", "material_name", "model_spec", "unit_name", "planned_qty"],
        },
        "ShareUpdateRequest": {"columns": ["plan_no", "material_name", "planned_qty"], "expires_in": "30d"},
        "SharePublicView": {
            "share_type": "purchase_plan",
            "item_count": 2,
            "expires_at": "2026-10-13T10:30:00+08:00",
            "created_at": "2026-09-13T09:40:00+08:00",
            "columns": ["plan_no", "material_code", "material_name", "model_spec", "unit_name", "planned_qty"],
            "items": [
                {
                    "id": row["id"],
                    "plan_no": row["plan_no"],
                    "material_code": row["material_code"],
                    "material_name": row["name"],
                    "model_spec": row["model_spec"],
                    "unit_name": row["unit_name"],
                    "planned_qty": row["planned_qty"],
                }
                for row in (plan, _PLAN_ROWS[7])
            ],
        },
        # —— 备忘录 ——
        "MemoRead": {"id": 1, **_MEMOS[0]},
        "MemoCreate": {"title": _MEMOS[0]["title"], "content": _MEMOS[0]["content"]},
        "MemoUpdate": {
            "title": _MEMOS[0]["title"],
            "content": _MEMOS[0]["content"],
            "version": _MEMOS[0]["version"],
        },
        # —— 工作台与系统设置 ——
        "DashboardSummaryRead": {
            "stock_material_count": len(_MATERIAL_ROWS),
            "low_stock_count": len(_LOW_STOCK_ROWS),
            "uncoded_purchase_material_count": len(
                [row for row in _PLAN_ROWS if row["material_code"] is None]
            ),
            "purchase_record_count": len(_RECORD_ROWS),
        },
        "AiSearchSettingsRead": {
            "endpoint": _AI_ENDPOINT,
            "api_key": _AI_API_KEY,
            "model": _AI_MODEL,
            "enabled": True,
            "mini_program_code_env": "release",
            "mini_program_code_app_id": _MINI_PROGRAM_APP_IDS[0],
            "mini_program_app_ids": _MINI_PROGRAM_APP_IDS,
            "mini_program_registration_enabled": True,
            "mini_program_new_user_enabled": True,
            "image_acceleration_server_url": _IMAGE_SERVER,
            "inventory_mode": "read_write",
            "huaxing_inventory_mode": "query_only",
            "purchase_plans_mode": "query_only",
            "purchase_records_mode": "query_only",
            "material_codes_mode": "query_only",
            "secondary_warehouse_mode": "full",
            "updated_at": _LATEST_STAMP,
            "version": 3,
        },
        "AiSearchSettingsUpdate": {
            "endpoint": _AI_ENDPOINT,
            "api_key": _AI_API_KEY,
            "model": _AI_MODEL,
            "enabled": True,
            "mini_program_code_env": "release",
            "mini_program_code_app_id": _MINI_PROGRAM_APP_IDS[0],
            "mini_program_registration_enabled": True,
            "mini_program_new_user_enabled": True,
            "image_acceleration_server_url": _IMAGE_SERVER,
            "inventory_mode": "read_write",
            "huaxing_inventory_mode": "query_only",
            "purchase_plans_mode": "query_only",
            "purchase_records_mode": "query_only",
            "material_codes_mode": "query_only",
            "secondary_warehouse_mode": "full",
            "version": 3,
        },
        "AiSearchStatusRead": {"available": True},
        "AiSearchExpandRequest": {"value": "电机|接触器"},
        "AiSearchExpandRead": {"original": "电机|接触器", "expanded": "电机|电动机|接触器"},
        "AiSearchTestRequest": {"endpoint": _AI_ENDPOINT, "api_key": _AI_API_KEY, "model": _AI_MODEL},
        "AiSearchTestRead": {"original": "空开", "expanded": "空开|小型断路器|微型断路器"},
        "ImageAccelerationSettingsRead": {"image_acceleration_server_url": _IMAGE_SERVER},
        "MiniProgramFeaturesRead": {
            "inventory_mode": "read_write",
            "huaxing_inventory_mode": "query_only",
            "purchase_plans_mode": "query_only",
            "purchase_records_mode": "query_only",
            "material_codes_mode": "query_only",
            "secondary_warehouse_mode": "full",
        },
        "WebhookChannelRead": {
            "platform": "FEISHU",
            "enabled": True,
            "subscribed_events": ["stock.outbound.created", "stock.inbound.created"],
            "webhook_url": _FEISHU_HOOK,
            "secret": "hxni-feishu-2026Kx7Q",
            "webhook_configured": True,
            "secret_configured": True,
            "updated_at": _LATEST_STAMP,
            "version": 2,
        },
        "WebhookChannelUpdate": {
            "enabled": True,
            "webhook_url": _DINGTALK_HOOK,
            "secret": "hxni-dingtalk-2026Wm3T",
            "subscribed_events": ["stock.outbound.created"],
            "version": 1,
        },
        "WebhookTestRequest": {"webhook_url": _FEISHU_HOOK, "secret": "hxni-feishu-2026Kx7Q"},
        "WebhookTestRead": {
            "platform": "FEISHU",
            "success": True,
            "message": "测试消息已发送",
        },
        # —— 导入导出任务与文件清理 ——
        "ExcelImportJobRead": {
            "id": 1,
            "import_type": "HUAXING_INVENTORY",
            "status": "SUCCEEDED",
            "original_filename": "华星库存导出_20260912.xlsx",
            "result": {"imported_count": len(_HX_INVENTORY)},
            "error_code": None,
            "error_message": None,
            "created_at": "2026-09-12T18:20:00+08:00",
            "started_at": "2026-09-12T18:20:01+08:00",
            "finished_at": "2026-09-12T18:20:03+08:00",
        },
        "ExcelExportJobRead": {
            "id": 1,
            "export_type": "PURCHASE_PLAN_RESULTS",
            "status": "SUCCEEDED",
            "download_filename": "申购计划导出_20260913.xlsx",
            "file_uuid": _file_id(900),
            "params": {"status": "正常", "category": "备品备件"},
            "result": {"rows": len(_PLAN_ROWS), "image_count": 0},
            "error_code": None,
            "error_message": None,
            "created_at": "2026-09-13T10:00:00+08:00",
            "started_at": "2026-09-13T10:00:01+08:00",
            "finished_at": "2026-09-13T10:00:04+08:00",
        },
        "OrphanFileRead": {
            "id": _file_id(950),
            "original_name": "IMG_20260612_103512.jpg",
            "size_bytes": 742400,
            "created_at": "2026-06-12T10:35:12+08:00",
            "file_exists": True,
        },
        "OrphanFileReportRead": {
            "cutoff": "2026-08-14T00:00:00+08:00",
            "unreferenced_records": [{
                "id": _file_id(950),
                "original_name": "IMG_20260612_103512.jpg",
                "size_bytes": 742400,
                "created_at": "2026-06-12T10:35:12+08:00",
                "file_exists": True,
            }],
            "untracked_file_names": ["IMG_20260612_103512.jpg"],
            "missing_file_ids": [_file_id(951)],
        },
        "OrphanFileCleanupRead": {
            "cutoff": "2026-08-14T00:00:00+08:00",
            "deleted_record_ids": [_file_id(950)],
            "deleted_file_names": ["IMG_20260612_103512.jpg"],
        },
        # —— 系统管理：附件管理 ——
        "AttachmentRead": {
            "id": _file_id(1),
            "original_name": "交流接触器-CJX2-2510-正面.jpg",
            "mime_type": "image/png",
            "size_bytes": 486912,
            "width": 1600,
            "height": 1200,
            "created_at": "2026-06-05T09:10:00+08:00",
            "reference_count": 1,
            "deleted_at": None,
            "file_exists": True,
        },
        "AttachmentDeleteRead": {
            "id": _file_id(952),
            "deleted_at": "2026-09-13T10:20:00+08:00",
            "purge_after": "2026-09-14T02:00:00+08:00",
        },
        "AttachmentBulkDeleteRead": {
            "deleted_count": 81,
            "purge_after": "2026-09-15T02:00:00+08:00",
        },
        "Page_AttachmentRead_": _page(
            [
                {
                    "id": _file_id(1),
                    "original_name": "交流接触器-CJX2-2510-正面.jpg",
                    "mime_type": "image/png",
                    "size_bytes": 486912,
                    "width": 1600,
                    "height": 1200,
                    "created_at": "2026-06-05T09:10:00+08:00",
                    "reference_count": 1,
                    "deleted_at": None,
                    "file_exists": True,
                },
                {
                    "id": _file_id(952),
                    "original_name": "IMG_20260612_103512.jpg",
                    "mime_type": "image/png",
                    "size_bytes": 742400,
                    "width": 1600,
                    "height": 1200,
                    "created_at": "2026-06-12T10:35:12+08:00",
                    "reference_count": 0,
                    "deleted_at": "2026-09-13T10:20:00+08:00",
                    "file_exists": True,
                },
            ]
        ),
        "VersionInfoRead": {
            "app_name": "电气车间备件管理系统",
            "version": "1.0.0",
            "commit": "9d21f4c",
            "build_time": "2026-09-13T09:00:00+08:00",
        },
        # —— 小程序：物资、流水、申购计划/记录 ——
        "MiniProgramInventoryItemRead": {
            "uuid": material["uuid"],
            "name": material["name"],
            "model_spec": material["model_spec"],
            "unit_name": material["unit_name"],
            "current_qty": material["current_qty"],
            "stock_status": "low_stock",
        },
        "Page_MiniProgramInventoryItemRead_": _page(
            [
                {
                    "uuid": row["uuid"],
                    "name": row["name"],
                    "model_spec": row["model_spec"],
                    "unit_name": row["unit_name"],
                    "current_qty": row["current_qty"],
                    "stock_status": (
                        "out_of_stock"
                        if _decimal(row["current_qty"]) == 0
                        else "low_stock"
                        if _decimal(row["current_qty"])
                        <= _decimal(row["replenishment_policy"]["minimum_qty"])
                        else "normal"
                    ),
                }
                for row in _MATERIAL_ROWS[:8]
            ]
        ),
        "MiniProgramMaterialRead": {
            "uuid": material["uuid"],
            "name": material["name"],
            "model_spec": material["model_spec"],
            "unit_name": material["unit_name"],
            "current_qty": material["current_qty"],
            "stock_status": "low_stock",
            "minimum_qty": material["replenishment_policy"]["minimum_qty"],
            "remark": material["remark"],
            "images": material["images"],
        },
        "MiniProgramHuaXingInventoryRead": _hua_xing_rows()[2],
        "Page_MiniProgramHuaXingInventoryRead_": _page(_hua_xing_rows()[:6]),
        "MiniProgramLiteInventoryItemRead": {
            "id": 1,
            "name": _LITE_INVENTORY[0][0],
            "model_spec": _LITE_INVENTORY[0][1],
            "unit_name": _LITE_INVENTORY[0][2],
            "quantity": _qty(_LITE_INVENTORY[0][3]),
        },
        "Page_MiniProgramLiteInventoryItemRead_": _page(
            [
                {
                    "id": index,
                    "name": name,
                    "model_spec": model_spec,
                    "unit_name": unit_name,
                    "quantity": _qty(quantity),
                }
                for index, (name, model_spec, unit_name, quantity, _) in enumerate(
                    _LITE_INVENTORY, start=1
                )
            ]
        ),
        "MiniProgramMaterialCodeRead": {
            "id": _CODE_ROWS[0]["id"],
            "material_code": _CODE_ROWS[0]["material_code"],
            "name": _CODE_ROWS[0]["name"],
            "model_spec": _CODE_ROWS[0]["model_spec"],
            "unit_name": _CODE_ROWS[0]["unit_name"],
        },
        "Page_MiniProgramMaterialCodeRead_": _page(_CODE_ROWS[:8]),
        "MiniProgramOperationRead": _mini_program_operation_read(mini_operation),
        "Page_MiniProgramOperationRead_": _page(
            [_mini_program_operation_read(row) for row in reversed(_MINI_PROGRAM_OPERATIONS)]
        ),
        "MiniProgramOutboundCreate": {
            "client_request_id": _uuid(7101),
            "material_uuid": material["uuid"],
            "occurred_at": mini_operation["occurred_at"],
            "quantity": "4",
            "business_reason": "就地操作箱转换开关更换",
            "receiver_unit": "电气检修二班",
            "subitem_no": "305",
        },
        "MiniProgramOutboundRead": _mini_program_outbound_read(mini_operation, mini_line),
        "MiniProgramOutboundReason": {"subitem_no": "305", "reason": "就地操作箱检修备件领用"},
        "MiniProgramOutboundReasonOptions": {
            "personal_reasons": [
                {"subitem_no": "305", "reason": "就地操作箱检修备件领用"},
                {"subitem_no": "201", "reason": "1#回转窑主电机控制柜检修更换"},
                {"subitem_no": "202", "reason": "3#破碎机电源电缆及防爆穿管更换"},
            ],
            "system_reasons": [
                {"subitem_no": "305", "reason": "2#皮带机启动回路检修"},
                {"subitem_no": "305", "reason": "仪表柜保险检查批量更换"},
                {"subitem_no": "401", "reason": "办公楼配电箱漏电保护器更换"},
            ],
        },
        "MiniProgramPurchasePlanItemRead": {
            "id": plan["id"],
            "plan_no": plan["plan_no"],
            "plan_date": plan["plan_date"],
            "name": plan["name"],
            "model_spec": plan["model_spec"],
            "unit_name": plan["unit_name"],
            "planned_qty": plan["planned_qty"],
            "actual_demand_person": plan["actual_demand_person"],
            "purchase_responsible": plan["purchase_responsible"],
            "urgency": plan["urgency"],
        },
        "Page_MiniProgramPurchasePlanItemRead_": _page(
            [
                {
                    "id": row["id"],
                    "plan_no": row["plan_no"],
                    "plan_date": row["plan_date"],
                    "name": row["name"],
                    "model_spec": row["model_spec"],
                    "unit_name": row["unit_name"],
                    "planned_qty": row["planned_qty"],
                    "actual_demand_person": row["actual_demand_person"],
                    "purchase_responsible": row["purchase_responsible"],
                    "urgency": row["urgency"],
                }
                for row in _PLAN_ROWS[:6]
            ]
        ),
        "MiniProgramPurchasePlanDetailRead": {
            "id": plan["id"],
            "plan_no": plan["plan_no"],
            "plan_date": plan["plan_date"],
            "name": plan["name"],
            "model_spec": plan["model_spec"],
            "unit_name": plan["unit_name"],
            "planned_qty": plan["planned_qty"],
            "actual_demand_person": plan["actual_demand_person"],
            "purchase_responsible": plan["purchase_responsible"],
            "urgency": plan["urgency"],
            "material_code": plan["material_code"],
            "category": plan["category"],
            "demand_department": plan["demand_department"],
            "usage": plan["usage"],
            "subitem_no": plan["subitem_no"],
            "remark": plan["remark"],
            "images": plan["images"],
            "next_id": _PLAN_ROWS[1]["id"],
        },
        "MiniProgramPurchasePlanFilterOptions": {
            "actual_demand_persons": _distinct([row["actual_demand_person"] for row in _PLAN_ROWS]),
            "subitem_nos": _distinct([row["subitem_no"] for row in _PLAN_ROWS]),
        },
        "MiniProgramPurchaseRecordItemRead": {
            "line_id": record["line_id"],
            "material_name": record["material_name"],
            "model_spec": record["model_spec"],
            "purchase_order_no": record["purchase_order_no"],
            "trace_no": record["trace_no"],
            "status": record["status"],
            "unit_name": record["unit_name"],
            "purchase_qty": record["purchase_qty"],
            "plan_date": record["plan_date"],
            "subitem_no": record["subitem_no"],
            "material_code": record["material_code"],
            "category": record["category"],
            "plan_no": record["plan_no"],
            "demand_department": record["demand_department"],
            "actual_demand_person": record["actual_demand_person"],
            "purchase_responsible": record["purchase_responsible"],
            "usage": record["usage"],
            "remark": record["record_remark"],
            "purchase_date": record["purchase_date"],
            "salesperson": record["salesperson"],
            "images": record["images"],
        },
        "Page_MiniProgramPurchaseRecordItemRead_": _page(
            [
                {
                    "line_id": row["line_id"],
                    "material_name": row["material_name"],
                    "model_spec": row["model_spec"],
                    "purchase_order_no": row["purchase_order_no"],
                    "trace_no": row["trace_no"],
                    "status": row["status"],
                    "unit_name": row["unit_name"],
                    "purchase_qty": row["purchase_qty"],
                    "plan_date": row["plan_date"],
                    "subitem_no": row["subitem_no"],
                    "material_code": row["material_code"],
                    "category": row["category"],
                    "plan_no": row["plan_no"],
                    "demand_department": row["demand_department"],
                    "actual_demand_person": row["actual_demand_person"],
                    "purchase_responsible": row["purchase_responsible"],
                    "usage": row["usage"],
                    "remark": row["record_remark"],
                    "purchase_date": row["purchase_date"],
                    "salesperson": row["salesperson"],
                    "images": row["images"],
                }
                for row in _RECORD_ROWS
            ]
        ),
        "MiniProgramPurchaseRecordFilterOptions": {
            "statuses": _distinct([row["status"] for row in _RECORD_ROWS]),
            "subitem_nos": _distinct([row["subitem_no"] for row in _RECORD_ROWS]),
        },
        # —— 采购进度同步（外部平台按追溯号 / 申购单号整单回写）——
        "PurchaseRecordSyncTargetRead": {"trace_no": "HX20260909001", "target_count": 2, "cursor_id": 3},
        "PurchaseRecordSyncTargetsRead": {
            "items": [{"trace_no": "HX20260909001", "target_count": 2, "cursor_id": 3}],
            "has_more": False,
            "next_cursor": 3,
        },
        "PurchaseRecordSyncOrderTargetRead": {
            "purchase_order_no": "申购 2026/9/9",
            "trace_nos": ["HX20260909001"],
            "cursor_id": 2,
        },
        "PurchaseRecordSyncOrderTargetsRead": {
            "items": [
                {
                    "purchase_order_no": "申购 2026/9/9",
                    "trace_nos": ["HX20260909001"],
                    "cursor_id": 2,
                }
            ],
            "has_more": False,
            "next_cursor": 2,
        },
        "PurchaseRecordSyncTraceUpdate": {
            "salesperson": "何丽娟",
            "contract_no": "HX-CG-2026-0183",
            "vessel_no": "MV HXNI 05",
            "consolidation_port": "Morowali",
            "consolidation_date": "2026-09-18",
            "sailing_date": "2026-09-23",
            "contract_sign_date": "2026-09-12",
            "status": "已采购",
        },
        "PurchaseRecordSyncOrderUpdateItem": {
            "salesperson": "何丽娟",
            "contract_no": "HX-CG-2026-0183",
            "vessel_no": "MV HXNI 05",
            "consolidation_port": "Morowali",
            "consolidation_date": "2026-09-18",
            "sailing_date": "2026-09-23",
            "contract_sign_date": "2026-09-12",
            "status": "已采购",
            "trace_no": "HX20260909001",
        },
        "PurchaseRecordSyncOrderApply": {
            "items": [
                {
                    "salesperson": "何丽娟",
                    "contract_no": "HX-CG-2026-0183",
                    "vessel_no": "MV HXNI 05",
                    "consolidation_port": "Morowali",
                    "consolidation_date": "2026-09-18",
                    "sailing_date": "2026-09-23",
                    "contract_sign_date": "2026-09-12",
                    "status": "已采购",
                    "trace_no": "HX20260909001",
                }
            ]
        },
        "PurchaseRecordSyncOrderApplyRead": {
            "applied": 1,
            "not_found": 0,
            "affected_headers": 1,
            "affected_lines": 2,
        },
        "PurchaseRecordSyncResultRead": {"affected_headers": 1, "affected_lines": 2},
        "PurchasePlanExportRequest": {"material_ids": [plan["id"], _PLAN_ROWS[7]["id"]]},
        "PurchasePlanResultExportRequest": {
            "columns": ["plan_no", "material_code", "name", "planned_qty"],
            "status": "正常",
            "category": "备品备件",
            "sort_by": "plan_date",
            "sort_order": "desc",
        },
        "PurchaseRecordResultExportRequest": {
            "columns": ["purchase_order_no", "material_name", "purchase_qty", "status"],
            "status": "已采购",
            "sort_by": "purchase_date",
            "sort_order": "desc",
        },
        "Body_upload_api_v1_files_images_post": {"file": "交流接触器-CJX2-2510-正面.jpg"},
        "Body_import_huaxing_inventory_api_v1_huaxing_inventory_import_post": {
            "file": "华星库存导出_20260912.xlsx"
        },
        "Body_import_lite_inventory_api_v1_secondary_warehouse_import_post": {
            "file": "精简二级库台账_20260912.xlsx"
        },
        "Body_import_material_codes_api_v1_material_code_library_import_post": {
            "file": "物资编码库_20260912.xlsx"
        },
    }


def _hua_xing_rows() -> list[dict[str, Any]]:
    return [
        {
            "id": index,
            "first_inbound_date": first_inbound_date,
            "warehouse": warehouse,
            "material_code": code,
            "name": name,
            "model_spec": model_spec,
            "quantity": _qty(quantity),
            "unit_name": unit_name,
            "purchaser": purchaser,
            "purchase_department": department,
            "subitem_no_name": subitem_name,
        }
        for index, (
            code,
            name,
            model_spec,
            unit_name,
            quantity,
            warehouse,
            purchaser,
            department,
            subitem_name,
            first_inbound_date,
        ) in enumerate(_HX_INVENTORY, start=1)
    ]


def _lite_rows() -> list[dict[str, Any]]:
    return [
        {
            "id": index,
            "name": name,
            "model_spec": model_spec,
            "unit_name": unit_name,
            "quantity": _qty(quantity),
            "remark": remark or None,
        }
        for index, (name, model_spec, unit_name, quantity, remark) in enumerate(
            _LITE_INVENTORY, start=1
        )
    ]


def _move_request_common() -> dict[str, Any]:
    return {
        "purchase_order_no": "申购 2026/9/14",
        "trace_no": "HX20260914001",
        "contract_no": "HX-CG-2026-0190",
        "vessel_no": "MV HXNI 05",
        "consolidation_date": "2026-09-24",
        "consolidation_port": "Morowali",
        "sailing_date": "2026-09-29",
        "contract_sign_date": "2026-09-20",
        "purchase_date": "2026-09-14",
        "salesperson": "何丽娟",
        "status": "已申购",
        "record_remark": "9 月低库存补库整单申购",
    }


def _record_update_fields(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "plan_date": record["plan_date"],
        "material_code": record["material_code"],
        "category": record["category"],
        "demand_department": record["demand_department"],
        "material_name": record["material_name"],
        "model_spec": record["model_spec"],
        "unit_name": record["unit_name"],
        "actual_demand_person": record["actual_demand_person"],
        "purchase_responsible": record["purchase_responsible"],
        "purchase_qty": record["purchase_qty"],
        "usage": record["usage"],
        "subitem_no": record["subitem_no"],
        "plan_remark": record["plan_remark"] or "",
        "stock_material_id": record["stock_material_id"],
        "image_ids": [],
        "vessel_no": record["vessel_no"],
        "consolidation_date": record["consolidation_date"],
        "consolidation_port": record["consolidation_port"],
        "sailing_date": record["sailing_date"],
        "contract_sign_date": record["contract_sign_date"],
        "purchase_date": record["purchase_date"],
        "salesperson": record["salesperson"],
        "status": record["status"],
        "version": record["version"],
    }


def _template_write(template: dict[str, Any]) -> dict[str, Any]:
    return {
        "material_code": template["material_code"],
        "category": template["category"],
        "urgency": template["urgency"],
        "demand_department": template["demand_department"],
        "name": template["name"],
        "model_spec": template["model_spec"],
        "unit_name": template["unit_name"],
        "actual_demand_person": template["actual_demand_person"],
        "purchase_responsible": template["purchase_responsible"],
        "planned_qty": template["planned_qty"],
        "usage": template["usage"],
        "subitem_no": template["subitem_no"],
        "remark": template["remark"] or "",
        "stock_material_id": template["stock_material_id"],
        "image_ids": [],
    }


# ===========================================================================
# 四、字段级示例字典（兜底生成用；不覆盖 `_SCHEMA_EXAMPLES` 里已有的 schema）
# ===========================================================================
_FIELD_EXAMPLES: dict[str, Any] = {
    # 认证与用户
    "username": "warehouse",
    "password": "123456",
    "display_name": "孙浩宇",
    "role": "WAREHOUSE_ADMIN",
    "roles": ["WAREHOUSE_ADMIN"],
    "enabled": True,
    "permissions": ["stock:read", "purchase:read"],
    "api_token": "6f1c2a34-9b8e-4c11-8a52-7d0e4b1c9a21",
    "token_type": "bearer",
    "registration_token": None,
    "requires_profile": False,
    "app_id": "wx9d2f1c8a5b3e4701",
    "wechat_openid": "oHXNI-9f3c1d2a8b7e4f5c",
    "created_by_name": "申购管理员",
    # 物资与库存
    "name": "交流接触器",
    "alias": "接触器",
    "unit_name": "个",
    "model_spec": "CJX2-2510 AC220V",
    "category": "备品备件",
    "material_code": "E011-00237",
    "material_name": "交流接触器",
    "name_id": "E011-00237",
    "current_qty": "6",
    "minimum_qty": "8",
    "quantity": "4",
    "planned_qty": "20",
    "purchase_qty": "20",
    "before_qty": "3",
    "after_qty": "2",
    "remaining_qty": "4",
    "stock_status": "low_stock",
    "has_operation_records": True,
    "is_low_stock": True,
    "suggested_purchase_qty": "4",
    "image_ids": [],
    "images": [],
    "remark": "",
    "replenishment_policy": {"minimum_qty": "8", "enabled": True, "version": 1},
    "warehouse": "P03电气仓",
    "purchaser": "李振国",
    "purchase_department": "设备管理部",
    "subitem_no_name": "305-硫酸厂",
    "first_inbound_date": "2024-03-12",
    # 流水
    "operation_no": "OUT20260706000003",
    "operation_type": "OUTBOUND",
    "source_type": "MANUAL",
    "reversal_of_id": None,
    "is_reversed": False,
    "business_reason": "1#回转窑主电机控制柜检修更换",
    "receiver_unit": "电气检修一班",
    "receiver_name": "李建军",
    "subitem_no": "201",
    "reason": "领用退回：现场未使用",
    "executed_by": "孙浩宇",
    "mini_program_user_name": "孙浩宇",
    "operation_id": 3,
    # 申购计划 / 记录
    "plan_no": "PLAN-20260805-001",
    "plan_date": "2026-08-05",
    "plan_remark": None,
    "record_remark": "8 月低压电器备件整单申购",
    "urgency": "正常",
    "demand_department": _DEMAND_DEPARTMENT,
    "actual_demand_person": "李建军",
    "purchase_responsible": "吴德海",
    "usage": "1#回转窑控制柜检修备件补充",
    "status": "已申购",
    "moved_to_record": True,
    "purchase_order_no": "申购 2026/8/20",
    "trace_no": "HX20260820001",
    "contract_no": "HX-CG-2026-0157",
    "vessel_no": "MV HXNI 03",
    "consolidation_port": "Morowali",
    "salesperson": "马晓东",
    "stock_material_id": 1,
    "stock_material_name": "交流接触器",
    "line_id": 1,
    "purchase_request_id": 1,
    "purchase_material_id": 1,
    "target_count": 2,
    "cursor_id": 3,
    "not_found": 0,
    "applied": 1,
    "affected_headers": 1,
    "affected_lines": 2,
    "has_more": False,
    "next_cursor": 3,
    "trace_nos": ["HX20260909001"],
    "next_id": 2,
    # 分享
    "share_type": "purchase_plan",
    "token": _SHARE_TOKEN,
    "item_ids": [1, 8],
    "item_count": 2,
    "columns": ["plan_no", "material_code", "material_name", "model_spec", "unit_name", "planned_qty"],
    "expires_in": "7d",
    # 备忘录
    "title": "9 月二级库盘点安排",
    "content": "9 月 18 日下班前完成二级库盘点，重点核对熔断器芯、指示灯、温湿度控制器的账实差异。",
    # 设置
    "endpoint": _AI_ENDPOINT,
    "model": _AI_MODEL,
    "value": "电机|接触器",
    "original": "电机|接触器",
    "expanded": "电机|电动机|接触器",
    "available": True,
    "image_acceleration_server_url": _IMAGE_SERVER,
    "inventory_mode": "read_write",
    "huaxing_inventory_mode": "query_only",
    "purchase_plans_mode": "query_only",
    "purchase_records_mode": "query_only",
    "material_codes_mode": "query_only",
    "mini_program_code_env": "release",
    "mini_program_code_app_id": _MINI_PROGRAM_APP_IDS[0],
    "mini_program_app_ids": _MINI_PROGRAM_APP_IDS,
    "mini_program_registration_enabled": True,
    "mini_program_new_user_enabled": True,
    "secondary_warehouse_mode": "full",
    "webhook_url": _FEISHU_HOOK,
    "secret": "hxni-feishu-2026Kx7Q",
    "webhook_configured": True,
    "secret_configured": True,
    "subscribed_events": ["stock.outbound.created", "stock.inbound.created"],
    "personal_reasons": [{"subitem_no": "305", "reason": "就地操作箱检修备件领用"}],
    "system_reasons": [{"subitem_no": "305", "reason": "2#皮带机启动回路检修"}],
    # 导入导出任务与文件
    "file": "华星库存导出_20260912.xlsx",
    "import_type": "HUAXING_INVENTORY",
    "export_type": "PURCHASE_PLAN_RESULTS",
    "original_filename": "华星库存导出_20260912.xlsx",
    "download_filename": "申购计划导出_20260913.xlsx",
    "file_uuid": "01900384-0000-7000-8000-000000000900",
    "params": {"status": "正常"},
    "result": {"rows": 16},
    "file_exists": True,
    "cutoff": "2026-08-14T00:00:00+08:00",
    "untracked_file_names": ["IMG_20260612_103512.jpg"],
    "unreferenced_records": [],
    "deleted_record_ids": [],
    "deleted_file_names": [],
    "missing_file_ids": [],
    "error_code": None,
    "error_message": None,
    "last_import_at": "2026-09-12T18:20:00+08:00",
    "next": "purchase_material",
    "resource_id": 17,
    # 错误与版本
    "message": "二级库物资不存在",
    "code": "NOT_FOUND",
    "request_id": "6b0c1a4e-8b7d-4c1e-9f2a-5d6e7f8a9b0c",
    "detail": "二级库物资不存在",
    "details": {"material_id": 404},
    "url": "https://img.hxni-electrical.com/files/images/01900010-0000-7000-8000-000000000001",
    "size": 320,
    "content_type": "image/jpeg",
    "platform": "FEISHU",
    "event_type": "stock.outbound.created",
    "build_time": "2026-09-13T09:00:00+08:00",
    "git_sha": "9d21f4c",
    "app_name": "电气车间备件管理系统",
    "commit": "9d21f4c",
    "success": True,
    # 工作台统计
    "stock_material_count": len(_MATERIAL_ROWS),
    "low_stock_count": len(_LOW_STOCK_ROWS),
    "uncoded_purchase_material_count": 2,
    "purchase_record_count": len(_RECORD_ROWS),
    # 筛选与导出参数
    "actual_demand_persons": _DEMAND_PERSONS[:3],
    "purchase_responsibles": _PURCHASE_RESPONSIBLES,
    "subitem_nos": list(_SUBITEM_NAMES.keys()),
    "purchasers": _HX_PURCHASERS,
    "purchase_departments": _HX_DEPARTMENTS,
    "statuses": ["已申购", "已采购", "部分入库", "已入库"],
    "salespersons": _SALES_PERSONS,
    "categories": ["备品备件", "消耗物资", "工具"],
    "records": [{"line_id": 1, "version": 1}],
    "materials": [{"id": 1, "version": 3}],
    "identities": [],
    "lines": [],
    "sort_by": "plan_date",
    "sort_order": "desc",
    "empty_status": False,
    "empty_actual_demand_person": False,
    "empty_subitem_no": False,
    "source_version": 2,
    "target_version": 2,
    "source_user_id": 3,
    "version": 1,
    "page": 1,
    "page_size": 20,
    "total": 20,
    "items": [],
    "ratio": "0.25",
}

# 字段名后缀匹配（写在后面代表优先级更低）
_SUFFIX_EXAMPLES: list[tuple[str, Any]] = [
    ("_at", _LATEST_STAMP),
    ("_date", _LATEST_DATE),
    ("_time", _LATEST_STAMP),
    ("_no", "PLAN-20260805-001"),
    ("_code", "E011-00237"),
    ("_qty", "4"),
    ("_person", "李建军"),
    ("_dept", _DEMAND_DEPARTMENT),
    ("_department", _DEMAND_DEPARTMENT),
    ("_url", _FEISHU_HOOK),
    ("_key", _AI_API_KEY),
    ("_token", _SHARE_TOKEN),
    ("_count", 2),
    ("_port", "Morowali"),
    ("_reason", "1#回转窑主电机控制柜检修更换"),
    ("_ids", []),
    ("_id", 1),
]


def _example_for(name: str, spec: dict[str, Any], depth: int, schemas: dict[str, Any]) -> Any:
    """按字段名 + schema 生成一个确定性的示例值。"""
    if "enum" in spec and spec["enum"]:
        return spec["enum"][0]
    if "example" in spec:
        return spec["example"]
    if "const" in spec:
        return spec["const"]
    if "$ref" in spec:
        resolved = schemas.get(spec["$ref"].rsplit("/", 1)[-1])
        if isinstance(resolved, dict):
            return _example_for(name, resolved, depth, schemas)

    if name in _FIELD_EXAMPLES:
        value = _FIELD_EXAMPLES[name]
        # 容器字段按元素 schema 生成一个元素，便于 Apifox 直接看到结构。
        if isinstance(value, list) and isinstance(spec.get("items"), dict):
            return [_example_from_schema(spec["items"], f"{name}_item", depth + 1, schemas)]
        return value

    for suffix, value in _SUFFIX_EXAMPLES:
        if name.endswith(suffix):
            return value

    fmt = spec.get("format")
    if fmt == "date":
        return _LATEST_DATE
    if fmt == "date-time":
        return _LATEST_STAMP
    if fmt == "uuid":
        return _uuid(1)
    if fmt == "binary":
        return "华星库存导出_20260912.xlsx"

    if "anyOf" in spec:
        # Optional[X] 在 OpenAPI 里是 anyOf: [X, null]，取非 null 分支。
        branches = [b for b in spec["anyOf"] if b.get("type") != "null"]
        if branches:
            return _example_from_schema(branches[0], name, depth + 1, schemas)
        return None

    return _example_by_type(name, spec, depth, schemas)


def _example_by_type(name: str, spec: dict[str, Any], depth: int, schemas: dict[str, Any]) -> Any:
    kind = spec.get("type")
    if kind is None and isinstance(spec.get("properties"), dict):
        kind = "object"
    if kind == "integer":
        return 1
    if kind == "number":
        return 10
    if kind == "boolean":
        return True
    if kind == "array":
        items = spec.get("items")
        if isinstance(items, dict):
            return [_example_from_schema(items, f"{name}_item", depth + 1, schemas)]
        return []
    if kind == "null":
        return None
    if kind == "object":
        return _object_example(spec, depth + 1, schemas)
    # 兜底：占位符只在「新字段忘了登记示例」时出现，由测试守住。
    return f"{name}-示例"


def _example_from_schema(spec: dict[str, Any], name: str, depth: int, schemas: dict[str, Any]) -> Any:
    if depth > 4:
        return None
    if "$ref" in spec:
        # 就地展开引用：示例里保留结构比保留 $ref 更有用。
        return {"__ref__": spec["$ref"]}
    return _example_for(name, spec, depth, schemas)


def _object_example(spec: dict[str, Any], depth: int, schemas: dict[str, Any]) -> dict[str, Any]:
    properties = spec.get("properties")
    if not isinstance(properties, dict):
        return {}
    return {key: _example_for(key, sub, depth, schemas) for key, sub in properties.items()}


_SCHEMA_EXAMPLES: dict[str, Any] = _build_schema_examples()


# 错误响应用哪条真实错误码（与 docs/websites/pages/api-error-codes.md 的分类一致）
_ERROR_BY_STATUS: dict[str, tuple[str, str]] = {
    "400": ("NOT_FOUND", "二级库物资不存在"),
    "401": ("UNAUTHORIZED", "请先登录"),
    "403": ("FORBIDDEN", "没有执行此操作的权限"),
    "409": ("VERSION_CONFLICT", "数据已被其他用户修改，请刷新后重试"),
    "422": ("VALIDATION_ERROR", "请求字段或筛选参数不合法"),
}

_OPERATION_METHODS = {"get", "post", "put", "patch", "delete"}


def _api_error_example(code: str, message: str) -> dict[str, Any]:
    return {
        "code": code,
        "message": message,
        "details": {},
        "request_id": _uuid(f"error:{code}"),
    }


def _resolve_placeholders(node: Any, schemas: dict[str, Any]) -> Any:
    """把 `__ref__` 占位换成被引用 schema 的示例（这些示例此时已经解析完毕）。"""
    if isinstance(node, dict):
        if "__ref__" in node and len(node) == 1:
            name = node["__ref__"].rsplit("/", 1)[-1]
            examples = (schemas.get(name) or {}).get("examples") or []
            return deepcopy(examples[0]) if examples else {}
        return {key: _resolve_placeholders(value, schemas) for key, value in node.items()}
    if isinstance(node, list):
        return [_resolve_placeholders(item, schemas) for item in node]
    return node


def _response_example(status: str, schema: dict[str, Any], schemas: dict[str, Any]) -> Any:
    """接口响应示例：错误响应给真实错误码，成功响应给对应 schema 的业务示例。"""
    if status in _ERROR_BY_STATUS:
        return _api_error_example(*_ERROR_BY_STATUS[status])
    name = schema.get("$ref", "").rsplit("/", 1)[-1]
    examples = (schemas.get(name) or {}).get("examples") or []
    if examples:
        return deepcopy(examples[0])
    # 数组 / 未引用命名的响应：就地生成并展开占位引用
    return _resolve_placeholders(_example_from_schema(schema, "response", 1, schemas), schemas)


def add_response_examples(document: dict[str, Any]) -> int:
    """为每个接口的 JSON 响应写 `example`，返回处理的响应数。"""
    schemas = document.get("components", {}).get("schemas", {})
    handled = 0
    for operations in document.get("paths", {}).values():
        for method, operation in operations.items():
            if method not in _OPERATION_METHODS or not isinstance(operation, dict):
                continue
            for status, response in (operation.get("responses") or {}).items():
                media = (response.get("content") or {}).get("application/json")
                if not isinstance(media, dict) or "example" in media:
                    continue
                schema = media.get("schema") or {}
                # 文件流响应（Excel / 图片）没有 schema，写 JSON 示例反而误导，跳过。
                if not schema:
                    continue
                media["example"] = deepcopy(_response_example(status, schema, schemas))
                handled += 1
    return handled


def add_examples(document: dict[str, Any]) -> int:
    """为 `components.schemas` 写入 `examples[0]`，返回处理的 schema 数。"""
    schemas = document.get("components", {}).get("schemas", {})
    handled = 0
    for name, spec in schemas.items():
        if not isinstance(spec, dict) or "examples" in spec:
            continue
        if name in _SCHEMA_EXAMPLES:
            spec["examples"] = [deepcopy(_SCHEMA_EXAMPLES[name])]
            handled += 1
            continue
        if spec.get("type") not in ("object", None) or "properties" not in spec:
            continue
        spec["examples"] = [_object_example(spec, 1, schemas)]
        handled += 1
    return handled


def resolve_refs(document: dict[str, Any]) -> None:
    """把示例中的 __ref__ 占位替换成被引用 schema 的示例（原地修改）。"""
    schemas = document.get("components", {}).get("schemas", {})
    cache: dict[str, Any] = {}

    def lookup(ref: str) -> Any:
        name = ref.rsplit("/", 1)[-1]
        if name in cache:
            return cache[name]
        spec = schemas.get(name)
        if not isinstance(spec, dict):
            return {}
        examples = spec.get("examples")
        if examples:
            value = examples[0]
        else:
            value = {key: {"__ref__": ref} for key in (spec.get("properties") or {})}
            value = {"__object__": True, **value}
        cache[name] = value
        return value

    def walk(node: Any, depth: int = 0) -> Any:
        if depth > 6:
            return None
        if isinstance(node, dict):
            if "__ref__" in node and len(node) == 1:
                return walk(lookup(node["__ref__"]), depth + 1)
            return {k: walk(v, depth + 1) for k, v in node.items() if k != "__object__"}
        if isinstance(node, list):
            return [walk(item, depth + 1) for item in node]
        return node

    for spec in schemas.values():
        if isinstance(spec, dict) and spec.get("examples"):
            spec["examples"] = [walk(spec["examples"][0])]
