import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(__dirname, '../../..')
const packagesRoot = path.join(repoRoot, 'vue/packages')

/**
 * Authoritative acyclic workspace dependency DAG for FsusUI 2.0 Vue packages.
 * Each package may only import `@fsusui/*` packages listed in its allowed
 * lower-layer set, and zero retired V1 `@element-plus/*` imports are allowed.
 */
const ALLOWED_PACKAGE_DEPS: Record<string, readonly string[]> = {
  core: [],
  'icons-svg': [],
  icons: [],
  motion: [],
  theme: [],
  wasm: ['core'],
  components: ['core', 'icons', 'motion', 'theme'],
  markdown: ['core', 'icons', 'motion', 'theme', 'wasm'],
  fsusui: ['components', 'core', 'icons', 'markdown', 'motion', 'theme', 'wasm'],
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
  /(?:from\s+|import\s*\(\s*)['"]@fsusui\/([a-z0-9-]+)(?:\/[^'"]*)?['"]/gu
const FORBIDDEN_V1_IMPORT_RE =
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
              `${path.relative(repoRoot, file)} imports forbidden @fsusui/${target} (allowed for ${pkg}: [${allowed.join(', ')}])`,
            )
          }
        }
        for (const match of content.matchAll(FORBIDDEN_V1_IMPORT_RE)) {
          violations.push(
            `${path.relative(repoRoot, file)} imports retired V1 package @element-plus/${match[1]}`,
          )
        }
      }
    }

    expect(violations).toEqual([])
  })
})
