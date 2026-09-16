// ==UserScript==
// @name         备件管理系统 - 华友何佳状态同步（旧系统）
// @namespace    https://materials-manager.qcloud.19890605.xyz/
// @version      2.0.0
// @description  对「申购单号 < 阈值（默认 P05SG0300）」的申购单按申购单号整单查询华友何佳“物资状态查询”，一次批量回写业务员、状态、合同号、合同签订日期、船号、集港与发运信息。
// @match        https://materials-manager.qcloud.19890605.xyz/*
// @updateURL    https://github.com/Sakana-1314/Electrical-Manager/raw/refs/heads/main/docs/references/scripts/huayou-hejia-sync.user.js
// @downloadURL  https://github.com/Sakana-1314/Electrical-Manager/raw/refs/heads/main/docs/references/scripts/huayou-hejia-sync.user.js
// @connect      materials-manager.qcloud.19890605.xyz
// @connect      quick-hejia.qcloud.19890605.xyz
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

// —— 与新版脚本（huayou-new-sync.user.js）的分工 ——
//   华友印尼数据平台脚本：申购单号 >= 阈值（默认 P05SG0300）
//   本脚本（华友何佳旧系统）：申购单号 < 阈值（默认 P05SG0300）
// 两个脚本互补、互不重叠；阈值在悬浮窗「连接与同步设置 → 申购单号上限（不含）」里改。
// 本脚本对齐新版脚本的做法：按申购单号整单查询、整单批量回写、3 天冷却去重、
// 首次请求做结构校验、悬浮窗输入即自动保存。
//
// —— 何佳请求协议（据附件 HAR 与站点自身实现核对，载荷逐字节一致）——
//   1. POST /hjerp/servlet/ComIDServlet           取组织列表（华越物资供应追踪系统）
//   2. POST /hjerp/servlet/login                  登录（comId/userId/password/uncheck=Y）
//   3. POST /hjerp/servlet/FlexUIServlet          取“物资状态查询”报表配置（menuId=820017687）
//   4. POST /hjerp/servlet/DataSetQueryServlet    按 conds 整单查询，json 参数为 base64(载荷)；
//      载荷里 conds 与 tables 两个字符串值需要反转后提交，qcols 是本次查询字段（申购单号），
//      整单条件为 `var_reqno like '%<申购单号>%'`，pageSize=800、超过一页时按 currPage 逐页拉全。
//   会话失效时接口返回 HTTP 403 /「登录超时或请求未认证」，脚本会自动补登一次并重试。

(() => {
  "use strict";

  const HEJIA_BASE = "https://quick-hejia.qcloud.19890605.xyz/hjerp";
  const MATERIALS_API = "https://materials-manager.qcloud.19890605.xyz/api/v1";
  const MENU_ID = "820017687";
  const MENU_NAME = "物资状态查询";
  const COMPANY_NAME = "华越物资供应追踪系统";
  // 单号阈值：只处理严格小于该值的申购单（旧系统数据）；新版脚本负责 >= 该值的申购单。
  const DEFAULT_MAX_PURCHASE_ORDER_NO = "P05SG0300";
  // 同步字段：与新脚本口径一致（含物资级「合同签订日期」）。
  const SYNC_FIELD_LIST = [
    "salesperson",
    "contract_no",
    "vessel_no",
    "consolidation_date",
    "consolidation_port",
    "sailing_date",
    "contract_sign_date",
    "status",
  ];
  // 后端旧版本不认识新增同步字段（返回“未知同步字段”）：降级为旧字段列表继续同步。
  const LEGACY_SYNC_FIELD_LIST = SYNC_FIELD_LIST.filter(
    (name) => name !== "contract_sign_date",
  );
  const SIGN_DATE_FIELD = "contract_sign_date";
  // 何佳单次查询页大小：与站点自身一致（HAR 实测 pageSize=800）；超过一页时逐页拉全。
  const HEJIA_PAGE_SIZE = 800;
  const HEJIA_MAX_PAGES = 50;
  // 何佳报表查询之间的最小间隔：避免连续整单查询给旧系统太大压力（登录不计入）。
  const HEJIA_MIN_GAP_MS = 1000;
  // 何佳请求（含登录）的瞬时错误重试次数：旧系统挂在 Cloudflare 后面，偶发 5xx / 524。
  const HEJIA_REQUEST_ATTEMPTS = 3;
  const PREFIX = "hejia_sync_";
  // 本地更新记录（IndexedDB）：每个申购单记录最近成功同步时间，冷却期内不再查询何佳。
  const IDB_NAME = `${PREFIX}order_sync`;
  const IDB_STORE = "orders";
  const ORDER_COOLDOWN_DAYS = 3;
  const ORDER_COOLDOWN_MS = ORDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const defaults = {
    hejiaUsername: "hync",
    hejiaPassword: "",
    apiToken: "",
    // 当前项目 id（0 = 未选择）：后端按项目隔离数据，业务接口都要带 X-Project-Id。
    projectId: 0,
    intervalMinutes: 10,
    batchSize: 30,
    maxPurchaseOrderNo: DEFAULT_MAX_PURCHASE_ORDER_NO,
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
  const array = (value) =>
    value == null ? [] : Array.isArray(value) ? value : [value];
  const boolean = (value, fallback) => {
    if (value == null || value === "") return fallback;
    return typeof value === "boolean"
      ? value
      : String(value).toLowerCase() === "true";
  };
  const joined = (values) => {
    const text = [...new Set(values.map(clean).filter(Boolean))].join(" / ");
    return text.length <= 128 ? text : `${text.slice(0, 127)}…`;
  };
  const reverse = (value) => String(value ?? "").split("").reverse().join("");
  const escapeJs = (value) =>
    String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t");
  const base64 = (value) => {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000)
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return btoa(binary);
  };
  const form = (data) =>
    Object.entries(data)
      .map(
        ([name, value]) =>
          `${encodeURIComponent(name)}=${encodeURIComponent(value ?? "")}`,
      )
      .join("&");
  const sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));
  const debounce = (fn, milliseconds = 500) => {
    let pending = null;
    return (...args) => {
      clearTimeout(pending);
      pending = setTimeout(() => fn(...args), milliseconds);
    };
  };
  // 结构性错误：报表配置 / 接口契约与脚本不符，属系统性问题，出现即终止本次同步。
  const structuralError = (message) =>
    Object.assign(new Error(`【结构异常】${message}`), { structural: true });
  // 项目相关问题（后端多项目隔离）：只给一条中文提示并终止本次同步。
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

  let config = loadConfig();
  let running = false;
  let timer = null;
  let host;
  let ui;
  // 何佳登录用户（补登成功后写入）：仅用于日志回显。
  let hejiaUser = null;
  const logs = [];
  let stats = { scanned: 0, found: 0, updated: 0, skipped: 0, failed: 0 };

  // —— 本地更新记录（IndexedDB）：3 天内已成功同步过的申购单不再查询何佳 ——
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
        const request = transaction.objectStore(IDB_STORE).getAll();
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

  let requestSeq = 0;
  // 请求调试日志只打方法/地址/状态与长度：不打印密码、接口令牌等凭证。
  const request = ({ method = "GET", url, headers = {}, data, timeout = 60000 }) =>
    new Promise((resolve, reject) => {
      const no = ++requestSeq;
      console.info(`[华友何佳] → 请求 #${no}`, { method, url });
      GM_xmlhttpRequest({
        method,
        url,
        headers,
        data,
        timeout,
        anonymous: false,
        onload(response) {
          const text = String(response.responseText || response.response || "");
          // finalUrl：跟随重定向后的地址。何佳会话失效时会 302 到 /hjerp/login，
          // 浏览器端跟随后只能看最终地址，据此判定“登录已失效”。
          const finalUrl = String(response.finalUrl || url);
          console.info(`[华友何佳] ← 响应 #${no}`, {
            status: response.status,
            length: text.length,
          });
          if (response.status >= 200 && response.status < 300)
            resolve({ text, status: response.status, finalUrl });
          else {
            reject(
              Object.assign(
                new Error(`HTTP ${response.status}：${text.slice(0, 300)}`),
                { status: response.status, body: text, finalUrl },
              ),
            );
          }
        },
        ontimeout: () => {
          console.info(`[华友何佳] ✗ 超时 #${no}`, { method, url });
          reject(new Error(`请求超时：${url}`));
        },
        onerror: (error) => {
          const detail = error?.error || error?.message || "网络请求失败";
          console.info(`[华友何佳] ✗ 失败 #${no}`, { url, detail });
          reject(new Error(`${detail}：${url}`));
        },
      });
    });
  const json = async (options) => {
    const { text, finalUrl } = await request(options);
    try {
      return JSON.parse(text);
    } catch {
      // 会话失效时何佳会 302 到登录页（或被重定向后返回 HTML），都按“不是有效 JSON”报错，
      // 但带上 loginPage 标记，交给 hejiaRequest 走补登流程。
      throw Object.assign(
        new Error(`接口返回的不是有效 JSON：${text.slice(0, 200)}`),
        {
          loginPage:
            /\/login\b|login/i.test(finalUrl) ||
            /<html|name=["']?password|登\s*录/i.test(text),
        },
      );
    }
  };
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
  // —— 整单目标：一次拿一批申购单（含每单待同步追溯号），并带上单号上限 ——
  let signDateSyncSupported = true;
  const orderTargetsUrl = (fieldList) => {
    const limit = int(config.batchSize, 30, 1, 200);
    const cursor = Number(GM_getValue(key("cursor"), 0)) || 0;
    const maxPo = clean(config.maxPurchaseOrderNo);
    const base = `${MATERIALS_API}/purchase-record-sync/order-targets?limit=${limit}&cursor=${cursor}&fields=${encodeURIComponent(fieldList)}`;
    // 上限参数由后端做半开区间过滤 [min, max)：单号 < 上限的记录才属于旧系统。
    return maxPo ? `${base}&max_purchase_order_no=${encodeURIComponent(maxPo)}` : base;
  };
  const orderTargets = async () => {
    const fields = () =>
      (signDateSyncSupported ? SYNC_FIELD_LIST : LEGACY_SYNC_FIELD_LIST).join(",");
    let payload;
    try {
      payload = await apiRequest({ method: "GET", url: orderTargetsUrl(fields()) });
    } catch (error) {
      // 服务端尚未更新（不认识 contract_sign_date）时降级为旧字段列表，本次同步其余字段照常。
      if (signDateSyncSupported && /未知同步字段/.test(error?.message || "")) {
        signDateSyncSupported = false;
        log(
          "服务端暂不支持合同签订日期字段（未知同步字段），已降级为旧字段同步；请更新后端后重试",
          "warn",
        );
        payload = await apiRequest({ method: "GET", url: orderTargetsUrl(fields()) });
      } else {
        throw error;
      }
    }
    const result = requireShape(payload, "整单目标接口");
    if (!Array.isArray(result.items))
      throw structuralError("整单目标接口缺少 items 数组");
    for (const item of result.items) {
      if (
        !item ||
        typeof item.purchase_order_no !== "string" ||
        !item.purchase_order_no.trim()
      )
        throw structuralError("整单目标接口存在缺少申购单号的目标");
      if (!Array.isArray(item.trace_nos))
        throw structuralError("整单目标缺少追溯号列表");
    }
    const rows = result.items;
    if (!rows.length && Number(GM_getValue(key("cursor"), 0)) > 0) {
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
      for (const field of [
        "applied",
        "not_found",
        "affected_headers",
        "affected_lines",
      ]) {
        if (!Number.isFinite(Number(payload[field])))
          throw structuralError(`整单回写接口缺少 ${field}`);
      }
      return payload;
    } catch (error) {
      if (attempt < 2 && !error?.structural && !error?.project) {
        log(
          `申购单 ${orderNo}：回写请求失败（${error.message}），短暂等待后重试一次`,
          "warn",
        );
        await sleep(1500);
        return applyOrder(orderNo, items, attempt + 1);
      }
      throw error;
    }
  };

  // —— 何佳（旧系统）会话：会话失效时自动补登一次并重试 ——
  // 失效表现有三种：登录超时 403（JSON 提示）、未认证 401、302 到 /hjerp/login（或跟随后落在登录页）。
  const isAuthError = (error) =>
    [302, 401, 403].includes(Number(error?.status)) ||
    error?.loginPage === true ||
    /登录超时|未认证|重新登录/.test(String(error?.message || ""));
  const loginHejia = async () => {
    if (!config.hejiaPassword)
      throw new Error(
        "何佳登录已失效，且未填写何佳密码无法自动补登：请在悬浮窗填写何佳密码后重试",
      );
    const companies = await json({
      method: "POST",
      url: `${HEJIA_BASE}/servlet/ComIDServlet`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      data: "",
    });
    const list = array(companies);
    const company =
      list.find((item) => item?.nameCom === COMPANY_NAME) || list[0];
    if (!company?.idCom)
      throw structuralError("何佳组织列表里没有“华越物资供应追踪系统”");
    const result = await json({
      method: "POST",
      url: `${HEJIA_BASE}/servlet/login`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      data: form({
        comId: company.idCom,
        userId: config.hejiaUsername,
        password: config.hejiaPassword,
        uncheck: "Y",
      }),
    });
    if (result?.errorCode || result?.errorMsg)
      throw new Error(result.errorMsg || `何佳登录失败：${result.errorCode}`);
    hejiaUser = result.loginUser || null;
    return hejiaUser;
  };
  // 带自动补登的何佳请求：第一次失败若是会话问题，登录一次后原样重试。
  const hejiaFetch = async (options) => {
    try {
      return await json(options);
    } catch (error) {
      if (!isAuthError(error)) throw error;
      log("检测到何佳登录已失效，正在用脚本账号补登…", "warn");
      await loginHejia();
      log(`何佳登录成功：${hejiaUser?.userName || config.hejiaUsername}`);
      return json(options);
    }
  };
  // 何佳（旧系统）走 Cloudflare，登录与报表接口偶发 5xx / 524（源站超时）：
  // 这类瞬时错误整段重试（含补登），避免一次抖动就整批失败。
  const isTransientError = (error) =>
    [408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524].includes(
      Number(error?.status),
    ) || /请求超时|网络请求失败|timeout/i.test(String(error?.message || ""));
  const hejiaRequest = async (options, attempt = 1) => {
    try {
      return await hejiaFetch(options);
    } catch (error) {
      if (attempt < HEJIA_REQUEST_ATTEMPTS && isTransientError(error)) {
        log(
          `何佳请求失败（${error.message}），等待后重试（第 ${attempt + 1}/${HEJIA_REQUEST_ATTEMPTS} 次）`,
          "warn",
        );
        await sleep(2000 * attempt);
        return hejiaRequest(options, attempt + 1);
      }
      throw error;
    }
  };

  // —— 何佳报表配置与查询载荷 ——
  const dataset = async () => {
    const result = await hejiaRequest({
      method: "POST",
      url: `${HEJIA_BASE}/servlet/FlexUIServlet`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      data: form({ menuId: MENU_ID, menuName: MENU_NAME }),
    });
    if (String(result?.result?.code) !== "1")
      throw structuralError(result?.result?.msg || "加载何佳查询配置失败");
    const sets = array(result?.dataSource?.dataSets?.dataSet);
    const source = sets.find((item) => item.compId === MENU_ID) || sets[0];
    if (!array(source?.fields?.field).length)
      throw structuralError("何佳查询配置缺少数据集字段");
    return source;
  };
  const fieldJson = (field) => {
    const table = field.tableAlias || field.tableName || "";
    let output = `{table:"${escapeJs(table)}",col:"${escapeJs(field.name)}",alias:"${escapeJs(field.dataField)}"`;
    if (!boolean(field.visible, true)) output += ",visible:false";
    if (String(field.type ?? "1") !== "1")
      output += `,type:"${escapeJs(field.type)}"`;
    if (boolean(field.sumFlag, false)) output += ",sumFlag:true";
    if (boolean(field.isVirtual, false)) {
      output += ",virtual:true";
      if (field.ext) output += `,ext:"${escapeJs(field.ext)}"`;
    }
    output += `,text:"${escapeJs(field.headerText)}"`;
    output += `,queryCol:${boolean(field.queryCol, true)}`;
    output += `,mainField:${boolean(field.mainField, false)}`;
    output += `,relatCol:"${escapeJs(field.relatCol || "")}"`;
    output += `,format:"${escapeJs(field.format || "")}"}`;
    return output;
  };
  // 查询载荷：字段清单、表连接、默认条件全部取自报表配置，运行期只替换「申购单号」条件。
  // conds 与 tables 需要字符串反转后提交；qcols 是本次查询字段（申购单号），与站点自身一致。
  const queryPayload = (source, orderNo, page) => {
    const fields = array(source.fields.field);
    const orderField = fields.find((field) => clean(field.name) === "var_reqno");
    if (!orderField)
      throw structuralError("何佳配置缺少申购单号字段 var_reqno");
    const table = source.name || source.aliasName || "";
    const condition = [
      source.defaultQuery,
      `${orderField.tableAlias || orderField.tableName || table}.var_reqno like '%${String(orderNo).replace(/'/g, "''")}%'`,
    ]
      .filter(Boolean)
      .join(" and ");
    const parts = [
      `compId:"${escapeJs(source.compId || MENU_ID)}"`,
      `table:"${escapeJs(table)}"`,
      `canSave:${boolean(source.canSave, true)}`,
      `conds:"${escapeJs(reverse(condition))}"`,
      "isQueryButton:true",
      `condsall:"${escapeJs(source.queryAll || "")}"`,
      `queryDrill:"${escapeJs(source.queryDrill || "")}"`,
      `pagePilot:{pageSize:${HEJIA_PAGE_SIZE},currPage:${page}}`,
      `fixSql:"${escapeJs(source.initsql || source.fsql || "")}"`,
      `presqls:"${escapeJs(source.presql || "")}"`,
      `col:"${escapeJs(source.columnId || "")}"`,
      `tables:["${escapeJs(reverse(`${table} ${source.relation || ""}`))}"]`,
      `cols:[${fields.map(fieldJson).join(",")}]`,
      "multiCols:[]",
      `qcols:[${fieldJson(orderField)}]`,
      `orderBy:"${escapeJs(source.orderBy || "")}"`,
    ];
    return `{${parts.join(",")}}`;
  };
  const rowValue = (row, alias) => {
    if (!alias) return "";
    const cell = row?.[alias];
    return clean(
      cell && typeof cell === "object" && "val" in cell ? cell.val : cell,
    );
  };
  const fieldAlias = (fields, names, headers) => {
    const normalizedHeaders = headers.map(clean);
    const field =
      fields.find((item) => names.includes(clean(item.name))) ||
      fields.find((item) => {
        const header = clean(item.headerText);
        return normalizedHeaders.some(
          (candidate) => header === candidate || header.includes(candidate),
        );
      });
    return field?.dataField;
  };
  // 列别名解析：优先按何佳内部字段名（HAR 实测：var_reqno/var_trackno/flag_prog/…），
  // 内部改过名时退回按中文表头识别。
  const aliasesFrom = (fields) => ({
    order: fieldAlias(fields, ["var_reqno"], ["申购单号"]),
    trace: fieldAlias(fields, ["var_trackno"], ["追踪码", "追溯码"]),
    status: fieldAlias(fields, ["flag_prog"], ["当前状态"]),
    salesperson: fieldAlias(fields, ["var_reqclerk"], ["业务员"]),
    contract: fieldAlias(
      fields,
      ["var_conno", "var_contractno", "var_pactno"],
      ["合同号", "合同编号"],
    ),
    vessel: fieldAlias(
      fields,
      ["var_shipno", "var_vesselno", "var_boatno"],
      ["船号", "船名"],
    ),
    consolidationDate: fieldAlias(
      fields,
      ["date_rcv", "date_jg", "date_collectport", "date_consolidation"],
      ["集港日期"],
    ),
    consolidationPort: fieldAlias(
      fields,
      ["name_post", "var_jgport", "var_collectport"],
      ["集港港口", "集港口岸"],
    ),
    sailingDate: fieldAlias(
      fields,
      ["date_ship", "date_sailing", "date_departure"],
      ["发船日期", "开船日期"],
    ),
    contractSignDate: fieldAlias(
      fields,
      ["date_sign"],
      ["合同签订日期", "合同签订时间", "签订日期"],
    ),
  });
  // 何佳日期列解析为 ISO 日期；无法识别、或明显是占位（何佳把「无日期」写成
  // 1900-01-01）的值一律返回空串——宁可不填，也不写错日期。
  const normalizedDate = (value) => {
    const match = clean(value).match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?/);
    if (!match) return "";
    const year = Number(match[1]);
    if (year < 2000) return "";
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    )
      return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  // 同一申购单下多个批次行：日期取最新的有效值。
  const latestDate = (values) =>
    values.map(normalizedDate).filter(Boolean).sort().at(-1) || "";
  // 何佳整单查询：pageSize=800，超过一页时按 currPage 逐页拉全。
  const queryOrder = async (source, orderNo) => {
    const pages = [];
    const first = await hejiaQueryPage(source, orderNo, 1);
    pages.push(first);
    const pageCount = int(first?.dataSource?.page?.pageCount, 1, 1, HEJIA_MAX_PAGES);
    for (let page = 2; page <= pageCount; page += 1) {
      pages.push(await hejiaQueryPage(source, orderNo, page));
    }
    return pages.flatMap((result) => array(result?.dataSource?.rows?.row));
  };
  const hejiaQueryPage = async (source, orderNo, page) => {
    const result = await hejiaRequest({
      method: "POST",
      url: `${HEJIA_BASE}/servlet/DataSetQueryServlet?default=default&`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      data: form({ params: "", json: base64(queryPayload(source, orderNo, page)) }),
    });
    // 空结果也是 code=1（msg=查询结果为空），由调用方按“未查询到记录”处理。
    if (String(result?.result?.code) !== "1")
      throw new Error(result?.result?.msg || `何佳查询 ${orderNo} 失败`);
    return result;
  };
  const resultFor = (rows, aliases) => ({
    count: rows.length,
    status: joined(rows.map((row) => rowValue(row, aliases.status))),
    salesperson: joined(rows.map((row) => rowValue(row, aliases.salesperson))),
    contractNo: joined(rows.map((row) => rowValue(row, aliases.contract))),
    vesselNo: joined(rows.map((row) => rowValue(row, aliases.vessel))),
    consolidationDate: latestDate(
      rows.map((row) => rowValue(row, aliases.consolidationDate)),
    ),
    consolidationPort: joined(
      rows.map((row) => rowValue(row, aliases.consolidationPort)),
    ),
    sailingDate: latestDate(rows.map((row) => rowValue(row, aliases.sailingDate))),
    contractSignDate: latestDate(
      rows.map((row) => rowValue(row, aliases.contractSignDate)),
    ),
  });
  // 整单行按追溯码分组：条件用的是 like '%单号%'，能取到申购单号列时只保留严格等于本单的行。
  const groupByTrace = (rows, aliases, orderNo) => {
    const groups = new Map();
    for (const row of rows) {
      const rowOrder = rowValue(row, aliases.order);
      if (rowOrder && rowOrder !== orderNo) continue;
      const trace = rowValue(row, aliases.trace);
      if (!trace) continue;
      const group = groups.get(trace) || [];
      group.push(row);
      groups.set(trace, group);
    }
    const results = {};
    for (const [trace, group] of groups) results[trace] = resultFor(group, aliases);
    return results;
  };
  // 何佳报表查询之间保持最小间隔（登录不计入）。
  const hejiaPacer = (() => {
    let last = 0;
    return async () => {
      const wait = Math.max(0, HEJIA_MIN_GAP_MS - (Date.now() - last));
      if (wait > 0) await sleep(wait);
      last = Date.now();
    };
  })();

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
    if (ui)
      ui.stats.textContent = `${projectLabel(activeProject())} · 申购单 ${stats.scanned} · 追溯号命中 ${stats.found} · 更新 ${stats.updated} · 跳过 ${stats.skipped} · 失败 ${stats.failed}`;
  };
  const status = (text, kind = "idle") => {
    if (!ui) return;
    ui.status.textContent = text;
    ui.status.dataset.kind = kind;
  };
  const credentials = () => {
    // 何佳查询优先复用浏览器现有何佳会话，因此不强制要求何佳密码；
    // 仅在接口返回登录超时、需要自动补登时才会用到何佳账号密码。
    if (!config.apiToken) throw new Error("请先填写并保存：接口令牌");
  };
  const summarize = (result) =>
    [
      ["业务员", result.salesperson],
      ["状态", result.status],
      ["合同号", result.contractNo],
      ["合同签订日期", result.contractSignDate],
      ["船号", result.vesselNo],
      ["集港日期", result.consolidationDate],
      ["集港港口", result.consolidationPort],
      ["发船日期", result.sailingDate],
    ]
      .filter(([, value]) => value)
      .map(([label, value]) => `${label}=${value}`)
      .join("，");
  const buildItem = (trace, result) => {
    const payload = {};
    for (const [field, value] of [
      ["salesperson", result.salesperson],
      ["contract_no", result.contractNo],
      ["vessel_no", result.vesselNo],
      ["consolidation_date", result.consolidationDate],
      ["consolidation_port", result.consolidationPort],
      ["sailing_date", result.sailingDate],
      // 旧后端不支持该字段时跳过，避免整单回写被 422 拒绝
      ...(signDateSyncSupported
        ? [[SIGN_DATE_FIELD, result.contractSignDate]]
        : []),
      ["status", result.status],
    ]) {
      if (value) payload[field] = value;
    }
    return Object.keys(payload).length
      ? { trace_no: trace, ...payload }
      : null;
  };
  // 本页游标推进：整单目标按“每组最大 line.id”倒序翻页，处理不完时把游标推到本页末尾，
  // 让后续批次继续处理更早的申购单（与新版脚本一致）。
  const advanceCursor = (orders) => {
    const ids = orders.map((order) => Number(order.cursor_id)).filter(Number.isFinite);
    if (ids.length) GM_setValue(key("cursor"), Math.min(...ids));
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
      const limit = clean(config.maxPurchaseOrderNo);
      log(
        limit
          ? `只处理申购单号 < ${limit} 的旧系统申购单（>= ${limit} 交由新版脚本）`
          : "未设置申购单号上限：本次将处理全部申购单",
        limit ? "info" : "warn",
      );
      log(`${trigger === "auto" ? "自动" : "手动"}同步开始（按申购单号整单同步）`);
      const orders = await orderTargets();
      const oldOrders = limit
        ? orders.filter((order) => clean(order.purchase_order_no) < limit)
        : orders;
      const skippedNewer = orders.length - oldOrders.length;
      if (skippedNewer) {
        const examples = orders
          .filter((order) => clean(order.purchase_order_no) >= limit)
          .slice(0, 3)
          .map((order) => clean(order.purchase_order_no))
          .join("、");
        log(
          `跳过 ${skippedNewer} 个不属于旧系统的申购单（>= ${limit}${examples ? `，如 ${examples}` : ""}）`,
          "warn",
        );
      }
      stats.scanned = oldOrders.length;
      renderStats();
      if (!oldOrders.length) {
        status("无需同步", "success");
        if (skippedNewer) {
          advanceCursor(orders);
          log("本批申购单都不属于旧系统，已跳过并推进批次，本次未查询何佳", "warn");
        } else {
          log("没有需要补齐的旧系统申购单");
        }
        return;
      }
      // 3 天冷却去重：最近一次成功同步过的申购单本次跳过，避免频繁查询何佳。
      let recentOrderNos = new Set();
      let idbAvailable = true;
      try {
        recentOrderNos = await idbRecentOrderNos(ORDER_COOLDOWN_MS);
      } catch (error) {
        idbAvailable = false;
        log(`本地更新记录不可用（${error.message}），本次不做 3 天去重`, "warn");
      }
      const pendingOrders = idbAvailable
        ? oldOrders.filter((order) => {
            const orderNo = clean(order.purchase_order_no);
            if (recentOrderNos.has(orderNo)) {
              stats.skipped += 1;
              return false;
            }
            return true;
          })
        : oldOrders;
      if (pendingOrders.length !== oldOrders.length) {
        log(
          `跳过 ${oldOrders.length - pendingOrders.length} 个 ${ORDER_COOLDOWN_DAYS} 天内已更新的申购单（避免重复查询）`,
          "warn",
        );
        renderStats();
      }
      if (!pendingOrders.length) {
        advanceCursor(orders);
        status("全部在冷却期内", "success");
        log(
          `本批 ${oldOrders.length} 个旧系统申购单均在 ${ORDER_COOLDOWN_DAYS} 天冷却期内，已跳过并推进批次，本次未查询何佳`,
          "warn",
        );
        return;
      }
      log("查询将复用浏览器现有何佳会话；会话失效时会用脚本账号自动补登一次");
      const source = await dataset();
      const aliases = aliasesFrom(array(source.fields.field));
      if (!aliases.trace || !aliases.order)
        throw structuralError(
          "何佳配置缺少追踪码或申购单号列，无法按整单回写",
        );
      log(`已加载“${source.headerText || MENU_NAME}”查询配置`);
      let orderIndex = 0;
      let aborted = false;
      let signDateColumnWarned = false;
      for (const order of pendingOrders) {
        orderIndex += 1;
        const orderNo = clean(order.purchase_order_no);
        const traceNos = array(order.trace_nos).map(clean).filter(Boolean);
        status(`${orderIndex}/${pendingOrders.length} ${orderNo}`, "running");
        try {
          await hejiaPacer();
          const rows = await queryOrder(source, orderNo);
          const perTrace = groupByTrace(rows, aliases, orderNo);
          // 有数据行却一行追踪码都解析不出来：报表模板可能已变化，只提示不中止。
          if (rows.length && !Object.keys(perTrace).length)
            log(
              `${orderNo}：何佳返回 ${rows.length} 行但未解析出追踪码，请检查“物资状态查询”报表配置`,
              "warn",
            );
          if (!aliases.contractSignDate && !signDateColumnWarned) {
            signDateColumnWarned = true;
            log(
              "何佳“物资状态查询”未包含合同签订日期列，本次不同步该字段，其余字段照常同步",
              "warn",
            );
          }
          const items = [];
          for (const traceNo of traceNos) {
            const result = perTrace[traceNo];
            if (!result || !result.count) {
              stats.skipped += 1;
              log(`${orderNo} ${traceNo}：何佳未查询到记录`, "warn");
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
            log(
              config.dryRun
                ? `申购单 ${orderNo}（${traceNos.length} 个追溯号）：演练完成，未写库`
                : `申购单 ${orderNo}（${traceNos.length} 个追溯号）：本单无需回写`,
              config.dryRun ? "success" : "warn",
            );
          } else {
            const applied = await applyOrder(orderNo, items);
            const changed = applied.affected_headers + applied.affected_lines;
            if (changed > 0) {
              stats.updated += items.length;
              log(
                `申购单 ${orderNo}：整单回写 ${items.length}/${traceNos.length} 个追溯号` +
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
            log("报表配置或接口契约异常属系统性问题，已终止本次同步", "error");
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
        advanceCursor(orders);
        status(
          stats.failed ? "完成（有失败）" : "同步完成",
          stats.failed ? "warn" : "success",
        );
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
  // 自动模式执行窗口：仅北京时间 02:00–06:00（UTC+8，无夏令时），与新版脚本一致。
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
    hejiaUsername: ui.hejiaUsername.value.trim(),
    hejiaPassword: ui.hejiaPassword.value,
    apiToken: ui.apiToken.value.trim(),
    projectId: int(ui.project.value, config.projectId, 0, 2147483647),
    intervalMinutes: int(ui.interval.value, 10, 1, 1440),
    batchSize: int(ui.batch.value, 30, 1, 200),
    maxPurchaseOrderNo: ui.maxPurchaseOrderNo.value.trim(),
    dryRun: ui.dryRun.checked,
    autoEnabled: ui.auto.checked,
  });
  const fillForm = () => {
    ui.hejiaUsername.value = config.hejiaUsername;
    ui.hejiaPassword.value = config.hejiaPassword;
    ui.apiToken.value = config.apiToken;
    ui.interval.value = config.intervalMinutes;
    ui.batch.value = config.batchSize;
    ui.maxPurchaseOrderNo.value = config.maxPurchaseOrderNo;
    ui.dryRun.checked = config.dryRun;
    ui.auto.checked = config.autoEnabled;
  };
  const bindAutosave = () => {
    const textBindings = [
      [ui.hejiaUsername, "hejiaUsername", (value) => value.trim()],
      [ui.hejiaPassword, "hejiaPassword", (value) => value],
      [ui.apiToken, "apiToken", (value) => value.trim()],
      [ui.maxPurchaseOrderNo, "maxPurchaseOrderNo", (value) => value.trim()],
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
    host.id = "hejia-sync-userscript";
    host.style.cssText = `position:fixed;z-index:2147483647;right:${Number(config.panelRight) || 20}px;bottom:${Number(config.panelBottom) || 20}px`;
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
<style>
:host{all:initial;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;color:#1f2937}*{box-sizing:border-box}.panel{width:380px;overflow:hidden;border:1px solid #cbd5e1;border-radius:8px;background:#fff;box-shadow:0 18px 45px #0f172a38}.head{display:flex;align-items:center;gap:8px;padding:9px 10px 9px 14px;color:#fff;background:#176b5b;cursor:move;user-select:none}.title{flex:1;font-size:14px;font-weight:700}.status{max-width:170px;overflow:hidden;padding:3px 8px;border-radius:4px;background:#ffffff2e;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.status[data-kind=success]{background:#10b98155}.status[data-kind=warn]{background:#f59e0b66}.status[data-kind=error]{background:#ef444466}.mini{width:28px;height:28px;border:0;border-radius:4px;color:#fff;background:#ffffff22;cursor:pointer}.body{padding:12px}:host([data-minimized=true]) .body{display:none}:host([data-minimized=true]) .panel{width:260px}.toolbar{display:flex;align-items:center;gap:9px}.run,.save{height:34px;border-radius:4px;padding:0 14px;font-weight:650;cursor:pointer}.run{border:0;color:#fff;background:#176b5b}.save{border:1px solid #cbd5e1;color:#334155;background:#fff}.switch{display:flex;align-items:center;gap:6px;margin-left:auto;font-size:12px;color:#475569}.switch input,.check input{accent-color:#176b5b}.stats{margin:10px 0;padding:8px 10px;border-radius:4px;color:#475569;background:#f1f5f9;font-size:12px}details{border:1px solid #e2e8f0;border-radius:4px}summary{padding:9px 10px;font-size:12px;font-weight:650;cursor:pointer}.settings{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:0 10px 10px}label{display:grid;gap:4px;color:#64748b;font-size:11px}input[type=text],input[type=number],select{width:100%;height:31px;border:1px solid #cbd5e1;border-radius:4px;padding:0 8px}.full{grid-column:1/-1}.check{display:flex;align-items:center;gap:6px}.hint{grid-column:1/-1;color:#92400e;font-size:11px;line-height:1.5}.logs{height:170px;margin-top:10px;overflow:auto;border-radius:4px;padding:8px;color:#cbd5e1;background:#20242c;font-size:11px;line-height:1.6;white-space:pre-wrap;word-break:break-all}.logs .success{color:#4ade80}.logs .warn{color:#fbbf24}.logs .error{color:#f87171}
</style>
<section class="panel"><header class="head"><div class="title">华友何佳同步（旧系统）</div><div class="status">待机</div><button class="mini" title="最小化">—</button></header><div class="body"><div class="toolbar"><button class="run">同步一次</button><label class="switch"><input class="auto" type="checkbox">自动模式</label></div><div class="stats">项目：未选择 · 申购单 0 · 追溯号命中 0 · 更新 0 · 跳过 0 · 失败 0</div><details><summary>连接与同步设置</summary><div class="settings"><label>何佳账号<input class="hejia-user" type="text"></label><label>何佳密码<input class="hejia-pass" type="text" autocomplete="off"></label><label>接口令牌<input class="api-token" type="text" autocomplete="off" placeholder="管理端 API Token"></label><label class="full">项目<select class="project"></select></label><label>自动间隔<input class="interval" type="number" min="1" max="1440"></label><label>单次申购单数<input class="batch" type="number" min="1" max="200"></label><label class="full">申购单号上限（不含）<input class="max-po-no" type="text" placeholder="如 P05SG0300"></label><div class="hint">本脚本只处理单号小于该上限的旧系统数据，其余交由新版（印尼数据平台）脚本处理。</div><label class="check full"><input class="dry-run" type="checkbox">演练模式</label><button class="save full">保存设置</button></div></details><div class="logs"></div></div></section>`;
    document.documentElement.append(host);
    ui = {
      status: shadow.querySelector(".status"),
      minimize: shadow.querySelector(".mini"),
      run: shadow.querySelector(".run"),
      auto: shadow.querySelector(".auto"),
      stats: shadow.querySelector(".stats"),
      logs: shadow.querySelector(".logs"),
      hejiaUsername: shadow.querySelector(".hejia-user"),
      hejiaPassword: shadow.querySelector(".hejia-pass"),
      apiToken: shadow.querySelector(".api-token"),
      project: shadow.querySelector(".project"),
      interval: shadow.querySelector(".interval"),
      batch: shadow.querySelector(".batch"),
      maxPurchaseOrderNo: shadow.querySelector(".max-po-no"),
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

  GM_registerMenuCommand("华友何佳同步：同步一次", () => run());
  GM_registerMenuCommand("华友何佳同步：切换自动模式", () => {
    saveConfig({ autoEnabled: !config.autoEnabled });
    if (ui) ui.auto.checked = config.autoEnabled;
    if (config.autoEnabled) schedule(1000);
    else clearTimeout(timer);
    log(`自动模式已${config.autoEnabled ? "开启" : "关闭"}`);
  });

  createPanel();
  log(
    `脚本已加载：只同步申购单号 < ${clean(config.maxPurchaseOrderNo) || "（未设上限）"} 的旧系统数据；首次使用请填写何佳密码和接口令牌`,
  );
})();
