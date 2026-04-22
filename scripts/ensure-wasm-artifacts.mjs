import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const requiredArtifacts = [
  resolve(process.cwd(), 'packages/wasm/dist/index.mjs'),
  resolve(process.cwd(), 'packages/wasm/dist/index.cjs'),
  resolve(process.cwd(), 'packages/wasm/dist/ep_wasm.mjs'),
  resolve(process.cwd(), 'packages/wasm/dist/ep_wasm.wasm'),
]

const hasAllArtifacts = async () => {
  try {
    await Promise.all(
      requiredArtifacts.map((artifact) => access(artifact, constants.F_OK)),
    )
    return true
  } catch {
    return false
  }
}

const run = (command, args) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

    child.on('error', rejectPromise)
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }

      rejectPromise(
        new Error(`${command} ${args.join(' ')} exited with code ${code ?? -1}`),
      )
    })
  })

if (!(await hasAllArtifacts())) {
  console.info('[ensure-wasm] Missing WASM artifacts. Building packages/wasm...')
  await run('pnpm', ['run', '-C', 'packages/wasm', 'build'])
  await run('pnpm', ['run', 'build:wasm'])
} else {
  console.info('[ensure-wasm] Reusing existing packages/wasm/dist artifacts.')
}
