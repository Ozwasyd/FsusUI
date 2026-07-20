import { parseArgs } from 'node:util'
import {
  assertCandidateMatchesPlan,
  createReleasePlan,
  npmRegistry,
  writeGithubOutputs,
} from './npm-release-channel-lib.mjs'

const { values } = parseArgs({
  options: {
    package: { type: 'string' },
    version: { type: 'string' },
    registry: { type: 'string', default: npmRegistry },
    'candidate-manifest': { type: 'string' },
    json: { type: 'boolean', default: false },
    'github-output': { type: 'boolean', default: false },
  },
})

const plan = createReleasePlan({
  packageName: values.package,
  version: values.version,
  registry: values.registry,
})
if (values['candidate-manifest'])
  assertCandidateMatchesPlan(values['candidate-manifest'], plan)

if (values['github-output']) {
  writeGithubOutputs({
    registry: plan.registry,
    package: plan.packageName,
    version: plan.version,
    dist_tag: plan.distTag,
    resource: plan.resource,
    concurrency_group: plan.concurrencyGroup,
  })
}
console.log(values.json ? JSON.stringify(plan) : plan.concurrencyGroup)
