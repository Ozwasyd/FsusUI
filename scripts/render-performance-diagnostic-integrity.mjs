import assert from 'node:assert/strict'
import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import { verifyImpactPlan } from './render-performance-impact.mjs'

const producerRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

export const readOriginalQuickScenarios = async (plan) => {
  const result = {}
  if (plan.platforms.web.run) {
    const source = await readFile(
      path.join(producerRoot, 'scripts/web-render-performance.mjs'),
      'utf8',
    )
    const start = source.indexOf('\nconst definitions = [')
    const end = source.indexOf('\nconst percentile =', start)
    assert.ok(
      start >= 0 && end > start,
      'unrecognized original Web matrix owner',
    )
    const template = [...source.matchAll(/^ +id: (`[^`\n]+`),$/gmu)]
    assert.equal(template.length, 1, 'unrecognized original Web case identity')
    const context = {
      profile: 'quick',
      scenarioFilter: plan.platforms.web.scenario ?? '',
    }
    const matrix = JSON.parse(
      new Script(
        `${source.slice(start, end)}\nJSON.stringify(matrix)`,
      ).runInNewContext(context, {
        timeout: 1000,
        contextCodeGeneration: { strings: false, wasm: false },
      }),
    )
    result.web = matrix.map(([scenario, size, refreshHz, dpr, motion]) => {
      const dimensions = { scenario, size, refreshHz, dpr, motion }
      const id = new Script(template[0][1]).runInNewContext(dimensions, {
        timeout: 1000,
        contextCodeGeneration: { strings: false, wasm: false },
      })
      return { id, ...dimensions }
    })
    assert.ok(
      result.web.length > 0,
      'selected Web scenario has no original cases',
    )
  }
  if (plan.platforms.avalonia.run) {
    const source = await readFile(
      path.join(
        producerRoot,
        'dotnet/FsusUI.Avalonia.Demo/RenderPerformanceRunner.cs',
      ),
      'utf8',
    )
    const blocks = [
      ...source.matchAll(/\n {6}:\s*\n {6}\[\n([\s\S]*?)\n {6}\];/gu),
    ]
    assert.equal(blocks.length, 1, 'unrecognized original native quick matrix')
    assert.ok(
      source.includes(
        'definition.Id.Contains(scenarioFilter, StringComparison.OrdinalIgnoreCase)',
      ),
      'unrecognized original native scenario selector',
    )
    const ids = blocks[0][1]
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const entry = line.match(
          /^ {8}[A-Za-z][A-Za-z0-9]*\("([a-z0-9][a-z0-9._-]*)"[^\n]*\),$/u,
        )
        assert.ok(entry, 'unrecognized native quick matrix entry')
        return entry[1]
      })
    const filter = plan.platforms.avalonia.scenario
    result.avalonia = ids.filter(
      (id) =>
        !filter?.trim() || id.toLowerCase().includes(filter.toLowerCase()),
    )
    assert.ok(
      result.avalonia.length > 0,
      'selected native scenario has no original cases',
    )
  }
  return result
}

const readRegularJson = async (root, file) => {
  const target = path.resolve(root, file)
  assert.ok((await lstat(target)).isFile(), `not a regular file: ${file}`)
  const relative = path.relative(root, await realpath(target))
  assert.ok(
    relative !== '..' && !relative.startsWith(`..${path.sep}`),
    `artifact escapes its measurement directory: ${file}`,
  )
  return JSON.parse(await readFile(target, 'utf8'))
}

const samples = (values, count, label) => {
  assert.ok(Array.isArray(values), `${label}: raw samples missing`)
  assert.equal(values.length, count, `${label}: incomplete sample count`)
  assert.ok(
    values.every((value) => Number.isFinite(value) && value >= 0),
    `${label}: invalid measured sample`,
  )
}

export const verifyDiagnosticMeasurements = async ({
  plan,
  baseSha,
  currentSha,
  directories,
}) => {
  verifyImpactPlan(plan)
  for (const sha of [baseSha, currentSha]) assert.match(sha, /^[a-f0-9]{40}$/u)
  assert.equal(
    plan.baseRef,
    baseSha,
    'declared base differs from the immutable plan',
  )
  assert.equal(plan.run, true, 'a skipped plan has no diagnostic measurements')
  assert.ok(plan.platforms.web.run || plan.platforms.avalonia.run)
  assert.equal(directories.length, 4, 'complete ABBA directories required')
  const identities = [baseSha, currentSha, currentSha, baseSha]
  const scenarios = await readOriginalQuickScenarios(plan)
  for (const [index, directory] of directories.entries()) {
    assert.ok(
      (await lstat(directory)).isDirectory(),
      'measurement root must be a regular directory',
    )
    const root = await realpath(directory)
    const recordedPlan = verifyImpactPlan(
      await readRegularJson(root, 'impact-plan.json'),
    )
    assert.equal(recordedPlan.planDigest, plan.planDigest, 'plan mismatch')
    for (const platform of ['web', 'avalonia']) {
      if (!plan.platforms[platform].run) continue
      const web = platform === 'web'
      const summary = await readRegularJson(root, `${platform}/summary.json`)
      assert.equal(summary[web ? 'gitSha' : 'GitSha'], identities[index])
      assert.equal(summary[web ? 'profile' : 'Profile'], 'quick')
      const runner = summary[web ? 'runner' : 'Runner']
      assert.equal(
        runner[web ? 'warmups' : 'Warmups'],
        plan.measurement.warmups,
      )
      assert.equal(
        runner[web ? 'samples' : 'Samples'],
        plan.measurement.samples,
      )
      const entries = summary[web ? 'results' : 'Results']
      assert.ok(Array.isArray(entries) && entries.length > 0)
      assert.equal(entries.length, runner[web ? 'matrixSize' : 'ScenarioCount'])
      const ids = entries.map((entry) => entry[web ? 'id' : 'Id']).sort()
      assert.equal(new Set(ids).size, ids.length, 'duplicate scenario')
      for (const id of ids) assert.match(id, /^[a-z0-9][a-z0-9._-]*$/u)
      const expectedIds = scenarios[platform]
        .map((entry) => (web ? entry.id : entry))
        .sort()
      assert.deepEqual(
        ids,
        expectedIds,
        'scenario mismatch with original producer and immutable plan',
      )
      const rawDirectory = web ? platform : `${platform}/raw`
      const rawFiles = (await readdir(path.join(root, rawDirectory)))
        .filter((file) => file.endsWith('.raw.json'))
        .sort()
      assert.deepEqual(rawFiles, ids.map((id) => `${id}.raw.json`).sort())
      for (const entry of entries) {
        const id = entry[web ? 'id' : 'Id']
        const raw = await readRegularJson(
          root,
          `${rawDirectory}/${id}.raw.json`,
        )
        assert.equal(raw[web ? 'id' : 'Id'], id)
        if (web) {
          const expected = scenarios.web.find((scenario) => scenario.id === id)
          for (const field of [
            'scenario',
            'size',
            'refreshHz',
            'dpr',
            'motion',
          ]) {
            assert.equal(
              entry[field],
              expected[field],
              `Web ${id} summary ${field} mismatch`,
            )
            assert.equal(
              raw[field],
              expected[field],
              `Web ${id} raw ${field} mismatch`,
            )
          }
        }
        for (const [rawName, summaryName] of web
          ? [
              ['inputToFrame', 'inputToNextFrameMs'],
              ['frameWork', 'frameWorkMs'],
            ]
          : [
              ['FrameMs', 'FrameMs'],
              ['MeasureArrangeMs', 'MeasureArrangeMs'],
              ['DrawMs', 'DrawMs'],
              ['AllocatedBytes', 'AllocatedBytes'],
            ]) {
          samples(
            raw[rawName],
            plan.measurement.samples,
            `${platform}/${id}/${rawName}`,
          )
          const metric = entry[summaryName]
          assert.equal(
            metric[web ? 'samples' : 'Samples'],
            plan.measurement.samples,
          )
          assert.ok(Number.isFinite(metric[web ? 'p95' : 'P95']))
        }
      }
    }
  }
  return { measurementCount: 4, scenarios }
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const [planFile, baseSha, currentSha, ...directories] = process.argv.slice(2)
  const result = await verifyDiagnosticMeasurements({
    plan: JSON.parse(await readFile(planFile, 'utf8')),
    baseSha,
    currentSha,
    directories,
  })
  console.log(
    `Complete source-bound ABBA raw measurements verified: ${JSON.stringify(result)}`,
  )
}
