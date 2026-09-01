import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { findStableAdapterLiteralViolations } from '../scripts/token-pipeline.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))

const renderTokenFixture = (tokens) => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'fsus-token-color-format-'),
  )
  try {
    const fixture = readJson('tests/fixtures/token-v2/schema-cases.json').valid
    fixture.layers.semantic.push('shadow.*')
    fixture.tokens.push(...tokens)

    fs.mkdirSync(path.join(fixtureRoot, 'scripts'), { recursive: true })
    fs.mkdirSync(path.join(fixtureRoot, 'spec/tokens'), { recursive: true })
    fs.copyFileSync(
      path.join(root, 'scripts/token-pipeline.mjs'),
      path.join(fixtureRoot, 'scripts/token-pipeline.mjs'),
    )
    fs.writeFileSync(
      path.join(fixtureRoot, 'spec/tokens/tokens.json'),
      `${JSON.stringify(fixture, null, 2)}\n`,
    )

    execFileSync(
      process.execPath,
      [path.join(fixtureRoot, 'scripts/token-pipeline.mjs'), 'generate'],
      { cwd: fixtureRoot, stdio: 'pipe' },
    )
    return {
      avaloniaXaml: fs.readFileSync(
        path.join(
          fixtureRoot,
          'dotnet/FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml',
        ),
        'utf8',
      ),
      csharp: fs.readFileSync(
        path.join(
          fixtureRoot,
          'dotnet/FsusUI.Avalonia/Generated/FsusTokens.g.cs',
        ),
        'utf8',
      ),
      webCss: fs.readFileSync(
        path.join(
          fixtureRoot,
          'vue/packages/theme-chalk/src/generated/tokens.css',
        ),
        'utf8',
      ),
    }
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true })
  }
}

test('every generated token carries complete source-to-consumer traceability', () => {
  const generated = readJson(
    'vue/packages/theme-chalk/src/generated/tokens.json',
  )

  for (const [name, token] of Object.entries(generated.tokens)) {
    assert.equal(token.traceability.canonicalName, name)
    assert.ok(token.traceability.runtimeAliases.includes(token.css))
    assert.ok(token.traceability.values.light)
    assert.ok(token.traceability.values.dark)
    assert.ok(token.traceability.usageSurface)
    assert.ok(token.traceability.owner)
    assert.equal(typeof token.traceability.consumerUse, 'boolean')
    assert.ok(token.traceability.generatedOutputs.length > 0)
    assert.ok(token.traceability.documentation)
    assert.ok(token.traceability.fixture)
    assert.equal(token.traceability.status, 'active')
    assert.equal(token.traceability.migrationStatus, 'none')
  }
})

test('stable adapter tokens reject unregistered visual literals', () => {
  const unregistered = [
    '--fsus-color-rogue: #123456;',
    '--fsus-radius-rogue: 8px;',
    '--fsus-space-rogue: 28px;',
    '--fsus-backdrop-rogue: 12px;',
    '--fsus-shadow-rogue: 0 2px 4px #000;',
    '--fsus-motion-rogue: 180ms;',
  ].join('\n')
  assert.equal(findStableAdapterLiteralViolations(unregistered).length, 6)
  assert.deepEqual(
    findStableAdapterLiteralViolations(
      '--fsus-space-5: 20px;\n--fsus-state-hover-bg: #2A599C0E;',
      'fixture.scss',
    ),
    [
      'fixture.scss:1 --fsus-space-5 must reference a generated canonical token, got 20px',
      'fixture.scss:2 --fsus-state-hover-bg must reference a generated canonical token, got #2A599C0E',
    ],
  )
  assert.deepEqual(
    findStableAdapterLiteralViolations(
      '--fsus-space-5: #{generated.$fsus-space-5};\n--fsus-state-hover-bg: var(--fsus-component-state-surface-hover-background);',
    ),
    [],
  )
})

test('keeps CSS colors as RRGGBBAA and renders Avalonia colors as AARRGGBB', () => {
  const output = renderTokenFixture([
    {
      name: 'primitive.color.alpha.600',
      type: 'color',
      value: '#11223344',
      description: 'Fixture alpha color.',
      platforms: ['web', 'avalonia'],
      modeValues: {
        dark: {
          value: '#AABBCCDD',
          fallback: 'primitive.color.alpha.600',
        },
      },
    },
    {
      name: 'component.overlay.scrim',
      type: 'color',
      value: '#00000099',
      description: 'Fixture 60 percent black scrim.',
      platforms: ['web', 'avalonia'],
    },
  ])

  assert.match(output.webCss, /--fsus-primitive-color-alpha-600: #11223344;/)
  assert.match(
    output.webCss,
    /\[data-fsus-theme="dark"\][\s\S]*--fsus-primitive-color-alpha-600: #AABBCCDD;/,
  )
  assert.match(output.webCss, /--fsus-component-overlay-scrim: #00000099;/)

  assert.match(
    output.avaloniaXaml,
    /<Color x:Key="FsusPrimitiveColorAlpha600">#44112233<\/Color>/,
  )
  assert.match(
    output.avaloniaXaml,
    /<Color x:Key="FsusPrimitiveColorAlpha600Dark">#DDAABBCC<\/Color>/,
  )
  assert.match(
    output.avaloniaXaml,
    /<Color x:Key="FsusComponentOverlayScrim">#99000000<\/Color>/,
  )
  assert.match(output.csharp, /PrimitiveColorAlpha600Value = "#44112233";/)
  assert.match(output.csharp, /PrimitiveColorAlpha600DarkValue = "#DDAABBCC";/)
  assert.match(output.csharp, /ComponentOverlayScrimValue = "#99000000";/)

  assert.match(
    output.avaloniaXaml,
    /<Color x:Key="FsusPrimitiveColorBlue600">#2A599C<\/Color>/,
  )
  assert.match(output.csharp, /PrimitiveColorBlue600Value = "#2A599C";/)
})

test('converts embedded 8-digit shadow colors for Avalonia and leaves 6-digit colors unchanged', () => {
  const output = renderTokenFixture([
    {
      name: 'shadow.fixture.alpha',
      type: 'shadow',
      value: '0 4px 12px #11223344, inset 0 0 0 1px #ABCDEF',
      description: 'Fixture shadow with alpha and opaque colors.',
      platforms: ['web', 'avalonia'],
      modeValues: {
        dark: {
          value: '0 8px 24px #AABBCCDD',
          fallback: 'shadow.fixture.alpha',
        },
      },
    },
  ])

  assert.match(
    output.webCss,
    /--fsus-shadow-fixture-alpha: 0 4px 12px #11223344, inset 0 0 0 1px #ABCDEF;/,
  )
  assert.match(
    output.avaloniaXaml,
    /<BoxShadows x:Key="FsusShadowFixtureAlpha">0 4 12 #44112233, inset 0 0 0 1 #ABCDEF<\/BoxShadows>/,
  )
  assert.match(
    output.csharp,
    /ShadowFixtureAlphaValue = "0 4 12 #44112233, inset 0 0 0 1 #ABCDEF";/,
  )
  assert.match(
    output.csharp,
    /BoxShadows\.Parse\("0 4 12 #44112233, inset 0 0 0 1 #ABCDEF"\)/,
  )
  assert.match(
    output.csharp,
    /ShadowFixtureAlphaDarkValue = "0 8 24 #DDAABBCC";/,
  )
})

test('defines the overlay scrim as 60 percent black in CSS and Avalonia', () => {
  const source = readJson('spec/tokens/tokens.json')
  const scrim = source.tokens.find(
    (token) => token.name === 'component.overlay.scrim',
  )
  assert.ok(scrim, 'component.overlay.scrim must exist in the canonical source')
  assert.equal(scrim.type, 'color')
  assert.equal(scrim.value, '#00000099')
  assert.equal(Number.parseInt(scrim.value.slice(7, 9), 16) / 255, 0.6)

  const webCss = fs.readFileSync(
    path.join(root, 'vue/packages/theme-chalk/src/generated/tokens.css'),
    'utf8',
  )
  const avaloniaXaml = fs.readFileSync(
    path.join(root, 'dotnet/FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml'),
    'utf8',
  )
  const csharp = fs.readFileSync(
    path.join(root, 'dotnet/FsusUI.Avalonia/Generated/FsusTokens.g.cs'),
    'utf8',
  )

  assert.match(webCss, /--fsus-component-overlay-scrim: #00000099;/)
  assert.match(
    avaloniaXaml,
    /<Color x:Key="FsusComponentOverlayScrim">#99000000<\/Color>/,
  )
  assert.match(
    avaloniaXaml,
    /<SolidColorBrush x:Key="FsusComponentOverlayScrimBrush" Color="#99000000" \/>/,
  )
  assert.match(csharp, /ComponentOverlayScrimValue = "#99000000";/)
})
