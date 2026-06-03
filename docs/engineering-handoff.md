# FsusUI 工程维护交接

本文面向后续接手仓库维护的工程师，目标是让接手者不依赖聊天记录即可完成本地验收、CI 排查和视觉回归维护。

## 1. 环境基线

- Node.js：`22.x`
- pnpm：`10.33.0`
- TypeScript：`6.0.x`
- 浏览器/视觉回归：Playwright Chromium（桌面亮色、移动端亮色、桌面暗黑、移动端暗黑）
- WASM 构建：需要 Emscripten `5.0.4`

本仓库默认以 `Node 22 + pnpm 10 + 现代浏览器` 作为质量门基线；不要在未验证的旧版本 Node 或 pnpm 上排查 CI 问题。

## 2. 标准命令入口

### 最小本地质量门

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
pnpm build:demo
pnpm verify
```

通过标准：

- `lint`：零 error、零 warning
- `typecheck`：零 TypeScript warning、零 error
- `test:run`：全量 Vitest 通过
- `build`：根构建通过，且类型生成链路无 `TS5103`
- `build:demo`：`packages/demo-app` 生产构建成功
- `verify`：上述主链路按既定顺序串行通过

### 覆盖率与视觉回归

```bash
pnpm test:coverage
pnpm test:visual
pnpm verify:release
```

通过标准：

- `test:coverage`：成功生成 `coverage/`，包含 `lcov`
- `test:visual`：Playwright 多项目截图与 smoke 通过，不重建基线
- `verify:release`：`verify` 和 `build:github-package` 一并通过

## WASM

本仓库的 WASM 包位于 `packages/wasm`，当前构建会生成：

- `ep_wasm.mjs/.wasm`：表格排序、虚拟列表行高等通用加速能力。
- `markdown_basic.js/.wasm`：Markdown raw HTML 渲染器的标量 fallback。
- `markdown_simd.js/.wasm`：Markdown raw HTML 渲染器的 SIMD 版本。

维护 Markdown 渲染器时，优先跑下面的窄门：

```bash
pnpm run build:wasm
pnpm run check:markdown-wasm
pnpm run check:markdown-wasm-runtime
pnpm run check:markdown-no-js-path
pnpm run check:markdown-extreme
```

MarkdownRenderer 组件不携带完整文章排版主题，但会通过 public `markdown-runtime` 自动归一 heading id、hash/external link、CSP nonce、Mermaid/LaTeX 占位符和代码块高亮挂点；业务侧通过 `features-activated` 和 `placeholders-ready` 接入业务 glue。

## 3. 质量门分工

### 本地入口

- `verify` 是本地最小总入口，对齐 CI 的核心门槛
- `verify` 不包含视觉回归；发布前仍需显式执行 `test:visual`
- `verify:release` 用于发布前完整核验

### CI 入口

- `.github/workflows/quality.yml` 是统一质量入口
- `.github/workflows/_quality.yml` 是可复用质量门定义
- `publish-github-package.yml` 必须依赖质量门通过后再发布

当前 CI job 分工：

- `lint`
- `typecheck`
- `unit`
- `coverage`
- `build-package`
- `build-demo`
- `visual`

## 4. 常见失败点与排查顺序

建议始终按下面顺序排查，避免同时处理多条链路：

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test:run`
4. `pnpm build`
5. `pnpm build:demo`
6. `pnpm test:coverage`
7. `pnpm test:visual`
8. `pnpm run build:github-package`

高频问题与对应位置：

- Vitest 环境噪声：看 [vitest.setup.ts](/data/projects/FsusUI/vitest.setup.ts:1)
- 覆盖率范围或门槛：看 [vitest.config.ts](/data/projects/FsusUI/vitest.config.ts:1)
- 视觉回归失败：先看 [playwright.config.ts](/data/projects/FsusUI/playwright.config.ts:1) 和 [tests/visual/demo-app.spec.ts](/data/projects/FsusUI/tests/visual/demo-app.spec.ts:1)
- demo 夹具问题：看 [packages/demo-app/src/VisualFixtures.vue](/data/projects/FsusUI/packages/demo-app/src/VisualFixtures.vue:1)
- GitHub Package 准备问题：看 `scripts/prepare-github-package.mjs`
- 根构建类型生成问题：看 `internal/build/src/tasks/types-definitions.ts`

## 5. Vitest、Coverage、Playwright 的关系

- Vitest 负责单元测试与集成测试，是 `verify` 主链路的一部分
- `test:coverage` 基于 Vitest 全量执行，并输出 `text + lcov`
- Playwright 负责桌面/移动端与亮色/暗黑模式的视觉 smoke 与截图回归，不参与 `verify`
- 视觉基线当前覆盖首批高风险组件的 `forms / data / surfaces` 三组夹具

当前约束：

- 行为断言优先于快照断言
- 若实现修复导致旧快照失真，应更新快照，而不是保留错误行为
- 视觉基线默认复用现有截图，不在常规验收中执行 `--update-snapshots`

## 6. Visual Fixtures 维护规则

- 稳定夹具入口在 [packages/demo-app/src/VisualFixtures.vue](/data/projects/FsusUI/packages/demo-app/src/VisualFixtures.vue:1)
- Playwright 用例入口在 [tests/visual/demo-app.spec.ts](/data/projects/FsusUI/tests/visual/demo-app.spec.ts:1)
- 视觉模式通过 `/?visual=<group>&theme=<light|dark>&compact=<0|1>` 切换，由 [packages/demo-app/src/main.ts](/data/projects/FsusUI/packages/demo-app/src/main.ts:1) 挂载

新增视觉用例时遵守这些规则：

- 优先新增 fixture，不直接在复杂 demo 页面堆断言
- 优先做组件区块截图，不做长页面滚动截图
- 固定 viewport、locale、timezone、color scheme、motion
- 首选复用 Playwright 项目矩阵，不单独复制测试文件
- 需要交互的表面态只覆盖关键路径：打开、hover、focus、disabled、loading、selected、empty

## 7. ESLint 范围治理

- 根目录一次性迁移脚本属于明确排除项，不纳入质量门
- 长期维护脚本仍纳入质量门，包括：
  - `scripts/**`
  - `packages/icons-vue/build/**`
  - `playwright.config.ts`
  - CI 工作流相关长期资产

后续新增脚本时，先判断它是：

- 一次性迁移/本地辅助脚本：加入 ignore
- 长期维护/发布/生成/测试脚本：纳入 lint 范围

## 8. 接手者的标准动作

新接手时，先执行：

```bash
pnpm install
pnpm verify
pnpm test:visual
pnpm run build:github-package
```

如果这三步都通过，说明当前仓库质量门、视觉基线和发布工件链路都处于可维护状态。
