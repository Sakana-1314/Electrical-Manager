const { apiBaseUrl } = require('../config/index');
const { getLocale, t } = require('./i18n');
const { buildRedirectQuery, getCurrentPageUrl } = require('./navigation');

const errorMessageKeys = {
  ACCOUNT_DISABLED: 'accountDisabled',
  FORBIDDEN: 'forbidden',
  INVALID_TOKEN: 'invalidToken',
  MINI_PROGRAM_REGISTRATION_DISABLED: 'registrationClosed',
  UNAUTHORIZED: 'loginRequired',
  USER_DISABLED: 'invalidToken',
};

// 模块级单例：并发的 401 只触发一次静默重登。
let refreshPromise = null;

// 弱网策略，与 Web 端 `web/src/api/retry.ts` 同一套参数：
// 单次 30s（小程序默认 60s 一次等太久）、最多 3 次尝试、指数退避 + 抖动，最坏约 92s。
const REQUEST_TIMEOUT_MS = 30000;
/** 图片上传包体大又不自动重放，单次给足时间（微信默认 60s）。 */
const UPLOAD_TIMEOUT_MS = 120000;
const MAX_ATTEMPTS = 3;
/** 无副作用、可安全重放的方法。 */
const IDEMPOTENT_METHODS = ['GET', 'HEAD', 'OPTIONS'];
/** 服务端尚未受理的失败：连接超时 / 限流 / 网关与上游抖动。 */
const RETRYABLE_STATUS = [408, 429, 500, 502, 503, 504];
const BASE_DELAY_MS = 600;
const DELAY_FACTOR = 3;
const MAX_DELAY_MS = 6000;
const JITTER_RATIO = 0.3;

/** 可重放 = 方法无副作用或业务显式声明幂等（`retry: true`），且未被显式关闭。 */
function isReplayable(options, method) {
  if (options.retry === false) return false;
  return options.retry === true || IDEMPOTENT_METHODS.indexOf(method) >= 0;
}

/** 第 n 次尝试失败后的等待时长（n 从 1 起）：退避 + 抖动，避免并发请求同时复活又打满弱网。 */
function retryDelayMs(attempt) {
  const backoff = Math.min(BASE_DELAY_MS * Math.pow(DELAY_FACTOR, attempt - 1), MAX_DELAY_MS);
  return Math.round(backoff * (1 + Math.random() * JITTER_RATIO));
}

function clearAuthStorage() {
  wx.removeStorageSync('miniProgramAccessToken');
  wx.removeStorageSync('miniProgramRegistrationToken');
  wx.removeStorageSync('miniProgramUser');
}

/**
 * 给请求头带上当前项目（业务数据按项目隔离）。
 *
 * 与 token 一样每次尝试都重新读取：项目重新解析后重试才能带上新项目；缺头时后端会落到
 * 默认项目（P05）。调用方显式传了同名头时以调用方为准。
 * 懒加载 project.js 以打破 request.js <-> project.js 的顶层循环依赖（CommonJS 按调用时机求值）。
 */
function withProjectHeader(headers) {
  const { getCurrentProjectId } = require('./project');
  const projectId = getCurrentProjectId();
  if (projectId && !headers['X-Project-Id']) {
    headers['X-Project-Id'] = projectId;
  }
  return headers;
}

/**
 * 静默重登（并发只触发一次）。request 与 uploadImage 共用同一段重登逻辑。
 * 懒加载 auth.js 以打破 auth.js <-> request.js 顶层循环依赖（CommonJS 按调用时机求值）。
 */
function refreshSessionAndRetry() {
  if (!refreshPromise) {
    const { loginSilently } = require('./auth');
    refreshPromise = loginSilently()
      .then((session) => {
        refreshPromise = null;
        // 静默重登后发现账号未绑定：跳绑定页，绑定后回跳原页面。
        if (session && session.requires_profile) {
          const currentPageUrl = getCurrentPageUrl();
          const redirect = currentPageUrl ? buildRedirectQuery(currentPageUrl) : '';
          wx.reLaunch({
            url: redirect ? `/pages/bind/bind?redirect=${redirect}` : '/pages/bind/bind',
          });
        }
        return session;
      })
      .catch((error) => {
        refreshPromise = null;
        if (
          error.code === 'ACCOUNT_DISABLED' ||
          error.code === 'MINI_PROGRAM_REGISTRATION_DISABLED'
        ) {
          clearAuthStorage();
          wx.reLaunch({
            url:
              error.code === 'ACCOUNT_DISABLED'
                ? '/pages/disabled/disabled'
                : '/pages/registration-closed/registration-closed',
          });
        }
        throw error;
      });
  }
  return refreshPromise;
}

// 模块级单例：并发的 PROJECT_DISABLED / PROJECT_NOT_FOUND 只重新解析一次项目。
let projectRecoveryPromise = null;

/**
 * 项目恢复（并发只触发一次）：清掉失效的当前项目，重新拉项目列表并落到可用项目
 * （通常是默认项目 P05）。与静默重登共用「单次重试」的思路，两者标志位独立
 * （`_retried` / `_projectRetried`），不会互相触发成环。
 *
 * ensureProject 自身吞掉异常，正常不会失败；这里仍兜底重置单例，避免一次意外把后续恢复永久卡住。
 */
function recoverCurrentProject() {
  if (projectRecoveryPromise) return projectRecoveryPromise;
  const { clearCurrentProject, ensureProject } = require('./project');
  clearCurrentProject();
  projectRecoveryPromise = ensureProject({ force: true })
    .then((projectId) => {
      projectRecoveryPromise = null;
      return projectId;
    })
    .catch((error) => {
      projectRecoveryPromise = null;
      throw error;
    });
  return projectRecoveryPromise;
}

function request(options) {
  // 可恢复的鉴权失败仅发生在：需要鉴权且未显式传入 token。
  // auth:false（登录/设置接口）与显式 options.token（绑定页注册 token）不参与重登重试。
  const canRetry = options.auth !== false && !options.token;
  const method = (options.method || 'GET').toUpperCase();

  return new Promise((resolve, reject) => {
    /** 还有额度就退避后重发一次；返回 false 表示这次失败该抛给调用方了。 */
    function retryIfPossible(response) {
      const attemptsMade = options._attempt || 0;
      if (attemptsMade + 1 >= MAX_ATTEMPTS) return false;
      if (!isReplayable(options, method)) return false;
      // 有响应时只看状态码；没有响应（fail 回调）即连接层失败，值得换条连接再试。
      if (response && RETRYABLE_STATUS.indexOf(response.statusCode) < 0) return false;
      options._attempt = attemptsMade + 1;
      setTimeout(doRequest, retryDelayMs(options._attempt));
      return true;
    }

    function doRequest() {
      // 每次重试都重新读取 token，重登后自动带上新 token。
      const token = options.token || wx.getStorageSync('miniProgramAccessToken');
      const headers = withProjectHeader({
        'content-type': 'application/json',
        'Accept-Language': getLocale(),
        ...(options.header || {}),
      });
      if (token && options.auth !== false) {
        headers.Authorization = `Bearer ${token}`;
      }

      wx.request({
        url: `${apiBaseUrl}${options.url}`,
        method: options.method || 'GET',
        data: options.data,
        header: headers,
        timeout: REQUEST_TIMEOUT_MS,
        success(response) {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(response.data);
            return;
          }

          const code = response.data?.code;

          // 账号禁用 / 注册关闭：全局处理，清空凭证并跳转。
          if (code === 'ACCOUNT_DISABLED') {
            clearAuthStorage();
            wx.reLaunch({ url: '/pages/disabled/disabled' });
          } else if (code === 'MINI_PROGRAM_REGISTRATION_DISABLED') {
            clearAuthStorage();
            wx.reLaunch({ url: '/pages/registration-closed/registration-closed' });
          }

          // 静默重登 + 单次重试：token 缺失或过期（UNAUTHORIZED / INVALID_TOKEN）。
          if (
            response.statusCode === 401 &&
            canRetry &&
            !options._retried &&
            (code === 'UNAUTHORIZED' || code === 'INVALID_TOKEN')
          ) {
            options._retried = true;
            refreshSessionAndRetry()
              .then((session) => {
                // 重登发现未绑定：已跳绑定页，不再重试，避免弹「请先登录」干扰跳转。
                if (session && session.requires_profile) {
                  const error = new Error(t('loginRequired'));
                  error.code = 'UNAUTHORIZED';
                  error.statusCode = 401;
                  reject(error);
                  return;
                }
                doRequest();
              })
              .catch(reject);
            return;
          }

          // 不可恢复的 401（重试后仍失败等）：仅丢弃已失效的 access token，不循环。
          if (response.statusCode === 401 && canRetry) {
            wx.removeStorageSync('miniProgramAccessToken');
          }

          // 项目被停用 / 已删除：清掉本地项目、重新解析一次后重发（后端缺头时会落默认项目）。
          if (
            (code === 'PROJECT_DISABLED' || code === 'PROJECT_NOT_FOUND') &&
            !options._projectRetried
          ) {
            options._projectRetried = true;
            recoverCurrentProject()
              .then(() => doRequest())
              .catch(reject);
            return;
          }

          // 服务端尚未受理：可重放的请求换个时机重发，不必让用户手点重试。
          if (retryIfPossible(response)) return;

          const messageKey = errorMessageKeys[code];
          const error = new Error(
            messageKey ? t(messageKey) : response.data?.message || t('requestFailed'),
          );
          error.code = code;
          error.statusCode = response.statusCode;
          reject(error);
        },
        fail(error) {
          // 断网 / 超时 / 连接被重置：换条连接再试，成功概率比直接报错高得多。
          if (retryIfPossible()) return;
          reject(new Error(error.errMsg || t('networkFailed')));
        },
      });
    }

    doRequest();
  });
}

/**
 * 上传图片（multipart）到小程序专用上传接口，返回图片对象。
 *
 * wx.uploadFile 的响应体是字符串，这里统一解析成对象；错误处理与 request 一致
 * （401 静默重登后重试一次，其余按错误码映射成本地化提示）。
 *
 * 包体大 + 弱网慢，且上传不做自动重放（重发会重复建附件），因此单次给足时间，
 * 与网页端导入类请求的 120s 口径一致；`retry` 对上传无效。
 */
function uploadImage(filePath, options = {}) {
  const url = options.url || '/mini-program/hazards/images';

  return new Promise((resolve, reject) => {
    function doUpload() {
      const token = wx.getStorageSync('miniProgramAccessToken');
      const header = withProjectHeader({ 'Accept-Language': getLocale() });
      if (token) {
        header.Authorization = `Bearer ${token}`;
      }
      wx.uploadFile({
        url: `${apiBaseUrl}${url}`,
        filePath,
        name: 'file',
        header,
        timeout: UPLOAD_TIMEOUT_MS,
        success(response) {
          let payload = response.data;
          try {
            payload = JSON.parse(response.data);
          } catch (_error) {
            payload = null;
          }
          if (response.statusCode >= 200 && response.statusCode < 300 && payload) {
            resolve(payload);
            return;
          }
          const code = payload && payload.code;
          if (
            response.statusCode === 401 &&
            !options._retried &&
            (code === 'UNAUTHORIZED' || code === 'INVALID_TOKEN')
          ) {
            options._retried = true;
            refreshSessionAndRetry()
              .then((session) => {
                if (session && session.requires_profile) {
                  const error = new Error(t('loginRequired'));
                  error.code = 'UNAUTHORIZED';
                  error.statusCode = 401;
                  reject(error);
                  return;
                }
                doUpload();
              })
              .catch(reject);
            return;
          }

          // 项目被停用 / 已删除：与 request 同一套恢复，重新解析项目后重传一次。
          if (
            (code === 'PROJECT_DISABLED' || code === 'PROJECT_NOT_FOUND') &&
            !options._projectRetried
          ) {
            options._projectRetried = true;
            recoverCurrentProject()
              .then(() => doUpload())
              .catch(reject);
            return;
          }

          const messageKey = errorMessageKeys[code];
          const error = new Error(
            messageKey ? t(messageKey) : (payload && payload.message) || t('uploadFailed'),
          );
          error.code = code;
          error.statusCode = response.statusCode;
          reject(error);
        },
        fail(error) {
          reject(new Error(error.errMsg || t('networkFailed')));
        },
      });
    }

    doUpload();
  });
}

module.exports = {
  request,
  uploadImage,
};
