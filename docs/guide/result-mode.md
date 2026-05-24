# Result Mode

FsusUI 使用 `FsusResult<T>` 表达可恢复失败。用户输入、WASM、Worker、IO、异步运行时和可取消交互不再用 `throw`、`Promise.reject` 或 `null` 作为正常失败边界。

推荐从专用入口导入：

```ts
import { fsusOk, fsusErr, type FsusResult } from 'element-plus/result'
```

如果使用当前 GitHub Packages 主包名，导入路径为 `@ozwasyd/element-plus/result`。

## 数据结构

```ts
type FsusResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: FsusErrorDetail }

type FsusErrorDetail = {
  code:
    | 'validation'
    | 'not-found'
    | 'conflict'
    | 'unauthorized'
    | 'forbidden'
    | 'infra'
    | 'protocol'
    | 'timeout'
    | 'aborted'
    | 'invariant'
    | 'unknown'
  message: string
  category: string
  cause?: unknown
  details?: string
  traceId?: string
}
```

## 处理方式

```ts
const result = await formRef.value?.validate()

if (!result?.ok) {
  console.warn(result?.error.code, result?.error.message)
  return
}

submit()
```

`fsusTry()` 与 `fsusTryAsync()` 只用于把第三方或历史异常边界收敛为 Result；新代码应优先直接返回 `fsusOk()` / `fsusErr()`。

## 允许 Throw 的情况

保留 invariant throw：

- 编程错误。
- 缺少必须导出。
- 非法内部状态。
- 同步 API 在未满足调用前置条件时失败。

可恢复失败必须返回 Result：

- 校验失败。
- 用户取消或关闭。
- Worker timeout、abort、crash。
- WASM runtime unavailable、协议错误、环境不可用。
- 上传、网络、IO、异步业务 hook 失败。

## 迁移表

| 旧写法 | 新写法 |
| ------ | ------ |
| `try { await validate() } catch (fields) { ... }` | `const result = await validate(); if (!result.ok) { ... }` |
| `MessageBox.confirm(...).catch(...)` | `const result = await MessageBox.confirm(...); if (!result.ok) { ... }` |
| `const html = await renderMarkdownWithRuntime(...); if (!html) ...` | `const result = await renderMarkdownWithRuntime(...); if (result.ok) result.value` |
| `worker.run(...).catch(...)` | `const result = await worker.run(...); if (!result.ok) ...` |

## Release Gate

`pnpm run check:result-boundaries` 会扫描生产 runtime 边界，防止新增裸 `Promise.reject()` 或非 allowlist 的 `throw new Error()`。测试、构建脚本、WASM glue 和 invariant-only 同步 helper 不纳入可恢复失败改造范围。
