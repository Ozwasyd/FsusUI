# FsusUI

> 基于 Element Plus 体系维护的 Vue 3 组件库工作区（pnpm monorepo）— ES2022 · TypeScript 6 · WebAssembly (C++23)

## 项目简介

- 本仓库目录名为 `FsusUI`，但多数源码目录与导出命名仍沿用 `element-plus` 体系。
- 工作区由 `pnpm-workspace.yaml` 定义，覆盖 `packages/*` 与 `internal/*`。
- 工作区源码主入口仍位于 `packages/element-plus`（源码包名 `element-plus`），对外 GitHub Packages 安装名为 `@ozwasyd/element-plus`。

核心特性（以仓库现状为准）：

| 维度       | 原 Element Plus         | FsusUI                                                      |
| ---------- | ----------------------- | ----------------------------------------------------------- |
| JS 标准    | ES2018                  | **ES2022**（`at()`、`Object.hasOwn()`、Top-level await 等） |
| TypeScript | 4.7                     | **6.0**（更严格推断、`moduleResolution: Bundler`）          |
| 最低兼容   | Chrome 64+              | **Chrome 106+**（ES2022 全支持）                            |
| 重计算     | 纯 JS                   | **WASM SIMD**（C++23 / Emscripten，见 `packages/wasm/`）    |
| 构建工具   | Rollup 2 / esbuild 0.14 | **Rollup 4 / esbuild 0.28**                                 |
| 包管理器   | pnpm 7                  | **pnpm 10**                                                 |
| 运行时     | Node 16                 | **Node 22**                                                 |
| ESLint     | 8（旧格式）             | **10（Flat Config）**                                       |

## 与 Element Plus 的关系与命名现状

- 这是一个以 Element Plus 包结构为主体的代码库分支/改造版本；具体行为以本仓库代码与构建产物为准。
- 文档与描述会避免“完全兼容”等无法从仓库自动证明的强断言；若你在迁移中遇到不一致，应以实际构建与运行结果为准。
- 当前对外安装名仍为 `@ozwasyd/element-plus`，发布目标仍为 GitHub Packages。公共 npm registry、provenance、dist-tag 和长期包名策略见 [`docs/release/npm-registry-policy.md`](./docs/release/npm-registry-policy.md)。

## 快速开始

环境要求：`node >= 22`、`pnpm >= 10`（根 `package.json` 的 `packageManager` 为 `pnpm@10.33.0`）。

外部业务项目接入请直接使用 [`@ozwasyd/element-plus`](./docs/guide/installation.md)；下面的命令是仓库开发/联调用法。

```bash
pnpm install

# 启动 demo（Vite dev server: 5173）
pnpm -C packages/demo-app dev
```

## 常用命令

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm lint

pnpm build:theme
pnpm build:wasm
```

## 详细文档

- 项目主文档：`docs/project-overview.md`
- 与 Element Plus 不同点的接入指南：`docs/element-plus-integration.md`
- Public API 稳定性：`docs/api-stability.md`
- Element Plus 兼容策略：`docs/element-plus-compatibility.md`
- 从 Element Plus 迁移：`docs/migration/from-element-plus.md`
- 主题 token 稳定性：`docs/theme/tokens.md`
- Motion token 稳定性：`docs/theme/motion.md`
