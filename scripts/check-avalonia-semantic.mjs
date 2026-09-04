import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const committedDir = path.join(root, 'spec/avalonia/semantic')
const project = path.join(
  root,
  'dotnet/FsusUI.Avalonia.ApiTool/FsusUI.Avalonia.ApiTool.csproj',
)

const expectedFiles = [
  'FsusUI.Avalonia.semantic.json',
  'FsusUI.Avalonia.Themes.semantic.json',
  'FsusUI.Avalonia.Icons.semantic.json',
]

const read = (file) => fs.readFileSync(file, 'utf8')
const exists = (file) => fs.existsSync(file)
const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex')

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const outputHashPattern = /("outputHash": ")[a-f0-9]{64}(")/gu
const outputPayload = (serialized, file) => {
  const matches = serialized.match(outputHashPattern) ?? []
  assert(matches.length === 1, `${file} must contain one source.outputHash`)
  return serialized.replace(outputHashPattern, '$1$2')
}

const validateFreshnessIdentity = (serialized, file) => {
  const baseline = JSON.parse(serialized)
  const source = baseline.source ?? {}
  assert(
    baseline.baselineVersion === '2.3.0',
    `${file} baselineVersion must be 2.3.0`,
  )
  assert(
    source.toolVersion === 'FsusUI.Avalonia.ApiTool@1.7.0',
    `${file} source.toolVersion is stale`,
  )
  for (const field of [
    'inputTreeHash',
    'compilerOptionsHash',
    'dependencyVersionHash',
    'outputHash',
  ]) {
    assert(
      /^[a-f0-9]{64}$/u.test(source[field] ?? ''),
      `${file} source.${field} must be a SHA-256 digest`,
    )
  }
  assert(
    source.contractSchemaVersion === '2.0.0',
    `${file} source.contractSchemaVersion must be 2.0.0`,
  )
  const expectedOutputHash = sha256(outputPayload(serialized, file))
  assert(
    source.outputHash === expectedOutputHash,
    `${file} source.outputHash does not match the semantic payload`,
  )
}

for (const file of expectedFiles) {
  assert(
    exists(path.join(committedDir, file)),
    `${file} must exist under spec/avalonia/semantic`,
  )
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avalonia-semantic-'))
try {
  execFileSync(
    'dotnet',
    [
      'run',
      '--project',
      project,
      '--',
      '--verify-source-semantics',
      '--output',
      tmpDir,
    ],
    {
      cwd: root,
      stdio: 'inherit',
      encoding: 'utf8',
    },
  )

  for (const file of expectedFiles) {
    const generated = read(path.join(tmpDir, file))
    const committed = read(path.join(committedDir, file))
    validateFreshnessIdentity(generated, file)
    validateFreshnessIdentity(committed, file)
    const mutated = committed.replace(
      '"deprecated": false',
      '"deprecated": true',
    )
    assert(mutated !== committed, `${file} payload mutation target missing`)
    let mutationError
    try {
      validateFreshnessIdentity(mutated, `${file} payload mutation`)
    } catch (error) {
      mutationError = error
    }
    assert(
      mutationError?.message.includes(
        'source.outputHash does not match the semantic payload',
      ),
      `${file} payload mutation did not invalidate source.outputHash`,
    )
    assert(
      generated === committed,
      `${file} drifted from the committed Avalonia semantic baseline; run pnpm run avalonia:semantic`,
    )
    console.log(`avalonia:semantic:check passed ${file}`)
  }
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true })
}
