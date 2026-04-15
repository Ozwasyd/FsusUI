# FsusUI 代码事实摘要

本文件基于仓库内的代码、配置和包定义整理，不以现有 Markdown 文档为依据。

## 1. 项目当前形态

- 仓库根目录是一个 `pnpm` monorepo。
- 根 `package.json` 的 `packageManager` 为 `pnpm@10.33.0`，并要求 `node >= 22`、`pnpm >= 10`。
- 工作区由 `pnpm-workspace.yaml` 定义，覆盖 `packages/*` 与 `internal/*`。
- 仓库目录名是 `FsusUI`，但多数包名、源码目录和导出命名仍沿用 `element-plus` 体系。
- 根包是私有包，`package.json` 中 `private: true`。

## 2. 代码中的包结构

`packages/` 下当前有 11 个工作区包：

- `packages/components`
- `packages/constants`
- `packages/demo-app`
- `packages/directives`
- `packages/element-plus`
- `packages/hooks`
- `packages/locale`
- `packages/test-utils`
- `packages/theme-chalk`
- `packages/utils`
- `packages/wasm`

`internal/` 下当前有 5 个内部工具包：

- `internal/build`
- `internal/build-constants`
- `internal/build-utils`
- `internal/eslint-config`
- `internal/metadata`

## 3. 发布入口与安装方式

- 对外主发布包仍是 `packages/element-plus`，包名为 `element-plus`，版本为 `0.0.0-dev.2`。
- `packages/element-plus/index.ts` 同时导出：
  - `@element-plus/components`
  - `@element-plus/constants`
  - `@element-plus/directives`
  - `@element-plus/hooks`
  - `make-installer`
- 默认安装器来自 `packages/element-plus/defaults.ts`，由 `component.ts` 和 `plugin.ts` 两组插件拼装。
- `make-installer.ts` 中的安装逻辑会：
  - 用 `INSTALLED_KEY` 防止重复安装
  - 对传入组件逐个执行 `app.use`
  - 在传入选项时调用 `provideGlobalConfig`

按当前源码统计：

- `packages/element-plus/component.ts` 中注册了 99 个可安装组件/子组件插件项。
- `packages/element-plus/plugin.ts` 中注册了 6 个插件项：
  - `ElInfiniteScroll`
  - `ElLoading`
  - `ElMessage`
  - `ElMessageBox`
  - `ElNotification`
  - `ElPopoverDirective`
- `packages/components/index.ts` 当前聚合导出了 78 个模块入口。

## 4. 组件与样式层

- `packages/components` 下当前有 112 个一级组件目录。
- 样式主题包是 `@element-plus/theme-chalk`。
- `packages/theme-chalk/package.json` 的描述是 `FsusUI default component theme.`。
- `packages/theme-chalk/src` 下维护了组件级 `scss`、公共变量和混入文件。
- 根包 `element-plus` 的 `sideEffects` 明确保留了 `dist/*`、`theme-chalk/**/*.css`、`theme-chalk/src/**/*.scss` 以及组件样式入口。

## 5. Demo 应用

- `packages/demo-app` 是一个独立的 Vite 应用。
- 其脚本包含：
  - `vite --host 0.0.0.0 --port 5173`
  - `vite build`
  - `vite preview --host 0.0.0.0 --port 4173`
- `packages/demo-app/src/main.ts` 通过 `createApp(App).use(ElementPlus).mount('#app')` 挂载整包。
- `packages/demo-app/src/App.vue` 直接从本地工作区入口引入大量组件、服务和类型，用于集中展示组件能力。
- `packages/demo-app/vite.config.ts` 对工作区包做了本地 alias，并为 Element Plus 相关模块、自定义 vendor 包和 WASM 模块设置了分包策略。
- 该 Vite 配置把 `packages/wasm` 或 `@element-plus/wasm` 打到 `fsus-wasm` chunk。

## 6. 测试、类型检查与规范

- 根脚本中存在 `test`、`test:coverage`、`lint`、`lint:fix`、`typecheck`、`build`、`build:theme`、`build:wasm` 等命令。
- `vitest.config.ts` 使用：
  - `@vitejs/plugin-vue`
  - `@vitejs/plugin-vue-jsx`
  - `unplugin-vue-macros/vite`
- 测试环境是 `jsdom`，并启用了 `pretendToBeVisual: true`。
- 覆盖率提供者是 `v8`，排除了 `packages/wasm/**`、测试目录和 `d.ts` 文件。
- 当前仓库 `packages/**/__tests__/**` 下共有 144 个测试文件。
- ESLint 使用 Flat Config，核心依赖包括：
  - `@eslint/js`
  - `typescript-eslint`
  - `eslint-plugin-vue`
  - `eslint-plugin-unicorn`
  - `vue-eslint-parser`

## 7. 国际化

- `packages/locale/lang` 下当前有 58 个语言文件。
- 其中包含 `zh-cn.ts`、`zh-tw.ts`、`en.ts`、`ja.ts`、`ko.ts`、`fr.ts`、`de.ts`、`ru.ts` 等。

## 8. WASM 接入现状

- 仓库中存在独立包 `@element-plus/wasm`。
- `packages/wasm/package.json` 的描述为 `WebAssembly acceleration layer for FsusUI (C++23 / Emscripten)`。
- `packages/wasm/index.ts` 将 WASM 封装成 Promise 单例，并暴露以下能力：
  - 数字排序 `sortNumbers`
  - 字符串排序 `sortStrings`
  - 关键词过滤 `filterIndices`
  - 颜色转换 `hexToHsl` / `hslToHex`
  - 数字精度处理 `roundToPrecision` / `clampAndRound`
  - 行高估算 `estimateRowHeights`
  - 预热与版本读取
- `packages/wasm/src/ep_wasm.cpp` 表明底层实现使用 C++23 与 Emscripten。
- 当前源码中已经看到两个明确的组件侧接入点：
  - `packages/components/table/src/composables/use-wasm-sort.ts`
  - `packages/components/virtual-list/src/hooks/use-wasm-row-height.ts`
- 表格排序在数据量达到 `5000` 行时尝试走 WASM。
- Virtual List 行高预估在数据量达到 `2000` 项时尝试走 WASM。

## 9. 其他可直接确认的事实

- 根 `package.json` 的 `peerDependencies` 要求 `vue ^3.5.0`。
- `packages/demo-app` 依赖 `vue ^3.5.32` 和 `vite ^7.1.7`。
- 项目启用了 `husky`，根脚本里有 `prepare: husky`。
- 根目录存在 `build/`、`dist/` 产物目录，当前工作区 `git status --short` 为空。

## 10. 与常规 Element Plus 使用方式的可见差异

以下差异均以本仓库代码为依据，重点是“在这个仓库里实际怎么引入、怎么构建”。

- 虽然对外包名仍是 `element-plus`，但 demo 并不是从外部安装产物消费它，而是通过 `packages/demo-app/vite.config.ts` 的 `resolve.alias` 直接指向工作区源码：
  - `element-plus -> ../element-plus/index.ts`
  - `@element-plus/components -> ../components`
  - `@element-plus/constants -> ../constants`
  - `@element-plus/directives -> ../directives`
  - `@element-plus/hooks -> ../hooks`
  - `@element-plus/locale -> ../locale`
  - `@element-plus/utils -> ../utils`
  - `@element-plus/wasm -> ../wasm/index.ts`
- `packages/demo-app/src/main.ts` 中的安装方式是 `createApp(App).use(ElementPlus)`，但这里的 `ElementPlus` 实际来自本地相对路径 `../../element-plus`，不是直接从外部包管理器解析出的构建产物。
- 样式引入方式也偏源码态：demo 直接引入 `@element-plus/theme-chalk/src/index.scss`，而不是只消费编译后的 `css` 成品。
- Vite 的 `optimizeDeps.exclude` 显式排除了 `element-plus` 及多个 `@element-plus/*` 工作区包，说明开发态优先保留源码联调，而不是把这些依赖当成普通第三方包预构建。
- 这个仓库额外引入了 `@element-plus/wasm` 包，并在 `demo-app` 构建里单独拆出 `fsus-wasm` chunk；这属于当前代码库的扩展层，不只是单纯的组件库源码镜像。
- `packages/element-plus/index.ts` 额外导出了 `dayjs`，因此当前整包入口除了组件、指令、hooks 和安装器外，还暴露了一个日期库转导出。
- 仓库名与主题描述已经出现 `FsusUI` 命名，但发布包名、目录结构和大多数导出标识仍保留 `element-plus` 命名，这意味着当前项目在“品牌/仓库名”和“运行时包名”之间仍是并存状态。

## 11. 一句话结论

从代码实况看，FsusUI 当前不是一个全新命名体系的独立 UI 库实现，而是一个仍以 `element-plus` 包结构、导出命名和构建体系为主体的 Vue 3 组件库工作区，并在其上加入了 demo、主题调整以及一层已开始落地到表格和虚拟列表的 WASM 加速能力。
