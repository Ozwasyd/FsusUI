import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const v1AuthorityPath = 'spec/baselines/vue-v1-runtime.json'
const sourcePaths = [
  'vue/packages',
  'vue/internal',
  'vue/vitest.config.ts',
  'vue/vitest.setup.ts',
  'package.json',
  'pnpm-lock.yaml',
  'scripts/npm-package-contract.mjs',
]

export function checkV1Authority({ root, baseSha }) {
  if (!/^[a-f0-9]{40}$/u.test(baseSha ?? ''))
    throw new Error('A full trusted base commit SHA is required')
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
    })
  git('cat-file', '-e', `${baseSha}^{commit}`)
  const file = path.join(root, v1AuthorityPath)
  if (!existsSync(file)) throw new Error('Frozen V1 authority is missing')
  const content = readFileSync(file, 'utf8')
  const previous = spawnSync('git', ['show', `${baseSha}:${v1AuthorityPath}`], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  if (previous.error) throw previous.error
  if (previous.status === 0) {
    if (previous.stdout !== content)
      throw new Error(
        'Frozen V1 authority differs from the trusted base; rebasing the contract is forbidden',
      )
    return {
      status: 'frozen',
      sha256: createHash('sha256').update(content).digest('hex'),
    }
  }
  // Distinguish a missing path from a failed Git invocation.
  if (git('ls-tree', baseSha, '--', v1AuthorityPath).trim())
    throw new Error('Unable to read the existing V1 authority from Git')

  const baseline = JSON.parse(content)
  if (
    baseline.schema !== 'fsusui.v1-runtime-contract.v1' ||
    baseline.source?.kind !== 'source-declarations'
  )
    throw new Error('Invalid initial V1 authority schema or source kind')
  const sourceSha = baseline.source.commitSha
  if (!/^[a-f0-9]{40}$/u.test(sourceSha ?? ''))
    throw new Error('The V1 source must identify an exact commit')
  git('merge-base', '--is-ancestor', sourceSha, baseSha)
  // Bootstrap must describe the old library, never the candidate's refactored tree.
  git('diff', '--exit-code', sourceSha, baseSha, '--', ...sourcePaths)
  git('diff', '--exit-code', sourceSha, '--', ...sourcePaths)
  if (
    git(
      'ls-files',
      '--others',
      '--exclude-standard',
      '--',
      ...sourcePaths,
    ).trim()
  )
    throw new Error(
      'Untracked library source invalidates V1 capture provenance',
    )
  const sourcePackage = JSON.parse(
    git('show', `${sourceSha}:vue/packages/element-plus/package.json`),
  )
  if (baseline.source.packageVersion !== sourcePackage.version)
    throw new Error(
      'V1 package version does not match the recorded source commit',
    )
  const inventory = JSON.parse(
    git('show', `${sourceSha}:spec/baselines/vue-current.json`),
  )
  const expectedNames = inventory.installableComponents
    .map(({ name }) => name)
    .sort()
  if (
    JSON.stringify(Object.keys(baseline.components ?? {}).sort()) !==
    JSON.stringify(expectedNames)
  )
    throw new Error(
      'Initial V1 authority must include every original installable component',
    )
  const tableDoc = git('show', `${sourceSha}:docs/components/table.md`)
  const section =
    tableDoc.split('### Table Exposes')[1]?.split(/\n#{1,3} /u)[0] ?? ''
  const lines = section.split('\n')
  const divider = lines.findIndex((line) => /^\|\s*:?-{3,}:?\s*\|/u.test(line))
  const methods =
    divider < 0
      ? []
      : lines
          .slice(divider + 1)
          .map((line) => line.match(/^\|\s*([A-Za-z]\w*)\s*\|/u)?.[1])
          .filter(Boolean)
  if (
    !methods.length ||
    JSON.stringify(baseline.documentedInstanceMethods?.ElTable) !==
      JSON.stringify(methods)
  )
    throw new Error(
      'Initial V1 authority must retain the documented Table instance methods',
    )
  return {
    status: 'initial-source-freeze',
    sourceSha,
    sha256: createHash('sha256').update(content).digest('hex'),
  }
}

const main = () => {
  const args = process.argv.slice(2)
  const options = { root: process.cwd() }
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]
    const value = args[index + 1]
    if (
      !['--root', '--base'].includes(flag) ||
      !value ||
      value.startsWith('--')
    )
      throw new Error(
        'Usage: node scripts/check-v1-authority.mjs --base <sha> [--root <checkout>]',
      )
    options[flag === '--base' ? 'baseSha' : 'root'] = value
  }
  console.log(JSON.stringify(checkV1Authority(options), null, 2))
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
