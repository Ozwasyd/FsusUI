# FsusUI 发布治理交接

本文定义当前仓库的版本与发布规则，目标是让后续维护者能够独立完成版本变更、包校验、npm 发布和失败回滚判断。

## 1. 当前发布目标

- 主发布目标：npm public registry
- 发布对象：`dist/element-plus` 中准备好的主包工件
- 当前包名：`@ozwasyd/element-plus`
- 发布触发：推送 `vX.Y.Z` 或 `vX.Y.Z-*` tag

Public preview 的 registry 策略、包名策略、dist-tag 策略和 provenance 要求见 [npm Registry Publishing Policy](./release/npm-registry-policy.md)。旧的包注册表自动发布流程已移入 `docs/archive/github-packages/`，仅作历史参考，不再自动发布，也不作为 npm 发布后的镜像。

常用验证门分为三层：

- `pnpm verify:pr-fast`：PR 默认快速门，覆盖 lint、按变更路径选择的 affected typecheck/unit、token/icon/design governance 和最小包构建 smoke，不包含 demo build、coverage、visual 或发布包安装。
- `pnpm verify:full`：完整本地质量门，等价于历史 `pnpm verify` 行为，包含 `prepare:test-artifacts`、`_verify:parallel` 和 `build:demo`。
- `pnpm verify:release`：发布候选门，在 `verify:full` 之上增加 npm dist-tag、npm package 和 consumer-install 检查。

`pnpm verify` 保留为 `verify:full` 的安全别名，避免旧脚本降级覆盖面。

`prepare:test-artifacts` 会先检查 icon 与 WASM 的 test artifact cache。
GitHub Actions 使用 source-hash key 恢复 `packages/icons-vue/dist` 与
`packages/wasm/dist`；日志中会输出 `icons-cache-hit`、`wasm-cache-hit`，
本地 wrapper 还会输出 `cache hit` / `cache miss` 与 fingerprint source hash。
cache hit 时会跳过对应 `ensure:icons` / `ensure:wasm`；cache miss 或
restore-key 命中旧工件时会重新生成并写入 fingerprint。发布或手工重建仍使用
`pnpm run build:wasm` 或 `FORCE_REBUILD=1 pnpm run prepare:test-artifacts`，
不要把 release regeneration 改成只依赖 cache。

full quality 的 unit shard 由 `unit-artifacts` job 统一准备测试工件并上传
`unit-test-artifacts`，各 shard 下载后运行 `pnpm run check:test-artifacts-ready`
和 `pnpm exec vitest run --shard=<n>/4`。这样 cache miss/generation 日志只集中在
前置 job，shard 不再重复执行 icon/WASM 生成。

full quality 的 `consumer-install` 复用 `build-package` 产出的
`fsusui-npm-package-dist`，下载后先用 `sha256sum` 校验
`fsusui-npm-package-dist.tgz`，再解包 `dist/element-plus` 并运行
`pnpm run build:package-smoke` 与 `pnpm test:consumer-install`。`verify:release`
仍按本地 release 顺序执行 `build:npm-package` 后再跑 consumer install，保留
independent rebuild 语义，便于发布前排查可复现性问题。

发布前必须先通过：

```bash
pnpm verify:release
pnpm test:coverage
pnpm test:visual
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
3. `pnpm test:visual`
4. 检查 `dist/element-plus/package.json`
5. 补充 `npm pack --dry-run` / `pnpm pack --dry-run` 记录，并更新 `release-evidence/npm-public-preview/`

发布工件检查重点：

- 包名与版本正确
- 不残留 `workspace:` 依赖协议
- `@element-plus/icons-vue` 等工作区依赖已被归一化为可消费 semver
- `publishConfig.access` 为 `public`
- `publishConfig.registry` 指向 `https://registry.npmjs.org/`
- 不包含 `.npmrc`、secrets、source maps 或私有 registry URL
- consumer fixture 可以从 tarball 安装并通过 `vue-tsc` / `vite build`

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
- 发布 job 不允许绕过质量门直接跑

发布工作流还包含这些保护：

- 读取最终工件内的包名与版本
- 校验 tag 版本与 package version 完全一致
- 使用 `scripts/resolve-npm-dist-tag.mjs` 推断 dist-tag
- 先查询目标版本是否已存在
- 已存在则跳过发布，避免重复发布同版本
- 使用 npm Trusted Publishing/OIDC，不设置长期 npm token

## 5. 发布后核验

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
- `test:visual`
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

PR-fast uses `typecheck:affected`, which selects the affected TypeScript
lanes and runs them through `scripts/run-typecheck.mjs`. The default
`typecheck:*` lanes write `.tsbuildinfo` files under `.tmp/typecheck-cache`;
GitHub Actions restores that typecheck cache with a key that includes
`pnpm-lock.yaml`, `package.json`, `tsconfig*.json`, package sources, typings,
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
