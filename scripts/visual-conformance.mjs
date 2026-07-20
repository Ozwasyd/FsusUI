import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import zlib from 'node:zlib'
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

const readBuffer = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath))

const inspectPng = (relativePath) => {
  const buffer = readBuffer(relativePath)
  const signature = buffer.subarray(0, 8).toString('hex')
  if (signature !== '89504e470d0a1a0a') {
    throw new Error(`${relativePath} is not a PNG`)
  }
  let offset = 8
  let width
  let height
  let bitDepth
  let colorType
  let interlace
  const idat = []
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii')
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    offset += 12 + length
  }
  if (!width || !height || bitDepth !== 8 || interlace !== 0) {
    throw new Error(`${relativePath} must be a non-interlaced 8-bit PNG`)
  }
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : undefined
  if (!channels)
    throw new Error(
      `${relativePath} uses unsupported PNG color type ${colorType}`,
    )
  const stride = width * channels
  const inflated = zlib.inflateSync(Buffer.concat(idat))
  if (inflated.length !== (stride + 1) * height) {
    throw new Error(`${relativePath} PNG scanline length is invalid`)
  }
  const pixels = Buffer.alloc(stride * height)
  const paeth = (a, b, c) => {
    const estimate = a + b - c
    const pa = Math.abs(estimate - a)
    const pb = Math.abs(estimate - b)
    const pc = Math.abs(estimate - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  for (let y = 0; y < height; y += 1) {
    const source = y * (stride + 1)
    const target = y * stride
    const filter = inflated[source]
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[source + 1 + x]
      const left = x >= channels ? pixels[target + x - channels] : 0
      const up = y > 0 ? pixels[target + x - stride] : 0
      const upperLeft =
        y > 0 && x >= channels ? pixels[target + x - stride - channels] : 0
      const value =
        filter === 0
          ? raw
          : filter === 1
            ? raw + left
            : filter === 2
              ? raw + up
              : filter === 3
                ? raw + Math.floor((left + up) / 2)
                : filter === 4
                  ? raw + paeth(left, up, upperLeft)
                  : Number.NaN
      if (!Number.isFinite(value))
        throw new Error(`${relativePath} uses invalid PNG filter ${filter}`)
      pixels[target + x] = value & 0xff
    }
  }
  const background = [pixels[0], pixels[1], pixels[2]]
  const isNonBackground = (x, y) => {
    const index = y * stride + x * channels
    return (
      Math.abs(pixels[index] - background[0]) +
        Math.abs(pixels[index + 1] - background[1]) +
        Math.abs(pixels[index + 2] - background[2]) >
      24
    )
  }
  let nonBackground = 0
  const colors = new Set()
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * stride + x * channels
      colors.add(
        (pixels[index] >> 3) |
          ((pixels[index + 1] >> 3) << 5) |
          ((pixels[index + 2] >> 3) << 10),
      )
      if (isNonBackground(x, y)) nonBackground += 1
    }
  }
  const inspectRegion = (bounds) => {
    const left = Math.max(0, Math.min(width - 1, Math.floor(bounds.X)))
    const top = Math.max(0, Math.min(height - 1, Math.floor(bounds.Y)))
    const right = Math.max(
      left,
      Math.min(width - 1, Math.ceil(bounds.Right) - 1),
    )
    const bottom = Math.max(
      top,
      Math.min(height - 1, Math.ceil(bounds.Y + bounds.Height) - 1),
    )
    const histogram = new Map()
    let count = 0
    let regionNonBackground = 0
    let borderCount = 0
    let borderNonBackground = 0
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const index = y * stride + x * channels
        const color =
          (pixels[index] >> 3) |
          ((pixels[index + 1] >> 3) << 5) |
          ((pixels[index + 2] >> 3) << 10)
        histogram.set(color, (histogram.get(color) ?? 0) + 1)
        count += 1
        if (isNonBackground(x, y)) regionNonBackground += 1
      }
    }
    for (let x = left; x <= right; x += 1) {
      borderCount += 2
      if (isNonBackground(x, top)) borderNonBackground += 1
      if (isNonBackground(x, bottom)) borderNonBackground += 1
    }
    for (let y = top + 1; y < bottom; y += 1) {
      borderCount += 2
      if (isNonBackground(left, y)) borderNonBackground += 1
      if (isNonBackground(right, y)) borderNonBackground += 1
    }
    return {
      nonBackgroundRatio: regionNonBackground / count,
      borderNonBackgroundRatio: borderNonBackground / borderCount,
      quantizedColorCount: histogram.size,
      minorityColorRatio: 1 - Math.max(...histogram.values()) / count,
    }
  }
  return {
    buffer,
    width,
    height,
    nonBackgroundRatio: nonBackground / (width * height),
    quantizedColorCount: colors.size,
    inspectRegion,
  }
}

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

const evaluateRenderEvidence = (comparison, fixture) => {
  const manifestPath = comparison.evidenceManifest
  const absoluteManifest = path.join(root, manifestPath)
  if (!fs.existsSync(absoluteManifest)) {
    throw new Error(
      `${comparison.id} render evidence manifest is missing: ${manifestPath}`,
    )
  }
  const manifest = readJson(manifestPath)
  if (
    manifest.renderer?.runner !== 'headless-skia' ||
    manifest.renderer?.control !== 'FsusPerceptionCharacterChallenge'
  ) {
    throw new Error(
      `${comparison.id} manifest does not prove the Avalonia Headless Skia control render`,
    )
  }

  const validateCapture = (capture) => {
    if (!capture?.File || !fs.existsSync(path.join(root, capture.File))) {
      throw new Error(
        `${comparison.id} capture is missing: ${capture?.File ?? 'undefined'}`,
      )
    }
    const png = inspectPng(capture.File)
    if (sha256(png.buffer) !== capture.Sha256) {
      throw new Error(`${comparison.id} capture hash drifted: ${capture.File}`)
    }
    if (
      png.width !== capture.PixelSize?.Width ||
      png.height !== capture.PixelSize?.Height
    ) {
      throw new Error(
        `${comparison.id} capture dimensions drifted: ${capture.File}`,
      )
    }
    if (png.nonBackgroundRatio <= 0.01 || png.quantizedColorCount < 4) {
      throw new Error(`${comparison.id} capture is blank: ${capture.File}`)
    }
    if (
      Math.abs(png.nonBackgroundRatio - capture.NonBackgroundPixelRatio) >
      0.000001
    ) {
      throw new Error(
        `${comparison.id} capture pixel evidence drifted: ${capture.File}`,
      )
    }
    for (const bounds of capture.ControlBounds ?? []) {
      if (
        bounds.Width <= 0 ||
        bounds.Height <= 0 ||
        bounds.X < 0 ||
        bounds.Y < 0 ||
        bounds.Right > png.width + 0.01 ||
        bounds.Y + bounds.Height > png.height + 0.01
      ) {
        throw new Error(
          `${comparison.id} control bounds leave capture ${capture.File}`,
        )
      }
    }
    for (const control of capture.CriticalControls ?? []) {
      const measured = png.inspectRegion(control.Bounds)
      if (
        measured.nonBackgroundRatio <= 0.01 ||
        measured.borderNonBackgroundRatio <= 0.01
      ) {
        throw new Error(
          `${comparison.id} critical control is not visible: ${control.State}/${control.AutomationId}`,
        )
      }
      if (
        control.AutomationId === 'character-raster' &&
        (measured.quantizedColorCount < 2 ||
          measured.minorityColorRatio <= 0.05)
      ) {
        throw new Error(
          `${comparison.id} raster glyph content is blank: ${control.State}`,
        )
      }
    }
    return png
  }

  const web = manifest.webBaseline
  if (web?.File !== comparison.baseline.screenshot) {
    throw new Error(
      `${comparison.id} Web baseline is not bound to the render manifest`,
    )
  }
  const webPng = validateCapture({
    ...web,
    ControlBounds: [],
    CriticalControls: [],
  })
  const captures = manifest.captures ?? []
  const byId = new Map(captures.map((capture) => [capture.Id, capture]))
  const overview = byId.get('perception-character-challenge-conformance')
  const highContrast = byId.get('perception-character-challenge-high-contrast')
  const zoom200 = byId.get('perception-character-challenge-zoom-200')
  const zoom400 = byId.get('perception-character-challenge-zoom-400')
  if (!overview || !highContrast || !zoom200 || !zoom400) {
    throw new Error(
      `${comparison.id} manifest must include overview, high contrast, 200%, and 400% captures`,
    )
  }
  if (overview.File !== comparison.candidate.screenshot) {
    throw new Error(
      `${comparison.id} Avalonia candidate is not bound to the render manifest`,
    )
  }
  for (const capture of [overview, highContrast, zoom200, zoom400])
    validateCapture(capture)

  const expectedStates = [
    'loading',
    'ready',
    'verifying',
    'retryable',
    'reissue',
    'expired',
    'unavailable',
    'disabled',
  ]
  for (const capture of [overview, highContrast]) {
    if (
      JSON.stringify(capture.States) !== JSON.stringify(expectedStates) ||
      capture.ControlBounds?.length !== 8
    ) {
      throw new Error(
        `${comparison.id} ${capture.Id} does not contain all eight measured states`,
      )
    }
    const rasterStates = (capture.CriticalControls ?? [])
      .filter((control) => control.AutomationId === 'character-raster')
      .map((control) => control.State)
      .sort()
    if (
      JSON.stringify(rasterStates) !==
      JSON.stringify(['disabled', 'ready', 'retryable', 'verifying'])
    ) {
      throw new Error(
        `${comparison.id} ${capture.Id} lacks four visible raster-state proofs`,
      )
    }
  }
  if (
    !highContrast.HighContrast ||
    zoom200.ZoomEquivalentPercent !== 200 ||
    zoom400.ZoomEquivalentPercent !== 400
  ) {
    throw new Error(
      `${comparison.id} contrast or zoom evidence metadata drifted`,
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
    evidenceManifest: manifestPath,
    evidence: {
      web: { width: webPng.width, height: webPng.height, sha256: web.Sha256 },
      avalonia: captures.map((capture) => ({
        id: capture.Id,
        width: capture.PixelSize.Width,
        height: capture.PixelSize.Height,
        sha256: capture.Sha256,
      })),
    },
    deltas: {},
    thresholds: {},
    allowedByOverride: [],
    passed: true,
    failures: [],
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

  if (comparison.evidenceManifest) {
    return evaluateRenderEvidence(comparison, fixture)
  }

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
