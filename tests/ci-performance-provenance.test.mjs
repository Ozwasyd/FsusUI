import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workflow = readFileSync(
  path.join(root, '.github/workflows/quality.yml'),
  'utf8',
)
const measurements = [
  ['Measure same-runner baseline first', 'baseline', 'performance-baseline'],
  ['Measure current quick matrix', 'current', 'performance-current'],
  [
    'Repeat current quick matrix for order balance',
    'current',
    'performance-current-repeat',
  ],
  [
    'Repeat baseline quick matrix last for order balance',
    'baseline',
    'performance-baseline-repeat',
  ],
].map(([name, checkout, output]) => {
  const lines = workflow.split('\n')
  const start = lines.indexOf(`      - name: ${name}`)
  assert.notEqual(start, -1, `missing measurement: ${name}`)
  const next = lines.findIndex(
    (line, index) => index > start && line.startsWith('      - '),
  )
  const step = lines.slice(start, next === -1 ? undefined : next).join('\n')
  const run = step.indexOf('        run: >-\n')
  assert.notEqual(run, -1, `${name} must retain its folded shell command`)
  const command = step
    .slice(run + '        run: >-\n'.length)
    .trimEnd()
    .split('\n')
    .map((line) => line.replace(/^ {10}/u, ''))
    .join('\n')
  return {
    name,
    checkout,
    output,
    step,
    command,
    // YAML's folded scalar joins ordinary lines; a blank line separates commands.
    shell: command
      .split('\n\n')
      .map((paragraph) => paragraph.replaceAll('\n', ' '))
      .join('\n'),
  }
})

const fixture = (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fsus-ci-provenance-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const repository = path.join(directory, 'repository')
  const outside = path.join(directory, 'outside')
  const bin = path.join(directory, 'bin')
  for (const entry of [repository, outside, bin]) mkdirSync(entry)
  const env = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
  }
  for (const key of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_COMMON_DIR',
    'GIT_CONFIG_COUNT',
    'GIT_CONFIG_PARAMETERS',
  ])
    delete env[key]
  const git = (...args) => {
    const result = spawnSync('git', args, {
      cwd: repository,
      env,
      encoding: 'utf8',
    })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout.trim()
  }
  git('init', '--quiet', '--initial-branch=main')
  git('config', 'user.name', 'CI provenance control')
  git('config', 'user.email', 'ci-provenance@example.invalid')
  git('config', 'core.hooksPath', outside)
  git('commit', '--quiet', '--allow-empty', '-m', 'baseline')
  const baseline = git('rev-parse', 'HEAD')
  git('commit', '--quiet', '--allow-empty', '-m', 'current merge')
  const current = git('rev-parse', 'HEAD')
  assert.notEqual(baseline, current)
  writeFileSync(
    path.join(bin, 'pnpm'),
    '#!/bin/bash\nprintf \'%s\\n\' "$GITHUB_SHA" > "$PERF_RECEIPT"\nprintf \'%s\\n\' "$@" >> "$PERF_RECEIPT"\n',
    { mode: 0o755 },
  )
  for (const command of ['dbus-run-session', 'node']) {
    writeFileSync(
      path.join(bin, command),
      `#!/bin/bash
if [ "$1" = '-p' ]; then printf 'fixture-digest'; exit 0; fi
printf '%s:%s:%s\\n' '${command}' "$GITHUB_SHA" "$*" >> "$PERF_RECEIPT"
`,
      { mode: 0o755 },
    )
  }
  let invocation = 0
  const run = (measurement, { head, sha, cwd, shell } = {}) => {
    git(
      'checkout',
      '--quiet',
      '--detach',
      head ?? (measurement.checkout === 'baseline' ? baseline : current),
    )
    const receipt = path.join(directory, `receipt-${invocation++}`)
    const output = `${receipt}-output`
    const expectedVariable =
      measurement.expectedVariable ?? 'FSUS_MEASUREMENT_SHA'
    const declaredSha =
      expectedVariable === 'FSUS_CANDIDATE_SHA' ||
      measurement.step.includes(
        'FSUS_MEASUREMENT_SHA: ${{ github.event.pull_request.base.sha }}',
      )
        ? baseline
        : current
    const childEnv = {
      ...env,
      // The runner owns GITHUB_* defaults, including the merge SHA on a PR.
      GITHUB_SHA: current,
      [expectedVariable]: sha === undefined ? declaredSha : sha,
      PERF_RECEIPT: receipt,
      GITHUB_OUTPUT: output,
    }
    if (sha === null) delete childEnv[expectedVariable]
    const result = spawnSync(
      '/bin/bash',
      [
        '--noprofile',
        '--norc',
        '-e',
        '-o',
        'pipefail',
        '-c',
        shell ?? measurement.shell,
      ],
      { cwd: cwd ?? repository, env: childEnv, encoding: 'utf8' },
    )
    return {
      ...result,
      receipt: existsSync(receipt)
        ? readFileSync(receipt, 'utf8').trimEnd().split('\n')
        : undefined,
      output: existsSync(output) ? readFileSync(output, 'utf8') : undefined,
    }
  }
  return { baseline, current, outside, run }
}

test('ABBA steps retain their measurement commands, checkouts, conditions, and order', () => {
  for (const measurement of measurements) {
    const { name, checkout, output, step, command } = measurement
    assert.ok(step.includes(`working-directory: ${checkout}\n`), name)
    const condition =
      name === 'Measure current quick matrix'
        ? 'render-impact.outputs.run'
        : 'baseline-contract.outputs.available'
    assert.ok(step.includes(`steps.${condition} == 'true'`), name)
    assert.equal(
      command.slice(command.indexOf('pnpm perf:render --')),
      `pnpm perf:render --\n--impact-plan ../performance-impact-plan.json\n--profile quick\n--output ../${output}`,
      name,
    )
  }
  const offsets = measurements.map(({ name }) => workflow.indexOf(name))
  assert.deepEqual(
    offsets,
    [...offsets].sort((left, right) => left - right),
  )
})

test('measurement expectations use a non-reserved variable with the declared checkout identity', () => {
  for (const { name, checkout, step } of measurements) {
    assert.doesNotMatch(step, /\n {10}GITHUB_SHA:/u, name)
    const expression =
      checkout === 'baseline'
        ? 'github.event.pull_request.base.sha'
        : 'github.sha'
    assert.ok(
      step.includes(`FSUS_MEASUREMENT_SHA: \${{ ${expression} }}\n`),
      name,
    )
  }
})

test('the unguarded command reproduces inherited merge-SHA misattribution', (t) => {
  const { baseline, current, run } = fixture(t)
  const measurement = measurements[0]
  const result = run(measurement, {
    head: baseline,
    sha: current,
    shell: measurement.command
      .slice(measurement.command.indexOf('pnpm perf:render --'))
      .replaceAll('\n', ' '),
  })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.receipt?.[0], current)
  assert.notEqual(result.receipt?.[0], baseline)
})

test('all four actual Bash steps reject a mismatched checkout before starting pnpm', (t) => {
  const { baseline, current, run } = fixture(t)
  for (const measurement of measurements) {
    const result = run(measurement, {
      head: measurement.checkout === 'baseline' ? current : baseline,
    })
    assert.notEqual(result.status, 0, measurement.name)
    assert.equal(result.receipt, undefined, measurement.name)
  }
})

test('real detached base and current checkouts launch with their own identities and original argv', (t) => {
  const { baseline, current, run } = fixture(t)
  for (const measurement of measurements) {
    const sha = measurement.checkout === 'baseline' ? baseline : current
    const result = run(measurement, { head: sha })
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(result.receipt, [
      sha,
      'perf:render',
      '--',
      '--impact-plan',
      '../performance-impact-plan.json',
      '--profile',
      'quick',
      '--output',
      `../${measurement.output}`,
    ])
  }
})

test('baseline child summaries use the verified base despite a runner-owned merge SHA', (t) => {
  const { baseline, current, run } = fixture(t)
  assert.notEqual(baseline, current)
  for (const measurement of measurements.filter(
    ({ checkout }) => checkout === 'baseline',
  )) {
    const result = run(measurement, { head: baseline })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.receipt?.[0], baseline)
    assert.notEqual(result.receipt?.[0], current)
  }
})

test('all four actual Bash steps reject empty or absent SHA before starting pnpm', (t) => {
  const { baseline, current, run } = fixture(t)
  for (const measurement of measurements) {
    for (const sha of ['', null]) {
      const result = run(measurement, {
        head: measurement.checkout === 'baseline' ? baseline : current,
        sha,
      })
      assert.notEqual(result.status, 0, measurement.name)
      assert.equal(result.receipt, undefined, measurement.name)
    }
  }
})

test('all four actual Bash steps reject a non-repository working directory before starting pnpm', (t) => {
  const { baseline, current, outside, run } = fixture(t)
  for (const measurement of measurements) {
    const result = run(measurement, {
      head: measurement.checkout === 'baseline' ? baseline : current,
      cwd: outside,
    })
    assert.notEqual(result.status, 0, measurement.name)
    assert.equal(result.receipt, undefined, measurement.name)
  }
})

const candidateSteps = [
  ['.github/workflows/quality.yml', 'Build the immutable NuGet candidate once'],
  [
    '.github/workflows/_avalonia-aot-leaf.yml',
    'Publish and run the final native binary',
  ],
].map(([file, name]) => {
  const lines = readFileSync(path.join(root, file), 'utf8').split('\n')
  const start = lines.indexOf(`      - name: ${name}`)
  assert.notEqual(start, -1, name)
  const next = lines.findIndex(
    (line, index) => index > start && line.startsWith('      - '),
  )
  const step = lines.slice(start, next === -1 ? undefined : next).join('\n')
  const marker = '        run: |\n'
  const run = step.indexOf(marker)
  const shell =
    run === -1
      ? step.match(/^ {8}run: (.+)$/mu)?.[1]
      : step
          .slice(run + marker.length)
          .split('\n')
          .map((line) => line.replace(/^ {10}/u, ''))
          .join('\n')
  assert.ok(shell, `${name} must have an executable command`)
  return {
    name,
    step,
    checkout: 'baseline',
    expectedVariable: 'FSUS_CANDIDATE_SHA',
    shell,
  }
})

test('candidate producer and consumer bind declared head identities without overriding runner defaults', () => {
  assert.ok(
    candidateSteps[0].step.includes(
      'FSUS_CANDIDATE_SHA: ${{ github.event.pull_request.head.sha }}',
    ),
  )
  assert.ok(
    candidateSteps[1].step.includes(
      'FSUS_CANDIDATE_SHA: ${{ inputs.commit-sha }}',
    ),
  )
  for (const { step } of candidateSteps)
    assert.doesNotMatch(step, /\n {10}GITHUB_SHA:/u)
})

test('real head checkout labels conformance, package, and AOT children despite the inherited merge SHA', (t) => {
  const { baseline: head, current: merge, run } = fixture(t)
  assert.notEqual(head, merge)
  const producer = run(candidateSteps[0], { head })
  assert.equal(producer.status, 0, producer.stderr)
  assert.deepEqual(producer.receipt, [
    `dbus-run-session:${head}:-- xvfb-run -a pnpm run conformance:v2`,
    `node:${head}:scripts/dotnet-package-verify.mjs`,
  ])
  assert.equal(producer.output, 'digest=fixture-digest\n')
  const consumer = run(candidateSteps[1], { head })
  assert.equal(consumer.status, 0, consumer.stderr)
  assert.deepEqual(consumer.receipt, [
    `node:${head}:scripts/test-avalonia-aot-smoke.mjs`,
  ])
})

test('candidate producer and consumer reject a different real checkout before starting children', (t) => {
  const { current: merge, run } = fixture(t)
  for (const step of candidateSteps) {
    const result = run(step, { head: merge })
    assert.notEqual(result.status, 0, step.name)
    assert.equal(result.receipt, undefined, step.name)
  }
})

test('candidate producer and consumer reject empty or absent expected identities before starting children', (t) => {
  const { run } = fixture(t)
  for (const step of candidateSteps) {
    for (const sha of ['', null]) {
      const result = run(step, { sha })
      assert.notEqual(result.status, 0, step.name)
      assert.equal(result.receipt, undefined, step.name)
    }
  }
})

test('candidate producer and consumer reject a non-repository checkout before starting children', (t) => {
  const { outside, run } = fixture(t)
  for (const step of candidateSteps) {
    const result = run(step, { cwd: outside })
    assert.notEqual(result.status, 0, step.name)
    assert.equal(result.receipt, undefined, step.name)
  }
})

test('both NuGet digest exports execute their actual Bash quoting', (t) => {
  const { run } = fixture(t)
  for (const file of [
    '.github/workflows/quality.yml',
    '.github/workflows/_quality.yml',
  ]) {
    const command = readFileSync(path.join(root, file), 'utf8').match(
      /^ {10}(echo "digest=.+)$/mu,
    )?.[1]
    assert.ok(command, file)
    const result = run(candidateSteps[0], { shell: command })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.output, 'digest=fixture-digest\n', file)
  }
})
