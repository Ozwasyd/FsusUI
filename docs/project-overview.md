# FsusUI 项目文档

本文件以仓库内代码、配置与包定义为依据整理，面向两类读者：

- **开发接手**：快速理解 monorepo 结构、构建链路与本地联调方式
- **使用者接入**：理解对外入口包、样式/I18n/WASM 等子系统的关系与使用方式

仓库首页入口文档见 `README.md`。

补充说明：

- 仓库名与主题描述已体现 `FsusUI`，但多数包名与导出仍沿用 `element-plus` 体系；下文会同时使用两者以保持准确。
- 与 Element Plus 的差异点及接入注意事项请参考：`docs/element-plus-integration.md`。
- 工程维护与质量门交接请参考：`docs/engineering-handoff.md`。
- 发布治理与 Changesets 流程请参考：`docs/release-governance.md`。

## 1. 项目定位（一句话）

FsusUI 是一个基于 Element Plus 包结构维护的 Vue 3 组件库工作区（`pnpm` monorepo），在保持现有入口组织方式的基础上引入 ES2022、TypeScript 6、Node 22、pnpm 10，并新增一层可被组件选择性使用的 WASM 性能增强模块。

## 2. 技术栈与环境要求

**必需环境**

- Node.js：`>= 22`（根 `package.json` `engines.node`）
- pnpm：`>= 10`（根 `package.json` `engines.pnpm`，`packageManager` 为 `pnpm@10.33.0`）

**运行时与工具链（仓库现状）**

- Vue：根 `peerDependencies` 要求 `vue ^3.5.0`
- TypeScript：`^6.0.2`
- 构建：仓库根 `pnpm build` 走 `internal/build` 的 gulp + Rollup 4 + esbuild 0.28 体系
- 构建 target：`es2022`（见 `internal/build/src/build-info.ts`）
- 测试：Vitest（`jsdom` 环境）
- 规范：ESLint 10（Flat Config）+ Prettier 3
- Demo：Vite（`packages/demo-app`，端口 `5173/4173`）

## 3. Monorepo 结构与工作区说明

工作区定义见 `pnpm-workspace.yaml`：

```yaml
packages:
  - packages/*
  - internal/*
```

### packages/\*

- `packages/element-plus`：对外主入口包（包名仍为 `element-plus`），聚合导出组件/指令/hooks/常量，并提供默认安装器。
- `packages/components`：组件源码集合（按组件目录组织）。
- `packages/theme-chalk`：样式主题包（`@element-plus/theme-chalk`），包含 SCSS 源码与构建脚本。
- `packages/locale`：国际化资源（语言包集合）。
- `packages/directives`：指令集合。
- `packages/hooks`：组合式能力集合。
- `packages/utils`：内部工具方法集合（私有）。
- `packages/constants`：常量与共享定义（私有）。
- `packages/test-utils`：测试工具（私有）。
- `packages/wasm`：WASM 性能层（`@element-plus/wasm`），提供排序/过滤/颜色/精度/行高等计算能力。
- `packages/demo-app`：Vite demo 应用，用于本地联调与展示。

### internal/\*

- `internal/build`：构建工具链入口（根 `pnpm build` 调用此包）。
- `internal/eslint-config`：ESLint Flat Config 封装（`@element-plus/eslint-config`）。
- `internal/metadata`：元信息生成工具（组件清单等）。
- `internal/build-utils` / `internal/build-constants`：构建期工具与常量。

## 4. 核心包关系（从入口看）

对外主入口位于 `packages/element-plus/index.ts`：

- 默认导出：`defaults.ts` 组合出的安装器实例（含 `install` 与 `version`）
- 聚合导出：`@element-plus/components` / `@element-plus/constants` / `@element-plus/directives` / `@element-plus/hooks`
- 安装器工具：`./make-installer`
- 额外转导出：`dayjs`（`export { default as dayjs } from 'dayjs'`）

直观理解可以按这条链路：

`element-plus`（主包） -> 默认安装器 -> 组件/插件/指令集合 -> 主题样式（`theme-chalk`）与可选 WASM 层（`@element-plus/wasm`）

## 5. 对外发布入口与安装方式

### 5.1 对外包与导出

`packages/element-plus/package.json` 定义了对外导出形态：

- ESM：`es/index.mjs`（类型定义对应 `es/index.d.ts`）
- CJS：`lib/index.js`（类型定义对应 `lib/index.d.ts`）
- 样式入口字段：`style: dist/index.css`
- sideEffects：显式保留 `dist/*`、`theme-chalk/**/*.css`、`theme-chalk/src/**/*.scss` 以及组件样式入口，避免被 tree-shaking 误删

### 5.2 构建产物与发布脚本

根 `package.json` 里与发布相关的脚本包括：

- `pnpm build`：执行构建工具链（`internal/build`）
- `pnpm build:npm-package`：构建后运行 `scripts/prepare-npm-package.mjs` 组织 npm public registry 发布目录
- `pnpm check:npm-dist-tag`：校验 tag 版本到 npm dist-tag 的推断规则

注意：仓库根包为 `private: true`，实际对外发布以 `packages/element-plus` 的构建产物为主。

## 6. 开发态运行方式与 Demo 应用

### 6.1 启动 demo

```bash
pnpm install
pnpm -C packages/demo-app dev
```

demo 默认端口：

- dev server：`5173`
- preview：`4173`（`pnpm -C packages/demo-app preview`）

### 6.2 demo 的“源码联调”特性

`packages/demo-app/vite.config.ts` 对工作区包做了 alias，开发态直接指向源码而非消费构建产物，例如：

- `element-plus` -> `packages/element-plus/index.ts`
- `@element-plus/*` -> 对应 `packages/*`

同时 `optimizeDeps.exclude` 显式排除了 `element-plus` 及多个 `@element-plus/*` 工作区包，避免被当成三方依赖预构建，从而保持源码联调体验。

demo 入口 `packages/demo-app/src/main.ts` 还直接引入了源码态样式：

- `@element-plus/theme-chalk/src/index.scss`

## 7. 构建、测试、类型检查与规范

### 7.1 常用命令（根目录）

```bash
pnpm build
pnpm test
pnpm test:coverage
pnpm typecheck
pnpm lint
pnpm lint:fix
pnpm format
```

补充命令：

- `pnpm build:theme`：构建 `@element-plus/theme-chalk`
- `pnpm build:wasm`：构建 WASM（见下文）
- `pnpm clean`：清理根 `dist` 以及各包的清理脚本

### 7.2 类型检查拆分

根 `pnpm typecheck` 使用 `vue-tsc` / `tsc` 对不同 tsconfig 分组检查：

- web：`tsconfig.web.json`
- node：`tsconfig.node.json`
- vite 配置：`tsconfig.vite-config.json`
- vitest：`tsconfig.vitest.json`

### 7.3 ESLint

仓库使用 ESLint Flat Config（入口 `eslint.config.mjs`），并提供 `internal/eslint-config` 包封装配置依赖。

## 8. 样式体系（theme-chalk）

样式包为 `@element-plus/theme-chalk`（`packages/theme-chalk`）：

- 既支持源码态 SCSS（如 demo 的 `@element-plus/theme-chalk/src/index.scss`），也可构建产出 CSS（包入口 `index.css`）。
- 构建脚本位于 `packages/theme-chalk/package.json`：`pnpm -C packages/theme-chalk build`（通过 gulp 执行）。

## 9. 国际化（locale）

国际化资源位于 `packages/locale/lang`，包含多语言文件（如 `zh-cn.ts`、`en.ts` 等）。

## 10. WASM 模块与当前接入点

### 10.1 包位置与职责

WASM 包为 `@element-plus/wasm`（`packages/wasm`），描述为 “WebAssembly acceleration layer for FsusUI (C++23 / Emscripten)”。

- 底层实现：`packages/wasm/src/ep_wasm.cpp`（C++23）
- 构建脚本：`packages/wasm/build.sh`（Emscripten）
- TS 封装：`packages/wasm/index.ts`（Promise-based 单例封装，同时提供若干 sync/async API）

构建 WASM：

```bash
pnpm build:wasm
```

说明：WASM 构建依赖 Emscripten 工具链（`emsdk`）；仓库脚本本身不负责安装它。

### 10.2 已落地的组件侧接入

目前代码中有两个明确接入点（均为“满足阈值才启用，不满足则降级”策略）：

- `packages/components/table/src/composables/use-wasm-sort.ts`
  - 表格列排序：行数 `>= 5000` 且列值满足条件（全数字或 ASCII 字符串）时尝试走 WASM
- `packages/components/virtual-list/src/hooks/use-wasm-row-height.ts`
  - 虚拟列表行高预估：items 数量 `>= 2000` 时尝试走 WASM 批量预估

## 11. 与标准 Element Plus 工作方式的可见差异

本仓库与常规 Element Plus 使用方式的可见差异（以及这些差异对“业务接入/仓库联调”的影响）已拆分为独立指南：

- `docs/element-plus-integration.md`

## 12. 维护注意事项

- **命名并存是现状**：仓库名/主题描述出现 `FsusUI`，但对外包与源码组织仍以 `element-plus` 为主；在改造或迁移时，优先以真实导出与构建产物判断影响面。
- **不要把 demo 行为当作“发布使用方式”**：demo 是源码联调入口，很多 alias/排除预构建/源码态样式引入是为了开发体验，并不等价于外部消费者的接入方式。
- **强结论要可证实**：涉及“兼容性/性能提升倍数/行为一致性”等结论，应以本仓库基准测试或实际运行验证为准，避免在文档中写成无条件保证。

## 附录：仓库事实快照（可核验）

本附录用于集中呈现“仓库内可直接核验的事实盘点”。其中的数量统计属于**快照信息**，会随代码变化；如需更新，应以实际仓库内容重新统计为准。

### 工作区与包结构

- 仓库是 `pnpm` monorepo；工作区由 `pnpm-workspace.yaml` 定义，覆盖 `packages/*` 与 `internal/*`。
- `packages/*` 下工作区包（11 个）：
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
- `internal/*` 下内部工具包（5 个）：
  - `internal/build`
  - `internal/build-constants`
  - `internal/build-utils`
  - `internal/eslint-config`
  - `internal/metadata`

### 发布入口与安装器（element-plus）

- 对外主入口包位于 `packages/element-plus`，包名为 `element-plus`，版本为 `0.0.0-dev.2`。
- `packages/element-plus/index.ts` 聚合导出：
  - `@element-plus/components` / `@element-plus/constants` / `@element-plus/directives` / `@element-plus/hooks`
  - `make-installer`
  - 并额外转导出 `dayjs`
- 默认安装器来自 `packages/element-plus/defaults.ts`，由 `component.ts` 与 `plugin.ts` 两组项拼装。
- `packages/element-plus/make-installer.ts` 的安装逻辑包含：
  - 使用 `INSTALLED_KEY` 防止重复安装
  - 对传入组件逐个执行 `app.use`
  - 传入选项时调用 `provideGlobalConfig`

截至当前快照（数量统计）：

- `packages/element-plus/component.ts` 注册了 99 个可安装组件/子组件插件项。
- `packages/element-plus/plugin.ts` 注册了 6 个插件项：
  - `ElInfiniteScroll` / `ElLoading` / `ElMessage` / `ElMessageBox` / `ElNotification` / `ElPopoverDirective`
- `packages/components/index.ts` 聚合导出了 78 个模块入口。

### 组件与样式（theme-chalk）

- `packages/components` 下共有 112 个一级组件目录。
- 样式主题包为 `@element-plus/theme-chalk`（`packages/theme-chalk`）。
- 根包 `packages/element-plus/package.json` 的 `sideEffects` 显式保留：
  - `dist/*`
  - `theme-chalk/**/*.css`
  - `theme-chalk/src/**/*.scss`
  - 以及组件样式入口（`es/components/*/style/*`、`lib/components/*/style/*`）

### Demo（packages/demo-app）

- `packages/demo-app` 是 Vite 应用：
  - dev：`5173`，preview：`4173`
- `packages/demo-app/src/main.ts` 通过 `createApp(App).use(ElementPlus).mount('#app')` 挂载整包，并引入 `@element-plus/theme-chalk/src/index.scss`（源码态联调入口）。
- `packages/demo-app/vite.config.ts`：
  - 通过 alias 直接指向工作区源码
  - 将 `packages/wasm` / `@element-plus/wasm` 拆分到 `fsus-wasm` chunk
  - `optimizeDeps.exclude` 排除 `element-plus` 及多个 `@element-plus/*` 工作区包以保持源码联调

### 测试、类型检查与规范

- 测试：Vitest（`jsdom`），并启用 `pretendToBeVisual: true`（见 `vitest.config.ts`）。
- 覆盖率 provider 为 `v8`，并排除 `packages/wasm/**` 等路径。
- 截至当前快照，`packages/**/__tests__/**` 下共有 144 个测试文件。
- ESLint 使用 Flat Config（入口 `eslint.config.mjs`），核心依赖包括 `typescript-eslint`、`eslint-plugin-vue`、`eslint-plugin-unicorn`、`vue-eslint-parser` 等。

### 国际化（locale）

- 截至当前快照，`packages/locale/lang` 下共有 58 个语言文件。

### WASM（@element-plus/wasm）

- `packages/wasm` 描述为 “WebAssembly acceleration layer for FsusUI (C++23 / Emscripten)”。
- `packages/wasm/index.ts` 将 WASM 封装成 Promise 单例，并提供（示例）能力：
  - 数字/字符串排序、关键词过滤、颜色转换、精度处理、行高预估、预热与版本读取
- 组件侧明确接入点与阈值：
  - 表格排序：`packages/components/table/src/composables/use-wasm-sort.ts`（`>= 5000`）
  - 虚拟列表行高：`packages/components/virtual-list/src/hooks/use-wasm-row-height.ts`（`>= 2000`）
