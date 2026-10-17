import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  assertPackageExportAllowlist,
  assertPublishedRegularFile,
  resolveExactRelativeDeclarationTarget,
  assertFinalSafeTypeExports,
  assertDeclarationExportAll,
  assertPortableDeclaration,
} from '../../../scripts/check-package-build-smoke.mjs'
import * as iconsVue from '../../packages/element-plus/icons-vue'
import * as markdownRuntime from '../../packages/element-plus/markdown-runtime'
import * as result from '../../packages/element-plus/result'
import * as theme from '../../packages/element-plus/theme'
import * as wasm from '../../packages/element-plus/wasm'

const repoRoot = join(__dirname, '..', '..', '..')
const vueRoot = join(repoRoot, 'vue')

describe('package public exports', () => {
  it('declares stable subpath exports for downstream adapters', () => {
    const packageJson = JSON.parse(
      readFileSync(
        join(vueRoot, 'packages', 'element-plus', 'package.json'),
        'utf8',
      ),
    )

    expect(packageJson.exports).toEqual(
      expect.objectContaining({
        './icons-vue': expect.any(Object),
        './markdown-runtime': expect.any(Object),
        './result': expect.any(Object),
        './theme': expect.any(Object),
        './wasm': expect.any(Object),
        './dist/index.css': './dist/index.css',
        './dist/public-shell-critical.css': './dist/public-shell-critical.css',
        './theme-chalk/*': './theme-chalk/*',
      }),
    )
  })

  it('uses an explicit compatibility allowlist without broad or wasm deep exports', () => {
    const packageJson = JSON.parse(
      readFileSync(
        join(vueRoot, 'packages', 'element-plus', 'package.json'),
        'utf8',
      ),
    )

    for (const forbidden of [
      './*',
      './es/*.mjs',
      './es/*',
      './lib/*.js',
      './lib/*',
    ]) {
      expect(Object.hasOwn(packageJson.exports, forbidden)).toBe(false)
    }
    expect(packageJson.exports['./es/wasm/*']).toBeNull()
    expect(packageJson.exports['./lib/wasm/*']).toBeNull()

    expect(packageJson.exports).toEqual(
      expect.objectContaining({
        './es/index': {
          import: { types: './es/index.d.mts', default: './es/index.mjs' },
        },
        './lib/index': {
          types: './lib/index.d.ts',
          require: './lib/index.js',
        },
        './es/icons-vue': {
          import: {
            types: './es/icons-vue.d.mts',
            default: './es/icons-vue.mjs',
          },
        },
        './lib/icons-vue': {
          types: './lib/icons-vue.d.ts',
          require: './lib/icons-vue.js',
        },
        './es/wasm': {
          import: { types: './es/wasm.d.mts', default: './es/wasm.mjs' },
        },
        './lib/wasm': {
          types: './lib/wasm.d.ts',
          require: './lib/wasm.js',
        },
        './es/motion': {
          import: { types: './es/motion.d.mts', default: './es/motion.mjs' },
        },
        './lib/motion': {
          types: './lib/motion.d.ts',
          require: './lib/motion.js',
        },
      }),
    )

    for (const directory of [
      'components',
      'constants',
      'directives',
      'hooks',
      'locale',
      'motion',
      'utils',
    ]) {
      expect(packageJson.exports[`./es/${directory}/*`]).toEqual({
        import: {
          types: [
            `./es/${directory}/*.d.mts`,
            `./es/${directory}/*/index.d.mts`,
          ],
          default: `./es/${directory}/*.mjs`,
        },
      })
      expect(packageJson.exports[`./lib/${directory}/*`]).toEqual({
        types: [`./lib/${directory}/*.d.ts`, `./lib/${directory}/*/index.d.ts`],
        require: `./lib/${directory}/*.js`,
      })
      expect(packageJson.exports[`./es/${directory}/*.mjs`]).toEqual({
        import: {
          types: `./es/${directory}/*.d.mts`,
          default: `./es/${directory}/*.mjs`,
        },
      })
      expect(packageJson.exports[`./lib/${directory}/*.js`]).toEqual({
        types: `./lib/${directory}/*.d.ts`,
        require: `./lib/${directory}/*.js`,
      })
    }
  })

  it('resolves stable public API modules without deep component paths', () => {
    expect(typeof theme.syncThemeMode).toBe('function')
    expect(typeof theme.readThemeMode).toBe('function')
    expect(typeof result.isFsusResult).toBe('function')
    expect(typeof result.getFsusErrorMessage).toBe('function')
    expect(typeof markdownRuntime.activateMarkdownFeatures).toBe('function')
    expect(typeof markdownRuntime.renderMarkdownResultWithRuntime).toBe(
      'function',
    )
    expect(typeof wasm.ensureWasmReady).toBe('function')
    expect(iconsVue.Search).toBeTruthy()
  })

  it('keeps the downstream fixture on public package paths only', () => {
    const fixture = readFileSync(
      join(repoRoot, 'tests', 'fixtures', 'downstream-public-api-adapter.ts'),
      'utf8',
    )

    expect(fixture).toContain('@ozwasyd/element-plus/theme')
    expect(fixture).toContain('@ozwasyd/element-plus/icons-vue')
    expect(fixture).toContain('@ozwasyd/element-plus/markdown-runtime')
    expect(fixture).not.toMatch(/@ozwasyd\/element-plus\/es\/.*\/src\//)
  })
})

const readPackage = () =>
  JSON.parse(
    readFileSync(
      join(vueRoot, 'packages', 'element-plus', 'package.json'),
      'utf8',
    ),
  )

describe('package export condition controls', () => {
  it('checks all 67 predetermined targets and condition ordering', () => {
    expect(() =>
      assertPackageExportAllowlist(readPackage(), 'source'),
    ).not.toThrow()
  })

  it('admits only the predetermined materialized component owners and targets', () => {
    const manifest = readPackage()
    manifest.exports['./es/components/select'] = {
      import: {
        types: './es/components/select/index.d.mts',
        default: './es/components/select/index.mjs',
      },
    }
    manifest.exports['./lib/components/select'] = {
      types: './lib/components/select/index.d.ts',
      require: './lib/components/select/index.js',
    }
    expect(() =>
      assertPackageExportAllowlist(manifest, 'prepared', {
        componentDirectoryNames: ['select'],
      }),
    ).not.toThrow()
    expect(() => assertPackageExportAllowlist(manifest, 'source')).toThrow(
      /key allowlist/,
    )
    expect(() =>
      assertPackageExportAllowlist(manifest, 'prepared', {
        componentDirectoryNames: ['other'],
      }),
    ).toThrow(/key allowlist/)
    manifest.exports['./es/components/select'].import.types =
      './es/components/select/index.d.ts'
    expect(() =>
      assertPackageExportAllowlist(manifest, 'prepared', {
        componentDirectoryNames: ['select'],
      }),
    ).toThrow(/target drift/)
  })

  const mutations: [
    string,
    (manifest: ReturnType<typeof readPackage>) => void,
  ][] = [
    [
      'missing root',
      (p) => {
        delete p.exports['.']
      },
    ],
    [
      'additional authority',
      (p) => {
        p.exports['./extra'] = './es/index.mjs'
      },
    ],
    [
      'flat ESM condition',
      (p) => {
        p.exports['./es/index'] = {
          types: './es/index.d.mts',
          import: './es/index.mjs',
        }
      },
    ],
    [
      'wrong declaration format',
      (p) => {
        p.exports['./es/index'].import.types = './es/index.d.ts'
      },
    ],
    [
      'default before types',
      (p) => {
        p.exports['./es/index'].import = {
          default: './es/index.mjs',
          types: './es/index.d.mts',
        }
      },
    ],
    [
      'wrong ESM runtime target',
      (p) => {
        p.exports['./es/index'].import.default = './lib/index.js'
      },
    ],
    [
      'wrong CJS branch',
      (p) => {
        p.exports['.'].require = p.exports['.'].import
      },
    ],
    [
      'missing CJS types',
      (p) => {
        delete p.exports['.'].require.types
      },
    ],
    [
      'wrong CJS runtime target',
      (p) => {
        p.exports['./lib/index'].require = './es/index.mjs'
      },
    ],
    [
      'CJS require before types',
      (p) => {
        p.exports['./lib/index'] = {
          require: './lib/index.js',
          types: './lib/index.d.ts',
        }
      },
    ],
    [
      'compatibility declaration fallback order',
      (p) => {
        p.exports['./es/components/*'].import.types.reverse()
      },
    ],
    [
      'CJS fallback format',
      (p) => {
        p.exports['./lib/components/*'].types[0] = './lib/components/*.d.mts'
      },
    ],
    [
      'CSS native spelling',
      (p) => {
        p.exports['./dist/index.css'] = './dist/index'
      },
    ],
    [
      'ESM native extension target',
      (p) => {
        p.exports['./es/components/*.mjs'].import.default =
          './es/components/*.js'
      },
    ],
    [
      'CJS native extension target',
      (p) => {
        p.exports['./lib/components/*.js'].require = './lib/components/*.mjs'
      },
    ],
  ]
  it.each(mutations)('rejects %s', (_name, mutate) => {
    const manifest = readPackage()
    mutate(manifest)
    expect(() => assertPackageExportAllowlist(manifest, 'mutation')).toThrow()
  })
  it.each(['./*', './es/*.mjs', './es/*', './lib/*.js', './lib/*'])(
    'rejects broad export %s',
    (exportPath) => {
      const manifest = readPackage()
      manifest.exports[exportPath] = './es/index.mjs'
      expect(() => assertPackageExportAllowlist(manifest, 'mutation')).toThrow(
        /broad authority/,
      )
    },
  )
  it.each(['./es/wasm/*', './lib/wasm/*'])(
    'rejects unblocked WASM %s',
    (exportPath) => {
      const manifest = readPackage()
      manifest.exports[exportPath] = './es/wasm/*'
      expect(() => assertPackageExportAllowlist(manifest, 'mutation')).toThrow(
        /must block/,
      )
    },
  )
})

describe('published declaration owner controls', () => {
  const temporaryRoots: string[] = []
  afterEach(() => {
    for (const root of temporaryRoots.splice(0))
      rmSync(root, { recursive: true, force: true })
  })
  const fixture = (format: 'esm' | 'legacy' | 'cjs' = 'esm') => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'fsus-package-declaration-'))
    temporaryRoots.push(repoRoot)
    const packageRoot = join(repoRoot, 'dist', 'element-plus')
    const directory = format === 'cjs' ? 'lib' : 'es'
    const extension = format === 'esm' ? '.d.mts' : '.d.ts'
    const wrapper = `dist/element-plus/${directory}/wasm${extension}`
    const owner = `dist/element-plus/${directory}/wasm/index${extension}`
    mkdirSync(join(repoRoot, owner, '..'), { recursive: true })
    writeFileSync(
      join(repoRoot, wrapper),
      format === 'esm'
        ? 'export * from "./wasm/index.mjs";\n'
        : "export * from './wasm/index'\n",
    )
    writeFileSync(
      join(repoRoot, owner),
      'export type { MarkdownSafeHtml, MarkdownSafeRenderResult };\n',
    )
    return { repoRoot, packageRoot, wrapper, owner }
  }
  it.each(['esm', 'legacy', 'cjs'] as const)(
    'resolves the exact %s owner and final safe types',
    (format) => {
      const f = fixture(format)
      const result = resolveExactRelativeDeclarationTarget(f.wrapper, f)
      expect(result.targetRelativePath).toBe(f.owner)
      expect(() =>
        assertFinalSafeTypeExports(result.declaration, f.owner),
      ).not.toThrow()
    },
  )
  it.each([
    'export * from "./wasm/index";',
    'export * from "./wrong/index.mjs";',
    'export * from "../wasm/index.mjs";',
    'export * from "/wasm/index.mjs";',
    'export * from "./wasm/index.d.mts";',
    'export * from "./wasm/index.mjs"; export * from "./other.mjs";',
    'export { MarkdownSafeHtml } from "./wasm/index.mjs";',
    'export type * from "./wasm/index.mjs";',
    'export * from "./wasm/index.mjs" with { "resolution-mode": "import" };',
    'export * from "./wasm/index.mjs"; const extra = 1;',
    'export * from "./wasm/index.mjs',
  ])('rejects noncanonical wrapper %s', (source) => {
    const f = fixture()
    writeFileSync(join(f.repoRoot, f.wrapper), source)
    expect(() => resolveExactRelativeDeclarationTarget(f.wrapper, f)).toThrow()
  })
  it('rejects an ESM runtime spelling in a retained legacy declaration', () => {
    const f = fixture('legacy')
    writeFileSync(
      join(f.repoRoot, f.wrapper),
      'export * from "./wasm/index.mjs";',
    )
    expect(() => resolveExactRelativeDeclarationTarget(f.wrapper, f)).toThrow(
      /exact.*owner and format/,
    )
  })
  it.each(['missing', 'directory', 'symlink'] as const)(
    'rejects %s declaration owner',
    (kind) => {
      const f = fixture()
      rmSync(join(f.repoRoot, f.owner))
      if (kind === 'directory') mkdirSync(join(f.repoRoot, f.owner))
      if (kind === 'symlink')
        symlinkSync(join(f.repoRoot, f.wrapper), join(f.repoRoot, f.owner))
      expect(() =>
        resolveExactRelativeDeclarationTarget(f.wrapper, f),
      ).toThrow()
    },
  )
  it.each(['root', 'parent', 'wrapper'] as const)(
    'rejects %s symlink traversal',
    (kind) => {
      const f = fixture()
      const target =
        kind === 'root'
          ? f.packageRoot
          : kind === 'parent'
            ? join(f.packageRoot, 'es', 'wasm')
            : join(f.repoRoot, f.wrapper)
      const outside = join(f.repoRoot, 'outside')
      if (kind === 'wrapper')
        writeFileSync(outside, 'export * from "./wasm/index.mjs";')
      else mkdirSync(outside)
      rmSync(target, { recursive: true })
      symlinkSync(outside, target)
      expect(() => resolveExactRelativeDeclarationTarget(f.wrapper, f)).toThrow(
        /real directory|symbolic link/,
      )
    },
  )
  it.each([
    'dist/element-plus/../outside.d.ts',
    '/tmp/outside.d.ts',
    'C:\\outside.d.ts',
    'outside.d.ts',
  ])('rejects escaping file %s', (relativePath) => {
    const f = fixture()
    expect(() =>
      assertPublishedRegularFile(relativePath, 'missing', f),
    ).toThrow(/traversal-free|within/)
  })
  it.each([
    'export type { MarkdownSafeHtml };',
    'export type { MarkdownSafeRenderResult };',
    'export { MarkdownSafeHtml, MarkdownSafeRenderResult };',
    'export type { Other as MarkdownSafeHtml, MarkdownSafeRenderResult };',
    'export type { MarkdownSafeHtml, MarkdownSafeRenderResult }; export type { Other };',
  ])('rejects missing or renamed final safe types %s', (source) => {
    expect(() => assertFinalSafeTypeExports(source, 'mutation')).toThrow(
      /final type export/,
    )
  })
  it.each(['pkg/es/components', './empty-state/index.js'])(
    'rejects wrong export-all owner %s',
    (specifier) => {
      expect(() =>
        assertDeclarationExportAll(
          `export * from "${specifier}";`,
          'pkg/lib/components',
          'mutation',
        ),
      ).toThrow(/exact owner/)
    },
  )
  it('accepts printer quotes and semicolons without accepting duplicate owner exports', () => {
    expect(() =>
      assertDeclarationExportAll(
        'export * from "pkg/lib/components";',
        'pkg/lib/components',
        'control',
      ),
    ).not.toThrow()
    expect(() =>
      assertDeclarationExportAll(
        "export * from 'pkg/lib/components'; export * from 'pkg/lib/components';",
        'pkg/lib/components',
        'mutation',
      ),
    ).toThrow(/once/)
  })
  it.each([
    '/absolute/owner',
    'C:\\owner',
    '@element-plus/wasm',
    'worktree/owner',
    'FsusUI/owner',
  ])('rejects leaked owner %s', (owner) => {
    expect(() =>
      assertPortableDeclaration(`export * from '${owner}';`, 'mutation'),
    ).toThrow(/must not leak/)
  })
})
