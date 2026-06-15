import {
  artifactGroups,
  inspectArtifactGroup,
} from './test-artifact-cache.mjs'

let failed = false

for (const group of [artifactGroups.icons, artifactGroups.wasm]) {
  const status = await inspectArtifactGroup(group)
  if (status.fresh) {
    console.log(
      `[test-artifacts-ready] ${group.id} cache-hit source-hash=${status.sourceHash.slice(
        0,
        16,
      )}`,
    )
    continue
  }

  failed = true
  console.error(
    `[test-artifacts-ready] ${group.id} is missing or stale; run prepare:test-artifacts first.`,
  )
  for (const reason of status.staleReasons) {
    console.error(`  - ${reason}`)
  }
}

if (failed) process.exit(1)

console.log('[test-artifacts-ready] ok')
