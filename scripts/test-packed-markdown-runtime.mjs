import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { candidateTarballName, verifyCandidate } from './npm-candidate-lib.mjs'
import { packedMarkdownRuntimeProjectionProbe } from './packed-markdown-runtime-probe.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const candidateArgument = process.argv
  .slice(2)
  .find((argument) => argument !== '--')
const candidateTarballPath = candidateArgument
  ? path.resolve(candidateArgument)
  : path.join(repoRoot, 'dist', 'npm-candidate', candidateTarballName)
const candidate = verifyCandidate({
  repoRoot,
  tarballPath: candidateTarballPath,
})
const fixtureRoot = mkdtempSync(
  path.join(os.tmpdir(), 'fsusui-packed-markdown-runtime-'),
)

try {
  writeFileSync(
    path.join(fixtureRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: 'fsusui-packed-markdown-runtime-probe',
        private: true,
        type: 'module',
      },
      null,
      2,
    )}\n`,
  )
  execFileSync('pnpm', ['add', candidateTarballPath], {
    cwd: fixtureRoot,
    env: {
      ...process.env,
      CI: '1',
      NO_UPDATE_NOTIFIER: '1',
    },
    stdio: 'inherit',
  })
  execFileSync(
    'node',
    [
      '--input-type=module',
      '--eval',
      packedMarkdownRuntimeProjectionProbe(candidate.package.name),
    ],
    {
      cwd: fixtureRoot,
      stdio: 'inherit',
    },
  )
  console.log(
    `Packed Markdown runtime consumer passed from candidate ${candidate.artifact.sha256}.`,
  )
} finally {
  rmSync(fixtureRoot, { force: true, recursive: true })
}
