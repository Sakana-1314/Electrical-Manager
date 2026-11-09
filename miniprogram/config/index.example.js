// 接口域名配置模板。真实域名不进公开仓库（config/index.js 已被 .gitignore 忽略）。
//
// 本地开发：复制本文件为 config/index.js，把 apiBaseUrl 改成实际后端地址；
// CI 上传：.github/workflows/upload-miniprogram.yml 会用 GitHub Secret
// MINIPROGRAM_API_BASE_URL 生成 config/index.js，无需手工提交。
module.exports = {
  apiBaseUrl: 'https://your-api-host.example.com/api/v1',
};
