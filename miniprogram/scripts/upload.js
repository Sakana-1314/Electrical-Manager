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
  'config/index.example.js',
  'scripts/**/*',
];

/**
 * 上传前用 `ci.packNpm` 构建完整的 TDesign 组件库，不再按页面引用裁剪组件目录：
 * 之前按 `usingComponents` 做依赖闭包时漏掉了组件 JS 里的 import 依赖
 * （`t-picker` 经 `mixins/using-config` 引用 `config-provider/use-config`），
 * 真机上组件加载失败、项目切换弹窗弹不出来。分包把页面挪出主包后，
 * 主包装得下完整组件库，这里不再做任何裁剪。
 */
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

  // 上传前按包量一遍解包体积：微信的 2MB 上限是「主包 / 每个分包各自 ≤ 2048KB」，
  // 分包后总量可以超过 2MB，所以分开校验并指出哪个包、超了多少。
  const sizes = packageSizes(project);
  let oversized = null;
  for (const [name, kb] of sizes) {
    const label = name === 'main' ? '主包' : name;
    console.log(`包体积（${label}）：${kb.toFixed(1)}KB / ${PACKAGE_LIMIT_KB}KB`);
    if (kb > PACKAGE_LIMIT_KB && !oversized) oversized = { name: label, kb };
  }
  if (oversized) {
    throw new Error(
      `${oversized.name} 解包体积 ${oversized.kb.toFixed(1)}KB 超过 ${PACKAGE_LIMIT_KB}KB 上限，` +
        `超出 ${(oversized.kb - PACKAGE_LIMIT_KB).toFixed(1)}KB；请精简页面或图片资源`,
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

/** 单包上限（KB）：微信侧 errcode 80051 的判定口径（主包 / 每个分包各自 ≤ 2MB）。 */
const PACKAGE_LIMIT_KB = 2048;

/** 按包（主包 / 各分包）汇总待打包文件的字节数（与打包器同一份文件清单）。 */
function packageSizes(project) {
  const sizes = new Map([['main', 0]]);
  project._fileSet.forEach((file) => {
    let bytes = 0;
    try {
      bytes = fs.statSync(path.join(projectPath, file)).size;
    } catch (_error) {
      // 清单里的文件在打包前被删掉时忽略，不影响体积判断。
      return;
    }
    // 分包文件都在 packages/<组>/ 下，其余归主包。
    const bucket = file.startsWith('packages/') ? `packages/${file.split('/')[1]}` : 'main';
    sizes.set(bucket, (sizes.get(bucket) || 0) + bytes);
  });
  for (const [name, bytes] of sizes) sizes.set(name, bytes / 1024);
  return sizes;
}

main().catch((error) => {
  console.error('微信小程序代码上传失败：', error);
  process.exit(1);
});
