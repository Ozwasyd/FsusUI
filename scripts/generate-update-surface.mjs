#!/usr/bin/env node
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  UPDATE_SURFACE_REL,
  buildExpectedUpdateSurface,
  canonicalJson,
} from './update-surface-lib.mjs'

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const output = path.join(root, UPDATE_SURFACE_REL)
const surface = buildExpectedUpdateSurface(root)

writeFileSync(output, canonicalJson(surface))
console.log(
  `[generate:update-surface] wrote ${UPDATE_SURFACE_REL} surfaces=${surface.surfaces.length} exclusions=${surface.exclusions.length}`,
)
