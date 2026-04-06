# FsusUI

> Element Plus 私有改造版 — ES2022 · TypeScript 6 · WebAssembly (C++23)

## 关键改造点

| 维度 | 原 Element Plus | FsusUI |
|------|----------------|--------|
| JS 标准 | ES2018 | **ES2022**（`at()`、`Object.hasOwn()`、Top-level await 等） |
| TypeScript | 4.7 | **6.0**（更严格推断、`moduleResolution: Bundler`） |
| 最低兼容 | Chrome 64+ | **Chrome 106+**（ES2022 全支持） |
| 重计算 | 纯 JS | **WASM SIMD**（C++23 / Emscripten，见 `packages/wasm/`） |
| 构建工具 | Rollup 2 / esbuild 0.14 | **Rollup 4 / esbuild 0.28** |
| 包管理器 | pnpm 7 | **pnpm 10** |
| 运行时 | Node 16 | **Node 22** |
| ESLint | 8（旧格式） | **10（Flat Config）** |

## 与 Element Plus 的合约兼容性

所有组件 props / emits / slots / expose 与 Element Plus 主线保持**完全一致**。  
现有项目无需修改任何代码即可切换。

## WASM 加速模块

```
packages/wasm/
├── src/ep_wasm.cpp   # C++23 源码（排序/过滤/颜色/精度/行高）
├── CMakeLists.txt    # Emscripten 构建配置
├── build.sh          # 一键构建脚本
├── index.ts          # TypeScript Promise-based 封装
└── dist/             # 构建产物（.wasm + .mjs）
```

**构建 WASM**（需安装 emsdk）：
```bash
pnpm build:wasm
```

**集成点**：
- `packages/components/table/src/composables/use-wasm-sort.ts` — 表格列排序（≥5000 行走 WASM）
- `packages/components/virtual-list/src/hooks/use-wasm-row-height.ts` — 虚拟列表行高估算（≥2000 项）

## 开发

```bash
# 安装依赖
pnpm install

# 构建
pnpm build

# 测试
pnpm test

# 类型检查
pnpm typecheck
```
