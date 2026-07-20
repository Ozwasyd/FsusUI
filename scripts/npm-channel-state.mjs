import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import {
  createReleasePlan,
  npmRegistry,
  writeGithubOutputs,
} from './npm-release-channel-lib.mjs'

const { values } = parseArgs({
  options: {
    package: { type: 'string' },
    candidate: { type: 'string' },
    channel: { type: 'string' },
    'github-output': { type: 'boolean', default: false },
  },
})
const plan = createReleasePlan({
  packageName: values.package,
  version: values.candidate,
})
if (values.channel !== plan.distTag)
  throw new Error(
    `Resolved channel ${plan.distTag} does not match ${values.channel}.`,
  )

function npmView(spec, field) {
  try {
    return execFileSync(
      'npm',
      ['view', spec, field, '--json', `--registry=${npmRegistry}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim()
  } catch (error) {
    const stderr = error.stderr?.toString() ?? ''
    if (/E404|404 Not Found/u.test(stderr)) return undefined
    throw new Error(`npm view failed for ${spec}: ${stderr.trim()}`, {
      cause: error,
    })
  }
}

const currentJson = npmView(plan.packageName, `dist-tags.${plan.distTag}`)
const versionJson = npmView(`${plan.packageName}@${plan.version}`, 'version')
const current = currentJson ? JSON.parse(currentJson) : ''
const candidateExists = Boolean(versionJson && JSON.parse(versionJson))
const state = { current, candidate_exists: candidateExists }
if (values['github-output']) writeGithubOutputs(state)
console.log(JSON.stringify(state))
