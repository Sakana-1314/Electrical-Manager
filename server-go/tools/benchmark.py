"""Python（FastAPI）与 Go（Gin）后端的接口性能对比。

两个服务连同一个 PostgreSQL 库（init.sql + 本脚本写入的种子数据），用 hey 对相同接口压测，
输出 Markdown 表格。用法（在 server-go 目录）：

    python tools/benchmark.py --python-url http://127.0.0.1:18300 --go-url http://127.0.0.1:18301 \
        [--seed] [--duration 10] [--concurrency 20]

--seed 时先通过 Go 服务写入种子数据（物资 + 入库流水 + 申购计划 + 隐患 + 台账）。
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from datetime import UTC, datetime

import httpx

HEADERS = {"X-Project-Id": "1"}


def login(base: str) -> dict[str, str]:
    response = httpx.post(f"{base}/api/v1/auth/login", json={"username": "admin", "password": "123456"}, timeout=30)
    response.raise_for_status()
    return {**HEADERS, "Authorization": f"Bearer {response.json()['access_token']}"}


def seed(base: str, materials: int) -> None:
    headers = login(base)
    with httpx.Client(base_url=base, headers=headers, timeout=60) as client:
        ids = []
        for i in range(materials):
            r = client.post("/api/v1/stock-materials", json={
                "name": f"压测物资{i:04d}", "model_spec": f"MODEL-{i % 37}-{i}", "unit_name": "个",
                "remark": "benchmark", "image_ids": [],
            })
            r.raise_for_status()
            ids.append(r.json()["id"])
        now = datetime.now(UTC).isoformat()
        for start in range(0, len(ids), 20):
            chunk = ids[start:start + 20]
            r = client.post("/api/v1/inventory/inbounds", json={
                "occurred_at": now, "source_type": "MANUAL", "business_reason": "压测入库",
                "lines": [{"stock_material_id": mid, "quantity": "10"} for mid in chunk],
            })
            if r.status_code >= 400:
                print("inbound failed:", r.text, file=sys.stderr)
                break
        for i in range(materials):
            r = client.post("/api/v1/purchase-materials", json={
                "name": f"压测计划{i:04d}", "model_spec": f"PLAN-{i}", "unit_name": "台",
                "actual_demand_person": f"需求人{i % 9}", "purchase_responsible": f"负责人{i % 5}",
                "planned_qty": "2", "usage": "压测", "image_ids": [],
            })
            if r.status_code >= 400:
                print("purchase plan seed skipped:", r.status_code, r.text[:200], file=sys.stderr)
                break


ENDPOINTS = [
    ("GET /auth/me", "/api/v1/auth/me"),
    ("GET /projects", "/api/v1/projects"),
    ("GET /stock-materials (50/页)", "/api/v1/stock-materials?page_size=50"),
    ("GET /stock-materials 关键词", "/api/v1/stock-materials?page_size=50&keyword=MODEL-3"),
    ("GET /inventory/balances (50/页)", "/api/v1/inventory/balances?page_size=50"),
    ("GET /inventory/operations (50/页)", "/api/v1/inventory/operations?page_size=50"),
    ("GET /inventory/low-stock", "/api/v1/inventory/low-stock"),
    ("GET /dashboard/summary", "/api/v1/dashboard/summary"),
    ("GET /purchase-materials (50/页)", "/api/v1/purchase-materials?page_size=50"),
    ("GET /hazards", "/api/v1/hazards"),
]


def run_hey(url: str, headers: dict[str, str], duration: int, concurrency: int) -> dict[str, float]:
    args = ["hey", "-z", f"{duration}s", "-c", str(concurrency)]
    for k, v in headers.items():
        args += ["-H", f"{k}: {v}"]
    out = subprocess.run(args + [url], capture_output=True, text=True, check=True).stdout
    rps = float(re.search(r"Requests/sec:\s+([\d.]+)", out).group(1))
    p50 = re.search(r"50%+ in ([\d.]+) secs", out)
    p99 = re.search(r"99%+ in ([\d.]+) secs", out)
    codes = dict(re.findall(r"\[(\d+)\]\s+(\d+) responses", out))
    return {
        "rps": rps,
        "p50": float(p50.group(1)) * 1000 if p50 else float("nan"),
        "p99": float(p99.group(1)) * 1000 if p99 else float("nan"),
        "non2xx": sum(int(n) for code, n in codes.items() if not code.startswith("2")),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--python-url", required=True)
    parser.add_argument("--go-url", required=True)
    parser.add_argument("--seed", action="store_true")
    parser.add_argument("--materials", type=int, default=500)
    parser.add_argument("--duration", type=int, default=10)
    parser.add_argument("--concurrency", type=int, default=20)
    parser.add_argument("--json", help="同时把结果写到这个 JSON 文件")
    args = parser.parse_args()
    if not shutil.which("hey"):
        sys.exit("需要 hey：go install github.com/rakyll/hey@latest")
    if args.seed:
        seed(args.go_url, args.materials)
    results = []
    py_headers, go_headers = login(args.python_url), login(args.go_url)
    for label, path in ENDPOINTS:
        py = run_hey(args.python_url + path, py_headers, args.duration, args.concurrency)
        go = run_hey(args.go_url + path, go_headers, args.duration, args.concurrency)
        results.append({"endpoint": label, "python": py, "go": go})
        print(f"{label}: python {py['rps']:.0f} rps / go {go['rps']:.0f} rps", file=sys.stderr)
    print(f"\n并发 {args.concurrency}，每个接口压测 {args.duration} 秒\n")
    print("| 接口 | Python 吞吐 (req/s) | Go 吞吐 (req/s) | 倍数 | Python P50/P99 (ms) | Go P50/P99 (ms) |")
    print("| --- | ---: | ---: | ---: | ---: | ---: |")
    for row in results:
        py, go = row["python"], row["go"]
        ratio = go["rps"] / py["rps"] if py["rps"] else float("nan")
        warn = " ⚠" if py["non2xx"] or go["non2xx"] else ""
        print(f"| {row['endpoint']}{warn} | {py['rps']:.0f} | {go['rps']:.0f} | {ratio:.1f}× | "
              f"{py['p50']:.1f} / {py['p99']:.1f} | {go['p50']:.1f} / {go['p99']:.1f} |")
    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(results, fh, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
