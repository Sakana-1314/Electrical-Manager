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
 * TDesign 的共享目录：组件裁剪时必须保留（组件 JS 会跨目录引用 common / mixins / locale 等）。
 * 根 `index.js` 还直接导出 ActionSheet / Dialog / Message / Toast，保留它们的目录，
 * 避免编译器解析根入口时找不到被裁剪的组件。
 */
const TD_SHARED_DIRS = new Set([
  'common',
  'mixins',
  'locale',
  'miniprogram_npm',
  'transition',
  'action-sheet',
  'dialog',
  'message',
  'message-item',
]);

/** 递归列出目录下的 JSON 文件（用于收集页面 / 组件声明的 usingComponents）。 */
function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(full);
  }
  return files;
}

/** 页面 / 组件 JSON 里实际引用到的 TDesign 组件名（如 t-button → button）。 */
function collectUsedTDesignComponents() {
  const used = new Set();
  const jsonFiles = [
    ...listJsonFiles(path.join(projectPath, 'pages')),
    ...listJsonFiles(path.join(projectPath, 'components')),
    path.join(projectPath, 'app.json'),
  ];
  for (const file of jsonFiles) {
    if (!fs.existsSync(file)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const value of Object.values(data.usingComponents || {})) {
        if (typeof value === 'string' && value.startsWith('tdesign-miniprogram/')) {
          const name = value.split('/')[1];
          if (name) used.add(name);
        }
      }
    } catch (_error) {
      // 单个 JSON 解析失败不影响其它页面；上传前的 check.js 会兜底结构问题。
    }
  }
  return used;
}

function directorySize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += directorySize(full);
    else if (entry.isFile()) total += fs.statSync(full).size;
  }
  return total;
}

/**
 * 裁剪 TDesign 未使用的组件目录。
 *
 * `ci.packNpm` 会把 tdesign-miniprogram 的整包（所有组件）复制进 miniprogram_npm，
 * 而项目实际只引用其中十几个组件；整包约 1.4MB，未使用部分会把主包顶到 2MB 上限。
 * 这里从页面 / 组件的 `usingComponents` 出发做一次依赖闭包，只保留实际用到的组件；
 * `common` / `mixins` / `locale` / `miniprogram_npm` 是组件共享目录，始终保留。
 */
function pruneUnusedTDesignComponents() {
  const tdRoot = path.join(projectPath, 'miniprogram_npm', 'tdesign-miniprogram');
  if (!fs.existsSync(tdRoot)) return;

  const keep = collectUsedTDesignComponents();
  const queue = [...keep];
  while (queue.length) {
    const name = queue.pop();
    const configPath = path.join(tdRoot, name, `${name}.json`);
    if (!fs.existsSync(configPath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      for (const value of Object.values(data.usingComponents || {})) {
        if (typeof value !== 'string') continue;
        let target = '';
        if (value.startsWith('tdesign-miniprogram/')) {
          target = value.split('/')[1];
        } else if (value.startsWith('.')) {
          // 相对路径先规范化：`.././icon/icon` → `../icon/icon`（跨组件，取顶层组件名）；
          // `./draggable/draggable` 是组件自己的子目录，不映射成顶层组件。
          const normalized = path.posix.normalize(value);
          if (normalized.startsWith('../')) target = normalized.split('/')[1];
        }
        if (target && !keep.has(target)) {
          keep.add(target);
          queue.push(target);
        }
      }
    } catch (_error) {
      // 组件配置解析失败时保留它，宁可少裁一点，不能裁掉实际依赖。
      keep.add(name);
    }
  }
  for (const name of TD_SHARED_DIRS) keep.add(name);

  let removed = 0;
  let freed = 0;
  for (const entry of fs.readdirSync(tdRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || keep.has(entry.name)) continue;
    const full = path.join(tdRoot, entry.name);
    freed += directorySize(full);
    fs.rmSync(full, { recursive: true, force: true });
    removed += 1;
  }
  console.log(
    `已裁剪 ${removed} 个未使用的 TDesign 组件（约 ${(freed / 1024).toFixed(1)}KB），` +
      `保留 ${keep.size} 个组件目录`,
  );
}

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
  pruneUnusedTDesignComponents();
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
