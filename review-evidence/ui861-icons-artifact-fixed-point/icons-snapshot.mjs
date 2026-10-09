import { artifactGroups, inspectArtifactGroup } from '../scripts/test-artifact-cache.mjs'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
const status = await inspectArtifactGroup(artifactGroups.icons)
const inputs = await Promise.all(status.fingerprints[0].files.map(async path => {
 const bytes = await readFile(path)
 return {path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')}
}))
await writeFile(process.argv[2], JSON.stringify({sourceSha: execFileSync('git', ['rev-parse','HEAD'], {encoding:'utf8'}).trim(), status, inputs}, null, 2)+'\n')
