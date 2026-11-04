const fs = require('fs');
const path = require('path');
const ci = require('miniprogram-ci');

const projectPath = path.resolve(__dirname, '..');
const appid = process.env.MINIPROGRAM_APPID;
const privateKeyPath = process.env.MINIPROGRAM_PRIVATE_KEY_PATH;
const version = process.env.MINIPROGRAM_VERSION;
const desc = process.env.MINIPROGRAM_DESC || 'GitHub Actions 自动上传';

if (!appid) {
  throw new Error('缺少环境变量 MINIPROGRAM_APPID');
}

if (!privateKeyPath || !fs.existsSync(privateKeyPath)) {
  throw new Error('缺少有效的环境变量 MINIPROGRAM_PRIVATE_KEY_PATH');
}

if (!version) {
  throw new Error('缺少环境变量 MINIPROGRAM_VERSION');
}

/**
 * 不进小程序包的文件。
 *
 * 小程序主包上限 2MB（解包后源码体积），而仓库里的开发文件会被打包器一并收进来：
 * `package-lock.json` 就有 530KB+，`scripts/` 里是校验与上传脚本，README 是给人看的。
 * 这些都不该占小程序体积——实测忽略后从 2365KB 降到 1769KB（原来一直贴着 2MB 上限，
 * 加个筛选组件就越线了）。
 */
const IGNORES = [
  'node_modules/**/*',
  'package-lock.json',
  'package.json',
  'README.md',
  'project.config.json',
  'scripts/**/*',
];

async function main() {
  const project = new ci.Project({
    appid,
    type: 'miniProgram',
    projectPath,
    privateKeyPath,
    ignores: IGNORES,
  });

  console.log('正在构建小程序 npm 依赖...');
  await ci.packNpm(project, { ignores: [] });
  project.updateFileAndDirs();

  // 上传前先量一遍解包体积：超过 2MB 时微信侧会直接报 80051，
  // 在 CI 里提前失败并指出超了多少，比等上传接口返回更清楚。
  const sizeKb = packageSizeKb(project);
  console.log(`小程序包体积：${sizeKb.toFixed(1)}KB（上限 2048KB）`);
  if (sizeKb > PACKAGE_LIMIT_KB) {
    throw new Error(
      `小程序包体积 ${sizeKb.toFixed(1)}KB 超过 ${PACKAGE_LIMIT_KB}KB 上限，` +
        `超出 ${(sizeKb - PACKAGE_LIMIT_KB).toFixed(1)}KB；请精简页面或图片资源`,
    );
  }

  console.log(`正在上传微信小程序，版本号：${version}`);
  console.log(`上传备注：${desc}`);
  await ci.upload({
    project,
    version,
    desc,
    robot: 1,
    onProgressUpdate: console.log,
  });

  console.log('微信小程序代码上传完成。');
}

/** 小程序主包上限（KB）：微信侧 errcode 80051 的判定口径。 */
const PACKAGE_LIMIT_KB = 2048;

/** 汇总待打包文件的字节数（与打包器同一份文件清单）。 */
function packageSizeKb(project) {
  let total = 0;
  project._fileSet.forEach((file) => {
    try {
      const info = fs.statSync(path.join(projectPath, file));
      if (info.isFile()) total += info.size;
    } catch (_error) {
      // 清单里的文件在打包前被删掉时忽略，不影响体积判断。
    }
  });
  return total / 1024;
}

main().catch((error) => {
  console.error('微信小程序代码上传失败：', error);
  process.exit(1);
});
