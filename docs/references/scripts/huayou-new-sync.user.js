// ==UserScript==
// @name         华友印尼数据平台同步脚本
// @namespace    https://materials-manager.qcloud.19890605.xyz/
// @version      3.4.0
// @description  从华友印尼数据平台“物料申购跟踪”同步采购人、状态、合同号、合同签订日期和船名：按申购单号整单查询、整单批量回写（平台每 10 秒至多查询 1 次）。
// @match        http://43.154.152.157:8080/*
// @updateURL    https://github.com/Sakana-1314/Electrical-Manager/raw/refs/heads/main/docs/references/scripts/huayou-new-sync.user.js
// @downloadURL  https://github.com/Sakana-1314/Electrical-Manager/raw/refs/heads/main/docs/references/scripts/huayou-new-sync.user.js
// @connect      materials-manager.qcloud.19890605.xyz
// @connect      43.154.152.157
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @grant        GM_cookie
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(() => {
  "use strict";

  const PLATFORM_ORIGIN = "http://43.154.152.157:8080";
  const PLATFORM_BASE = `${PLATFORM_ORIGIN}/webroot/decision`;
  const MATERIALS_API = "https://materials-manager.qcloud.19890605.xyz/api/v1";
  const SYNC_FIELDS = "contract_no,vessel_no,salesperson,status,contract_sign_date";
  // 后端旧版本不认识新增同步字段（返回“未知同步字段”）：降级为旧字段列表继续同步，
  // 避免脚本先于服务端更新时整批中断。
  const LEGACY_SYNC_FIELDS = "contract_no,vessel_no,salesperson,status";
  const SIGN_DATE_FIELD = "contract_sign_date";
  // 平台“物料申购跟踪”报表里的合同签订日期列。列名来自真实 HAR（page/data）：
  // 该报表第 32 列（1-based）紧跟“采购合同号”之后，表头文本为「合同签订时间」；
  // 其余候选用于兼容平台模板的轻微改名。
  const CONTRACT_SIGN_DATE_COLUMNS = [
    "合同签订时间",
    "合同签订日期",
    "签订日期",
    "合同日期",
  ];
  // 报表解析（worker 页内）命中的列名；空表示该报表没有合同签订日期列。
  let contractSignDateColumn = "";
  // 服务端是否支持新增同步字段：被拒（旧后端）时置 false，自动降级为旧字段列表。
  let signDateSyncSupported = true;
  const VIEWLET =
    "%252F%25E6%2595%25B0%25E6%258D%25AE%25E5%2588%2586%25E6%259E%2590" +
    "%252F%25E4%25BB%2593%25E5%2582%25A8%25E7%25AE%25A1%25E7%2590%2586" +
    "%252F%25E7%2589%25A9%25E6%2596%2599%25E7%2594%25B3%25E8%25B4%25AD" +
    "%252F%25E7%2589%25A9%25E6%2596%2599%25E7%2594%25B3%25E8%25B4%25AD%25E8%25B7%259F%25E8%25B8%25AA.cpt";
  const PREFIX = "huaxing_tracking_sync_";
  const TASK_KEY = `${PREFIX}task`;
  const RESPONSE_PREFIX = `${PREFIX}response_`;
  const WORKER_PARAM = "huaxingSyncTask";
  // 平台限频：任意两次报表查询（每个申购单号一次）之间至少间隔 10 秒；登录不计入。
  const MIN_PLATFORM_GAP_MS = 10000;
  const REPORT_LOAD_DEADLINE_MS = 60000;
  const ORDER_QUERY_DEADLINE_MS = 120000;
  const defaults = {
    platformUsername: "huaxing_jianxiu",
    platformPassword: "",
    apiToken: "",
    // 当前项目 id（0 = 未选择）：后端按项目隔离数据，业务接口都要带 X-Project-Id。
    projectId: 0,
    intervalMinutes: 10,
    batchSize: 30,
    minPurchaseOrderNo: "P05SG0300",
    autoEnabled: false,
    dryRun: false,
    minimized: false,
    panelRight: 20,
    panelBottom: 20,
  };

  const key = (name) => `${PREFIX}${name}`;
  const loadConfig = () =>
    Object.fromEntries(
      Object.entries(defaults).map(([name, value]) => [
        name,
        GM_getValue(key(name), value),
      ]),
    );
  const saveConfig = (values) => {
    config = { ...config, ...values };
    Object.entries(config).forEach(([name, value]) =>
      GM_setValue(key(name), value),
    );
  };
  const saveField = (name, value) => {
    config = { ...config, [name]: value };
    GM_setValue(key(name), value);
  };
  const int = (value, fallback, min, max) => {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed)
      ? Math.min(max, Math.max(min, parsed))
      : fallback;
  };
  const clean = (value) =>
    String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();
  const joined = (values) => {
    const value = [...new Set(values.map(clean).filter(Boolean))].join(" / ");
    return value.length <= 128 ? value : `${value.slice(0, 127)}…`;
  };
  // 报表里的日期列解析为 ISO 日期（YYYY-MM-DD）：平台可能给「2026-08-20」「2026/8/20」
  // 「2026年8月20日」「2026-08-20 00:00:00」或「20260820」，后端只接受 ISO 日期。
  // 无法识别的值（如平台返回未格式化的日期序列号）一律返回空串——宁可不填，也不写错日期。
  const toIsoDate = (value) => {
    const text = clean(value);
    if (!text) return "";
    const parts = text.match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (parts) {
      const [, year, month, day] = parts;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
    return "";
  };
  // 同一追溯号可能有多批次行：日期取最新的有效值（与何佳脚本一致）。
  const latestDate = (values) => {
    const dates = values.map(toIsoDate).filter(Boolean).sort();
    return dates.at(-1) || "";
  };
  const sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));
  // 结构性错误：报表模板/接口契约与脚本不符，属于系统性问题，出现即应终止本次同步。
  const structuralError = (message) =>
    Object.assign(new Error(`【结构异常】${message}`), { structural: true });
  // 项目相关问题（后端多项目隔离）：请求失败时只给一条中文提示并终止本次同步，
  // 不把原始「HTTP 400：{"code":"PROJECT_REQUIRED",…}」报文抛给用户。
  const PROJECT_ERROR_CODES = [
    "PROJECT_REQUIRED",
    "PROJECT_NOT_FOUND",
    "PROJECT_DISABLED",
  ];
  const PROJECT_ERROR_TEXT =
    "项目未选择或已失效：请在悬浮窗的“连接与同步设置”里重新选择项目后重试";
  const projectError = (message) => {
    const code = PROJECT_ERROR_CODES.find((item) =>
      String(message ?? "").includes(item),
    );
    return code
      ? Object.assign(new Error(PROJECT_ERROR_TEXT), { project: code })
      : null;
  };

  // —— 本地更新记录（IndexedDB）：每个申购单记录最近成功同步时间，冷却期内不再请求平台 ——
  const IDB_NAME = `${PREFIX}order_sync`;
  const IDB_STORE = "orders";
  const ORDER_COOLDOWN_DAYS = 3;
  const ORDER_COOLDOWN_MS = ORDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  // 油猴隔离沙箱里可能拿不到页面的 indexedDB，需回退到 unsafeWindow（同源页面）。
  const idbFactory = () => {
    if (typeof indexedDB !== "undefined") return indexedDB;
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow.indexedDB)
        return unsafeWindow.indexedDB;
    } catch {}
    return null;
  };
  const openIdb = () =>
    new Promise((resolve, reject) => {
      const factory = idbFactory();
      if (!factory) {
        reject(new Error("IndexedDB 不可用，本环境无法做 3 天去重"));
        return;
      }
      let openRequest;
      try {
        openRequest = factory.open(IDB_NAME, 1);
      } catch (error) {
        reject(error);
        return;
      }
      openRequest.onupgradeneeded = () => {
        const db = openRequest.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: "orderNo" });
        }
      };
      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () =>
        reject(openRequest.error || new Error("IndexedDB 打开失败"));
    });
  const idbRecentOrderNos = async (cooldownMs) => {
    const db = await openIdb();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE, "readonly");
        const store = transaction.objectStore(IDB_STORE);
        const request = store.getAll();
        request.onsuccess = () => {
          const now = Date.now();
          const recent = new Set();
          for (const record of request.result || []) {
            if (now - Number(record.updatedAt) < cooldownMs) {
              recent.add(String(record.orderNo));
            }
          }
          resolve(recent);
        };
        request.onerror = () =>
          reject(request.error || new Error("读取本地更新记录失败"));
      });
    } finally {
      db.close();
    }
  };
  const idbRememberOrder = async (orderNo) => {
    const db = await openIdb();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE, "readwrite");
        transaction.objectStore(IDB_STORE).put({
          orderNo: String(orderNo),
          updatedAt: Date.now(),
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
          reject(transaction.error || new Error("写入本地更新记录失败"));
      });
    } finally {
      db.close();
    }
  };

  // —— 请求调试日志：每次网络请求（备件 API / 平台登录 / 报表拉取）统一打印参数与输出 ——
  // 注意：按需求为全量明文输出，请求日志会包含密码、接口令牌、accessToken 等敏感凭证，
  // 仅用于个人电脑上的联调核对，勿在共享/生产控制台长时间留存。
  let requestSeq = 0;
  const clipText = (text, max = 5000) => {
    const value = String(text ?? "");
    return value.length > max
      ? `${value.slice(0, max)}\n…（响应截断，共 ${value.length} 字符）`
      : value;
  };
  const request = ({
    method = "GET",
    url,
    headers = {},
    data,
    responseType,
    timeout = 45000,
  }) =>
    new Promise((resolve, reject) => {
      const no = ++requestSeq;
      console.info(`[华友印尼] → 请求 #${no}`, {
        method,
        url,
        headers,
        body: data,
      });
      GM_xmlhttpRequest({
        method,
        url,
        headers,
        data,
        responseType,
        timeout,
        anonymous: false,
        onload(response) {
          const text = String(response.responseText || response.response || "");
          console.info(`[华友印尼] ← 响应 #${no}`, {
            status: response.status,
            text: clipText(text),
          });
          if (response.status >= 200 && response.status < 300) resolve(response);
          else {
            const detail = text.slice(0, 300);
            reject(new Error(`HTTP ${response.status}：${detail}`));
          }
        },
        ontimeout: () => {
          console.info(`[华友印尼] ✗ 超时 #${no}`, { method, url });
          reject(new Error(`请求超时：${url}`));
        },
        onerror: (error) => {
          const detail = error?.error || error?.message || "网络请求失败";
          const target = error?.finalUrl || url;
          const suffix = error?.status ? `（HTTP ${error.status}）` : "";
          console.info(`[华友印尼] ✗ 失败 #${no}`, {
            method,
            url: target,
            status: error?.status,
            detail,
          });
          reject(new Error(`${detail}：${target}${suffix}`));
        },
      });
    });
  const json = async (options) => {
    const response = await request(options);
    const text = String(response.responseText || response.response || "");
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`接口返回的不是有效 JSON：${text.slice(0, 200)}`);
    }
  };

  const parseCsv = (text) => {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quoted) {
        if (char === '"' && text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else if (char === '"') quoted = false;
        else cell += char;
      } else if (char === '"') quoted = true;
      else if (char === ",") {
        row.push(cell);
        cell = "";
      } else if (char === "\n") {
        row.push(cell.replace(/\r$/, ""));
        rows.push(row);
        row = [];
        cell = "";
      } else cell += char;
    }
    if (cell || row.length) {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
    }
    return rows;
  };
  const reportSections = (text) => {
    const sections = [];
    for (const row of parseCsv(text.replace(/^\uFEFF/, ""))) {
      if (clean(row[0]) === "序号") {
        sections.push({ headers: row.map(clean), rows: [] });
        continue;
      }
      const section = sections.at(-1);
      if (!section || !row.some((value, index) => index > 0 && clean(value))) continue;
      section.rows.push(
        Object.fromEntries(
          section.headers.map((header, index) => [header, clean(row[index])]),
        ),
      );
    }
    return sections;
  };
  const rowKey = (row) =>
    [row["申购单号"], row["申购物料编码"], row["申购物料名称"]]
      .map(clean).join("\u0000");
  const quantity = (value) => {
    const parsed = Number(String(value ?? "").replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const progressStatus = (trackingRows, quantityRows) => {
    let rank = 0;
    const byKey = new Map(quantityRows.map((row) => [rowKey(row), row]));
    for (const tracking of trackingRows) {
      const quantities = byKey.get(rowKey(tracking));
      const requested = quantity(quantities?.["申购数量"]);
      const purchased = quantity(quantities?.["采购数量"]);
      const inbound = quantity(quantities?.["入库数量"]);
      if (inbound > 0 && requested > 0 && inbound >= requested) rank = Math.max(rank, 3);
      else if (inbound > 0) rank = Math.max(rank, 2);
      else if (purchased > 0 || tracking["采购合同号"]) rank = Math.max(rank, 1);
    }
    return ["已申购", "已采购", "部分入库", "已入库"][rank];
  };
  const resultFor = (rows, quantityRows) => ({
    count: rows.length,
    salesperson: joined(rows.map((row) => row["采购人"])),
    contractNo: joined(rows.map((row) => row["采购合同号"])),
    vesselNo: joined(rows.map((row) => row["船名"])),
    // 合同签订日期为物资级字段：按追溯号（行）回写，后端只补空值。
    contractSignDate: latestDate(rows.map((row) => row[contractSignDateColumn])),
    status: progressStatus(rows, quantityRows),
  });
  // 按申购单号查询一次，返回该单下每个追溯码的聚合结果（追溯码 -> 结果）。
  const parseOrderReport = (text) => {
    if (!/序号/.test(text)) {
      throw structuralError("导出内容缺少“序号”表头，可能未登录或报表模板已变化");
    }
    const sections = reportSections(text);
    // 报表可能分多个 canvas 块（表头重复），逐个块的表头里找一个命中的列名。
    const headerNames = [...new Set(sections.flatMap((section) => section.headers))];
    contractSignDateColumn = CONTRACT_SIGN_DATE_COLUMNS.find((name) => headerNames.includes(name)) || "";
    const trackingRows = [];
    const quantityRows = [];
    for (const section of sections) {
      if (section.headers.includes("追溯码")) trackingRows.push(...section.rows);
      if (section.headers.includes("入库数量")) quantityRows.push(...section.rows);
    }
    // 表头正常但无有效数据行（多为“该单在平台无记录”），不属于结构异常：
    // 返回空结果，由调用方视作“平台未查询到记录”，不应终止整批同步。
    if (!trackingRows.length && !quantityRows.length) return {};
    const traces = new Map();
    for (const row of trackingRows) {
      const trace = clean(row["追溯码"]);
      if (!trace) continue;
      const group = traces.get(trace) || [];
      group.push(row);
      traces.set(trace, group);
    }
    const results = {};
    for (const [trace, rows] of traces) {
      results[trace] = resultFor(rows, quantityRows);
    }
    return results;
  };
  const reportUrl = (task) => {
    const parameters = encodeURIComponent(
      encodeURIComponent(
        JSON.stringify({
          申购单号: task.orderNo,
          申购日期开始: "2020-01-01",
          申购日期截止: "2035-12-31",
          __pi__: true,
        }),
      ),
    );
    return `${PLATFORM_BASE}/view/report?viewlet=${VIEWLET}&__parameters__=${parameters}&${WORKER_PARAM}=${encodeURIComponent(task.id)}`;
  };
  // —— 报表 JSON 数据接口：与真实平台内置报表 viewer 一致（不再走导出接口）——
  // viewer 打开报表后自行发起 page/data（JSON）；cid 取自页面已发出的 page/data 资源 URL（保留原始编码原样回传）。
  const reportPageDataUrl = () => {
    const entry = performance
      .getEntriesByType("resource")
      .map((resource) => resource.name)
      .filter(
        (url) =>
          url.includes("/url/report/v10/page/data") && /[?&]cid=/.test(url),
      )
      .pop();
    return entry || "";
  };
  const reportPage = async (template, sid, pn) => {
    const url =
      template
        .replace(/sessionID=[^&]*/, `sessionID=${encodeURIComponent(sid)}`)
        .replace(/([?&])pn=\d+/, `$1pn=${pn}`) + `&_=${Date.now()}`;
    const response = await request({ method: "GET", url });
    const text = String(response.responseText || response.response || "");
    try {
      return JSON.parse(text);
    } catch {
      throw structuralError(
        `报表 page/data 返回的不是有效 JSON：${text.slice(0, 200)}`,
      );
    }
  };
  const cellText = (value) => {
    if (value == null) return "";
    if (typeof value === "object") return String(value?.value ?? "");
    if (typeof value === "string") {
      try {
        return String(JSON.parse(value)?.value ?? "");
      } catch {
        return value;
      }
    }
    return String(value);
  };
  const csvCell = (value) => {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  // 把一个 page/data 页（可含多个 canvas 块、冻结表头重复）还原为 {header, rows}
  const pageToRows = (pageJson) => {
    const grid = {};
    for (const block of pageJson?.pageResult || []) {
      for (const cell of block || []) {
        const y = cell?.position?.y;
        const x = cell?.position?.x;
        if (y == null || x == null) continue;
        (grid[y] ||= {})[x] = cellText(cell.value);
      }
    }
    const ys = Object.keys(grid).map(Number).sort((a, b) => a - b);
    if (!ys.length) return { header: [], rows: [] };
    const headerY = ys[0];
    const headerXs = Object.keys(grid[headerY])
      .map(Number)
      .sort((a, b) => a - b);
    const header = headerXs.map((x) => grid[headerY][x]);
    const rows = [];
    for (const y of ys) {
      if (y === headerY) continue;
      if (!Object.values(grid[y]).some((text) => clean(text))) continue;
      rows.push(headerXs.map((x) => grid[y][x] ?? ""));
    }
    return { header, rows };
  };
  const sessionId = () => {
    for (const script of document.scripts) {
      if (script.src) continue;
      const match = script.textContent.match(/var\s+sid\s*=\s*"([^"]+)"/);
      if (match) return match[1];
    }
    return "";
  };
  const waitForReport = async () => {
    const startedAt = Date.now();
    const deadline = startedAt + REPORT_LOAD_DEADLINE_MS;
    while (Date.now() < deadline) {
      const text = document.body?.innerText || "";
      const hasCanvas = !!document.querySelector(".sheet-table-canvas");
      if (sessionId() && /共\d+行/.test(text) && hasCanvas) {
        await sleep(800);
        return;
      }
      // 页面呈现登录表单（无报表画布）→ 明确未登录，快速失败，便于主面板补登一次
      if (!hasCanvas && document.querySelector('input[type="password"]')) {
        throw new Error("【未登录】物资平台未登录：报表被重定向到登录页");
      }
      if (
        !hasCanvas &&
        Date.now() - startedAt > 5000 &&
        /(登\s*录|用户名|密\s*码)/.test(text)
      ) {
        throw new Error("【未登录】物资平台未登录：报表未加载（检测到登录页特征）");
      }
      await sleep(300);
    }
    const text = document.body?.innerText || "";
    if (/(无权限|无权访问|没有权限|权限不足)/.test(text)) {
      throw new Error("【无权限】当前账号无权访问“物料申购跟踪”报表");
    }
    throw new Error("【未登录】物资平台未登录或报表加载失败（未取得报表会话）");
  };
  const runWorker = async (taskId) => {
    const task = GM_getValue(TASK_KEY, null);
    if (!task || task.id !== taskId) return;
    const responseKey = `${RESPONSE_PREFIX}${taskId}`;
    try {
      await waitForReport();
      const sid = sessionId();
      // 复用页面已发出的 page/data 资源 URL（含报表实例 cid），逐页拉全量 JSON，不用导出接口
      const pageDataTemplate = reportPageDataUrl();
      if (!pageDataTemplate) {
        throw new Error("报表页尚未发起 page/data，未能取得报表实例 cid");
      }
      const first = await reportPage(pageDataTemplate, sid, 1);
      const totalPages = Math.min(Number(first?.totalPage) || 1, 200);
      const allRows = [];
      let header = [];
      for (let pn = 1; pn <= totalPages; pn += 1) {
        const page = pn === 1 ? first : await reportPage(pageDataTemplate, sid, pn);
        const pageRows = pageToRows(page);
        if (pn === 1) header = pageRows.header;
        allRows.push(...pageRows.rows);
      }
      if (!header.length) {
        throw structuralError("报表未返回表头，模板或权限可能已变化");
      }
      if (!allRows.length) {
        // 表头正常但无任何数据行：该申购单在平台无记录，返回空结果（不终止整批）
        GM_setValue(responseKey, {
          id: taskId,
          ok: true,
          result: {},
          contractSignDateColumn: CONTRACT_SIGN_DATE_COLUMNS.find((name) => header.includes(name)) || "",
        });
        return;
      }
      const text = [
        header.map(csvCell).join(","),
        ...allRows.map((row) => row.map(csvCell).join(",")),
      ].join("\n");
      GM_setValue(responseKey, {
        id: taskId,
        ok: true,
        result: parseOrderReport(text),
        // 上报命中的列名（空 = 报表没有合同签订日期列），供主脚本提示一次
        contractSignDateColumn,
      });
    } catch (error) {
      GM_setValue(responseKey, {
        id: taskId,
        ok: false,
        error: error?.message || String(error),
      });
    } finally {
      setTimeout(() => window.close(), 150);
    }
  };

  const workerTaskId = new URLSearchParams(location.search).get(WORKER_PARAM);
  if (workerTaskId && location.origin === PLATFORM_ORIGIN) {
    runWorker(workerTaskId);
    return;
  }

  let config = loadConfig();
  let running = false;
  let timer = null;
  let host;
  let ui;
  const logs = [];
  let stats = { scanned: 0, found: 0, updated: 0, skipped: 0, failed: 0 };

  const apiRequest = async (options) => {
    let result;
    try {
      result = await json({
        ...options,
        headers: {
          "Content-Type": "application/json",
          "X-API-Token": config.apiToken,
          // 业务接口一律带当前项目（项目隔离）；未选择项目时不带，由后端返回 PROJECT_REQUIRED。
          ...(Number(config.projectId) > 0
            ? { "X-Project-Id": String(config.projectId) }
            : {}),
          ...(options.headers || {}),
        },
      });
    } catch (error) {
      throw projectError(error?.message) || error;
    }
    if (result?.code && result?.message) {
      throw projectError(result.code) || new Error(result.message);
    }
    return result;
  };
  // —— 项目（多项目隔离）——
  // 项目列表接口本身不带 X-Project-Id；业务接口通过 apiRequest 统一带上。
  let projects = [];
  const enabledProjects = () => projects.filter((item) => item?.enabled === true);
  // 项目没有编码，界面一律只显示名称（下拉项本身就是名称，状态栏是「项目：<名称>」）。
  const projectOptionLabel = (project) =>
    clean(project?.name) || `#${project?.id ?? ""}`;
  const projectLabel = (project) =>
    project ? `项目：${clean(project?.name) || `#${project.id}`}` : "项目：未选择";
  const activeProject = () =>
    projects.find((item) => Number(item.id) === Number(config.projectId)) || null;
  const fetchProjects = async () => {
    if (!config.apiToken) return projects;
    const payload = await json({
      method: "GET",
      url: `${MATERIALS_API}/projects`,
      headers: {
        "Content-Type": "application/json",
        "X-API-Token": config.apiToken,
      },
    });
    if (!Array.isArray(payload)) throw new Error("项目列表接口返回的不是数组");
    projects = payload.filter((item) => item && Number.isFinite(Number(item.id)));
    return projects;
  };
  // 解析本次同步使用的项目：已保存的项目仍启用则沿用；否则回退到系统默认项目，
  // 再退到第一个启用项目，并把结果写回本地存储（与网页端右上角项目切换器一致）。
  const resolveProject = async () => {
    if (!config.apiToken) return null;
    if (!projects.length) await fetchProjects();
    const enabled = enabledProjects();
    const picked =
      enabled.find((item) => Number(item.id) === Number(config.projectId)) ||
      enabled.find((item) => item.is_default === true) ||
      enabled[0] ||
      null;
    if (!picked) throw new Error("没有已启用的项目，请在管理端启用项目后重试");
    if (Number(config.projectId) !== Number(picked.id)) {
      saveField("projectId", Number(picked.id));
    }
    return picked;
  };
  const renderProjectOptions = () => {
    if (!ui?.project) return;
    const enabled = enabledProjects();
    const options = enabled.map((project) => {
      const option = document.createElement("option");
      option.value = String(project.id);
      option.textContent = projectOptionLabel(project);
      return option;
    });
    if (!options.length) {
      const option = document.createElement("option");
      option.value = "0";
      option.textContent = projects.length
        ? "（无已启用项目）"
        : config.apiToken
          ? "（项目未加载）"
          : "（请先填写接口令牌）";
      options.push(option);
    }
    const values = options.map((option) => option.value);
    ui.project.replaceChildren(...options);
    ui.project.value = values.includes(String(config.projectId))
      ? String(config.projectId)
      : values[0];
    ui.project.disabled = !enabled.length;
  };
  // 面板打开 / 保存设置后重新拉取项目列表并刷新下拉框；失败只提示，不影响其余功能。
  const refreshProjects = async () => {
    if (config.apiToken) {
      try {
        await fetchProjects();
        await resolveProject();
      } catch (error) {
        log(`项目列表获取失败：${error.message}`, "warn");
      }
    }
    renderProjectOptions();
    renderStats();
  };
  const requireShape = (payload, label) => {
    if (!payload || typeof payload !== "object")
      throw structuralError(`${label}不是 JSON 对象`);
    return payload;
  };
  const orderTargets = async () => {
    const limit = int(config.batchSize, 30, 1, 200);
    const cursor = Number(GM_getValue(key("cursor"), 0)) || 0;
    const minPo = clean(config.minPurchaseOrderNo);
    const fields = () => (signDateSyncSupported ? SYNC_FIELDS : LEGACY_SYNC_FIELDS);
    const targetsUrl = (fieldList) => {
      const base = `${MATERIALS_API}/purchase-record-sync/order-targets?limit=${limit}&cursor=${cursor}&fields=${encodeURIComponent(fieldList)}`;
      return minPo ? `${base}&min_purchase_order_no=${encodeURIComponent(minPo)}` : base;
    };
    let payload;
    try {
      payload = await apiRequest({ method: "GET", url: targetsUrl(fields()) });
    } catch (error) {
      // 服务端尚未更新（不认识 contract_sign_date）时降级为旧字段列表，本次同步其余字段照常。
      if (signDateSyncSupported && /未知同步字段/.test(error?.message || "")) {
        signDateSyncSupported = false;
        log(
          "服务端暂不支持合同签订日期字段（未知同步字段），已降级为旧字段同步；请更新后端后重试",
          "warn",
        );
        payload = await apiRequest({ method: "GET", url: targetsUrl(fields()) });
      } else {
        throw error;
      }
    }
    const result = requireShape(payload, "整单目标接口");
    if (!Array.isArray(result.items))
      throw structuralError("整单目标接口缺少 items 数组");
    for (const item of result.items) {
      if (!item || typeof item.purchase_order_no !== "string" || !item.purchase_order_no.trim())
        throw structuralError("整单目标接口存在缺少申购单号的目标");
      if (!Array.isArray(item.trace_nos))
        throw structuralError("整单目标缺少追溯号列表");
    }
    const rows = result.items;
    if (!rows.length && cursor > 0) {
      GM_setValue(key("cursor"), 0);
      return orderTargets();
    }
    return rows;
  };
  // 回写只补空值、状态只进不退，天然幂等：瞬时网络错误可安全重试一次。
  const applyOrder = async (orderNo, items, attempt = 1) => {
    try {
      const payload = requireShape(
        await apiRequest({
          method: "POST",
          url: `${MATERIALS_API}/purchase-record-sync/orders/${encodeURIComponent(orderNo)}/apply`,
          data: JSON.stringify({ items }),
        }),
        "整单回写接口",
      );
      for (const field of ["applied", "not_found", "affected_headers", "affected_lines"]) {
        if (!Number.isFinite(Number(payload[field])))
          throw structuralError(`整单回写接口缺少 ${field}`);
      }
      return payload;
    } catch (error) {
      if (attempt < 2 && !error?.structural && !error?.project) {
        log(`申购单 ${orderNo}：回写请求失败（${error.message}），短暂等待后重试一次`, "warn");
        await sleep(1500);
        return applyOrder(orderNo, items, attempt + 1);
      }
      throw error;
    }
  };
  const loginPlatform = async () => {
    const result = requireShape(
      await json({
        method: "POST",
        url: `${PLATFORM_BASE}/login`,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({
          username: config.platformUsername,
          password: config.platformPassword,
          validity: -1,
          encrypted: false,
        }),
      }),
      "物资平台登录接口",
    );
    const token = result?.data?.accessToken;
    if (!token) throw new Error(result?.errorMsg || "印尼数据平台登录失败");
    console.info("[华友印尼] 平台登录成功，写入 fine_auth_token cookie", {
      username: config.platformUsername,
      token,
    });
    await new Promise((resolve, reject) =>
      GM_cookie.set(
        {
          url: PLATFORM_BASE,
          name: "fine_auth_token",
          value: token,
          path: "/",
          expirationDate: Math.floor(Date.now() / 1000) + 7200,
        },
        (error) => (error ? reject(new Error(String(error))) : resolve()),
      ),
    );
    return token;
  };
  // 平台限频：相邻两次报表查询至少间隔 10 秒。每个申购单号只发起一次平台查询。
  const pacer = (() => {
    let last = 0;
    return async () => {
      const wait = Math.max(0, MIN_PLATFORM_GAP_MS - (Date.now() - last));
      if (wait > 0) {
        status(`限频等待 ${Math.ceil(wait / 1000)} 秒`, "running");
        await sleep(wait);
      }
      last = Date.now();
    };
  })();
  // 每个申购单号只发起一次平台查询；复用浏览器会话，仅在 worker 明确报【未登录】时补登一次并重试。
  const queryOrder = async (orderNo, allowRelogin = true) => {
    await pacer();
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const task = { id, orderNo };
    const responseKey = `${RESPONSE_PREFIX}${id}`;
    GM_deleteValue(responseKey);
    GM_setValue(TASK_KEY, task);
    const tab = GM_openInTab(reportUrl(task), {
      active: false,
      insert: true,
      setParent: true,
    });
    const deadline = Date.now() + ORDER_QUERY_DEADLINE_MS;
    try {
      while (Date.now() < deadline) {
        const response = GM_getValue(responseKey, null);
        if (response?.id === id) {
          if (!response.ok) {
            const error = Object.assign(
              new Error(response.error || "报表查询失败"),
              { structural: /【结构异常】/.test(response.error || "") },
            );
            if (allowRelogin && /未登录/.test(response.error || "")) {
              GM_deleteValue(responseKey);
              GM_deleteValue(TASK_KEY);
              try {
                tab?.close();
              } catch {}
              if (!config.platformPassword) {
                throw new Error(
                  "物资平台未登录，且未填写平台密码无法自动补登；请先在浏览器登录印尼数据平台，或在悬浮窗填写平台密码",
                );
              }
              await loginPlatform();
              log(
                `检测到平台未登录，已用 ${config.platformUsername} 补登并重试 ${orderNo}`,
              );
              return queryOrder(orderNo, false);
            }
            throw error;
          }
          // 返回完整响应：result（追溯号 → 结果）+ contractSignDateColumn（命中的平台列名）
          return response;
        }
        await sleep(400);
      }
      throw new Error("等待物资平台查询结果超时");
    } finally {
      GM_deleteValue(responseKey);
      GM_deleteValue(TASK_KEY);
      try {
        tab?.close();
      } catch {}
    }
  };

  const log = (message, level = "info") => {
    logs.push({
      time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
      message: String(message),
      level,
    });
    if (logs.length > 200) logs.splice(0, logs.length - 200);
    if (!ui) return;
    ui.logs.replaceChildren(
      ...logs.map((line) => {
        const item = document.createElement("div");
        item.className = line.level;
        item.textContent = `[${line.time}] ${line.message}`;
        return item;
      }),
    );
    ui.logs.scrollTop = ui.logs.scrollHeight;
  };
  const renderStats = () => {
    if (ui) {
      ui.stats.textContent = `${projectLabel(activeProject())} · 申购单 ${stats.scanned} · 追溯号命中 ${stats.found} · 更新 ${stats.updated} · 跳过 ${stats.skipped} · 失败 ${stats.failed}`;
    }
  };
  const status = (text, kind = "idle") => {
    if (!ui) return;
    ui.status.textContent = text;
    ui.status.dataset.kind = kind;
  };
  const credentials = () => {
    // 平台查询优先复用浏览器现有平台会话，因此不强制要求平台密码；
    // 仅在 worker 报告未登录而需自动补登时才会用到平台账号密码。
    const missing = [];
    if (!config.apiToken) missing.push("接口令牌");
    if (missing.length) throw new Error(`请先填写并保存：${missing.join("、")}`);
  };
  const summarize = (result) =>
    [
      ["采购人", result.salesperson],
      ["状态", result.status],
      ["合同号", result.contractNo],
      ["合同签订日期", result.contractSignDate],
      ["船名", result.vesselNo],
    ]
      .filter(([, value]) => value)
      .map(([label, value]) => `${label}=${value}`)
      .join("，");
  const buildItem = (trace, result) => {
    const payload = {};
    for (const [field, value] of [
      ["contract_no", result.contractNo],
      ["vessel_no", result.vesselNo],
      ["salesperson", result.salesperson],
      ["status", result.status],
      // 旧后端不支持该字段时跳过，避免整单回写被 422 拒绝
      ...(signDateSyncSupported ? [[SIGN_DATE_FIELD, result.contractSignDate]] : []),
    ]) {
      if (value) payload[field] = value;
    }
    return Object.keys(payload).length
      ? { trace_no: trace, ...payload }
      : null;
  };
  const run = async (trigger = "manual") => {
    if (running) return log("已有同步任务正在执行", "warn");
    running = true;
    clearTimeout(timer);
    stats = { scanned: 0, found: 0, updated: 0, skipped: 0, failed: 0 };
    renderStats();
    ui.run.disabled = true;
    ui.run.textContent = "同步中…";
    status("连接中", "running");
    try {
      credentials();
      const project = await resolveProject();
      if (project) log(`项目：${clean(project.name)}`);
      log(`${trigger === "auto" ? "自动" : "手动"}同步开始（按申购单号整单同步）`);
      const orders = await orderTargets();
      // 只处理申购单号以 P 开头的申购单（如 P05SG0398），其余一律跳过，不发起平台查询。
      const pOrders = orders.filter((order) =>
        /^P/i.test(clean(order.purchase_order_no)),
      );
      const skippedNonP = orders.length - pOrders.length;
      const skippedExamples = orders
        .filter((order) => !/^P/i.test(clean(order.purchase_order_no)))
        .slice(0, 3)
        .map((order) => clean(order.purchase_order_no))
        .join("、");
      if (skippedNonP) {
        log(
          `跳过 ${skippedNonP} 个非 P 开头申购单${skippedExamples ? `（如 ${skippedExamples}）` : ""}，不查询平台`,
          "warn",
        );
      }
      stats.scanned = pOrders.length;
      renderStats();
      if (!pOrders.length) {
        status("无需同步", "success");
        if (skippedNonP) {
          // 本批全为非 P 申购单：推进游标，避免反复拉取同一批
          const pageCursorIds = orders
            .map((order) => Number(order.cursor_id))
            .filter(Number.isFinite);
          if (pageCursorIds.length) {
            GM_setValue(key("cursor"), Math.min(...pageCursorIds));
          }
          log("本批申购单均非 P 开头，已跳过并推进批次，本次未请求平台", "warn");
        } else {
          log("没有需要补齐的申购单");
        }
        return;
      }
      // 3 天冷却去重：最近一次成功同步过的申购单本次跳过，避免频繁请求平台。
      let recentOrderNos = new Set();
      let idbAvailable = true;
      try {
        recentOrderNos = await idbRecentOrderNos(ORDER_COOLDOWN_MS);
      } catch (error) {
        idbAvailable = false;
        log(`本地更新记录不可用（${error.message}），本次不做 3 天去重`, "warn");
      }
      const pendingOrders = idbAvailable
        ? pOrders.filter((order) => {
            const orderNo = clean(order.purchase_order_no);
            if (recentOrderNos.has(orderNo)) {
              stats.skipped += 1;
              return false;
            }
            return true;
          })
        : pOrders;
      if (pendingOrders.length !== pOrders.length) {
        log(
          `跳过 ${pOrders.length - pendingOrders.length} 个 ${ORDER_COOLDOWN_DAYS} 天内已更新的申购单（避免重复请求）`,
          "warn",
        );
        renderStats();
      }
      if (!pendingOrders.length) {
        // 本页全部在冷却期内：不请求平台，但把游标推进到本页末尾，让后续批次继续处理更早的申购单。
        const pageCursorIds = orders
          .map((order) => Number(order.cursor_id))
          .filter(Number.isFinite);
        if (pageCursorIds.length) {
          GM_setValue(key("cursor"), Math.min(...pageCursorIds));
        }
        status("全部在冷却期内", "success");
        log(
          `本批 ${pOrders.length} 个 P 开头申购单均在 ${ORDER_COOLDOWN_DAYS} 天冷却期内，已跳过并推进批次，本次未请求平台`,
          "warn",
        );
        return;
      }
      // 复用浏览器现有平台会话查询；若 worker 报告未登录，queryOrder 内部会自动补登一次。
      log("查询将复用浏览器平台会话；如需补登会使用脚本账号自动登录");
      let orderIndex = 0;
      let aborted = false;
      let signDateColumnWarned = false;
      for (const order of pendingOrders) {
        orderIndex += 1;
        const orderNo = clean(order.purchase_order_no);
        const traceNos = (order.trace_nos || []).map(clean).filter(Boolean);
        const orderTargetsCount = traceNos.length;
        status(`${orderIndex}/${pendingOrders.length} ${orderNo}`, "running");
        try {
          const queryResult = await queryOrder(orderNo);
          const perTrace = queryResult.result || {};
          if (!queryResult.contractSignDateColumn && !signDateColumnWarned) {
            signDateColumnWarned = true;
            log(
              `平台报表未包含合同签订日期列（候选：${CONTRACT_SIGN_DATE_COLUMNS.join("、")}），本次不同步该字段，其余字段照常同步`,
              "warn",
            );
          }
          const items = [];
          for (const traceNo of traceNos) {
            const result = perTrace[traceNo];
            if (!result || !result.count) {
              stats.skipped += 1;
              log(`${orderNo} ${traceNo}：平台未查询到记录`, "warn");
              continue;
            }
            stats.found += 1;
            const summary = summarize(result);
            if (config.dryRun) {
              stats.skipped += 1;
              log(`${orderNo} ${traceNo}：演练模式，${summary}`);
              continue;
            }
            const item = buildItem(traceNo, result);
            if (!item) {
              stats.skipped += 1;
              log(`${orderNo} ${traceNo}：可同步字段均为空`, "warn");
              continue;
            }
            items.push(item);
          }
          if (!items.length) {
            if (config.dryRun) {
              log(
                `申购单 ${orderNo}（${orderTargetsCount} 个追溯号）：演练完成，未写库`,
                "success",
              );
            } else {
              log(
                `申购单 ${orderNo}（${orderTargetsCount} 个追溯号）：本单无需回写`,
                "warn",
              );
            }
          } else {
            const applied = await applyOrder(orderNo, items);
            const changed = applied.affected_headers + applied.affected_lines;
            if (changed > 0) {
              stats.updated += items.length;
              log(
                `申购单 ${orderNo}：整单回写 ${items.length}/${orderTargetsCount} 个追溯号` +
                  `（头表 ${applied.affected_headers}、明细 ${applied.affected_lines}）`,
                "success",
              );
            } else {
              stats.skipped += items.length;
              log(`申购单 ${orderNo}：回写 ${items.length} 项均无变化`, "warn");
            }
            if (applied.not_found > 0) {
              log(`申购单 ${orderNo}：${applied.not_found} 个追溯号未命中本地记录`, "warn");
            }
          }
          // 查询与（如需）回写都成功后才记录最近更新时间；演练模式不记，避免挡住后续正式同步。
          if (!config.dryRun) {
            try {
              await idbRememberOrder(orderNo);
            } catch (error) {
              log(`申购单 ${orderNo}：写入本地更新记录失败：${error.message}`, "warn");
            }
          }
        } catch (error) {
          stats.failed += 1;
          if (error?.project) {
            aborted = true;
            status("同步中止", "error");
            log(`申购单 ${orderNo}：${error.message}`, "error");
            log("项目已失效，已终止本次同步", "error");
            break;
          }
          if (error?.structural) {
            aborted = true;
            status("同步中止", "error");
            log(`申购单 ${orderNo}：${error.message}`, "error");
            log("报表结构异常属系统性问题，已终止本次同步", "error");
            break;
          }
          log(
            `申购单 ${orderNo}：${error.message}（已计入失败，继续处理其余申购单）`,
            "error",
          );
        }
        renderStats();
      }
      if (aborted) {
        log(
          `已中止：进度 ${orderIndex}/${pendingOrders.length} 个申购单（失败 ${stats.failed}）`,
          "error",
        );
      } else {
        const cursorIds = orders
          .map((order) => Number(order.cursor_id))
          .filter(Number.isFinite);
        if (cursorIds.length) GM_setValue(key("cursor"), Math.min(...cursorIds));
        status(stats.failed ? "完成（有失败）" : "同步完成", stats.failed ? "warn" : "success");
        log(
          `同步完成：申购单 ${stats.scanned}，追溯号命中 ${stats.found}，更新 ${stats.updated}，失败 ${stats.failed}`,
          stats.failed ? "warn" : "success",
        );
      }
    } catch (error) {
      stats.failed += 1;
      renderStats();
      if (error?.project) {
        // 项目失效（未选择 / 已停用 / 不存在）：只提示一次，清掉本地选择并重新解析项目。
        status("同步中止", "error");
        log(error.message, "error");
        saveField("projectId", 0);
        await refreshProjects();
      } else {
        status("同步失败", "error");
        log(error.message, "error");
      }
    } finally {
      running = false;
      ui.run.disabled = false;
      ui.run.textContent = "同步一次";
      if (config.autoEnabled) schedule();
    }
  };
  // 自动模式执行窗口：仅北京时间 02:00–06:00（UTC+8，无夏令时）。
  // 返回距下次应执行的时间（毫秒）：窗口内返回 0；否则返回距下一个窗口开始
  // （当日或次日北京时间 02:00）的毫秒数。
  const autoWindowDelayMs = (nowMs) => {
    const bj = nowMs + 8 * 3600 * 1000; // 北京时间 = UTC+8
    const hour = new Date(bj).getUTCHours();
    if (hour >= 2 && hour < 6) return 0;
    const start = new Date(bj);
    start.setUTCHours(2, 0, 0, 0);
    let next = start.getTime();
    if (next <= bj) next += 24 * 3600 * 1000;
    return next - bj;
  };
  const schedule = (delay) => {
    clearTimeout(timer);
    if (!config.autoEnabled) return;
    const milliseconds = int(config.intervalMinutes, 10, 1, 1440) * 60000;
    const wait = autoWindowDelayMs(Date.now());
    if (wait > 0) {
      timer = setTimeout(() => run("auto"), wait);
      status(`自动模式：等北京时间凌晨2点（约 ${Math.ceil(wait / 60000)} 分钟后）`);
    } else {
      timer = setTimeout(
        () => run("auto"),
        typeof delay === "number" ? delay : milliseconds,
      );
      status(`自动模式：北京时间 2-6 点，每 ${config.intervalMinutes} 分钟`);
    }
  };
  const formConfig = () => ({
    platformUsername: ui.platformUsername.value.trim(),
    platformPassword: ui.platformPassword.value,
    apiToken: ui.apiToken.value.trim(),
    projectId: int(ui.project.value, config.projectId, 0, 2147483647),
    intervalMinutes: int(ui.interval.value, 10, 1, 1440),
    batchSize: int(ui.batch.value, 30, 1, 200),
    minPurchaseOrderNo: ui.minPurchaseOrderNo.value.trim(),
    dryRun: ui.dryRun.checked,
    autoEnabled: ui.auto.checked,
  });
  const fillForm = () => {
    ui.platformUsername.value = config.platformUsername;
    ui.platformPassword.value = config.platformPassword;
    ui.apiToken.value = config.apiToken;
    ui.interval.value = config.intervalMinutes;
    ui.batch.value = config.batchSize;
    ui.minPurchaseOrderNo.value = config.minPurchaseOrderNo;
    ui.dryRun.checked = config.dryRun;
    ui.auto.checked = config.autoEnabled;
  };
  const debounce = (fn, milliseconds = 500) => {
    let pending = null;
    return (...args) => {
      clearTimeout(pending);
      pending = setTimeout(() => fn(...args), milliseconds);
    };
  };
  const bindAutosave = () => {
    const textBindings = [
      [ui.platformUsername, "platformUsername", (value) => value.trim()],
      [ui.platformPassword, "platformPassword", (value) => value],
      [ui.apiToken, "apiToken", (value) => value.trim()],
      [ui.minPurchaseOrderNo, "minPurchaseOrderNo", (value) => value.trim()],
      [ui.interval, "intervalMinutes", (value) => int(value, 10, 1, 1440)],
      [ui.batch, "batchSize", (value) => int(value, 30, 1, 200)],
    ];
    for (const [input, name, normalize] of textBindings) {
      input.addEventListener(
        "input",
        debounce(() => saveField(name, normalize(String(input.value)))),
      );
    }
    ui.dryRun.addEventListener("change", () =>
      saveConfig({ dryRun: ui.dryRun.checked }),
    );
    ui.project.addEventListener("change", () => {
      saveField("projectId", Number(ui.project.value) || 0);
      renderStats();
      log(`已选择${projectLabel(activeProject())}`);
    });
    ui.auto.addEventListener("change", () => {
      saveConfig({ autoEnabled: ui.auto.checked });
      if (config.autoEnabled) {
        log("自动模式已开启（仅北京时间 02:00–06:00 执行）");
        schedule(1500);
      } else {
        clearTimeout(timer);
        status("自动模式已关闭");
        log("自动模式已关闭");
      }
    });
  };
  const minimize = (value = host.dataset.minimized !== "true") => {
    host.dataset.minimized = String(value);
    ui.minimize.textContent = value ? "□" : "—";
    saveConfig({ minimized: value });
  };
  const drag = (handle) => {
    let active = false;
    let startX;
    let startY;
    let startRight;
    let startBottom;
    handle.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      active = true;
      startX = event.clientX;
      startY = event.clientY;
      startRight = Number.parseFloat(host.style.right) || 20;
      startBottom = Number.parseFloat(host.style.bottom) || 20;
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (!active) return;
      host.style.right = `${Math.max(0, startRight - event.clientX + startX)}px`;
      host.style.bottom = `${Math.max(0, startBottom - event.clientY + startY)}px`;
    });
    handle.addEventListener("pointerup", (event) => {
      if (!active) return;
      active = false;
      handle.releasePointerCapture(event.pointerId);
      saveConfig({
        panelRight: Number.parseFloat(host.style.right),
        panelBottom: Number.parseFloat(host.style.bottom),
      });
    });
  };
  const createPanel = () => {
    host = document.createElement("div");
    host.id = "huaxing-tracking-sync-userscript";
    host.style.cssText = `position:fixed;z-index:2147483647;right:${Number(config.panelRight) || 20}px;bottom:${Number(config.panelBottom) || 20}px`;
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
<style>
:host{all:initial;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;color:#1f2937}*{box-sizing:border-box}.panel{width:380px;overflow:hidden;border:1px solid #cbd5e1;border-radius:8px;background:#fff;box-shadow:0 18px 45px #0f172a38}.head{display:flex;align-items:center;gap:8px;padding:9px 10px 9px 14px;color:#fff;background:#176b5b;cursor:move;user-select:none}.title{flex:1;font-size:14px;font-weight:700}.status{max-width:170px;overflow:hidden;padding:3px 8px;border-radius:4px;background:#ffffff2e;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.status[data-kind=success]{background:#10b98155}.status[data-kind=warn]{background:#f59e0b66}.status[data-kind=error]{background:#ef444466}.mini{width:28px;height:28px;border:0;border-radius:4px;color:#fff;background:#ffffff22;cursor:pointer}.body{padding:12px}:host([data-minimized=true]) .body{display:none}:host([data-minimized=true]) .panel{width:260px}.toolbar{display:flex;align-items:center;gap:9px}.run,.save{height:34px;border-radius:4px;padding:0 14px;font-weight:650;cursor:pointer}.run{border:0;color:#fff;background:#176b5b}.save{border:1px solid #cbd5e1;color:#334155;background:#fff}.switch{display:flex;align-items:center;gap:6px;margin-left:auto;font-size:12px;color:#475569}.switch input,.check input{accent-color:#176b5b}.stats{margin:10px 0;padding:8px 10px;border-radius:4px;color:#475569;background:#f1f5f9;font-size:12px}details{border:1px solid #e2e8f0;border-radius:4px}summary{padding:9px 10px;font-size:12px;font-weight:650;cursor:pointer}.settings{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:0 10px 10px}label{display:grid;gap:4px;color:#64748b;font-size:11px}input[type=text],input[type=number],select{width:100%;height:31px;border:1px solid #cbd5e1;border-radius:4px;padding:0 8px}.full{grid-column:1/-1}.check{display:flex;align-items:center;gap:6px}.logs{height:170px;margin-top:10px;overflow:auto;border-radius:4px;padding:8px;color:#cbd5e1;background:#20252b;font:11px/1.55 Consolas,"Microsoft YaHei",monospace}.logs div{margin-bottom:2px;overflow-wrap:anywhere}.logs .success{color:#6ee7b7}.logs .warn{color:#fcd34d}.logs .error{color:#fca5a5}button:disabled{opacity:.55;cursor:wait}
</style>
<section class="panel"><header class="head"><div class="title">华友印尼数据平台同步</div><div class="status">待机</div><button class="mini" title="最小化">—</button></header><div class="body"><div class="toolbar"><button class="run">同步一次</button><label class="switch"><input class="auto" type="checkbox">自动模式</label></div><div class="stats">项目：未选择 · 申购单 0 · 追溯号命中 0 · 更新 0 · 跳过 0 · 失败 0</div><details><summary>连接与同步设置</summary><div class="settings"><label>物资平台账号<input class="platform-user" type="text"></label><label>物资平台密码<input class="platform-pass" type="text" autocomplete="off"></label><label>接口令牌<input class="api-token" type="text" autocomplete="off" placeholder="管理端 API Token"></label><label class="full">项目<select class="project"></select></label><label>自动间隔<input class="interval" type="number" min="1" max="1440"></label><label>单次申购单数<input class="batch" type="number" min="1" max="200"></label><label>申购单号起始<input class="min-po-no" type="text" placeholder="如 P05SG0300"></label><label class="check full"><input class="dry-run" type="checkbox">演练模式</label><button class="save full">保存设置</button></div></details><div class="logs"></div></div></section>`;
    document.documentElement.append(host);
    ui = {
      status: shadow.querySelector(".status"),
      minimize: shadow.querySelector(".mini"),
      run: shadow.querySelector(".run"),
      auto: shadow.querySelector(".auto"),
      stats: shadow.querySelector(".stats"),
      logs: shadow.querySelector(".logs"),
      platformUsername: shadow.querySelector(".platform-user"),
      platformPassword: shadow.querySelector(".platform-pass"),
      apiToken: shadow.querySelector(".api-token"),
      project: shadow.querySelector(".project"),
      interval: shadow.querySelector(".interval"),
      batch: shadow.querySelector(".batch"),
      minPurchaseOrderNo: shadow.querySelector(".min-po-no"),
      dryRun: shadow.querySelector(".dry-run"),
      save: shadow.querySelector(".save"),
    };
    fillForm();
    bindAutosave();
    minimize(Boolean(config.minimized));
    drag(shadow.querySelector(".head"));
    // 打开“连接与同步设置”面板时刷新项目下拉框（令牌可能刚改过）
    shadow.querySelector("details").addEventListener("toggle", (event) => {
      if (event.target.open) refreshProjects();
    });
    ui.minimize.addEventListener("click", () => minimize());
    ui.run.addEventListener("click", () => run());
    ui.save.addEventListener("click", () => {
      saveConfig(formConfig());
      fillForm();
      log("设置已保存", "success");
      refreshProjects();
      if (config.autoEnabled) schedule(1500);
      else {
        clearTimeout(timer);
        status("待机");
      }
    });
    renderStats();
    refreshProjects();
    if (config.autoEnabled) schedule(3000);
  };

  GM_registerMenuCommand("印尼数据平台：同步一次", () => run());
  GM_registerMenuCommand("印尼数据平台：切换自动模式", () => {
    saveConfig({ autoEnabled: !config.autoEnabled });
    if (ui) ui.auto.checked = config.autoEnabled;
    if (config.autoEnabled) schedule(1000);
    else clearTimeout(timer);
    log(`自动模式已${config.autoEnabled ? "开启" : "关闭"}`);
  });

  createPanel();
})();
