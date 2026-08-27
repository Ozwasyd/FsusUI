import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs'
import path from 'node:path'
import {
  AUTHORITY_REL,
  DEPENDENCY_FIELDS,
  listControlledManifests,
  loadAuthority,
} from './npm-authority-lib.mjs'

export const UPDATE_SURFACE_REL =
  'config/dependencies/update-surface.json'
export const UPDATE_SURFACE_SCHEMA_REL =
  'config/dependencies/update-surface.schema.json'
export const RENOVATE_REL = 'renovate.json5'
export const UPDATE_SURFACE_GENERATOR =
  'node scripts/generate-update-surface.mjs'

export const FIXED_GROUPS = [
  'vue-build-toolchain',
  'vue-runtime-dependencies',
  'js-test-quality-tooling',
  'npm-release-tooling',
  'avalonia-platform',
  'dotnet-test-performance',
  'wasm-toolchain',
  'node-dotnet-sdk-images',
  'github-actions',
  'dotnet-build-toolchain',
]

const NPM_PACKAGE_NAME_OVERRIDES = {
  '@popperjs/core': '@sxzz/popperjs-es',
}

const NPM_GROUP_MEMBERS = {
  'vue-runtime-dependencies': [
    '@ctrl/tinycolor',
    '@floating-ui/dom',
    '@popperjs/core',
    '@types/lodash',
    '@types/lodash-es',
    'async-validator',
    'dayjs',
    'escape-html',
    'gsap',
    'katex',
    'lodash',
    'lodash-es',
    'lodash-unified',
    'memoize-one',
    'mermaid',
    'motion-dom',
    'normalize-wheel-es',
    'shiki',
  ],
  'js-test-quality-tooling': [
    '@eslint/js',
    '@playwright/test',
    '@types/fs-extra',
    '@types/jsdom',
    '@types/node',
    '@vitest/coverage-v8',
    '@vitest/ui',
    '@vue/test-utils',
    'csstype',
    'eslint',
    'eslint-plugin-unicorn',
    'eslint-plugin-vue',
    'expect-type',
    'husky',
    'jsdom',
    'lint-staged',
    'prettier',
    'resize-observer-polyfill',
    'typescript-eslint',
    'vitest',
    'vue-eslint-parser',
  ],
  'npm-release-tooling': [
    '@changesets/cli',
    '@pnpm/find-workspace-packages',
    '@pnpm/logger',
    '@pnpm/types',
    'ajv',
    'concurrently',
    'npm-run-all',
    'octokit',
    'type-fest',
  ],
  'vue-build-toolchain': [
    '@esbuild-kit/cjs-loader',
    '@fontsource/google-sans',
    '@fontsource/noto-sans-sc',
    '@rollup/plugin-commonjs',
    '@rollup/plugin-json',
    '@rollup/plugin-node-resolve',
    '@types/gulp',
    '@types/gulp-autoprefixer',
    '@types/gulp-clean-css',
    '@types/gulp-rename',
    '@types/gulp-sass',
    '@types/sass',
    '@vitejs/plugin-vue',
    '@vitejs/plugin-vue-jsx',
    '@vue/shared',
    '@vue/tsconfig',
    'camelcase',
    'chalk',
    'components-helper',
    'consola',
    'esbuild',
    'esbuild-plugin-globals',
    'fast-glob',
    'fs-extra',
    'gulp',
    'gulp-autoprefixer',
    'gulp-clean-css',
    'gulp-rename',
    'gulp-sass',
    'localtunnel',
    'rimraf',
    'rollup',
    'rollup-plugin-esbuild',
    'sass',
    'svgo',
    'tinyglobby',
    'ts-morph',
    'tsx',
    'typescript',
    'unbuild',
    'unplugin-vue',
    'unplugin-vue-macros',
    'vite',
    'vue',
    'vue-router',
    'vue-tsc',
  ],
}

const NUGET_GROUPS = {
  Avalonia: 'avalonia-platform',
  'Avalonia.Desktop': 'avalonia-platform',
  'Avalonia.Headless.XUnit': 'avalonia-platform',
  'Avalonia.Themes.Fluent': 'avalonia-platform',
  'Microsoft.CodeAnalysis.CSharp': 'dotnet-build-toolchain',
  'Microsoft.NET.Test.Sdk': 'dotnet-test-performance',
  'coverlet.collector': 'dotnet-test-performance',
  xunit: 'dotnet-test-performance',
  'xunit.runner.visualstudio': 'dotnet-test-performance',
  'xunit.v3': 'dotnet-test-performance',
}

const EXCLUSIONS = [
  {
    id: 'generated-npm-authority-inventory',
    path: 'config/dependencies/npm-authority.inventory.json',
    field: '*',
    reason:
      'Generated evidence projected from npm-authority.json; the generator output is not an update target.',
    owner: 'dependency-governance',
    createdAt: '2026-08-27',
    reviewAfter: '2027-02-28',
    removalCondition:
      'Remove when the generated inventory is replaced by direct runtime discovery.',
  },
  {
    id: 'frozen-npm-migration-baseline',
    path: 'config/dependencies/migration-baseline.json',
    field: '*',
    reason:
      'Frozen zero-version-change migration evidence; current versions remain owned by npm-authority.json.',
    owner: 'dependency-governance',
    createdAt: '2026-08-27',
    reviewAfter: '2027-02-28',
    removalCondition:
      'Remove after the migration baseline retention requirement expires.',
  },
  {
    id: 'vue-public-api-package-fixture',
    path:
      'tests/fixtures/vue-public-api-baseline/vue/packages/element-plus/package.json',
    field: '*',
    reason:
      'Frozen input fixture for public API baseline mutation tests, not a consumable manifest.',
    owner: 'api-governance',
    createdAt: '2026-08-27',
    reviewAfter: '2027-02-28',
    removalCondition:
      'Remove if the fixture stops embedding an intentionally frozen package manifest.',
  },
  {
    id: 'renovate-custom-manager-negative-fixture',
    path: 'tests/fixtures/dependencies/renovate-custom-managers.json',
    field: 'negative',
    reason:
      'Intentional malformed and documentation-like examples used to prove custom managers do not over-match.',
    owner: 'dependency-governance',
    createdAt: '2026-08-27',
    reviewAfter: '2027-02-28',
    removalCondition:
      'Remove with the custom manager mutation suite.',
  },
  {
    id: 'npm-authority-documentation-examples',
    path: 'docs/ci/npm-authority.md',
    field: 'code-fences',
    reason:
      'Documentation examples explain the authority contract and are not executable version fields.',
    owner: 'dependency-governance',
    createdAt: '2026-08-27',
    reviewAfter: '2027-02-28',
    removalCondition:
      'Remove if the document no longer contains dependency-version examples.',
  },
  {
    id: 'form-generator-netstandard-contract',
    path:
      'dotnet/FsusUI.Avalonia.FormGenerator/FsusUI.Avalonia.FormGenerator.csproj',
    field: 'TargetFramework',
    reason:
      'netstandard2.0 is the frozen public analyzer compatibility target, not a floating runtime pin.',
    owner: 'avalonia-maintainers',
    createdAt: '2026-08-27',
    reviewAfter: '2027-02-28',
    removalCondition:
      'Remove only with an explicitly reviewed breaking analyzer compatibility change.',
  },
  {
    id: 'avalonia-aot-smoke-project-fixture',
    path: 'tests/fixtures/avalonia-aot-smoke/FsusUI.Avalonia.AotSmoke.csproj',
    field: '*',
    reason:
      'Local packed-package smoke input whose package sources and versions are controlled by the fixture test.',
    owner: 'avalonia-maintainers',
    createdAt: '2026-08-27',
    reviewAfter: '2027-02-28',
    removalCondition:
      'Remove if the fixture becomes a production-restored project.',
  },
  {
    id: 'avalonia-nuget-accidental-publication-fixture',
    path:
      'tests/fixtures/avalonia-nuget-stable/accidental-demo-publication.csproj',
    field: '*',
    reason:
      'Intentionally invalid NuGet publication fixture used by negative governance tests.',
    owner: 'avalonia-maintainers',
    createdAt: '2026-08-27',
    reviewAfter: '2027-02-28',
    removalCondition:
      'Remove with the negative NuGet publication fixture.',
  },
  {
    id: 'avalonia-nuget-missing-metadata-fixture',
    path:
      'tests/fixtures/avalonia-nuget-stable/missing-package-metadata.csproj',
    field: '*',
    reason:
      'Intentionally invalid missing-metadata fixture used by negative NuGet tests.',
    owner: 'avalonia-maintainers',
    createdAt: '2026-08-27',
    reviewAfter: '2027-02-28',
    removalCondition:
      'Remove with the negative NuGet metadata fixture.',
  },
  {
    id: 'avalonia-nuget-stale-notes-fixture',
    path:
      'tests/fixtures/avalonia-nuget-stable/stale-release-notes.props',
    field: '*',
    reason:
      'Intentionally stale release-note fixture used by negative NuGet tests.',
    owner: 'avalonia-maintainers',
    createdAt: '2026-08-27',
    reviewAfter: '2027-02-28',
    removalCondition:
      'Remove with the stale release-note negative fixture.',
  },
  {
    id: 'avalonia-packed-consumer-project-fixture',
    path:
      'tests/fixtures/avalonia-packed-consumer/FsusUI.Avalonia.PackedConsumerSample.csproj',
    field: '*',
    reason:
      'Local packed-package consumer input whose package versions are supplied by the fixture runner.',
    owner: 'avalonia-maintainers',
    createdAt: '2026-08-27',
    reviewAfter: '2027-02-28',
    removalCondition:
      'Remove if the fixture becomes a production-restored project.',
  },
]

function readText(root, relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

function readJson(root, relativePath) {
  return JSON.parse(readText(root, relativePath))
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/')
}

function walkFiles(root, relativeDir, predicate, output = []) {
  const absoluteDir = path.join(root, relativeDir)
  if (!existsSync(absoluteDir)) return output
  for (const name of readdirSync(absoluteDir)) {
    if (
      [
        '.git',
        '.pnpm-store',
        'artifacts',
        'bin',
        'coverage',
        'dist',
        'node_modules',
        'obj',
        'test-results',
      ].includes(name)
    ) {
      continue
    }
    const absolute = path.join(absoluteDir, name)
    const relative = toPosix(path.relative(root, absolute))
    const stat = statSync(absolute)
    if (stat.isDirectory()) {
      walkFiles(root, relative, predicate, output)
    } else if (predicate(relative)) {
      output.push(relative)
    }
  }
  return output
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) =>
    left.localeCompare(right),
  )
}

function npmGroup(authorityKey) {
  const groups = Object.entries(NPM_GROUP_MEMBERS)
    .filter(([, members]) => members.includes(authorityKey))
    .map(([group]) => group)
  if (groups.length !== 1) {
    throw new Error(
      `npm authority package ${authorityKey} must belong to exactly one group; found ${groups.join(', ') || 'none'}`,
    )
  }
  return groups[0]
}

function npmPackageName(authorityKey) {
  return NPM_PACKAGE_NAME_OVERRIDES[authorityKey] ?? authorityKey
}

function npmSurfaceEntries(root) {
  const authority = loadAuthority(root)
  const manifests = listControlledManifests(root).map((entry) => ({
    ...entry,
    manifest: readJson(root, entry.relative),
  }))

  return Object.keys(authority.install)
    .sort((left, right) => left.localeCompare(right))
    .map((authorityKey) => {
      const files = [AUTHORITY_REL, 'pnpm-lock.yaml']
      for (const { relative, manifest } of manifests) {
        if (
          DEPENDENCY_FIELDS.some(
            (field) => manifest[field]?.[authorityKey] !== undefined,
          )
        ) {
          files.push(relative)
        }
      }
      return {
        id: `npm-${slug(authorityKey)}`,
        datasource: 'npm',
        packageName: npmPackageName(authorityKey),
        authorityKey,
        manager: 'custom.jsonata',
        customManager: 'npm-authority',
        files: uniqueSorted(files),
        versioning: 'npm',
        group: npmGroup(authorityKey),
        stabilityPolicy: 'stable-only',
      }
    })
}

function projectFiles(root) {
  return walkFiles(
    root,
    'dotnet',
    (relative) => relative.endsWith('.csproj'),
  ).sort()
}

export function expectedNugetLockfiles(root) {
  return projectFiles(root).map((project) =>
    toPosix(path.join(path.dirname(project), 'packages.lock.json')),
  )
}

function nugetSurfaceEntries(root) {
  const centralPath = 'dotnet/Directory.Packages.props'
  const central = readText(root, centralPath)
  const packageNames = [
    ...central.matchAll(
      /<PackageVersion\s+Include="([^"]+)"\s+Version="[^"]+"\s*\/>/g,
    ),
  ].map((match) => match[1])

  const projects = projectFiles(root).map((relative) => ({
    relative,
    text: readText(root, relative),
  }))

  return packageNames
    .sort((left, right) => left.localeCompare(right))
    .map((packageName) => {
      const references = projects
        .filter(({ text }) =>
          new RegExp(
            `<PackageReference\\s+Include="${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"(?:\\s|/|>)`,
          ).test(text),
        )
        .map(({ relative }) => relative)
      const lockfiles = references.map((relative) =>
        toPosix(path.join(path.dirname(relative), 'packages.lock.json')),
      )
      const group = NUGET_GROUPS[packageName]
      if (!group) {
        throw new Error(`NuGet package ${packageName} has no semantic group`)
      }
      return {
        id: `nuget-${slug(packageName)}`,
        datasource: 'nuget',
        packageName,
        manager: 'nuget',
        files: uniqueSorted([centralPath, ...references, ...lockfiles]),
        versioning: 'nuget',
        group,
        stabilityPolicy: 'stable-only',
      }
    })
}

function yamlFiles(root) {
  return [
    ...walkFiles(
      root,
      '.github/workflows',
      (relative) => /\.ya?ml$/u.test(relative),
    ),
    ...walkFiles(
      root,
      '.github/actions',
      (relative) => /\/action\.ya?ml$/u.test(relative),
    ),
  ].sort()
}

function githubActionEntries(root) {
  const actionFiles = new Map()
  for (const relative of yamlFiles(root)) {
    const text = readText(root, relative)
    for (const match of text.matchAll(/\buses:\s*([^\s@]+)@([^\s#]+)/gu)) {
      const packageName = match[1]
      if (packageName.startsWith('./')) continue
      const files = actionFiles.get(packageName) ?? []
      files.push(relative)
      actionFiles.set(packageName, files)
    }
  }

  return [...actionFiles.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([packageName, files]) => ({
      id: `github-action-${slug(packageName)}`,
      datasource: 'github-tags',
      packageName,
      manager: 'github-actions',
      files: uniqueSorted(files),
      versioning: 'docker',
      group:
        packageName === 'emscripten-core/setup-emsdk'
          ? 'wasm-toolchain'
          : 'github-actions',
      stabilityPolicy: 'stable-only',
    }))
}

function filesContaining(root, relatives, pattern) {
  return relatives.filter((relative) =>
    pattern.test(readText(root, relative)),
  )
}

function toolchainEntries(root) {
  const workflows = walkFiles(
    root,
    '.github/workflows',
    (relative) => /\.ya?ml$/u.test(relative),
  ).sort()
  const nodeWorkflowFiles = filesContaining(
    root,
    workflows,
    /\bnode-version:\s*\d/u,
  )
  const emsdkFiles = filesContaining(
    root,
    workflows,
    /uses:\s*emscripten-core\/setup-emsdk@[^\s]+[\s\S]*?\bversion:\s*\d+\.\d+\.\d+/u,
  )
  const dotnetRuntimeFiles = projectFiles(root).filter((relative) =>
    /<TargetFramework>net\d+\.\d+<\/TargetFramework>/u.test(
      readText(root, relative),
    ),
  )
  if (
    /<TargetFramework>net\d+\.\d+<\/TargetFramework>/u.test(
      readText(root, 'dotnet/Directory.Build.props'),
    )
  ) {
    dotnetRuntimeFiles.push('dotnet/Directory.Build.props')
  }

  return [
    {
      id: 'dotnet-sdk',
      datasource: 'dotnet-version',
      packageName: 'dotnet-sdk',
      manager: 'nuget',
      files: ['dotnet/global.json'],
      versioning: 'loose',
      group: 'node-dotnet-sdk-images',
      stabilityPolicy: 'stable-only',
    },
    {
      id: 'dotnet-runtime-target-framework',
      datasource: 'dotnet-version',
      packageName: 'dotnet-runtime',
      manager: 'custom.regex',
      customManager: 'dotnet-target-framework',
      files: uniqueSorted(dotnetRuntimeFiles),
      versioning: 'loose',
      group: 'node-dotnet-sdk-images',
      stabilityPolicy: 'stable-only',
    },
    {
      id: 'node-runtime',
      datasource: 'node-version',
      packageName: 'node',
      manager: 'custom.regex',
      customManager: 'node-version-pins',
      files: ['.nvmrc', 'package.json'],
      versioning: 'node',
      group: 'node-dotnet-sdk-images',
      stabilityPolicy: 'stable-only',
    },
    {
      id: 'github-actions-node-runtime',
      datasource: 'node-version',
      packageName: 'actions/node-versions',
      manager: 'github-actions',
      files: uniqueSorted(nodeWorkflowFiles),
      versioning: 'node',
      group: 'node-dotnet-sdk-images',
      stabilityPolicy: 'stable-only',
    },
    {
      id: 'pnpm-package-manager',
      datasource: 'npm',
      packageName: 'pnpm',
      manager: 'custom.regex',
      customManager: 'pnpm-package-manager',
      files: [
        'package.json',
        'vue/tests/consumer-install/template/package.json',
      ],
      versioning: 'npm',
      group: 'npm-release-tooling',
      stabilityPolicy: 'stable-only',
    },
    {
      id: 'emsdk-toolchain',
      datasource: 'github-releases',
      packageName: 'emscripten-core/emsdk',
      manager: 'custom.regex',
      customManager: 'emsdk-version-input',
      files: uniqueSorted(emsdkFiles),
      versioning: 'semver-coerced',
      group: 'wasm-toolchain',
      stabilityPolicy: 'stable-only',
    },
  ]
}

function dockerEntries(root) {
  const dockerfiles = walkFiles(root, '.', (relative) =>
    /(^|\/)Dockerfile(?:\.[^/]+)?$/u.test(relative),
  )
  const images = new Map()
  for (const relative of dockerfiles) {
    const text = readText(root, relative)
    for (const match of text.matchAll(
      /^\s*FROM\s+([^\s:@]+(?:\/[^\s:@]+)*)(?::([^\s@]+))?(?:@sha256:[a-f0-9]+)?/gimu,
    )) {
      const packageName = match[1]
      const files = images.get(packageName) ?? []
      files.push(relative)
      images.set(packageName, files)
    }
  }
  return [...images.entries()].map(([packageName, files]) => ({
    id: `docker-${slug(packageName)}`,
    datasource: 'docker',
    packageName,
    manager: 'dockerfile',
    files: uniqueSorted(files),
    versioning: 'docker',
    group: 'node-dotnet-sdk-images',
    stabilityPolicy: 'stable-only',
  }))
}

export function buildExpectedUpdateSurface(root) {
  const surfaces = [
    ...npmSurfaceEntries(root),
    ...nugetSurfaceEntries(root),
    ...toolchainEntries(root),
    ...githubActionEntries(root),
    ...dockerEntries(root),
  ].sort((left, right) => left.id.localeCompare(right.id))

  return {
    schemaVersion: 2,
    generatedBy: UPDATE_SURFACE_GENERATOR,
    surfaces,
    exclusions: EXCLUSIONS,
    governance: {
      automerge: false,
      majorEnabled: true,
      minorEnabled: true,
      patchEnabled: true,
      digestEnabled: true,
      lockfileMaintenanceEnabled: true,
      permanentIgnoreCount: 0,
    },
  }
}

export function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function packageGroupsFromSurface(surface) {
  const groups = new Map()
  for (const entry of surface.surfaces ?? []) {
    const names = new Set([
      entry.packageName,
      ...(entry.authorityKey ? [entry.authorityKey] : []),
    ])
    for (const name of names) {
      const existing = groups.get(name)
      if (existing && existing !== entry.group) {
        throw new Error(
          `package ${name} maps to both ${existing} and ${entry.group}`,
        )
      }
      groups.set(name, entry.group)
    }
  }
  return groups
}
