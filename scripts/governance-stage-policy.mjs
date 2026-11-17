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
  assert.ok(
    job(quality, 'pr-feedback').includes(
      'run: pnpm run verify:pr-fast:ci-static\n',
    ),
  )
  assert.ok(
    job(reusable, 'static-quality').includes(
      'run: pnpm run governance:check:ci-static\n',
    ),
  )
  for (const producer of [
    job(reusable, 'dotnet-package'),
    job(quality, 'pr-avalonia-aot-candidate'),
  ]) {
    assert.match(
      producer,
      /uses: actions\/checkout@v4\n\s+with:\n\s+fetch-depth: 3/u,
      'Conformance must retain the reviewed candidate ancestry',
    )
    assert.match(
      producer,
      /pnpm run conformance:v2\n\s+pnpm run check:avalonia-stable-readiness\n\s+node scripts\/dotnet-package-verify\.mjs/u,
      'The unchanged readiness gate must run after governed production and before package success',
    )
  }
  assert.ok(
    !/^    if:/mu.test(job(reusable, 'dotnet-package')),
    'Required producer must not become conditional',
  )
  assert.ok(
    job(reusable, 'stable-readiness').includes('      - dotnet-package\n'),
  )
  assert.ok(job(quality, 'pr-fast').includes('      - premerge-main\n'))
  assert.ok(
    job(quality, 'pr-fast').includes(
      'test "${PREMERGE_MAIN_RESULT}" = "success"',
    ),
  )
  for (const group of ['premerge-main', 'main', 'nightly', 'release'])
    assert.ok(
      job(quality, group).includes('uses: ./.github/workflows/_quality.yml'),
    )
}
