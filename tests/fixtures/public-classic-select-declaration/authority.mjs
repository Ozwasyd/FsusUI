import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const authority = JSON.parse(await readFile(new URL('./authority.json', import.meta.url), 'utf8'))
const hash = (value) => createHash('sha256').update(value).digest('hex')
const selectProfile = (field, identity) => {
  const profile = authority.profiles.find((entry) => entry[field] === identity)
  assert.ok(profile, `Unknown classic Select ${field}: ${identity}; inspect the actual source/artifact before adding authority.`)
  return profile
}

export async function sourceAuthority(root) {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0')
    .filter((file) => (file.startsWith('vue/') && !file.includes('/__tests__/') && !file.includes('/__mocks__/')) || ['package.json', 'pnpm-lock.yaml'].includes(file)).sort()
  const rows = await Promise.all(files.map(async (file) => [file, hash(await readFile(path.join(root, file)))]))
  return selectProfile('sourceFingerprint', hash(JSON.stringify(rows)))
}

export async function installedAuthority(packageRoot) {
  const rows = await Promise.all(authority.declarationPaths.map(async (file) => {
    try { return [file, hash(await readFile(path.join(packageRoot, file)))] }
    catch (error) { if (error.code === 'ENOENT') return [file, null]; throw error }
  }))
  const packageJson = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'))
  rows.push(['package.json', hash(JSON.stringify(packageJson))])
  return selectProfile('installedFingerprint', hash(JSON.stringify(rows)))
}

// Normalize only installation location, never diagnostic identity or contents.
export function normalizedDiagnostics(rows) {
  return rows.map((row) => ({
    file: row.file?.replace(/^.*node_modules\/@ozwasyd\/element-plus\//, 'PACKAGE/'),
    line: row.line, code: row.code,
    message: row.message.replace(/"[^"\n]*node_modules\/@ozwasyd\/element-plus\//g, '"PACKAGE/'),
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
}

export function assertInstalledDiagnostics(profile, mode, name, rows) {
  const bundler = profile.installedDiagnostics[`bundler-${name}`]
  const expected = profile.installedDiagnostics[`${mode}-${name}`] ?? (mode === 'node16' && bundler && [
    ...bundler, ...authority.node16BoundaryDiagnostics,
    ...(name === 'positive' ? authority.node16PositiveDiagnostics : []),
  ])
  assert.ok(expected, `No authority for ${profile.name}/${mode}/${name}`)
  assert.deepEqual(normalizedDiagnostics(rows), normalizedDiagnostics(expected), `Every diagnostic must match ${profile.name}/${mode}/${name}; unknown diagnostics fail.`)
}

export function assertProducerDiagnostics(profile, rows) {
  assert.deepEqual(rows, profile.producerDiagnostics, `Complete canonical diagnostics must match ${profile.name}.`)
}
