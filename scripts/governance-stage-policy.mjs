import assert from 'node:assert/strict'

const job = (workflow, name) =>
  workflow.match(
    new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [\\w-]+:\\n|$)`, 'u'),
  )?.[1] ?? ''

export function staticGovernanceArgs(command) {
  const parts = command.split(/\s+/u)
  assert.deepEqual(parts.slice(0, 3), [
    'node',
    './scripts/with-node-heap.mjs',
    'run-s',
  ])
  const dynamic = 'check:avalonia-stable-readiness'
  assert.equal(
    parts.filter((part) => part === dynamic).length,
    1,
    'Full governance must contain exactly one producer-owned readiness gate',
  )
  assert.ok(
    parts.slice(3).every((part) => /^[a-zA-Z0-9:_-]+$/u.test(part)),
    'Governance must remain an explicit ordered task list',
  )
  return parts.slice(1).filter((part) => part !== dynamic)
}

export function validateGovernanceStages({
  scripts,
  quality,
  reusable,
  readiness,
  capacity,
}) {
  staticGovernanceArgs(scripts['governance:check'])
  assert.equal(
    scripts['governance:check:ci-static'],
    'node ./scripts/run-ci-static-governance.mjs',
  )
  assert.equal(
    scripts['verify:pr-fast:ci-static'],
    scripts['verify:pr-fast'].replace(
      '_verify:pr-fast:parallel',
      '_verify:pr-fast:parallel:ci-static',
    ),
  )
  assert.equal(
    scripts['_verify:pr-fast:parallel:ci-static'],
    'node ./scripts/run-capacity-suite.mjs --suite=pr-fast-ci-static',
  )
  assert.ok(
    capacity.includes(
      "suites['pr-fast-ci-static'] = suites['pr-fast'].map((task) =>",
    ),
  )
  assert.ok(
    capacity.includes(
      "task === 'governance:check' ? 'governance:check:ci-static' : task",
    ),
  )
  assert.match(
    job(reusable, 'static-quality'),
    /uses: actions\/setup-dotnet@v4\n\s+with:\n\s+global-json-file: dotnet\/global\.json/u,
    'Static governance requires the repository-pinned SDK for source semantics',
  )
  const producer = job(reusable, 'dotnet-package')
  assert.match(
    producer,
    /uses: actions\/checkout@v4\n\s+with:\n\s+fetch-depth: 0[ \t]*\n/u,
    'Conformance must retain complete ancestry for the independently reviewed candidate',
  )
  assert.match(
    producer,
    /pnpm run conformance:v2\n\s+node scripts\/dotnet-package-verify\.mjs/u,
    'Conformance V2 must run before NuGet candidate package verification',
  )
  assert.ok(
    !/^ {4}if:/mu.test(producer),
    'Required producer must not become conditional',
  )
  const readinessSource = readiness ?? reusable
  assert.ok(
    job(readinessSource, 'stable-readiness').includes(
      'node scripts/ci-readiness.mjs check',
    ),
  )
  assert.ok(job(quality, 'pr-fast').includes('      - quality\n'))
  assert.ok(
    job(quality, 'pr-fast').includes('test "${QUALITY_RESULT}" = "success"'),
  )
  assert.ok(
    job(quality, 'quality').includes('uses: ./.github/workflows/_quality.yml'),
  )
}
