import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const resolveRevision = async (directory, revision = 'HEAD') => {
  const { stdout } = await execFileAsync(
    'git',
    ['rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`],
    { cwd: directory },
  )
  return stdout.trim()
}

export const measurementEnvironment = async (directory, expected, env) => {
  const actual = await resolveRevision(directory)
  if (actual !== expected)
    throw new Error(
      `Performance checkout mismatch: expected ${expected}, got ${actual}`,
    )
  return { ...env, GITHUB_SHA: actual }
}
