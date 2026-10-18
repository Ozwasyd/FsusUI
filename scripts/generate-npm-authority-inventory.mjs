#!/usr/bin/env node

import { writeFileSync } from 'node:fs'
import { URL } from 'node:url'
import {
  DEPENDENCY_FIELDS,
  listControlledManifests,
  loadAuthority,
  readJson,
  repoRoot,
} from './npm-authority-lib.mjs'

const authority = loadAuthority()
const packages = {}
for (const { relative } of listControlledManifests(repoRoot)) {
  const manifest = readJson(relative)
  for (const field of DEPENDENCY_FIELDS) {
    for (const [id, version] of Object.entries(manifest[field] ?? {})) {
      if (version.startsWith('workspace:')) continue
      const entry = (packages[id] ??= {
        installPin: authority.install[id],
        occurrences: [],
      })
      if (!entry.installPin) throw new Error(`Missing authority pin: ${id}`)
      entry.occurrences.push({ path: relative, field, version })
    }
  }
}
for (const entry of Object.values(packages)) {
  entry.occurrences.sort((a, b) =>
    `${a.path}:${a.field}`.localeCompare(`${b.path}:${b.field}`, 'en'),
  )
}
writeFileSync(
  new URL(
    '../config/dependencies/npm-authority.inventory.json',
    import.meta.url,
  ),
  `${JSON.stringify(
    {
      generator: 'node scripts/generate-npm-authority-inventory.mjs',
      externalPackageCount: Object.keys(packages).length,
      packages: Object.fromEntries(
        Object.entries(packages).sort(([a], [b]) => a.localeCompare(b, 'en')),
      ),
      unresolved: [],
    },
    null,
    2,
  )}\n`,
)
