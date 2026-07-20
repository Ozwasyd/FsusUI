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
- `build:demo`：`vue/packages/demo-app` 生产构建成功
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
- `verify:release`：`verify`、`check:npm-dist-tag`、`build:npm-package` 和 `test:consumer-install` 一并通过

## WASM

本仓库的 WASM 包位于 `vue/packages/wasm`，当前构建会生成：

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

## Motion 系统收口状态

Motion 系统的上游实现已经收口在 FsusUI：

- 专用模块位于 [`vue/packages/motion`](../vue/packages/motion)，提供 `FsuTransition`、`v-motion`、`v-scroll-reveal`、tokens、presets、runtime、GSAP context、timeline、ScrollTrigger wrapper 和 route cleanup。
- `ElConfigProvider.motion` 位于 [`vue/packages/components/config-provider/src/motion.ts`](../vue/packages/components/config-provider/src/motion.ts)，统一写入 `system / enabled / reduced / disabled` 状态、motion preset 和 CSS token。
- 组件级 `motion` prop 约定位于 [`vue/packages/components/motion.ts`](../vue/packages/components/motion.ts)，已接入 Button、Card、Dialog、Drawer、Dropdown、Tooltip、Message、Notification、Collapse 和 Tabs。
- GSAP 不作为业务侧直接依赖暴露；调用端通过 `useGsapContext`、`useTimeline`、`useScrollReveal`、`useMotionRouteCleanup` 和 `refreshScrollTriggers()` 完成生命周期清理与动态内容刷新。
- 使用说明、preset gallery、低动效策略、性能规则、反模式和 FsusBlog 集成示例统一维护在 [`docs/components/motion.md`](./components/motion.md)。

FsusBlog 侧的消费规则：页面只消费 FsusUI 导出的 component / directive / composable / preset，不在业务页面重复编写本地动画系统，不直接导入 `gsap` 或 `ScrollTrigger`；路由切换和动态 Markdown / 图片内容必须走 FsusUI 的 cleanup 与 refresh API。

## 3. 质量门分工

### 本地入口

- `verify:pr-fast` 是 PR 默认快速门，用于小改动迭代；它覆盖 lint、按变更路径选择的 affected typecheck/unit、token/icon/design governance 和最小包构建 smoke。
- `verify:full` 是完整本地质量门，等价于历史 `verify` 的覆盖面。
- `verify` 保留为 `verify:full` 的安全别名，避免旧命令降低检查覆盖。
- `verify:release` 用于发布前完整核验，在 `verify:full` 基础上增加 npm dist-tag、package build 和 consumer-install。
- `verify:release` 不替代视觉/覆盖率证据；发布前仍需显式执行 `test:coverage` 与 `test:visual`。

### Test artifact cache

- `prepare:test-artifacts` 会按 source hash 检查 icon / WASM 生成工件，再决定是否调用 `ensure:icons` 与 `ensure:wasm`。
- CI 使用 test artifact cache 恢复 `vue/packages/icons-vue/dist` 与 `vue/packages/wasm/dist`，cache key 覆盖相关源码、构建配置和生成脚本。
- GitHub Actions 日志会输出 `icons-cache-hit` 与 `wasm-cache-hit`；本地 wrapper 会继续输出 `cache hit` / `cache miss`、source hash 和 miss reason。
- cache hit 会跳过对应 ensure 脚本；cache miss、restore-key 命中过期工件或 fingerprint 不一致时会重新生成。
- `pnpm run build:wasm` 保留显式 force regeneration 语义；需要强制重建所有测试工件时可使用 `FORCE_REBUILD=1 pnpm run prepare:test-artifacts`。
- `_quality.yml` 的 `unit-artifacts` job 会先生成并上传 `unit-test-artifacts`，unit shard 只下载该工件、解包、执行 `pnpm run check:test-artifacts-ready`，再运行 `pnpm exec vitest run --config vue/vitest.config.ts --shard=<n>/4`。
- 本地复现 unit shard 时，先运行 `pnpm run prepare:test-artifacts`，再运行 `pnpm run check:test-artifacts-ready` 和目标 `vitest run --shard` 命令；不要在每个 shard 前重复生成 icon/WASM 工件。
- `_quality.yml` 的 `build-package` job 会上传 `fsusui-npm-package-dist`，其中包含 `fsusui-npm-package-dist.tgz` 与 `sha256sum` 文件；`consumer-install` 只下载、校验、解包该工件并运行 `build:package-smoke` / `test:consumer-install`，不再重复执行 `build:npm-package`。
- `verify:release` 仍保留 independent rebuild：本地发布验收会重新执行 `build:npm-package`，再运行 consumer install，避免发布路径只依赖 workflow artifact。

### CI 入口

- `.github/workflows/quality.yml` 是统一质量入口
- `.github/workflows/_quality.yml` 是可复用质量门定义
- `publish-npm.yml` 必须依赖质量门通过后再发布

当前 CI job 分工：

- `quality.yml` 在 `pull_request` 默认运行 `verify:pr-fast`
- `quality.yml` 在 `push` 调用 `_quality.yml` 的 `group: main`
- `quality.yml` 在定时任务或手工选择 nightly 时调用 `_quality.yml` 的 `group: nightly`
- `quality.yml` 在手工选择 release 时调用 `_quality.yml` 的 `group: release`

- `lint`
- `typecheck`
- `unit`
- `coverage`
- `build-package`
- `build-demo`
- `visual`

## 4. 常见失败点与排查顺序

建议始终按下面顺序排查，避免同时处理多条链路：

1. `pnpm verify:pr-fast`
2. `pnpm verify:full`
3. `pnpm test:coverage`
4. `pnpm test:visual`
5. `pnpm verify:release`
6. `pnpm run check:npm-dist-tag`
7. `pnpm run build:npm-package`

高频问题与对应位置：

- Vitest 环境噪声：看 [vitest.setup.ts](/data/projects/FsusUI/vitest.setup.ts:1)
- 覆盖率范围或门槛：看 [vue/vitest.config.ts](/data/projects/FsusUI/vue/vitest.config.ts:1)
- 视觉回归失败：先看 [vue/playwright.config.ts](/data/projects/FsusUI/vue/playwright.config.ts:1) 和 [vue/tests/visual/demo-app.spec.ts](/data/projects/FsusUI/vue/tests/visual/demo-app.spec.ts:1)
- demo 夹具问题：看 [vue/packages/demo-app/src/VisualFixtures.vue](/data/projects/FsusUI/vue/packages/demo-app/src/VisualFixtures.vue:1)
- npm package 准备问题：看 `scripts/prepare-npm-package.mjs`
- 根构建类型生成问题：看 `vue/internal/build/src/tasks/types-definitions.ts`

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

- 稳定夹具入口在 [vue/packages/demo-app/src/VisualFixtures.vue](/data/projects/FsusUI/vue/packages/demo-app/src/VisualFixtures.vue:1)
- Playwright 用例入口在 [vue/tests/visual/demo-app.spec.ts](/data/projects/FsusUI/vue/tests/visual/demo-app.spec.ts:1)
- 视觉模式通过 `/?visual=<group>&theme=<light|dark>&compact=<0|1>` 切换，由 [vue/packages/demo-app/src/main.ts](/data/projects/FsusUI/vue/packages/demo-app/src/main.ts:1) 挂载

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
  - `vue/packages/icons-vue/build/**`
  - `vue/playwright.config.ts`
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
pnpm run build:npm-package
pnpm test:consumer-install
```

如果这些步骤都通过，说明当前仓库质量门、视觉基线和发布工件链路都处于可维护状态。

## Typecheck cache policy

## .NET quality lanes

Run `pnpm dotnet:matrix:plan --os linux,windows,macos` to inspect ownership
without attempting cross-OS execution. The three `dotnet-platform` matrix
entries own only restore/build/test/startup smoke and each emit a distinct
platform manifest. `pnpm dotnet:platform:verify` runs that same lane for the
current host.

`pnpm dotnet:package:verify` is the canonical Ubuntu package lane. It deletes
the prior package output, restores/builds once, packs the three public projects,
runs metadata/package/packed-consumer/stable checks, and emits a manifest with
one aggregate candidate SHA-256. CI uploads that candidate separately from
platform results. Icons, tokens, conformance, governance, and a11y remain in
the single `static-quality` job.

The `check:dotnet-matrix` governance guard includes negative fixtures that
reject package or governance commands in the OS matrix and reject missing
platform coverage. The final manifest check also rejects duplicate platforms,
failed tests/smoke, commit mismatches, and candidate digest drift. A developer
needs only the current operating system to run either local verification lane.

PR-fast uses `typecheck:affected`, which selects the affected TypeScript
lanes and runs them through `scripts/run-typecheck.mjs`. The default
`typecheck:*` lanes write `.tsbuildinfo` files under `.tmp/typecheck-cache`;
GitHub Actions restores that typecheck cache with a key that includes
`pnpm-lock.yaml`, `package.json`, `vue/tsconfig*.json`, package sources, typings,
internal TypeScript sources, and `scripts/run-typecheck.mjs`.

Workflow logs print `typecheck-cache-hit`, `cache-hit`, and
`cache-primary-key`. The wrapper also prints `cache hit` / `cache miss`,
the lane name, the `.tsbuildinfo` path, and a source hash prefix. `verify:full`
still runs the full four-lane `typecheck` graph, while
`pnpm run typecheck:no-cache` keeps a diagnostic and release fallback that
bypasses the incremental typecheck cache entirely.

## Path-aware demo build

PR checks call `scripts/should-run-demo-build.mjs` after `verify:pr-fast`.
The script classifies changed files into demo, component/runtime, theme,
public API, and build-config filters. Matching changes run `pnpm run build:demo`;
docs/metadata-only changes skip it. The workflow logs `demo-build-run` and
`demo-build-reason` for handoff/debugging.

Full verification remains unchanged for main, master, workflow-dispatch, and
release paths: `verify:full` and the reusable `build-demo` quality job still
run the complete demo build.

## Short Quality Consolidation

Reusable full quality uses a `static-quality` job for short quality checks with
shared setup/install. The job keeps contract, lint, token, icon, conformance,
and governance as separate named steps so failure output remains easy to map
back to the failing quality area.

## Coverage Sharding

`pnpm test:coverage` now runs through `scripts/run-coverage.mjs`. The measured
baseline on 2026-06-15 was 44.1s wall-clock after the wrapper path (the wrapper
logged 42.4s and Vitest reported 39.79s across 180 test files and 1888 tests),
so coverage sharding stays disabled by default.

The sharding threshold is 180s and is configurable with
`FSUSUI_COVERAGE_SHARD_THRESHOLD_SECONDS`. If a single coverage lane exceeds the
threshold, set `FSUSUI_COVERAGE_SHARDS=<n>` to run sharded coverage. Shards emit
blob reports, then the wrapper calls Vitest `--merge-reports`; reports are
merged before coverage thresholds are evaluated.
