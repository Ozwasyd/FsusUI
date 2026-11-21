import { createOwnerAbi } from './markdown/anchor-owner.portable.mjs'

let runtime: ReturnType<typeof createOwnerAbi> | undefined

// The caller supplies normalized UTF-8 and maps the resulting ranges back to
// raw UTF-16. This private ABI carries only valid paragraph/code/table/quote owners and unbound nested list lines.
export const readMarkdownAnchorOwnerBlocks = (source: string) => {
  if (!runtime) {
    runtime = createOwnerAbi({
      env: { emscripten_notify_memory_growth: () => undefined },
      wasi_snapshot_preview1: {
        fd_close: () => 0,
        fd_seek: () => 0,
        fd_write: () => 0,
      },
    })
    runtime._initialize()
  }
  const bytes = new TextEncoder().encode(source)
  const pointer = runtime.fa_alloc(Math.max(1, bytes.length))
  if (pointer <= 0) throw new Error('Unable to allocate anchor owner source')
  try {
    new Uint8Array(runtime.memory.buffer, pointer, bytes.length).set(bytes)
    const count = runtime.fa_collect(pointer, bytes.length)
    if (count < 0) throw new Error('Unable to collect anchor owners')
    const records = new Uint32Array(
      runtime.memory.buffer,
      runtime.fa_data(),
      count * 3,
    )
    return Array.from({ length: count }, (_, index) => {
      const offset = index * 3
      const kind = records[offset]
      if (kind !== 1 && kind !== 2 && kind !== 4 && kind !== 5 && kind !== 8) {
        throw new Error('Unexpected anchor owner kind')
      }
      return {
        kind:
          kind === 1
            ? 'paragraph'
            : kind === 2
              ? 'unbound-list'
              : kind === 4
                ? 'quote'
                : kind === 5
                  ? 'table'
                  : 'code',
        start: records[offset + 1]!,
        end: records[offset + 2]!,
      }
    })
  } finally {
    runtime.fa_free(pointer)
  }
}
