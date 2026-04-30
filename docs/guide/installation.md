# 安装

## 环境要求

FsusUI 要求以下最低版本的运行环境：

| 环境 | 版本 |
|------|------|
| Node.js | `22.x` |
| pnpm | `10.33.0` |
| TypeScript | `6.0.x` |
| Vue | `^3.5.0` |

FsusUI 支持所有现代浏览器最近两个主版本（不支持 IE）。

| 版本 | Chrome | Edge | Firefox | Safari |
|------|--------|------|---------|--------|
| 当前 | ≥ 85 | ≥ 85 | ≥ 79 | ≥ 14.1 |

### SCSS 编译器

本项目使用 `theme-chalk` 中的 SCSS 源码，最低兼容 Sass `1.79.0`。

如果终端出现 `legacy JS API Deprecation Warning`，在 `vite.config.ts` 中添加：

```ts
// vite.config.ts
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: { api: 'modern-compiler' },
    },
  },
})
```

---

## 通过 GitHub Packages 安装

FsusUI 发布在 **GitHub Packages**，不发布到 npm 公共仓库。安装前需要配置 GitHub Packages 认证。

### 第一步：配置 .npmrc

在项目根目录或用户目录 `~/.npmrc` 中添加：

```ini
@element-plus:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

> **说明**：`GITHUB_TOKEN` 需要具备 `read:packages` 权限。可在 GitHub 个人设置 → Developer settings → Personal access tokens 中生成。

### 第二步：安装包

```bash
pnpm install element-plus
```

### Sass 源码依赖（可选）

若需要使用 SCSS 变量进行深度主题定制，额外安装：

```bash
pnpm install -D sass
```

---

## 在本仓库中进行本地开发

若要在仓库内对组件或样式进行修改，直接在 monorepo 工作区中操作：

```bash
# 安装全部工作区依赖
pnpm install

# 启动 demo 开发服务器（端口 5173）
pnpm dev

# 构建包
pnpm build

# 执行全量测试
pnpm test:run
```

完整的命令说明请参阅 [工程维护交接](../engineering-handoff.md)。

---

## WASM 可选性能层

FsusUI 内置 WASM 加速模块，在特定场景下自动启用，无需额外配置：

- **Table 排序**：当表格行数 ≥ 5000 时，自动启用 WASM 加速排序，低于阈值时使用纯 JS。
- **VirtualList 行高预估**：当列表项 ≥ 2000 时，自动启用 WASM 动态行高预估，低于阈值时自动降级。

若需要在项目中重新编译 WASM 模块，需要 Emscripten `5.0.4`。详见 [工程维护交接](../engineering-handoff.md#wasm)。
