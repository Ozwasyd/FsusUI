import process from 'node:process'
import { execFileSync } from 'node:child_process'

export const platformEnvironment = (root, env = process.env) => {
  const commitSha = execFileSync(
    'git',
    ['rev-parse', '--verify', 'HEAD^{commit}'],
    {
      cwd: root,
      encoding: 'utf8',
    },
  ).trim()
  const supplied = env.FSUS_WEBVIEW_CANDIDATE_SHA
  if (supplied !== undefined && supplied !== commitSha)
    throw new Error(
      `Native platform candidate mismatch: expected ${commitSha}, got ${supplied}`,
    )
  return {
    ...env,
    GITHUB_SHA: commitSha,
    FSUS_WEBVIEW_CANDIDATE_SHA: commitSha,
  }
}
