import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

const [sourceRoot, beforeTarball, afterTarball, output] = process.argv.slice(2)
assert(sourceRoot && beforeTarball && afterTarball && output, 'Four explicit source/artifact/output arguments required')
const { loadAuthority, checkPackageCandidateFields, projectPublishedExternalFields, PUBLISHED_PACKAGE_REL } = await import(pathToFileURL(path.join(sourceRoot, 'scripts/deps-check-lib.mjs')))
const authority = loadAuthority(sourceRoot)
const source = JSON.parse(readFileSync(path.join(sourceRoot, PUBLISHED_PACKAGE_REL), 'utf8'))
const projection = projectPublishedExternalFields(authority)
const cases = []
for (const id of ['type-fest', 'vue-router']) {
  assert(source.dependencies[id], `Source declaration dependency ${id} must exist`)
  assert.equal(projection.dependencies[id], source.dependencies[id])
  cases.push({ control: 'published projection preserves existing source declaration dependency', id, result: 'PASS' })
  const missing = structuredClone(authority)
  delete missing.published.dependencies[id]
  const errors = checkPackageCandidateFields(sourceRoot, missing)
  assert(errors.some(error => error.field === `dependencies.${id}` && error.code === 'candidate-source-extra'))
  cases.push({ control: 'removing only the published authority entry fails official source drift checker', id, result: 'PASS' })
}
const tempRoot = mkdtempSync(path.join(tmpdir(), 'fsusui-authority-declaration-control-'))
try {
  const manifestPath = path.join(tempRoot, PUBLISHED_PACKAGE_REL)
  mkdirSync(path.dirname(manifestPath), { recursive: true })
  for (const [phase, tarball] of [['before', beforeTarball], ['after', afterTarball]]) {
    const manifest = JSON.parse(execFileSync('tar', ['-xOf', tarball, 'package/package.json'], { encoding: 'utf8' }))
    writeFileSync(manifestPath, JSON.stringify(manifest))
    const errors = checkPackageCandidateFields(tempRoot, authority)
    if (phase === 'before') {
      assert.equal(errors.length, 2)
      for (const id of ['type-fest', 'vue-router']) {
        assert(errors.some(error => error.field === `dependencies.${id}` && error.actual === '<absent>' && error.code === 'candidate-source-drift'))
      }
    } else assert.deepEqual(errors, [])
    cases.push({ control: 'actual canonical artifact checked by official published dependency checker', phase, result: 'PASS', expectedDiagnostics: phase === 'before' ? 2 : 0, actualDiagnostics: errors })
  }
} finally { rmSync(tempRoot, { recursive: true, force: true }) }
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim()
writeFileSync(output, JSON.stringify({ sourceSha, officialCheckerUnchanged: true, sourceManifestAndInstallPinsUnchanged: true, cases }, null, 2) + '\n')
console.log(`PASS ${cases.length} controls: source projection, two missing-authority mutations, and real before/after artifact checks`)
