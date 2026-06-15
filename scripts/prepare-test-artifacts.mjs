import { spawn } from 'node:child_process'
import {
  artifactGroups,
  inspectArtifactGroup,
  root,
} from './test-artifact-cache.mjs'

const force =
  process.env.FORCE_REBUILD === '1' || process.argv.includes('--force')
const dryRun = process.argv.includes('--dry-run')

function runEnsure(group) {
  const args = [group.scriptPath]
  if (force) args.push('--force')

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(
        new Error(
          `${process.execPath} ${args.join(' ')} exited with code ${
            code ?? -1
          }`,
        ),
      )
    })
  })
}

const groups = [artifactGroups.icons, artifactGroups.wasm]
const pending = []

for (const group of groups) {
  const status = await inspectArtifactGroup(group)
  const state = force ? 'force' : status.fresh ? 'cache-hit' : 'cache-miss'
  console.info(
    `[test-artifacts] ${group.id} ${state} source-hash=${status.sourceHash.slice(
      0,
      16,
    )}`,
  )

  if (!force && status.fresh) {
    console.info(`[test-artifacts] skipping ${group.scriptName}`)
    continue
  }

  for (const reason of status.staleReasons) {
    console.info(`[test-artifacts] ${group.id} miss: ${reason}`)
  }

  if (dryRun) {
    console.info(`[test-artifacts] dry-run skipped ${group.scriptName}`)
    continue
  }

  pending.push(runEnsure(group))
}

await Promise.all(pending)

console.info('[test-artifacts] ready')
