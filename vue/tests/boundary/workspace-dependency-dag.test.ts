import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(__dirname, '../../..')
const packagesRoot = path.join(repoRoot, 'vue/packages')

/**
 * Authoritative acyclic workspace dependency DAG for FsusUI Vue packages.
 * Each package may only import `@element-plus/*` packages listed in its
 * allowed lower-layer set.
 */
const ALLOWED_PACKAGE_DEPS: Record<string, readonly string[]> = {
  constants: [],
  'icons-svg': [],
  'icons-vue': [],
  locale: [],
  motion: [],
  'theme-chalk': [],
  utils: ['constants', 'icons-vue'],
  wasm: ['utils'],
  directives: ['constants', 'utils'],
  hooks: ['constants', 'locale', 'utils'],
  components: [
    'constants',
    'directives',
    'hooks',
    'icons-vue',
    'locale',
    'motion',
    'theme-chalk',
    'utils',
    'wasm',
  ],
  'element-plus': [
    'components',
    'constants',
    'directives',
    'hooks',
    'icons-vue',
    'locale',
    'motion',
    'theme-chalk',
    'utils',
    'wasm',
  ],
}

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.vue', '.mjs', '.js'])
const SKIP_DIRS = new Set([
  '__tests__',
  'tests',
  'mocks',
  'dist',
  'node_modules',
  'pkg',
  'target',
  'build',
])
const IMPORT_RE =
  /(?:from\s+|import\s*\(\s*)['"]@element-plus\/([a-z0-9-]+)(?:\/[^'"]*)?['"]/gu

function walkProductionSources(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walkProductionSources(path.join(dir, entry.name), out)
      continue
    }
    if (!entry.isFile()) continue
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue
    if (
      entry.name.endsWith('.test.ts') ||
      entry.name.endsWith('.test.tsx') ||
      entry.name.endsWith('.spec.ts') ||
      entry.name === 'setup-mock.ts' ||
      entry.name === 'gulpfile.ts' ||
      entry.name === 'build.config.ts'
    ) {
      continue
    }
    out.push(path.join(dir, entry.name))
  }
  return out
}

describe('workspace package dependency DAG boundary', () => {
  it('defines an acyclic allowed dependency graph', () => {
    const visiting = new Set<string>()
    const visited = new Set<string>()

    const visit = (pkg: string) => {
      if (visited.has(pkg)) return
      if (visiting.has(pkg)) {
        throw new Error(`Cycle detected in ALLOWED_PACKAGE_DEPS at ${pkg}`)
      }
      visiting.add(pkg)
      for (const dep of ALLOWED_PACKAGE_DEPS[pkg] ?? []) {
        visit(dep)
      }
      visiting.delete(pkg)
      visited.add(pkg)
    }

    for (const pkg of Object.keys(ALLOWED_PACKAGE_DEPS)) {
      visit(pkg)
    }
    expect(visited.size).toBe(Object.keys(ALLOWED_PACKAGE_DEPS).length)
  })

  it('enforces strict one-way cross-package imports across production sources', () => {
    const violations: string[] = []

    for (const [pkg, allowed] of Object.entries(ALLOWED_PACKAGE_DEPS)) {
      const allowedSet = new Set(allowed)
      const files = walkProductionSources(path.join(packagesRoot, pkg))
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8')
        for (const match of content.matchAll(IMPORT_RE)) {
          const target = match[1]
          if (target === pkg) continue
          if (!allowedSet.has(target)) {
            violations.push(
              `${path.relative(repoRoot, file)} imports forbidden @element-plus/${target} (allowed for ${pkg}: [${allowed.join(', ')}])`,
            )
          }
        }
      }
    }

    expect(violations).toEqual([])
  })
})
