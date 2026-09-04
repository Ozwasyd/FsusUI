# FsusUI 发布治理交接

> **Role:** Normative release governance and operational workflow
> **Applies to:** Versioning, quality gates, candidate construction, publishing, and rollback decisions

本文定义当前仓库的版本与发布规则，目标是让后续维护者能够独立完成版本变更、包校验、npm 发布和失败回滚判断。

## 1. 当前发布目标

- 主发布目标：npm public registry
- 发布对象：`dist/element-plus` 中准备好的主包工件
- 当前包名：`@ozwasyd/element-plus`
- 发布触发：推送 `vX.Y.Z` 或 `vX.Y.Z-*` tag

Public preview 的 registry 策略、包名策略、dist-tag 策略和 provenance 要求见 [npm Registry Publishing Policy](./policy/npm-registry.md)。旧的包注册表自动发布流程已移入 `docs/archive/github-vue/packages/`，仅作历史参考，不再自动发布，也不作为 npm 发布后的镜像。

常用验证门分为三层：

- `pnpm verify:pr-fast`：PR 默认快速门，覆盖 lint、按变更路径选择的 affected typecheck/unit、token/icon/design governance 和最小包构建 smoke，不包含 demo build、coverage、visual 或发布包安装。
- `pnpm verify:full`：完整本地质量门，等价于历史 `pnpm verify` 行为，包含 `prepare:test-artifacts`、`_verify:parallel` 和 `build:demo`。
- `pnpm verify:stable`：显式本地开发者入口，执行 token/icon、interaction、visual、a11y、performance、conformance、governance 与 .NET 验证。
- `pnpm verify:nightly`：显式本地开发者入口，执行 full、coverage、visual、.NET 与 performance 验证。
- `pnpm verify:release`：显式本地发布候选入口，执行完整检查和唯一 npm candidate/consumer-matrix 链路。

CI 中的 `stable-readiness`、`nightly-readiness`、`release-readiness` 不调用
上述 `verify:*`。它们只聚合当前 workflow run 的结构化 leaf manifests，
校验 SHA、workflow group、run attempt、矩阵完整性、状态和工件 digest 后
生成 evidence；完整契约与本地 fixtures 见 `docs/ci-readiness.md`。

`spec/ci/readiness-gates.json` 同时是 main、nightly、release 的机器可读
profile registry。`pnpm ci:profile:plan --group release` 只打印 gate、执行画像
和 artifact binding；`pnpm ci:profile:check` 静态验证 workflow 与 invalid
fixture，不启动测试、浏览器或网络访问。tag workflow 必须显式传入
`group: release` 与 tag，手工 Release dispatch 调用同一个 profile；release
aggregator 将唯一 npm candidate 的 commit、tag、package version 和 digest
写入 evidence，publish 依赖该 evidence digest 后才可进入 channel lock。

`pnpm verify` 保留为 `verify:full` 的安全别名，避免旧脚本降级覆盖面。

所有并行质量组都通过 `run-p --continue-on-error` 收集完整失败集；单项失败不会
提前终止仍在运行的 typecheck、unit、visual 或 release sibling。命令最终仍以
非零状态退出，因此该策略只改善诊断完整性，不放宽任何 gate。

Rollup 构建只静默已核验的第三方包内部循环：`mlly`、`semver`、
`d3-interpolate`、`d3-selection` 和 `d3-transition`。过滤器会逐个解析循环参与
文件的精确 `node_modules` 包名；只要包含本仓库文件、未知包或其他 warning code，
就继续原样输出。`check:rollup-warning-policy` 防止规则退化成宽泛字符串过滤。

`FsusUI.Avalonia.Tests` 内的控件测试共享 Avalonia 进程级 UI Dispatcher，因此该
测试程序集禁用 test-collection 并行，避免跨线程 `InvokeAsync` 在无消息泵线程上
等待。`dotnet test` 仍会并行执行 Avalonia、Headless 和 Performance 测试程序集；
只有这个无法安全并行的共享 Dispatcher 边界保持串行。

Demo 会加载完整 Markdown/Mermaid 压力样例，因此不再用 Vite 无路径语义的单文件
warning 数字冒充响应性能预算。Demo 将工作区运行时收拢为单一 `fsus-ui` 所有权
边界，第三方运行时仍按包分组；`onlyExplicitManualChunks` 保持关闭，让 Rollup 合并
静态依赖并阻止跨组件循环 chunk。
consumer smoke 根据 manifest 分开计算首屏静态闭包
与 Markdown 冷水合闭包：首屏禁止提前引入 Markdown、WASM、Mermaid、Shiki、KaTeX
或 Cytoscape，并以 `scripts/consumer-performance-baseline.json` 中的实测 raw/gzip/
brotli 结果执行只减不增的棘轮。Consumer fixture 仍使用显式 tree-shaken
chunk ownership；所有非尺寸类
构建 warning 继续原样输出并由现有零 warning gate 拦截。
诊断中可用 `FSUS_CONSUMER_FIXTURE_PATH` 指向一次完整安装后保留的 fixture，断点重跑
运行时导出、类型检查、Vite 构建和性能棘轮；release gate 不设置该变量，始终从冷
安装验证真实消费链路。

GitHub Actions 的 `quality.yml` 将非 PR 路径拆成 main、nightly、release
三个 group：push 进入 `group: main`，定时任务进入 `group: nightly`，手工
workflow dispatch 可选择 main、nightly 或 release。最终发布仍只由发布 workflow
处理，quality release group 只产出发布前证据，不执行 publish。

`prepare:test-artifacts` 会先检查 icon 与 WASM 的 test artifact cache。
GitHub Actions 使用 source-hash key 恢复 `vue/packages/icons-vue/dist` 与
`vue/packages/wasm/dist`；日志中会输出 `icons-cache-hit`、`wasm-cache-hit`，
本地 wrapper 还会输出 `cache hit` / `cache miss` 与 fingerprint source hash。
cache hit 时会跳过对应 `ensure:icons` / `ensure:wasm`；cache miss 或
restore-key 命中旧工件时会重新生成并写入 fingerprint。发布或手工重建仍使用
`pnpm run build:wasm` 或 `FORCE_REBUILD=1 pnpm run prepare:test-artifacts`，
不要把 release regeneration 改成只依赖 cache。

full quality 的 Unit matrix 先由 `capacity` job 按测试文件数、有效 CPU 与有效
内存生成，不再固定为四个 shard。`unit-artifacts` job 统一准备测试工件并上传
`unit-test-artifacts`；各 shard 下载后运行 `pnpm run check:test-artifacts-ready`
和 `pnpm exec vitest run --config vue/vitest.config.ts --shard=<n>/<total>`，同时使用
plan 给出的 `FSUS_VITEST_WORKERS`。这样 shard 与内部 worker 共享同一预算，且
cache miss/generation 日志只集中在前置 job。

仓库级资源计划可通过 `pnpm ci:capacity:plan --dry-run` 查看，通过
`pnpm ci:capacity:check` 运行无浏览器、无网络 fixture。计划取
`FSUS_CI_CPU_LIMIT`、cgroup CPU quota、`availableParallelism()` 与可见 CPU 的
最小值，并对 `FSUS_CI_MEMORY_LIMIT_MB`、cgroup memory limit 和 host memory
执行同样的最小值约束。`FSUS_CI_MAX_PARALLEL_LANES` 可用于诊断性限流，所有
override 都会显示 requested/applied 状态与原因。

`with-node-heap.mjs` 依据同一 plan 为 small、unit、typecheck、build、coverage、
visual 选择不同 heap cap，并保留 OS、文件缓存、Chromium/WASM/esbuild/Sass 与
native memory。`FSUS_NODE_HEAP_PROFILE` 可显式选 profile；
`FSUS_NODE_HEAP_MB` 是诊断 override，但仍会被安全预算封顶并输出人工覆盖日志。

full quality 的 `build-package` 只构建一次，并产出 `fsusui-npm-candidate`
工件：`fsusui-npm-candidate.tgz`、SHA-256 sidecar 和 candidate manifest。
manifest 把 candidate digest 绑定到 commit、package name/version、dist-tag、
canonical package.json、Node/pnpm/npm、lockfile 与 build input fingerprint。
`consumer-install` 先执行 `package:candidate:verify`，再从同一个 tarball 运行
`npm-latest`、`pnpm-latest` 与 `npm-peer-floor` 的真实冷安装、typecheck、SSR、
正式 exports、Vite production build、worker/Wasm/lazy chunk 与 bundle budget 检查。
三个 profile receipt 和 matrix summary 作为 `consumer-matrix` CI artifact 上传，
并必须引用同一个 digest。纯文档 PR 只能凭含完整 changed-path 列表与 digest 的
`no-package-impact:documentation-only` plan 跳过；main、nightly 与 release 没有
base diff 时保守运行。

`verify:release` 使用同样的本地链路：`package:candidate:build` →
`package:candidate:verify` → negative fixtures → consumer matrix，不依赖 Actions artifact
服务或 npm 权限。需要独立可复现性重建时，将 B 输出到另一个目录，再运行
`pnpm package:candidate:compare <A.tgz> <B.tgz>`；比较通过也不会替换已经测试的 A。

发布前必须先通过：

```bash
pnpm verify:release
pnpm test:coverage
pnpm test:visual:evidence
```

## 2. Changesets 流程

仓库已经接入 `.changeset/`，后续版本变更不再依赖手工约定。

标准流程：

1. 功能/修复合入前编写 changeset
2. 使用 `pnpm changeset` 生成变更说明
3. 使用 `pnpm version-packages` 生成版本与 changelog
4. 复跑 `verify:release`
5. 推送匹配版本的 tag，由发布工作流读取最终工件版本并发布 npm package

约束：

- 没有 changeset 的功能性改动，不应直接进入正式发布流
- 版本号和 changelog 以 changesets 生成结果为准，不再手工维护版本叙述

## 3. 发布前检查

发布前按以下顺序检查：

1. `pnpm verify:release`
2. `pnpm test:coverage`
3. `pnpm test:visual:evidence`
4. 检查 `dist/element-plus/package.json`
5. 补充 `npm pack --dry-run` / `pnpm pack --dry-run` 记录，并更新 `docs/releases/evidence/npm-public-preview/`

发布工件检查重点：

- 包名与版本正确
- 不残留 `workspace:` 依赖协议
- `@element-plus/icons-vue` 等工作区依赖已被归一化为可消费 semver
- `publishConfig.access` 为 `public`
- `publishConfig.registry` 指向 `https://registry.npmjs.org/`
- 不包含 `.npmrc`、secrets、source maps 或私有 registry URL
- 所有 worker URL 必须改写到包内已生成的 ESM runtime；不得残留 `.worker.ts`，也不得指向不存在的相对路径
- consumer fixture 可以从 tarball 安装并通过 `vue-tsc` / `vite build`

consumer 性能采样使用按需组件导入与 `profile: 'consumer'` 分包策略，避免完整
`app.use` 安装面把未使用组件强制变成空 chunk 或混入首屏。完整插件安装能力由包
接口、类型和 pack smoke 独立校验；性能预算只对真实可达的首屏及动态依赖闭包计算
raw、gzip 与 Brotli 体积。

同理，性能采样首屏只加载 `base.css` 与实际首屏组件 CSS；
`public-shell-critical.css` 保持可独立动态加载并由 package smoke 校验。完整
`dist/fsus.css` / `el-fsus-theme.css` 的内容、hash
和可安装性仍由 package smoke 校验；DataList、Motion、Perception 的 runtime export
也由独立 Node contract smoke 校验，不再人为塞进按需消费首屏。

Markdown 首屏采样必须提供与 `content` 同源、同 renderer version 的
`initialRender`，模拟 SSR、AOT shell 或可信缓存立即首显；该值必须来自 Markdown
runtime 的 `MarkdownSafeRenderResult`，不能用普通 HTML 字符串构造。WASM 仍在后台
完成正式解析并替换内容。这样首个可见文本不依赖 WASM 下载，同时 consumer smoke
仍会真实请求并验证打包后的 WASM runtime。

性能 fixture 还会在首次 idle 之前使用同源静态 HTML，之后才异步加载
`ElMarkdownRenderer` 并 hydration。该边界用于证明 Markdown runtime、worker 与 WASM
不会和首屏 Vue/CSS 争抢同一个启动任务；完整 runtime export 仍由独立 contract smoke
覆盖。

workspace 依赖归一化由 `scripts/prepare-npm-package.mjs` 负责，当前要求它处理：

- `dependencies`
- `peerDependencies`
- `optionalDependencies`

若归一化后仍残留 `workspace:`，构建应直接失败，不能带病发布。

## 4. GitHub Actions 发布规则

当前发布顺序已经固定：

- `_quality.yml` 负责统一质量门
- `publish-npm.yml` 只响应 `v*.*.*` 与 `v*.*.*-*` tag
- `publish-npm.yml` 先运行可复用质量门，再执行发布
- publish job 只下载并校验 quality 的 immutable candidate，核对 release profile、
  commit/tag/package/digest 后执行 `npm publish ./fsusui-npm-candidate.tgz`；禁止重新
  运行 build/prepare 或发布可变目录。版本已存在时可跳过，但仍记录 candidate digest。
- 发布 job 不允许绕过质量门直接跑

发布工作流还包含这些保护：

- 轻量 plan job 按 `registry + package + resolved dist-tag` 生成 canonical 锁键；
  quality 可以并行，但相同 package/channel 的 publish 临界区必须串行
- 读取最终工件内的包名与版本
- 校验 tag、plan、candidate manifest 的 registry/package/version/dist-tag 完全一致
- 使用 `scripts/resolve-npm-dist-tag.mjs` 推断 dist-tag
- 进入锁等待前以及获得锁后分别查询 channel 状态并执行 monotonicity check；查询失败
  必须阻止发布
- 仅当同版本已经存在且正是当前 dist-tag 时幂等跳过；已存在但 tag 不一致时失败，
  不得在自动路径隐式移动 dist-tag
- 使用 npm Trusted Publishing/OIDC，不设置长期 npm token

显式回退或修复错误 dist-tag 只能手工触发 `recover-npm-dist-tag.yml`。该 workflow
要求填写目标版本、请求时看到的当前版本和原因，在 `npm-recovery` environment 审批后
使用同一 package/channel 锁；锁内重新读取状态并校验 expected-current，避免审批期间的
状态变化被覆盖。恢复凭据只存放为该 environment 的 `NPM_RECOVERY_TOKEN`，不进入正常
自动发布路径。

## 5. 发布后核验

For a stable `latest` release, `publish-npm.yml` performs the automated
post-publish verification before the manual checks below. It consumes the
successful `fsusblog-consumer-gate` artifact produced by the #318 gate and
binds its digest to the immutable candidate and manifest before `npm publish`.
After an actual publish (never an idempotent skip), it polls the canonical npm
registry, downloads the registry-provided tarball, verifies SHA-512 integrity,
candidate SHA-256, package name/version, and the `latest` dist-tag, then sends
the strict `fsusui-npm-published-v1` event. Preview, next, and other prerelease
channels never enter this path.

The payload contract is
[`spec/releases/fsusui-npm-published-v1.schema.json`](../../spec/releases/fsusui-npm-published-v1.schema.json).
The sanitized artifact contract is
[`spec/releases/fsusui-release-dispatch-receipt.schema.json`](../../spec/releases/fsusui-release-dispatch-receipt.schema.json).
The sender uses only `FSUS_RELEASE_TRAIN_APP_ID` and
`FSUS_RELEASE_TRAIN_APP_PRIVATE_KEY`: it mints a metadata-only token scoped to
FsusUI and a separate FsusBlog-only token with metadata read, contents write,
and pull requests write. Missing, insufficient, or additional token permissions
fail before dispatch. PATs and the workflow `GITHUB_TOKEN` are not cross-repo
dispatch credentials.

The local deterministic registry/App/dispatch matrix is:

```bash
pnpm check:npm-release-workflow
```

These tests are implementation evidence only. They do not claim a real npm
publication, GitHub App installation, repository dispatch, or downstream
migration.

The separate #318 pre-publish App uses
`FSUS_CROSS_REPO_APP_ID` / `FSUS_CROSS_REPO_APP_PRIVATE_KEY` and is restricted
to metadata and contents read for exactly FsusUI and FsusBlog. Its verifier
produces only the non-sensitive installation identifiers and permission/check
summary defined by
[`spec/releases/fsus-cross-repo-app-evidence.schema.json`](../../spec/releases/fsus-cross-repo-app-evidence.schema.json).
It exits before reading credentials in an untrusted context. The checked-in
simulator proves the fail-closed contract; the real installation and its
administrator-owned evidence remain external and must not be inferred from a
local pass.

Release quality invokes the reusable
`.github/workflows/_fsusblog-consumer-gate.yml` only from a trusted release-tag
context. The workflow resolves the current FsusBlog default branch through the
API exactly once, freezes its full 40-character head SHA, checks out that SHA
with credentials disabled after checkout, and runs the formal
`verify:fsusui-candidate` entry against an absolute path to the downloaded local
tarball. It records exact Node/npm/Vue/Vite/TypeScript/vue-tsc versions and
requires a clean, unchanged FsusBlog checkout both before and after the command.
It never resolves the candidate from a registry and never changes FsusBlog.

发布后至少检查：

- GitHub Actions run 成功
- npm 上目标版本可见
- npm provenance / trusted publishing 信息可见
- 发布包 manifest 中无 `workspace:` 协议
- 下游可正常以 npm 解析该包依赖
- 视觉基线快照与交接文档已进入远端代码库

建议抽查：

- 包版本
- `dependencies["@element-plus/icons-vue"]`
- `publishConfig.registry`
- dist-tag 是否符合版本通道

## 6. 失败处理与回滚判断

### 质量门失败

- 不进入发布阶段
- 先在本地复现失败的门槛
- 修复后重跑 `verify:release`

### 工件准备失败

- 优先检查 `scripts/prepare-npm-package.mjs`
- 重点排查 workspace 依赖归一化、包元信息写入和 `dist/element-plus` 结构

### 已发布但 manifest 有问题

- 不修改已发布包内容
- 通过下一个补丁版本修复并重新发布
- 必要时在交接说明或发布说明中明确该版本问题和替代版本

## 7. 维护边界

本轮治理已固定这些工程接口：

- `verify`
- `verify:pr-fast`
- `verify:full`
- `check:consumer-contract`
- `verify:release`
- `test:coverage`
- `test:consumer-install`
- `test:visual:evidence`
- quality workflow
- Changesets 基础目录与模板
- npm public-preview package audit evidence

本轮未纳入的事项：

- Storybook
- 多 Node/OS 矩阵
- CODEOWNERS
- 分支保护
- 复杂 release train

后续若扩展治理范围，应在不破坏当前发布顺序和质量门语义的前提下增量演进。

## Typecheck cache policy

## .NET platform and package ownership

The reusable quality workflow separates platform compatibility from NuGet
candidate validation:

- `dotnet-platform` runs restore, Release build, tests, and the demo startup
  smoke on Linux, Windows, and macOS. Each runner uploads only its TRX results
  and a platform manifest containing OS/architecture, SDK/runtime inventory,
  solution fingerprint, test summary, smoke status, and commit SHA.
- `dotnet-package` runs once on Ubuntu. It creates one clean NuGet candidate,
  checks metadata, package contents, the packed consumer, and stable-package
  contracts, then records per-file hashes and one aggregate candidate SHA-256.
- `static-quality` owns icons, tokens, conformance, governance, and the a11y
  contract. Those checks are never members of the .NET OS matrix.
- Each `.NET` leaf uploads a readiness manifest alongside its existing detailed
  platform/package artifact. `stable-readiness` consumes the three platform
  dimensions and unique NuGet owner through the common manifest aggregator,
  rejecting duplicate/missing platforms, commit/run drift, failed status, or
  changed artifact digest before preserving evidence.

Use `pnpm dotnet:matrix:plan --os linux,windows,macos` for a static ownership
plan on any host. `pnpm dotnet:platform:verify` and
`pnpm dotnet:package:verify` remain independently runnable on the current OS;
local verification does not emulate or require the other operating systems.
The restore cache key includes runner OS, pinned SDK, projects, solution,
props/targets, and lock inputs. Final package directories are not cached or
treated as trusted evidence.

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

Pull request quality gates use `scripts/should-run-demo-build.mjs` after
`verify:pr-fast` to decide whether `pnpm run build:demo` is needed. The PR demo
build runs for demo app, component/runtime, theme, public API, and build-config
changes. It skips only docs/metadata-only changes, and the workflow prints
`demo-build-run` plus `demo-build-reason` so the decision is visible in logs.

Main, master, workflow-dispatch, release, and local full verification paths
still keep the full `build:demo` gate through `verify:full` and the reusable
`build-demo` quality job.

## Short Quality Consolidation

The reusable full quality workflow groups short quality checks in one
`static-quality` job with shared setup/install. Contract, lint, token, icon,
conformance, and governance checks remain separate named steps, so failure
output still identifies the failing quality area while avoiding repeated
checkout, Node setup, and dependency installation for each short check.

## Coverage execution and merge contract

`pnpm coverage:plan --dry-run` creates a deterministic plan without a browser,
network access, or an external performance service. It uses the shared CI
capacity base (effective CPU quota, effective memory/cgroup limit, and the
repository lane budget), test-file count, minimum files per shard, and a
per-shard memory estimate. Small workloads remain on one channel. A measured
duration can be supplied as a scheduling signal with
`FSUSUI_COVERAGE_KNOWN_SECONDS`; explicit shard/worker requests are still capped
so `shards * workers` cannot exceed the shared capacity plan.

`pnpm coverage:run` runs either one complete Vitest coverage process or truly
parallel local shard processes. Every shard writes a unique blob, coverage
fragment, and manifest containing its index/total, commit SHA, selection,
config/toolchain digests, duration, and memory field. A shard explicitly records
that it did not apply final thresholds, so a zero-threshold shard result cannot
be presented as complete coverage.

`pnpm coverage:merge <blob-dir>` rejects missing or duplicate shard indexes,
mixed totals, stale artifacts, digest changes, or shards that do not belong to
the same commit, config, toolchain, and full test selection. Only the complete
final merged result executes the repository coverage thresholds, exactly once.
The scheduling target applies to both modes as a planning signal, not as a
fixed GitHub-runner correctness claim. When a particular environment has an
explicit wall-clock SLO, set `FSUSUI_COVERAGE_DURATION_BUDGET_SECONDS`; that
budget is enforced for both single and sharded execution and therefore cannot
be bypassed by changing modes.
