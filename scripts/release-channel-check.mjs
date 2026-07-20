import { parseArgs } from 'node:util'
import {
  checkChannelMonotonicity,
  writeGithubOutputs,
} from './npm-release-channel-lib.mjs'

const { values } = parseArgs({
  options: {
    candidate: { type: 'string' },
    current: { type: 'string', default: '' },
    'candidate-exists': { type: 'string', default: 'false' },
    mode: { type: 'string', default: 'automatic' },
    reason: { type: 'string' },
    'expected-current': { type: 'string' },
    json: { type: 'boolean', default: false },
    'github-output': { type: 'boolean', default: false },
  },
})

if (!values.candidate) throw new Error('--candidate is required.')
if (!['true', 'false'].includes(values['candidate-exists']))
  throw new Error('--candidate-exists must be true or false.')

const result = checkChannelMonotonicity({
  candidate: values.candidate,
  current: values.current || undefined,
  candidateExists: values['candidate-exists'] === 'true',
  mode: values.mode,
  reason: values.reason,
  expectedCurrent: values['expected-current'],
})
if (values['github-output']) writeGithubOutputs(result)
console.log(values.json ? JSON.stringify(result) : result.action)
