# Result mode

FsusUI uses `FsusResult<T>` for recoverable failures. User input, WASM,
Workers, IO, asynchronous runtimes, and cancellable interactions do not use
`throw`, `Promise.reject`, or `null` as their normal failure boundary.

Import the dedicated entry:

```ts
import { fsusOk, fsusErr, type FsusResult } from '@ozwasyd/element-plus/result'
```

Repository source consumers may use the `element-plus/result` alias for the
same entry.

## Data structure

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

## Handle a result

```ts
const result = await formRef.value?.validate()

if (!result?.ok) {
  console.warn(result?.error.code, result?.error.message)
  return
}

submit()
```

Use `fsusTry()` and `fsusTryAsync()` only to adapt third-party or legacy
exception boundaries. New code should return `fsusOk()` or `fsusErr()` directly.

## When `throw` remains valid

Synchronous invariant throws remain for:

- programming errors;
- a required export being absent;
- an invalid internal state; or
- a synchronous API called without its prerequisites.

The registered cases are using `WasmDataSession` after `dispose()`, reading an
ASCII index before `setAsciiIndex()`, and passing a duplicate key to
`useFsusVirtualWindow`. They indicate a lifecycle or identity violation, not a
retryable WASM/Worker failure.

All recoverable failures must return a Result:

- validation failure;
- user cancellation or dismissal;
- Worker timeout, abort, or crash;
- unavailable WASM runtime, protocol error, or unavailable environment; and
- upload, network, IO, or asynchronous business-hook failure.

## Migration table

| Old form | Result form |
| --- | --- |
| `try { await validate() } catch (fields) { ... }` | `const result = await validate(); if (!result.ok) { ... }` |
| `MessageBox.confirm(...).catch(...)` | `const result = await MessageBox.confirm(...); if (!result.ok) { ... }` |
| `const html = await renderMarkdownWithRuntime(...); if (!html) ...` | `const result = await renderMarkdownWithRuntime(...); if (result.ok) result.value` |
| `worker.run(...).catch(...)` | `const result = await worker.run(...); if (!result.ok) ...` |

## Release gate

`pnpm run check:result-boundaries` scans production runtime boundaries and
rejects new bare `Promise.reject()` or non-allowlisted `throw new Error()`.
Tests, build scripts, WASM glue, and invariant-only synchronous helpers are
outside this recoverable-failure migration.
