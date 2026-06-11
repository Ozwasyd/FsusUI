# FsusUI 发布治理交接

本文定义当前仓库的版本与发布规则，目标是让后续维护者能够独立完成版本变更、包校验、GitHub Package 发布和失败回滚判断。

## 1. 当前发布目标

- 主发布目标：GitHub Packages
- 发布对象：`dist/element-plus` 中准备好的主包工件
- 当前不发布到 npm registry

Public preview 的 npm registry 策略、包名策略、dist-tag 策略和 provenance 要求见 [npm Registry Publishing Policy](./release/npm-registry-policy.md)。在 #8 public-preview readiness gate 完成前，npm public publish 只能作为候选审计流程，不能实际发布。

发布前必须先通过：

```bash
pnpm verify
pnpm test:coverage
pnpm test:visual
pnpm run build:github-package
pnpm test:consumer-install
```

## 2. Changesets 流程

仓库已经接入 `.changeset/`，后续版本变更不再依赖手工约定。

标准流程：

1. 功能/修复合入前编写 changeset
2. 使用 `pnpm changeset` 生成变更说明
3. 使用 `pnpm version-packages` 生成版本与 changelog
4. 复跑 `verify:release`
5. 由发布工作流读取生成后的版本发布 GitHub Package

约束：

- 没有 changeset 的功能性改动，不应直接进入正式发布流
- 版本号和 changelog 以 changesets 生成结果为准，不再手工维护版本叙述

## 3. 发布前检查

发布前按以下顺序检查：

1. `pnpm verify`
2. `pnpm test:coverage`
3. `pnpm test:visual`
4. `pnpm run build:github-package`
5. `pnpm test:consumer-install`
6. 检查 `dist/element-plus/package.json`
7. 若准备 public-preview npm 发布，补充 `npm pack --dry-run` / `pnpm pack --dry-run` 记录，并更新 `release-evidence/npm-public-preview/`

发布工件检查重点：

- 包名与版本正确
- 不残留 `workspace:` 依赖协议
- `@element-plus/icons-vue` 等工作区依赖已被归一化为可消费 semver
- `publishConfig.registry` 指向 GitHub Packages
- consumer fixture 可以从 tarball 安装并通过 `vue-tsc` / `vite build`

workspace 依赖归一化由 `scripts/prepare-github-package.mjs` 负责，当前要求它处理：

- `dependencies`
- `peerDependencies`
- `optionalDependencies`

若归一化后仍残留 `workspace:`，构建应直接失败，不能带病发布。

## 4. GitHub Actions 发布规则

当前发布顺序已经固定：

- `quality.yml` 负责统一质量门
- `publish-github-package.yml` 先运行可复用质量门，再执行发布
- 发布 job 不允许绕过质量门直接跑

发布工作流还包含这些保护：

- 读取最终工件内的包名与版本
- 先查询目标版本是否已存在
- 已存在则跳过发布，避免重复发布同版本

## 5. 发布后核验

发布后至少检查：

- GitHub Actions run 成功
- GitHub Packages 上目标版本可见
- 发布包 manifest 中无 `workspace:` 协议
- 下游可正常以 npm 解析该包依赖
- 视觉基线快照与交接文档已进入远端代码库

建议抽查：

- 包版本
- `dependencies["@element-plus/icons-vue"]`
- `publishConfig.registry`

## 6. 失败处理与回滚判断

### 质量门失败

- 不进入发布阶段
- 先在本地复现失败的门槛
- 修复后重跑 `verify:release`

### 工件准备失败

- 优先检查 `scripts/prepare-github-package.mjs`
- 重点排查 workspace 依赖归一化、包元信息写入和 `dist/element-plus` 结构

### 已发布但 manifest 有问题

- 不修改已发布包内容
- 通过下一个补丁版本修复并重新发布
- 必要时在交接说明或发布说明中明确该版本问题和替代版本

## 7. 维护边界

本轮治理已固定这些工程接口：

- `verify`
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
