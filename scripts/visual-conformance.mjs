import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const generatedBy = 'scripts/visual-conformance.mjs'
const fixturePath = 'tests/conformance/visual/fixtures/visual-comparisons.json'
const invalidFixturePath = 'tests/fixtures/visual-regression/invalid-cases.json'

const requiredFixtureFields = [
  'theme',
  'density',
  'variant',
  'size',
  'state',
  'locale',
  'direction',
  'motionMode',
]

const metricLabels = {
  geometry: 'geometry delta',
  colorDelta: 'color delta',
  radius: 'radius delta',
  spacing: 'spacing delta',
  textBaseline: 'text baseline delta',
  screenshotDiffPercent: 'screenshot diff percentage',
  perceptualDelta: 'perceptual delta',
}

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8')

const readJson = (relativePath) => JSON.parse(read(relativePath))

const sha256 = (content) =>
  crypto.createHash('sha256').update(content).digest('hex')

const toPosix = (value) => value.split(path.sep).join('/')

const parseValue = (value) => {
  const trimmed = value.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return trimmed.replace(/^['"]|['"]$/g, '')
}

const parseOverrideFile = (relativePath) => {
  const entries = []
  let current
  let pendingKey
  const absolutePath = path.join(root, relativePath)
  for (const line of fs.readFileSync(absolutePath, 'utf8').split('\n')) {
    const start = line.match(/^ {2}- id:\s*(.+)$/)
    if (start) {
      pendingKey = undefined
      current = {
        id: parseValue(start[1]),
        file: toPosix(path.relative(root, absolutePath)),
      }
      entries.push(current)
      continue
    }
    if (!current) continue
    if (pendingKey) {
      const continuation = line.match(/^ {6,}(.+)$/)
      if (continuation) {
        current[pendingKey] = parseValue(continuation[1])
        pendingKey = undefined
        continue
      }
    }
    const field = line.match(/^ {4}([A-Za-z][A-Za-z0-9]*):\s*(.*)$/)
    if (field) {
      if (field[2].trim() === '') {
        pendingKey = field[1]
      } else {
        current[field[1]] = parseValue(field[2])
        pendingKey = undefined
      }
    }
  }
  return entries
}

const collectVisualOverrides = () => {
  const overrideRoot = path.join(root, 'spec/platform-overrides')
  return fs
    .readdirSync(overrideRoot)
    .filter((file) => file.endsWith('.yaml'))
    .sort()
    .flatMap((file) =>
      parseOverrideFile(`spec/platform-overrides/${file}`).filter((entry) =>
        ['visual', 'typography'].includes(entry.area),
      ),
    )
}

const maxAbsDelta = (a, b, keys) =>
  keys.reduce(
    (max, key) => Math.max(max, Math.abs(Number(a[key]) - Number(b[key]))),
    0,
  )

const colorDelta = (a, b) =>
  Math.sqrt(
    a.reduce((sum, value, index) => {
      const diff = Number(value) - Number(b[index])
      return sum + diff * diff
    }, 0),
  )

const ensureVisualCapture = (comparison, side, capture, artifactRoot) => {
  const prefix = `${comparison.id}:${side}`
  if (!['web', 'avalonia'].includes(capture.platform)) {
    throw new Error(`${prefix} uses unsupported platform ${capture.platform}`)
  }
  if (capture.platform === 'web' && capture.runner !== 'playwright') {
    throw new Error(`${prefix} web capture must use Playwright`)
  }
  if (
    capture.platform === 'avalonia' &&
    !['headless-skia', 'real-window'].includes(capture.runner)
  ) {
    throw new Error(
      `${prefix} Avalonia capture must use Headless Skia or real window`,
    )
  }
  if (!capture.screenshot?.startsWith(`${artifactRoot}/screenshots/`)) {
    throw new Error(
      `${prefix} screenshot artifact must be under ${artifactRoot}/screenshots`,
    )
  }
}

const ensureFixtureDimensions = (comparison) => {
  for (const field of requiredFixtureFields) {
    if (!comparison.fixture?.[field]) {
      throw new Error(`${comparison.id} fixture missing ${field}`)
    }
  }
}

const ensureComparisonMode = (comparison) => {
  if (!['samePlatform', 'crossPlatform'].includes(comparison.mode)) {
    throw new Error(
      `${comparison.id} uses unsupported comparison mode ${comparison.mode}`,
    )
  }
  const platforms = new Set([
    comparison.baseline.platform,
    comparison.candidate.platform,
  ])
  if (comparison.mode === 'samePlatform' && platforms.size !== 1) {
    throw new Error(`${comparison.id} same-platform comparison mixes platforms`)
  }
  if (
    comparison.mode === 'crossPlatform' &&
    !(platforms.has('web') && platforms.has('avalonia'))
  ) {
    throw new Error(
      `${comparison.id} cross-platform comparison must include Web and Avalonia`,
    )
  }
}

const computeDeltas = (comparison) => ({
  geometry: maxAbsDelta(
    comparison.baseline.geometry,
    comparison.candidate.geometry,
    ['x', 'y', 'width', 'height'],
  ),
  colorDelta: colorDelta(
    comparison.baseline.color.lab,
    comparison.candidate.color.lab,
  ),
  radius: Math.abs(comparison.baseline.radius - comparison.candidate.radius),
  spacing: maxAbsDelta(
    comparison.baseline.spacing,
    comparison.candidate.spacing,
    ['paddingX', 'paddingY', 'gap'],
  ),
  textBaseline: Math.abs(
    comparison.baseline.textBaseline - comparison.candidate.textBaseline,
  ),
  screenshotDiffPercent: comparison.screenshotDiffPercent,
  perceptualDelta: comparison.perceptualDelta,
})

const getThreshold = (thresholds, mode, metric) => {
  const threshold = thresholds[mode]?.[metric]
  if (typeof threshold !== 'number') {
    throw new Error(`${mode} missing ${metric} threshold`)
  }
  return threshold
}

const findOverride = (comparison, overrides) => {
  if (!comparison.overrideId) return undefined
  return overrides.find((override) => override.id === comparison.overrideId)
}

const overrideAllows = (comparison, override, metric, delta, thresholds) => {
  if (!override) return false
  if (override.status !== 'accepted') return false
  if (!['visual', 'typography'].includes(override.area)) return false
  if (
    override.component !== 'all' &&
    override.component !== comparison.component
  ) {
    return false
  }
  const platforms = [
    comparison.baseline.platform,
    comparison.candidate.platform,
  ]
  if (override.platform !== 'all' && !platforms.includes(override.platform)) {
    return false
  }
  const level = override.allowedDeviation || override.visualThreshold
  const budget = thresholds.levels?.[level]?.[metric]
  return typeof budget === 'number' && delta <= budget
}

const evaluateComparison = (comparison, fixture, overrides) => {
  ensureFixtureDimensions(comparison)
  ensureVisualCapture(
    comparison,
    'baseline',
    comparison.baseline,
    fixture.artifactRoot,
  )
  ensureVisualCapture(
    comparison,
    'candidate',
    comparison.candidate,
    fixture.artifactRoot,
  )
  ensureComparisonMode(comparison)

  const deltas = computeDeltas(comparison)
  const override = findOverride(comparison, overrides)
  const failures = []
  const allowedByOverride = []

  for (const [metric, delta] of Object.entries(deltas)) {
    const threshold = getThreshold(fixture.thresholds, comparison.mode, metric)
    if (delta <= threshold) continue
    if (
      overrideAllows(comparison, override, metric, delta, fixture.thresholds)
    ) {
      allowedByOverride.push({
        metric,
        delta,
        threshold,
        overrideId: override.id,
      })
      continue
    }
    failures.push(
      `${comparison.id} ${metricLabels[metric]} exceeded ${threshold}: ${delta}; component=${comparison.component}; state=${comparison.fixture.state}; platform=${comparison.baseline.platform}->${comparison.candidate.platform}; token=${comparison.token}; screenshot=${comparison.candidate.screenshot}`,
    )
  }

  if (comparison.overrideId && !override) {
    failures.push(
      `${comparison.id} unregistered visual override ${comparison.overrideId}; component=${comparison.component}; state=${comparison.fixture.state}; platform=${comparison.baseline.platform}->${comparison.candidate.platform}; token=${comparison.token}; screenshot=${comparison.candidate.screenshot}`,
    )
  }

  return {
    id: comparison.id,
    component: comparison.component,
    state: comparison.fixture.state,
    mode: comparison.mode,
    platform: `${comparison.baseline.platform}->${comparison.candidate.platform}`,
    token: comparison.token,
    screenshotArtifact: comparison.candidate.screenshot,
    diffArtifact: `${fixture.artifactRoot}/diffs/${comparison.id}.json`,
    deltas,
    thresholds: fixture.thresholds[comparison.mode],
    allowedByOverride,
    passed: failures.length === 0,
    failures,
  }
}

const validateInvalidFixtures = (fixture, overrides) => {
  const invalid = readJson(invalidFixturePath)
  for (const testCase of invalid.cases ?? []) {
    let message = ''
    try {
      const result = evaluateComparison(testCase.comparison, fixture, overrides)
      message = result.failures.join('\n')
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    if (!message.includes(testCase.expectedError)) {
      throw new Error(
        `${testCase.name} expected ${testCase.expectedError}, got ${message || 'success'}`,
      )
    }
  }
}

const renderApprovedBaselines = (fixture, results) =>
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedBy,
      fixtureSource: {
        path: fixturePath,
        sha256: sha256(read(fixturePath)),
      },
      artifactRoot: fixture.artifactRoot,
      thresholds: fixture.thresholds,
      captures: fixture.comparisons.map((comparison) => ({
        id: comparison.id,
        component: comparison.component,
        fixture: comparison.fixture,
        token: comparison.token,
        baseline: comparison.baseline,
        candidate: comparison.candidate,
      })),
      approvedComparisons: results.map((result) => ({
        id: result.id,
        mode: result.mode,
        platform: result.platform,
        diffArtifact: result.diffArtifact,
      })),
    },
    null,
    2,
  )}\n`

const renderDiffReport = (fixture, results) =>
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedBy,
      artifactRoot: fixture.artifactRoot,
      summary: {
        total: results.length,
        passed: results.filter((result) => result.passed).length,
        allowedByOverride: results.reduce(
          (count, result) => count + result.allowedByOverride.length,
          0,
        ),
      },
      comparisons: results,
    },
    null,
    2,
  )}\n`

const renderAll = () => {
  const fixture = readJson(fixturePath)
  const overrides = collectVisualOverrides()
  validateInvalidFixtures(fixture, overrides)
  const results = fixture.comparisons.map((comparison) =>
    evaluateComparison(comparison, fixture, overrides),
  )
  const failures = results.flatMap((result) => result.failures)
  if (failures.length > 0) {
    throw new Error(`visual conformance failed:\n- ${failures.join('\n- ')}`)
  }

  const files = {
    [`${fixture.artifactRoot}/approved-baselines.json`]:
      renderApprovedBaselines(fixture, results),
    [`${fixture.artifactRoot}/diff-report.json`]: renderDiffReport(
      fixture,
      results,
    ),
  }
  for (const result of results) {
    files[result.diffArtifact] = `${JSON.stringify(result, null, 2)}\n`
  }
  return files
}

const prettierConfig = await resolveConfig(path.join(root, 'package.json'))

const formatGeneratedContent = async (relativePath, content) =>
  format(content, {
    ...(prettierConfig ?? {}),
    filepath: path.join(root, relativePath),
  })

const renderFormatted = async () => {
  const files = renderAll()
  return Object.fromEntries(
    await Promise.all(
      Object.entries(files).map(async ([relativePath, content]) => [
        relativePath,
        await formatGeneratedContent(relativePath, content),
      ]),
    ),
  )
}

const writeFiles = (files) => {
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath)
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    fs.writeFileSync(absolutePath, content)
    console.log(`wrote ${relativePath}`)
  }
}

const checkFiles = (files) => {
  const failures = []
  for (const [relativePath, expected] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath)
    if (!fs.existsSync(absolutePath)) {
      failures.push(`${relativePath} is missing`)
      continue
    }
    if (fs.readFileSync(absolutePath, 'utf8') !== expected) {
      failures.push(`${relativePath} is stale`)
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `Visual conformance artifacts are not current:\n${failures.join('\n')}`,
    )
  }
  console.log('Visual conformance comparisons passed.')
}

const command = process.argv[2] ?? 'check'

try {
  const files = await renderFormatted()
  if (command === 'generate') writeFiles(files)
  else if (command === 'check') checkFiles(files)
  else
    throw new Error(
      'Usage: node scripts/visual-conformance.mjs <generate|check>',
    )
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
