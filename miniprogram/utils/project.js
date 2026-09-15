const { request } = require('./request');

/**
 * 当前项目（项目隔离）。
 *
 * - 业务数据全部按项目隔离，小程序始终处在某一个项目内；当前项目 id 存本机 storage，
 *   与外观档位同一语义（换设备各自独立，不落库、不产生额外请求）。
 * - 每个业务请求都带 `X-Project-Id` 头（见 utils/request.js）；缺头时后端落到默认项目（P05），
 *   所以老版本客户端与网络异常都还能继续用。
 * - 项目列表一次会话只拉一次；拉取失败不阻塞业务（后端有默认项目兜底）。
 *
 * 与 request.js 的循环依赖：request.js 只在函数内部 `require('./project')`，
 * 这里顶层 require request 不会形成模块加载环（CommonJS 按调用时机求值）。
 */

/** 当前项目 id（值为主键整数）。 */
const CURRENT_PROJECT_STORAGE_KEY = 'currentProjectId';
/** 当前项目对象缓存（`{id, code, name, label}`）：网络不可用时弹窗仍能显示当前项目。 */
const CURRENT_PROJECT_CACHE_KEY = 'currentProjectCache';
/**
 * 「已切换项目」提示标记（一次性）：切换会整页重启，页面里的 toast 活不到新页面，
 * 所以在重启前落标记，由首页读取并提示一次。
 */
const PROJECT_SWITCH_NOTICE_KEY = 'projectSwitchedNotice';

/** 最近一次成功拉取的可选项目（仅启用项，后端按 code 升序返回）。 */
let projectList = [];
/** 项目列表请求（并发只发一次）；失败后置空，下次再试。 */
let projectsPromise = null;

function hasWx() {
  return typeof wx !== 'undefined' && wx;
}

function readStorage(key) {
  if (!hasWx() || typeof wx.getStorageSync !== 'function') return '';
  try {
    return wx.getStorageSync(key);
  } catch (_error) {
    return '';
  }
}

function writeStorage(key, value) {
  if (!hasWx() || typeof wx.setStorageSync !== 'function') return;
  try {
    wx.setStorageSync(key, value);
  } catch (_error) {
    // 存储不可用（配额满 / 受限）：忽略写入失败，仅影响下次启动的记忆。
  }
}

function removeStorage(key) {
  if (!hasWx() || typeof wx.removeStorageSync !== 'function') return;
  try {
    wx.removeStorageSync(key);
  } catch (_error) {
    // 同上：删除失败不影响本次会话。
  }
}

/** 是否是可选中项目：停用的项目不展示、不能被选中。 */
function isEnabledProject(project) {
  return !!project && Number(project.id) > 0 && project.enabled === true;
}

/** 项目对象裁剪成展示与缓存需要的字段（`label` 即弹窗显示的文字：只用名称，不外显编码）。 */
function projectSummary(project) {
  return {
    id: project.id,
    code: project.code,
    name: project.name,
    label: project.name || project.code,
  };
}

/** 当前项目 id；未选择或存储值非法时返回 null。 */
function getCurrentProjectId() {
  const value = Number(readStorage(CURRENT_PROJECT_STORAGE_KEY));
  return Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * 写入当前项目 id，并清掉项目对象缓存（该缓存是「当前项目」的快照，换项目后必须失效）。
 * 返回写入的 id；id 非法时返回 null 且不改动存储。
 */
function setCurrentProjectId(id) {
  const value = Number(id);
  if (!Number.isInteger(value) || value <= 0) return null;
  writeStorage(CURRENT_PROJECT_STORAGE_KEY, value);
  removeStorage(CURRENT_PROJECT_CACHE_KEY);
  return value;
}

/** 清空当前项目（id 与对象缓存）：项目被停用 / 删除后重新解析前调用。 */
function clearCurrentProject() {
  removeStorage(CURRENT_PROJECT_STORAGE_KEY);
  removeStorage(CURRENT_PROJECT_CACHE_KEY);
}

/** 项目列表（含停用项，不过滤）；接口失败时原样抛给调用方。 */
function getProjects() {
  return request({ url: '/mini-program/projects' });
}

/** 拉取项目列表并缓存；`force` 为 true 时忽略内存缓存（项目失效后重新解析用）。 */
function loadProjects(force) {
  if (!force && projectsPromise) return projectsPromise;
  projectsPromise = getProjects()
    .then((projects) => {
      // 过滤掉停用项并裁剪成展示用的 summary，页面直接取 label 显示（只显示名称）
      projectList = Array.isArray(projects)
        ? projects.filter(isEnabledProject).map(projectSummary)
        : [];
      return projectList;
    })
    .catch((error) => {
      // 失败不缓存：下次进首页或收到项目错误码时再试。
      projectsPromise = null;
      throw error;
    });
  return projectsPromise;
}

/** 可选项目（仅启用项，按 code 升序）；尚未成功拉取过时为空数组。 */
function getEnabledProjects() {
  return projectList;
}

/** 当前项目对象（弹窗展示用）：优先取已加载的列表，其次取本机缓存；都没有时返回 null。 */
function getCurrentProject() {
  const id = getCurrentProjectId();
  if (!id) return null;
  const matched = projectList.find((project) => project.id === id);
  if (matched) return projectSummary(matched);
  const cached = readStorage(CURRENT_PROJECT_CACHE_KEY);
  return cached && cached.id === id ? cached : null;
}

/**
 * 保证有一个可用的当前项目：
 * 1. 项目列表只拉一次（`force` 时重拉）；
 * 2. 存储里的 id 已是启用项目 → 直接沿用；
 * 3. 否则落到默认项目（`is_default`），没有默认项时取第一个启用项目，并写入存储。
 *
 * 任何异常都被吞掉：网络失败不该卡住小程序（此时请求不带 `X-Project-Id`，后端会落到默认项目
 * P05）。返回解析出的项目 id，解析不出来时返回 null。
 */
async function ensureProject(options = {}) {
  const currentId = getCurrentProjectId();
  try {
    const projects = await loadProjects(options.force === true);
    if (!projects.length) {
      // 一个可用项目都没有：清掉失效的 id，业务请求仍由后端兜底。
      if (currentId) clearCurrentProject();
      return null;
    }
    const matched = currentId ? projects.find((project) => project.id === currentId) : null;
    if (matched) {
      writeStorage(CURRENT_PROJECT_CACHE_KEY, projectSummary(matched));
      return matched.id;
    }
    const fallback = projects.find((project) => project.is_default) || projects[0];
    setCurrentProjectId(fallback.id);
    writeStorage(CURRENT_PROJECT_CACHE_KEY, projectSummary(fallback));
    return fallback.id;
  } catch (_error) {
    return null;
  }
}

/**
 * 切换当前项目：先持久化，再整页重启回首页。
 *
 * 整页重启与网页端切换项目后整页刷新的语义一致：列表 / 详情等页面都可能缓存了上一个项目的
 * 数据，重启最稳妥。重启前落一个一次性提示标记，由首页提示「已切换项目」。
 * id 非法时不切换也不重启，返回 null。
 */
function switchProject(id) {
  const value = setCurrentProjectId(id);
  if (!value) return null;
  writeStorage(PROJECT_SWITCH_NOTICE_KEY, 1);
  if (hasWx() && typeof wx.reLaunch === 'function') {
    wx.reLaunch({ url: '/pages/home/home' });
  }
  return value;
}

/** 取出并清除「已切换项目」提示标记：返回 true 表示本次要提示（只提示一次）。 */
function takeProjectSwitchNotice() {
  if (!readStorage(PROJECT_SWITCH_NOTICE_KEY)) return false;
  removeStorage(PROJECT_SWITCH_NOTICE_KEY);
  return true;
}

module.exports = {
  CURRENT_PROJECT_CACHE_KEY,
  CURRENT_PROJECT_STORAGE_KEY,
  PROJECT_SWITCH_NOTICE_KEY,
  clearCurrentProject,
  ensureProject,
  getCurrentProject,
  getCurrentProjectId,
  getEnabledProjects,
  getProjects,
  setCurrentProjectId,
  switchProject,
  takeProjectSwitchNotice,
};
