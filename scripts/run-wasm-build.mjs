import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const isPathLike = (value) => /[\\/]/u.test(value) || value.endsWith('.exe')

const existingFiles = (candidates) =>
  candidates.filter((candidate) => candidate && existsSync(candidate))

const getBashCandidates = () => {
  const configuredBash = process.env.WASM_BASH?.trim()

  if (process.platform !== 'win32') {
    return [configuredBash, 'bash'].filter(Boolean)
  }

  return [
    configuredBash,
    ...existingFiles([
      join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git/bin/bash.exe'),
      join(
        process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
        'Git/bin/bash.exe',
      ),
      process.env.LOCALAPPDATA
        ? join(process.env.LOCALAPPDATA, 'Programs/Git/bin/bash.exe')
        : '',
    ]),
    'bash',
  ].filter(Boolean)
}

const [bash] = getBashCandidates()

if (!bash) {
  console.error(
    'Unable to find bash for packages/wasm/build.sh. Set WASM_BASH to a bash executable.',
  )
  process.exit(1)
}

const child = spawn(bash, ['./build.sh', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: !isPathLike(bash) && process.platform === 'win32',
})

child.on('error', (error) => {
  console.error(`Failed to start ${bash}: ${error.message}`)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`${bash} exited because of signal ${signal}`)
    process.exit(1)
  }

  process.exit(code ?? 1)
})
