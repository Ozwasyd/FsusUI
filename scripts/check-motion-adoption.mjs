import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const allowedPresets = new Set([
  'surface-settle',
  'paper-settle',
  'route-settle',
  'dialog-settle',
  'sheet-settle',
  'overlay-settle',
  'dock-settle',
  'toast-receipt',
  'banner-receipt',
  'lightbox-focus',
  'index-list-settle',
  'reading-title-settle',
  'media-develop',
  'media-focus',
  'code-ready',
  'grid-settle',
  'quote-line',
  'toc-anchor',
  'anchor-mark',
  'reading-progress-transform',
  'copy-confirm',
])

const target = process.argv[2]

if (!target) {
  console.error(
    'Usage: node scripts/check-motion-adoption.mjs <mapping.json>',
  )
  process.exit(1)
}

const payload = JSON.parse(readFileSync(resolve(process.cwd(), target), 'utf8'))
const mappings = Array.isArray(payload) ? payload : payload.mappings

if (!Array.isArray(mappings)) {
  console.error('Motion adoption file must be an array or contain mappings[].')
  process.exit(1)
}

const findings = []

for (const entry of mappings) {
  const label = entry.semantic ?? '<missing semantic>'

  if (!entry.semantic || !entry.preset || !entry.surface) {
    findings.push(`${label}: semantic, preset, and surface are required.`)
  }

  if (!allowedPresets.has(entry.preset)) {
    findings.push(`${label}: ${entry.preset} is not an adopted FsusUI preset.`)
  }

  if (entry.effect === 'raw-keyframes') {
    findings.push(`${label}: app-local keyframes are not allowed.`)
  }

  if (entry.effect === 'raw-animation-engine') {
    findings.push(`${label}: app-local raw animation engines are not allowed.`)
  }

  if (entry.effect === 'local-wrapper' && entry.callsFsusPreset !== true) {
    findings.push(`${label}: local wrappers must call FsusUI presets.`)
  }

  if (entry.effect === 'loading-sweep' && entry.surface === 'reading-surface') {
    findings.push(`${label}: reading surfaces must not default to loading sweep.`)
  }
}

if (findings.length > 0) {
  for (const finding of findings) console.error(`[error] ${finding}`)
  process.exit(1)
}

console.log(`Motion adoption check passed for ${mappings.length} mappings.`)
