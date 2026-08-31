import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`

const digest = (value) =>
  crypto
    .createHash('sha256')
    .update(typeof value === 'string' ? value : stableJson(value))
    .digest('hex')

export const currentIdentity = () => {
  const gitHead = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  })
  if (gitHead.status !== 0) {
    throw new Error(
      'Avalonia stable readiness cannot resolve the current candidate',
    )
  }
  const contractHash = digest(
    fs.readFileSync(
      path.join(root, 'spec/components/contracts/v2/contract-v2.json'),
    ),
  )
  return { candidate: gitHead.stdout.trim(), contractHash }
}

export const alignmentHash = (alignment) =>
  digest({
    statuses: alignment.statuses,
    stable: alignment.stable,
    gaps: alignment.gaps,
  })

export const readAlignment = (relativePath, expected) => {
  const alignmentPath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(root, relativePath)
  if (!fs.existsSync(alignmentPath)) {
    throw new Error(
      `${relativePath} is missing; run the governed producer "pnpm run conformance:v2" before governance:check`,
    )
  }
  const alignment = JSON.parse(fs.readFileSync(alignmentPath, 'utf8'))
  if (alignment.schema !== 'fsusui.alignment.v2') {
    throw new Error('Contract V2 alignment artifact schema invalid')
  }
  if (!Array.isArray(alignment.statuses)) {
    throw new Error('Contract V2 alignment statuses missing')
  }
  const calculatedAlignmentHash = alignmentHash(alignment)
  for (const field of ['candidate', 'contractHash']) {
    if (alignment.identity?.[field] !== expected[field]) {
      throw new Error(
        `Contract V2 alignment identity ${field} is stale; rerun "pnpm run conformance:v2"`,
      )
    }
  }
  if (
    !alignment.identity ||
    alignment.identity.alignmentHash !== calculatedAlignmentHash
  ) {
    throw new Error('Contract V2 alignment artifact integrity hash is invalid')
  }
  return alignment
}
