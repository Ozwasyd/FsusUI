import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { staticGovernanceArgs } from './governance-stage-policy.mjs'

// Only CI's static jobs use this entry point. Full local governance is unchanged;
// mandatory package production owns the one dynamic, candidate-bound check.
const { scripts } = JSON.parse(readFileSync('package.json', 'utf8'))
const result = spawnSync(
  process.execPath,
  staticGovernanceArgs(scripts['governance:check']),
  {
    stdio: 'inherit',
  },
)
if (result.error) throw result.error
process.exitCode = result.status ?? 1
