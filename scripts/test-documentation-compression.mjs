import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  appendFileSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '..')
const checker = path.join(scriptDirectory, 'check-documentation-compression.mjs')
const designSource = path.join(repositoryRoot, 'docs/design.md')
const tick = String.fromCharCode(96)
const fence = tick.repeat(3)

const runGit = (cwd, args) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const write = (root, relativePath, content) => {
  const absolute = path.join(root, relativePath)
  mkdirSync(path.dirname(absolute), { recursive: true })
  writeFileSync(absolute, content)
}

const fixtureFiles = {
  'docs/components/overview.md': `# Components\n\n- [Button](./button.md)\n`,
  'docs/components/button.md': `# Button\n\n## Attributes\n\nThe ${tick}size${tick} prop is optional.\n\n${fence}ts\nconst button = new FsusButtonUnique({ size: 'small' })\n${fence}\n`,
  'docs/reference.md': `# Reference\n\nThe ${tick}FsusButton${tick} API must not persist user data.\n\nSee [Button](./components/button.md#attributes).\n\n${fence}bash\npnpm run check:documentation-compression\necho stable-example-marker\n${fence}\n`,
  'tests/fixtures/markdown-links.md': `# Fixture\n\n![fixture](./missing-image.png)\n`,
  'docs/avalonia/components/button.md': `# Button\n\nComponent ID: ${tick}button${tick}\n\n## Avalonia API\n\n## Vue Contract Mapping\n\n## Supported Platform Differences\n\n## Theme Tokens\n\n## Minimal Avalonia Example\n\n${fence}csharp\nvar button = new FsusButton();\n${fence}\n\n## Known Limitations\n`,
}

const createFixture = () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'fsusui-documentation-compression-'))
  mkdirSync(path.join(root, 'docs'), { recursive: true })
  copyFileSync(designSource, path.join(root, 'docs/design.md'))
  for (const [relativePath, content] of Object.entries(fixtureFiles)) write(root, relativePath, content)

  runGit(root, ['init', '-q'])
  runGit(root, ['config', 'user.email', 'compression-checker@example.invalid'])
  runGit(root, ['config', 'user.name', 'Documentation Compression Checker'])
  runGit(root, ['add', '.'])
  runGit(root, ['commit', '-qm', 'fixture baseline'])
  return root
}

const runChecker = (root, extra = []) =>
  spawnSync(process.execPath, [checker, '--root', root, '--json', ...extra], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })

const outputOf = (result) => `${result.stdout}\n${result.stderr}`

const assertPasses = (root, label) => {
  const result = runChecker(root)
  assert.equal(result.status, 0, `${label}:\n${outputOf(result)}`)
  const report = JSON.parse(result.stdout)
  assert.equal(report.ok, true, `${label}: checker report was not ok`)
  return report
}

const assertFailsWith = (root, pattern, label) => {
  const result = runChecker(root)
  assert.notEqual(result.status, 0, `${label}: checker unexpectedly passed`)
  const output = outputOf(result)
  assert.match(output, pattern, `${label}: unexpected diagnostic\n${output}`)
}

const cases = []

try {
  {
    const root = createFixture()
    try {
      const report = assertPasses(root, 'baseline fixture')
      assert.equal(report.summary.frozen.actualSha256, report.summary.frozen.expectedSha256)
      assert.ok(report.summary.links.baselineExceptions >= 2)
      assert.ok(
        report.summary.links.exceptionDetails.some(
          ({ file }) => file === 'tests/fixtures/markdown-links.md',
        ),
      )
      assert.equal(report.summary.avalonia.checked, 1)
      assert.equal(report.summary.componentsOverview.checked, 1)
      cases.push('baseline')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }

  {
    const root = createFixture()
    try {
      appendFileSync(path.join(root, 'docs/reference.md'), '\n[Missing](./does-not-exist.md)\n')
      assertFailsWith(root, /links to .*missing/u, 'missing link')
      cases.push('missing-link')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }

  {
    const root = createFixture()
    try {
      appendFileSync(path.join(root, 'docs/reference.md'), '\n[Missing anchor](./components/button.md#missing)\n')
      assertFailsWith(root, /missing anchor #missing/u, 'missing anchor')
      cases.push('missing-anchor')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }

  {
    const root = createFixture()
    try {
      const file = path.join(root, 'docs/avalonia/components/button.md')
      writeFileSync(file, readFileSync(file, 'utf8').replace('## Theme Tokens\n', ''))
      assertFailsWith(root, /missing ## Theme Tokens/u, 'Avalonia heading')
      cases.push('avalonia-heading')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }

  {
    const root = createFixture()
    try {
      const file = path.join(root, 'docs/components/overview.md')
      writeFileSync(file, '# Components\n')
      assertFailsWith(root, /overview\.md missing link to docs\/components\/button\.md/u, 'component overview')
      cases.push('component-overview')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }

  {
    const root = createFixture()
    try {
      const file = path.join(root, 'docs/design.md')
      appendFileSync(file, '\nMutation\n')
      assertFailsWith(root, /docs\/design\.md SHA-256 changed/u, 'frozen design')
      cases.push('frozen-design')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }

  {
    const root = createFixture()
    try {
      const file = path.join(root, 'tests/fixtures/markdown-links.md')
      appendFileSync(file, '\nFixture mutation\n')
      assertFailsWith(root, /preserved file changed: tests\/fixtures\/markdown-links\.md/u, 'preserved fixture')
      cases.push('preserved-fixture')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }

  {
    const root = createFixture()
    try {
      const file = path.join(root, 'docs/components/button.md')
      const before = readFileSync(file, 'utf8')
      writeFileSync(file, before.replace('FsusButton', 'FsusLink'))
      assertFailsWith(root, /protected (?:api|technical) removed/u, 'protected API')
      cases.push('protected-api')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }

  {
    const root = createFixture()
    try {
      const file = path.join(root, 'docs/reference.md')
      const before = readFileSync(file, 'utf8')
      writeFileSync(file, before.replace('must not', 'should'))
      assertFailsWith(root, /normative (?:should increased|atom removed)/u, 'normative strength')
      cases.push('normative-strength')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }

  {
    const root = createFixture()
    try {
      const file = path.join(root, 'docs/reference.md')
      appendFileSync(file, '\n```ts\nconst uniqueFenceValue = 1\n')
      assertFailsWith(root, /unclosed .*fence/u, 'unclosed code fence')
      cases.push('code-fence')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }

  {
    const root = createFixture()
    try {
      const file = path.join(root, 'docs/reference.md')
      const before = readFileSync(file, 'utf8')
      // Remove a command from an example while shrinking the corpus, so the
      // protected-entity diagnostic is exercised before the compression
      // ratchet can mask it.
      writeFileSync(
        file,
        before
          .replace('stable-example-marker', 'changed-example-marker')
          .replace('pnpm run check:documentation-compression\n', ''),
      )
      assertFailsWith(
        root,
        /protected command removed/u,
        'protected example content',
      )
      cases.push('protected-example')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }

  {
    const root = createFixture()
    try {
      const file = path.join(root, 'docs/reference.md')
      appendFileSync(file, '\nextra words increase the corpus\n')
      assertFailsWith(root, /edited Markdown corpus did not achieve a net reduction/u, 'compression ratchet')
      cases.push('compression-ratchet')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exitCode = 1
}

if (!process.exitCode) {
  console.log(`[documentation-compression-fixtures] ${cases.join(' ')}`)
}
