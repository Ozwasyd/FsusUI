import assert from 'node:assert/strict'
import test from 'node:test'

import { findWebRadiusScaleViolations } from '../scripts/token-pipeline.mjs'

test('accepts canonical radius fallbacks and token-driven declarations', () => {
  const source = `
.control { border-radius: var(--fsus-radius-control, 6px); }
.panel { border-radius: var(--fsus-radius-panel, var(--el-border-radius-large)); }
.pill { border-radius: 999px; }
`

  assert.deepEqual(findWebRadiusScaleViolations(source, 'valid.scss'), [])
})

test('rejects off-scale fsus radius fallbacks', () => {
  const failures = findWebRadiusScaleViolations(
    '.panel { border-radius: var(--fsus-radius-panel, 8px); }',
    'fallback.scss',
  )

  assert.deepEqual(failures, [
    'fallback.scss:1 --fsus-radius-panel uses off-scale fallback 8px',
  ])
})

test('rejects naked 8px declarations including important values', () => {
  const failures = findWebRadiusScaleViolations(
    `.first {
  border-radius: 8px;
}
.second { border-radius: 8px !important; }
`,
    'literal.scss',
  )

  assert.deepEqual(failures, [
    'literal.scss:2 uses obsolete bare radius 8px; use a canonical --fsus-radius-* token',
    'literal.scss:4 uses obsolete bare radius 8px; use a canonical --fsus-radius-* token',
  ])
})

test('ignores excluded line and block comments without losing line numbers', () => {
  const source = `
// body wrapper carries border-radius: 8px in the legacy explanation
/*
.example { border-radius: 8px; }
*/
.control { border-radius: var(--fsus-radius-control, 6px); }
`

  assert.deepEqual(findWebRadiusScaleViolations(source, 'comments.scss'), [])
})
