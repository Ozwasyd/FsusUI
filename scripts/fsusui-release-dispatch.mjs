#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canonicalJson,
  runReleaseDispatch,
  verifyLocalBindings,
} from './fsusui-release-dispatch-lib.mjs'

const argv = process.argv.slice(2)
const command = argv.shift()

const option = (name, fallback) => {
  const index = argv.indexOf(name)
  if (index === -1) return fallback
  const value = argv[index + 1]
  if (!value || value.startsWith('--'))
    throw new Error(`${name} requires a value.`)
  return value
}

const required = (name) => {
  const value = option(name)
  if (!value) throw new Error(`${name} is required.`)
  return value
}

const common = () => ({
  candidatePath: path.resolve(required('--candidate')),
  candidateManifestPath: path.resolve(required('--candidate-manifest')),
  crossGateReceiptPath: path.resolve(required('--cross-gate-receipt')),
  expectedCrossGateReceiptSha256: required('--cross-gate-receipt-sha256'),
  sourceCommit: required('--source-commit'),
  releaseTag: required('--release-tag'),
})

export async function main() {
  if (command === 'verify') {
    const result = verifyLocalBindings(common())
    process.stdout.write(canonicalJson({ status: 'verified', ...result }))
    return
  }
  if (command !== 'dispatch') {
    throw new Error(
      'Usage: fsusui-release-dispatch.mjs <verify|dispatch> [options]',
    )
  }
  const result = await runReleaseDispatch({
    ...common(),
    distTag: required('--dist-tag'),
    publishRunId: required('--publish-run-id'),
    receiptPath: path.resolve(required('--receipt-out')),
    downloadedTarballPath: path.resolve(required('--npm-tarball-out')),
    appId: process.env.FSUS_RELEASE_TRAIN_APP_ID,
    privateKey: process.env.FSUS_RELEASE_TRAIN_APP_PRIVATE_KEY,
    timeoutMs: Number(option('--timeout-ms', '180000')),
    intervalMs: Number(option('--interval-ms', '5000')),
  })
  process.stdout.write(canonicalJson(result))
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  main().catch((error) => {
    console.error(
      `[fsusui-release-dispatch] ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    process.exitCode = 1
  })
}
