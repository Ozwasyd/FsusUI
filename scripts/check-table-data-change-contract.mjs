import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve(import.meta.dirname, '..')
const read = (file) => readFile(path.join(root, file), 'utf8')
const [defaults, style, watcher, docs, tableV2, benchmark] = await Promise.all([
  read('vue/packages/components/table/src/table/defaults.ts'),
  read('vue/packages/components/table/src/table/style-helper.ts'),
  read('vue/packages/components/table/src/store/watcher.ts'),
  read('docs/components/table.md'),
  read('docs/components/table-v2.md'),
  read('scripts/table-data-change-performance.mjs'),
])

const requirements = [
  [defaults, "'identity'", 'identity strategy type'],
  [defaults, "'version'", 'version strategy type'],
  [defaults, "'manual'", 'manual strategy type'],
  [defaults, "'deep'", 'deep compatibility strategy type'],
  [style, "strategy === 'deep'", 'conditional deep watcher'],
  [style, 'const refreshData', 'manual refresh boundary'],
  [watcher, 'new Map<unknown, T>()', 'stable selection key map'],
  [watcher, 'filteredRowIndices', 'filter row index view'],
  [watcher, 'sortedRowIndices', 'sort row index view'],
  [watcher, 'pendingLayoutReasons', 'layout reason deduplication'],
  [watcher, 'TableLayoutDiagnostics', 'typed layout diagnostics'],
  [docs, 'data-change-strategy', 'Table migration contract'],
  [tableV2, 'getLayoutDiagnostics()', 'Table to TableV2 guidance'],
  [benchmark, "--size', '100000'", '100K benchmark default'],
]

for (const [content, expected, label] of requirements) {
  if (!content.includes(expected)) {
    throw new Error(`Table data-change contract missing ${label}: ${expected}`)
  }
}
if (watcher.includes('@ts-nocheck')) {
  throw new Error('Table watcher hot path must remain TypeScript checked')
}
if (watcher.includes('selection.value.includes(row)')) {
  throw new Error('Table selection lookup must not regress to linear includes')
}

process.stdout.write('Table data-change contract passed.\n')
