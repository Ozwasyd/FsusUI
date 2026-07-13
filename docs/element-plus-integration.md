# 与 Element Plus 不同点的接入指南（FsusUI）

本指南只覆盖**本仓库代码与配置可直接证明**的差异点，以及这些差异对接入/联调的影响。不会写“完全兼容”“无需改代码”等无法从仓库自动证明的强保证。

适用人群：

- **业务项目接入/迁移**：从 Element Plus 切换到本仓库 npm 构建产物时的注意事项
- **仓库内开发联调**：在本仓库里用 demo、源码 alias、源码态样式进行开发与调试

相关入口：

- 主文档：`docs/project-overview.md`

## A. 面向业务项目：从 Element Plus 接入/迁移到 FsusUI

### A1. 环境与兼容性边界（必须先确认）

- 本仓库构建目标为 `es2022`（见 `vue/internal/build/src/build-info.ts`），意味着你的运行环境至少需要具备 ES2022 支持能力。
- 若你的目标浏览器/运行环境低于 ES2022（例如需要兼容更老浏览器），需要在业务侧自行做更强的转译与 polyfill 策略；本仓库不承诺提供向下兼容输出。
- 根 `package.json` 对开发环境要求：`node >= 22`、`pnpm >= 10`（用于构建与仓库内联调，不等同于业务运行时要求）。

### A2. 安装与入口（发布名 vs 源码名）

当前对外 npm public registry 主包为 `@ozwasyd/element-plus`。仓库内部源码主入口仍位于 `vue/packages/element-plus`，源码包名保持 `element-plus`，两者不要混用。

- 业务项目整包安装入口：`@ozwasyd/element-plus`
- 全局类型入口：`@ozwasyd/element-plus/global`
- 语言包子路径：`@ozwasyd/element-plus/es/locale/lang/*`
- 业务项目通常不需要单独安装 theme / wasm 工作区包，优先直接消费主包工件

### A3. 样式引入建议（业务侧）

业务侧优先按“发布产物”方式引入样式（而不是照搬仓库联调用的源码态 SCSS）：

- 推荐：`@ozwasyd/element-plus/dist/fsus.css`（主包内唯一完整的 FsusUI 发布样式入口）

不推荐在业务项目中直接引入：

- `@ozwasyd/element-plus/theme-chalk/src/fsus.scss`

原因：这是仓库联调友好的源码态入口，业务侧是否具备一致的 SCSS 构建、变量/路径解析与副作用配置不确定。

### A3.1. 暗色模式接入（业务侧）

FsusUI 当前主题包已经内置明暗 token 和 `prefers-color-scheme` 自适应，所以：

- 只要引入主题 CSS，就已经具备“跟随系统”的基础能力
- 如果业务侧要持久化用户主题选择，建议在安装时显式传入 `themeMode`

```ts
app.use(ElementPlus, {
  themeMode: 'system',
})
```

或在根部使用：

```vue
<el-config-provider :theme-mode="themeMode">
  <App />
</el-config-provider>
```

接入侧需要了解的真实行为：

- `themeMode: 'dark'` 会写入 `html.dark`
- `themeMode: 'light'` 会写入 `html.light`
- `themeMode: 'system'` 不强制写 class，而是保留系统媒体查询切换，并同步 `data-theme-resolved`

如果你要写“仅暗色态”自定义 CSS，推荐命中：

```css
html.dark,
html[data-theme-resolved='dark'] {
  /* your overrides */
}
```

这样既兼容显式 dark，也兼容 system 模式下解析出的暗色态。

### A4. WASM 注意事项（业务侧）

`@element-plus/wasm` 是“可选性能层”，仓库代码中已有两处组件侧接入点：

- `vue/packages/components/table/src/composables/use-wasm-sort.ts`
  - 当行数 `>= 5000` 且列值满足条件时尝试走 WASM 排序，否则降级到 JS
- `vue/packages/components/virtual-list/src/hooks/use-wasm-row-height.ts`
  - 当 items `>= 2000` 时尝试走 WASM 批量预估，否则返回 `null` 由调用方降级

业务接入时的现实约束：

- WASM 构建产物位于 `vue/packages/wasm/dist/`，并通过 `@element-plus/wasm` 对外导出；你需要确保你的打包器/部署链路能正确处理 `.wasm` 资源与其加载方式。
- 不要假设“零配置必然可用”：是否需要额外的静态资源拷贝、跨域/COOP/COEP 配置、或 bundler 的 wasm 插件支持，取决于你的构建与部署环境。

### A5. 与 Element Plus 的“可见差异清单”（只列可证实项）

这些差异点大多**不影响**你在业务侧以“发布包”方式使用组件 API，但会影响仓库内联调与构建策略：

- **额外能力**：`vue/packages/element-plus/index.ts` 额外转导出 `dayjs`（`export { default as dayjs } from 'dayjs'`）。
- **图标源码归属**：`@element-plus/icons-svg` 在本仓库内作为原始 SVG 真源维护，`@element-plus/icons-vue` 由其生成并供组件代码直接引用；当前目标是源码内收与联调一致，不代表视觉体系已分叉。
- **可选性能层**：新增 `@element-plus/wasm`，并在仓库 demo 构建中被拆到独立 chunk（`fsus-wasm`）。

## B. 面向仓库开发者：本地联调与贡献

### B1. demo 启动与端口

```bash
pnpm install
pnpm -C vue/packages/demo-app dev
```

- dev server：`5173`（见 `vue/packages/demo-app/vite.config.ts`）
- preview：`4173`

### B2. 源码联调（Vite alias / 排除预构建）

`vue/packages/demo-app/vite.config.ts` 通过 alias 将依赖指向工作区源码：

- `element-plus` -> `vue/packages/element-plus/index.ts`
- `@element-plus/components` / `constants` / `directives` / `hooks` / `locale` / `utils` / `wasm` -> 对应 `vue/packages/*`

同时 `optimizeDeps.exclude` 排除这些包，目的是让它们保持源码态联调，而不是被 Vite 当作普通三方依赖进行预构建。

### B3. 样式联调（仅仓库内）

demo 入口 `vue/packages/demo-app/src/main.ts` 使用源码态样式入口：

- `@element-plus/theme-chalk/src/fsus.scss`

这对仓库内开发是便利的，但不代表业务项目应该照搬。

### B4. WASM 构建与调试

WASM 构建脚本为 `vue/packages/wasm/build.sh`，仓库根命令为：

```bash
pnpm build:wasm
```

- 构建依赖 Emscripten 工具链（`emsdk`）已安装并激活；脚本会在必要时尝试从环境中定位/激活。
- demo 构建会把 WASM 相关模块拆分为 `fsus-wasm` chunk（见 `vue/packages/demo-app/vite.config.ts`）。
