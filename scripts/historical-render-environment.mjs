import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const json = async (file) => JSON.parse(await readFile(file, 'utf8'))
const requireThat = (condition, message) => {
  if (!condition) throw new Error(`Historical baseline rejected: ${message}`)
}

export function validateHistoricalSdkPolicy(policy, selected) {
  const stable = /^(\d+)\.(\d+)\.(\d+)$/u
  const wanted = stable.exec(policy?.version ?? '')
  const actual = stable.exec(selected)
  requireThat(wanted && actual, 'stable SDK versions required')
  requireThat(
    !Object.keys(policy).some(
      (key) => !['version', 'rollForward', 'allowPrerelease'].includes(key),
    ),
    'unsupported historical SDK policy',
  )
  const exact = policy.version === selected
  const laterFeature =
    policy.rollForward === 'latestFeature' &&
    wanted[1] === actual[1] &&
    wanted[2] === actual[2] &&
    Number(actual[3]) >= Number(wanted[3])
  requireThat(
    (exact && ['disable', 'latestFeature'].includes(policy.rollForward)) ||
      laterFeature,
    'installed SDK is outside the explicitly supported historical roll-forward range',
  )
}

const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`

export async function prepareHistoricalSdk(
  directory,
  currentRoot,
  env = process.env,
) {
  const current = (await json(path.join(currentRoot, 'global.json'))).sdk
  requireThat(
    current?.rollForward === 'disable',
    'current SDK must be exactly pinned',
  )
  let policyPath = path.join(directory, 'global.json')
  try {
    await access(policyPath)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    policyPath = path.join(directory, 'dotnet/global.json')
  }
  const policyBytes = await readFile(policyPath, 'utf8')
  validateHistoricalSdkPolicy(JSON.parse(policyBytes).sdk, current.version)
  const evidence = {
    version: current.version,
    policyPath: path.relative(directory, policyPath),
    policy: JSON.parse(policyBytes),
    policySha256: createHash('sha256').update(policyBytes).digest('hex'),
    restoreLockedMode: true,
  }
  const ambient = await exec('dotnet', ['--version'], {
    cwd: directory,
    env,
  }).then(
    (result) => result.stdout.trim(),
    () => null,
  )
  if (ambient === current.version)
    return {
      env: { ...env, RestoreLockedMode: 'true' },
      cleanup: async () => {},
      evidence: { ...evidence, selection: 'ambient-exact' },
    }
  requireThat(
    process.platform !== 'win32',
    'SDK bridge requires a POSIX runner; exact ambient SDK is unavailable',
  )
  const installed = (await exec('dotnet', ['--list-sdks'], { env })).stdout
  const sdk = installed
    .split(/\r?\n/u)
    .map((line) => /^(\S+) \[(.+)\]$/u.exec(line))
    .find((entry) => entry?.[1] === current.version)
  requireThat(sdk, `exact SDK ${current.version} is not installed`)
  const dotnetRoot = path.dirname(sdk[2])
  const host = path.join(dotnetRoot, 'dotnet')
  const entry = path.join(sdk[2], current.version, 'dotnet.dll')
  await access(host)
  await access(entry)
  const launcher = await mkdtemp(path.join(os.tmpdir(), 'fsus-historical-sdk-'))
  const cleanup = () => rm(launcher, { recursive: true, force: true })
  try {
    await writeFile(
      path.join(launcher, 'dotnet'),
      `#!/bin/sh\nexec ${quote(host)} ${quote(entry)} "$@"\n`,
      { mode: 0o700 },
    )
    const selectedEnv = {
      ...env,
      PATH: `${launcher}${path.delimiter}${env.PATH ?? ''}`,
      DOTNET_ROOT: dotnetRoot,
      DOTNET_HOST_PATH: host,
      RestoreLockedMode: 'true',
    }
    const version = (
      await exec('dotnet', ['--version'], { cwd: directory, env: selectedEnv })
    ).stdout.trim()
    requireThat(
      version === current.version,
      'SDK launcher did not select exact version',
    )
    return {
      env: selectedEnv,
      cleanup,
      evidence: { ...evidence, selection: 'explicit-entrypoint', host, entry },
    }
  } catch (error) {
    await cleanup()
    throw error
  }
}

export async function assertHistoricalIdentity(directory, sha, output, phase) {
  const actual = (
    await exec('git', ['rev-parse', '--verify', 'HEAD'], { cwd: directory })
  ).stdout.trim()
  requireThat(actual === sha, 'historical HEAD mismatch')
  try {
    await exec('git', ['diff', '--quiet', 'HEAD', '--'], { cwd: directory })
  } catch (error) {
    if (error.code !== 1) throw error
    const changed = (
      await exec(
        'git',
        ['diff', '--no-renames', '--name-status', '-z', 'HEAD', '--'],
        { cwd: directory },
      )
    ).stdout.split('\0')
    if (changed.at(-1) === '') changed.pop()
    const paths = []
    for (let i = 0; i < changed.length; i += 2)
      paths.push({ status: changed[i], path: changed[i + 1] })
    await mkdir(output, { recursive: true })
    const evidence = { sha, phase, paths }
    await writeFile(
      path.join(output, `historical-source-drift-${phase}.json`),
      `${JSON.stringify(evidence, null, 2)}\n`,
    )
    console.error(
      `Historical tracked source drift: ${JSON.stringify(evidence)}`,
    )
    throw new Error(
      'Historical baseline rejected: tracked source drift (see diagnostic artifact)',
      { cause: error },
    )
  }
}
