import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const requiredBaselineCases = [
  'latin-body',
  'simplified-chinese-body',
  'punctuation-density',
  'tabular-numbers',
  'code-monospace',
  'mixed-cjk-latin-label',
]

const requiredSnapshotMetrics = [
  'textSize',
  'baseline',
  'lineHeight',
  'wrapping',
  'ellipsis',
  'mixedLanguage',
  'visualRegression',
]

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8')

const readJson = (relativePath) => JSON.parse(read(relativePath))

const exists = (relativePath) => fs.existsSync(path.join(root, relativePath))

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const assertIncludes = (content, expected, file) => {
  assert(content.includes(expected), `${file} must include ${expected}`)
}

const splitFontStack = (stack) =>
  String(stack)
    .split(',')
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)

const loadTokenValue = (tokenName) => {
  const tokens = readJson('spec/tokens/tokens.json')
  const token = tokens.tokens.find((item) => item.name === tokenName)
  assert(token, `missing token ${tokenName}`)
  return token.value
}

const validateBaseline = () => {
  const file = 'spec/typography/baseline.json'
  assert(exists(file), `${file} missing`)
  const baseline = readJson(file)

  for (const section of [
    'fontStacks',
    'fallbackBehavior',
    'cjkHandling',
    'lineHeightStrategy',
    'measurementBaselines',
    'platformThresholds',
    'fontWeights',
  ]) {
    assert(baseline[section], `${file} missing ${section}`)
  }

  for (const key of ['body', 'monospace']) {
    const stack = baseline.fontStacks[key]
    assert(stack?.css, `${file} missing fontStacks.${key}.css`)
    assert(
      Array.isArray(stack.avaloniaFallbacks) && stack.avaloniaFallbacks.length,
      `${file} missing fontStacks.${key}.avaloniaFallbacks`,
    )
  }

  const bodyToken = loadTokenValue('typography.family.body')
  const monospaceToken = loadTokenValue('typography.family.monospace')
  assert(
    bodyToken === baseline.fontStacks.body.css,
    'typography.family.body must match spec/typography/baseline.json',
  )
  assert(
    monospaceToken === baseline.fontStacks.monospace.css,
    'typography.family.monospace must match spec/typography/baseline.json',
  )

  const stableWeights = baseline.fontWeights.stable
  assert(
    Array.isArray(stableWeights) && stableWeights.join(',') === '400,500,700',
    `${file} fontWeights.stable must declare 400, 500, and 700`,
  )
  for (const [family, weights] of Object.entries(
    baseline.fontWeights.bundledFamilies ?? {},
  )) {
    assert(
      stableWeights.every((weight) => weights.includes(weight)),
      `${file} bundled family ${family} must provide every stable weight`,
    )
  }
  assert(
    loadTokenValue('typography.body.md.weight') === String(stableWeights[0]) &&
      loadTokenValue('typography.weight.medium') === String(stableWeights[1]) &&
      loadTokenValue('typography.weight.bold') === String(stableWeights[2]),
    'typography weight tokens must match the declared stable font weights',
  )

  const caseIds = new Set(
    baseline.measurementBaselines.map((testCase) => testCase.id),
  )
  for (const id of requiredBaselineCases) {
    assert(caseIds.has(id), `${file} missing measurement case ${id}`)
  }
}

const validateSnapshots = () => {
  const file = 'tests/fixtures/typography-baseline/text-metrics.json'
  assert(exists(file), `${file} missing`)
  const snapshots = readJson(file)

  for (const metric of requiredSnapshotMetrics) {
    assert(snapshots[metric], `${file} missing ${metric}`)
    assert(
      Array.isArray(snapshots[metric].cases) &&
        snapshots[metric].cases.length > 0,
      `${file} ${metric} must contain cases`,
    )
  }

  const baseline = readJson('spec/typography/baseline.json')
  const visualCases = snapshots.visualRegression.cases
  for (const language of ['latin', 'cjk']) {
    for (const theme of ['light', 'dark']) {
      for (const weight of baseline.fontWeights.stable) {
        assert(
          visualCases.some(
            (testCase) =>
              testCase.language === language &&
              testCase.theme === theme &&
              testCase.weight === weight &&
              testCase.fontSynthesis === 'none',
          ),
          `${file} missing ${language}/${theme}/${weight} real-weight visual fixture`,
        )
      }
    }
  }
}

const validateGeneratedOutputs = () => {
  const baseline = readJson('spec/typography/baseline.json')
  const generatedCss = read('vue/packages/theme-chalk/src/generated/tokens.css')
  const generatedXaml = read(
    'dotnet/FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml',
  )
  const generatedCsharp = read(
    'dotnet/FsusUI.Avalonia/Generated/FsusTokens.g.cs',
  )

  assertIncludes(
    generatedCss,
    `--fsus-typography-family-body: ${baseline.fontStacks.body.css};`,
    'vue/packages/theme-chalk/src/generated/tokens.css',
  )
  assertIncludes(
    generatedCss,
    `--fsus-typography-family-monospace: ${baseline.fontStacks.monospace.css};`,
    'vue/packages/theme-chalk/src/generated/tokens.css',
  )
  assertIncludes(
    generatedXaml,
    '<FontFamily x:Key="FsusTypographyFamilyBody">',
    'dotnet/FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml',
  )
  assertIncludes(
    generatedXaml,
    '<FontFamily x:Key="FsusTypographyFamilyMonospace">',
    'dotnet/FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml',
  )
  assertIncludes(
    generatedCsharp,
    'public static FontFamily TypographyFamilyMonospaceFontFamily',
    'dotnet/FsusUI.Avalonia/Generated/FsusTokens.g.cs',
  )
}

const scanStableFontFamilies = () => {
  const baseline = readJson('spec/typography/baseline.json')
  const allowed = new Set([
    ...splitFontStack(baseline.fontStacks.body.css),
    ...splitFontStack(baseline.fontStacks.monospace.css),
    ...(baseline.allowedAliases ?? []),
  ])
  const files = [
    'vue/packages/theme-chalk/src/common/var.scss',
    'vue/packages/theme-chalk/src/fsus-theme.scss',
    'vue/packages/theme-chalk/src/markdown-editor.scss',
    'vue/packages/theme-chalk/src/settings-primitives.scss',
    'vue/packages/wasm/markdown/src/markdown_mermaid.cpp',
    'dotnet/FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml',
    'dotnet/FsusUI.Avalonia/Generated/FsusTokens.g.cs',
  ]
  const failures = []
  const familyPattern = /font-family\s*:\s*([^;]+);/gims
  const quotedPattern = /'([^']+)'|"([^"]+)"/g

  for (const file of files) {
    const content = read(file)
    for (const match of content.matchAll(familyPattern)) {
      const lineStart = content.lastIndexOf('\n', match.index) + 1
      const prefix = content.slice(lineStart, match.index)
      if (prefix.includes('$')) continue

      const declaration = match[1]
      if (/var\(|getCssVar\(|inherit|initial/.test(declaration)) continue
      for (const familyMatch of declaration.matchAll(quotedPattern)) {
        const family = familyMatch[1] ?? familyMatch[2]
        if (!allowed.has(family)) {
          failures.push(`${file} uses undocumented font family ${family}`)
        }
      }
    }
  }

  if (failures.length) {
    throw new Error(
      `Typography font-family check failed:\n${failures.join('\n')}`,
    )
  }
}

const walkFiles = (directory, extension, files = []) => {
  for (const entry of fs.readdirSync(path.join(root, directory), {
    withFileTypes: true,
  })) {
    const relativePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      walkFiles(relativePath, extension, files)
    } else if (entry.name.endsWith(extension)) {
      files.push(relativePath)
    }
  }
  return files
}

const scanStableFontWeights = () => {
  const baseline = readJson('spec/typography/baseline.json')
  const allowed = new Set(baseline.fontWeights.stable.map(String))
  const files = [
    ...walkFiles('vue/packages/theme-chalk/src', '.scss'),
    'vue/packages/demo-app/src/style.css',
  ]
  const failures = []

  for (const file of files) {
    const content = read(file)
    for (const match of content.matchAll(/font-weight\s*:\s*(\d{3})\s*;/g)) {
      if (!allowed.has(match[1])) {
        failures.push(`${file} uses unavailable font weight ${match[1]}`)
      }
    }
  }

  const demoEntry = read('vue/packages/demo-app/src/main.ts')
  for (const [family, weights] of Object.entries(
    baseline.fontWeights.bundledFamilies,
  )) {
    const slug = family.toLowerCase().replaceAll(' ', '-')
    for (const weight of weights) {
      assertIncludes(
        demoEntry,
        `@fontsource/${slug}/${weight}.css`,
        'vue/packages/demo-app/src/main.ts',
      )
    }
  }
  assertIncludes(
    read('vue/packages/demo-app/src/style.css'),
    'font-synthesis: none;',
    'vue/packages/demo-app/src/style.css',
  )

  if (failures.length) {
    throw new Error(
      `Typography font-weight check failed:\n${failures.join('\n')}`,
    )
  }
}

try {
  validateBaseline()
  validateSnapshots()
  validateGeneratedOutputs()
  scanStableFontFamilies()
  scanStableFontWeights()
  console.log('typography baseline check passed')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
