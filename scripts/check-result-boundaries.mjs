#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const root = process.cwd()

const checkedFiles = [
  'vue/packages/wasm/index.ts',
  'vue/packages/wasm/markdown-runtime.ts',
  'vue/packages/hooks/use-render-pipeline/index.ts',
  'vue/packages/components/form/src/form.vue',
  'vue/packages/components/form/src/form-item.vue',
  'vue/packages/components/message-box/src/messageBox.ts',
  'vue/packages/components/upload/src/upload-content.vue',
]

const generatedDeclarationChecks = [
  {
    file: 'vue/packages/wasm/dist/index.d.ts',
    signatures: [
      'initMarkdownRuntime(): Promise<FsusResult<MarkdownRuntimeKind>>',
      'renderMarkdownHtmlWithRuntime(request: MarkdownRenderRequest | string): Promise<FsusResult<MarkdownRuntimeHtmlResult>>',
      'renderMarkdownSummaryWithRuntime(request: MarkdownRenderRequest | string): Promise<FsusResult<MarkdownRuntimeSummaryResult>>',
      'renderMarkdownResultWithRuntime(request: MarkdownRenderRequest | string): Promise<FsusResult<MarkdownRuntimeRenderResult>>',
      'renderMarkdownChunksWithRuntime(request: MarkdownRenderRequest | string): Promise<FsusResult<MarkdownRuntimeChunkResult>>',
      'ensureWasmReady(): Promise<FsusResult<void>>',
      'sortNumbers(data: number[], ascending?: boolean): Promise<FsusResult<number[]>>',
    ],
  },
]

const invariantThrowAllowlist = new Map([
  [
    'vue/packages/wasm/index.ts',
    [
      '@element-plus/wasm is not ready',
      '@element-plus/wasm internal buffer helpers are unavailable',
      '@element-plus/wasm session disposed',
      '@element-plus/wasm ASCII index is not loaded',
      'contains non-ASCII data',
    ],
  ],
  [
    'vue/packages/hooks/use-render-pipeline/index.ts',
    [
      'fsus_render_pipeline_adapter_id_required',
      'useFsusVirtualWindow requires unique keys',
    ],
  ],
])

const violations = []

const addViolation = (file, line, message) => {
  violations.push(`${file}:${line}: ${message}`)
}

const lineNumberOf = (source, index) =>
  source.slice(0, index).split('\n').length

for (const file of checkedFiles) {
  const abs = resolve(root, file)
  const source = readFileSync(abs, 'utf8')
  const normalized = relative(root, abs)

  for (const match of source.matchAll(/Promise\.reject\s*\(/g)) {
    addViolation(
      normalized,
      lineNumberOf(source, match.index ?? 0),
      'recoverable boundary must return FsusResult instead of Promise.reject()',
    )
  }

  for (const match of source.matchAll(/throw\s+new\s+Error\s*\(([^)]*)\)/g)) {
    const line = lineNumberOf(source, match.index ?? 0)
    const allowedSnippets = invariantThrowAllowlist.get(normalized) ?? []
    if (!allowedSnippets.some((snippet) => match[0]?.includes(snippet))) {
      addViolation(
        normalized,
        line,
        'throw new Error() is only allowed for documented invariants',
      )
    }
  }

  if (normalized === 'vue/packages/wasm/markdown-runtime.ts') {
    const publicResultFunctions = [
      'initMarkdownRuntime',
      'renderMarkdownHtmlWithRuntime',
      'renderMarkdownSummaryWithRuntime',
      'renderMarkdownWithRuntime',
      'renderMarkdownResultWithRuntime',
      'renderMarkdownChunksWithRuntime',
    ]
    for (const name of publicResultFunctions) {
      const start = source.indexOf(`export async function ${name}`)
      const signatureWindow = start >= 0 ? source.slice(start, start + 260) : ''
      if (
        !signatureWindow.includes('Promise<') ||
        !signatureWindow.includes('FsusResult')
      ) {
        addViolation(
          normalized,
          1,
          `${name} must expose Promise<FsusResult<...>>`,
        )
      }
    }
  }
}

for (const { file, signatures } of generatedDeclarationChecks) {
  const abs = resolve(root, file)
  const source = readFileSync(abs, 'utf8')
  const normalized = relative(root, abs)

  for (const signature of signatures) {
    if (!source.includes(signature)) {
      addViolation(
        normalized,
        1,
        `generated wasm declaration is stale; run pnpm run build:wasm before verify (${signature})`,
      )
    }
  }
}

if (violations.length > 0) {
  console.error('Result boundary check failed:')
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  process.exit(1)
}

console.log(`Result boundary check passed (${checkedFiles.length} files).`)
