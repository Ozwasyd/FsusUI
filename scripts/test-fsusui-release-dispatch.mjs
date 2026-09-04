#!/usr/bin/env node
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash, generateKeyPairSync } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { URL } from 'node:url'
import {
  canonicalJson,
  dispatchEligibility,
  PACKAGE_NAME,
  pollPublishedPackage,
  runReleaseDispatch,
  sha256,
  validatePayload,
  verifyLocalBindings,
} from './fsusui-release-dispatch-lib.mjs'

const VERSION = '1.2.3'
const SOURCE_COMMIT = 'a'.repeat(40)
const RUN_ID = '416001'
const temporaryRoots = []
const servers = []
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' })

after(async () => {
  await Promise.all(
    servers.map(
      (server) => new Promise((resolve) => server.close(() => resolve())),
    ),
  )
  for (const root of temporaryRoots)
    rmSync(root, { recursive: true, force: true })
})

const writePackageTarball = (
  root,
  { name = PACKAGE_NAME, version = VERSION } = {},
) => {
  const packageRoot = path.join(root, 'archive', 'package')
  mkdirSync(packageRoot, { recursive: true })
  writeFileSync(
    path.join(packageRoot, 'package.json'),
    canonicalJson({ name, version }),
  )
  writeFileSync(path.join(packageRoot, 'index.js'), 'export const value = 1\n')
  const tarball = path.join(root, 'candidate.tgz')
  execFileSync('tar', [
    '-czf',
    tarball,
    '-C',
    path.dirname(packageRoot),
    'package',
  ])
  return tarball
}

const createFixture = () => {
  const root = mkdtempSync(
    path.join(os.tmpdir(), 'fsusui-release-dispatch-test-'),
  )
  temporaryRoots.push(root)
  const candidatePath = writePackageTarball(root)
  const candidateSha256 = sha256(readFileSync(candidatePath))
  const candidateManifestPath = path.join(root, 'candidate.manifest.json')
  writeFileSync(
    candidateManifestPath,
    canonicalJson({
      schemaVersion: 1,
      sourceProfile: 'Release',
      commitSha: SOURCE_COMMIT,
      package: { name: PACKAGE_NAME, version: VERSION, distTag: 'latest' },
      artifact: { filename: 'candidate.tgz', sha256: candidateSha256 },
      metadata: { registry: 'https://registry.npmjs.org/' },
    }),
  )
  const candidateManifestSha256 = sha256(readFileSync(candidateManifestPath))
  const crossGateReceiptPath = path.join(
    root,
    'fsusblog-consumer-gate.receipt.json',
  )
  writeFileSync(
    crossGateReceiptPath,
    canonicalJson({
      schemaVersion: 1,
      status: 'success',
      fsusui: {
        repository: 'Ozwasyd/FsusUI',
        sourceCommit: SOURCE_COMMIT,
        releaseTag: `v${VERSION}`,
      },
      candidate: {
        package: PACKAGE_NAME,
        version: VERSION,
        sha256: candidateSha256,
        manifestSha256: candidateManifestSha256,
      },
      fsusblog: {
        repository: 'Ozwasyd/FsusBlog',
        defaultBranch: 'main',
        commitSha: 'b'.repeat(40),
      },
      toolchain: {
        node: '22.14.0',
        npm: '11.5.1',
        vue: '3.5.18',
        vite: '7.1.3',
        typescript: '5.9.2',
        vueTsc: '3.0.5',
      },
      gates: [
        { name: 'verify:fsusui-candidate', status: 'success', durationMs: 1 },
      ],
      startedAt: '2026-09-03T00:00:00Z',
      completedAt: '2026-09-03T00:00:01Z',
      workflow: { runId: '318001', runUrl: 'https://example.test/runs/318001' },
    }),
  )
  return {
    root,
    candidatePath,
    candidateSha256,
    candidateManifestPath,
    candidateManifestSha256,
    crossGateReceiptPath,
    crossGateReceiptSha256: sha256(readFileSync(crossGateReceiptPath)),
    receiptPath: path.join(root, 'fsusui-release-dispatch.receipt.json'),
    downloadedTarballPath: path.join(root, 'npm-download.tgz'),
  }
}

const readBody = async (request) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

const sendJson = (response, status, value) => {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(value))
}

const startServices = async (
  fixture,
  {
    versionReadable = true,
    metadataName = PACKAGE_NAME,
    metadataVersion = VERSION,
    distTag = VERSION,
    integrity,
    tarballBytes = readFileSync(fixture.candidatePath),
    sourcePermissions = { metadata: 'read' },
    targetPermissions = {
      metadata: 'read',
      contents: 'write',
      pull_requests: 'write',
    },
    appPermissions = {
      metadata: 'read',
      contents: 'write',
      pull_requests: 'write',
    },
  } = {},
) => {
  const state = { dispatches: [], tokenRequests: [] }
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, baseUrl)
    const method = request.method
    if (method === 'GET' && url.pathname === '/app') {
      return sendJson(response, 200, { permissions: appPermissions })
    }
    if (
      method === 'GET' &&
      decodeURIComponent(url.pathname) === `/${PACKAGE_NAME}/${VERSION}`
    ) {
      if (!versionReadable)
        return sendJson(response, 404, { error: 'not found' })
      const npmIntegrity =
        integrity ??
        `sha512-${createHash('sha512').update(tarballBytes).digest('base64')}`
      return sendJson(response, 200, {
        name: metadataName,
        version: metadataVersion,
        dist: {
          integrity: npmIntegrity,
          tarball: `${baseUrl}@ozwasyd/element-plus/-/element-plus-${VERSION}.tgz`,
        },
      })
    }
    if (
      method === 'GET' &&
      decodeURIComponent(url.pathname) === `/${PACKAGE_NAME}`
    ) {
      return sendJson(response, 200, { 'dist-tags': { latest: distTag } })
    }
    if (
      method === 'GET' &&
      url.pathname === `/@ozwasyd/element-plus/-/element-plus-${VERSION}.tgz`
    ) {
      response.writeHead(200, { 'content-type': 'application/octet-stream' })
      return response.end(tarballBytes)
    }
    if (
      method === 'GET' &&
      (url.pathname === '/repos/Ozwasyd/FsusUI/installation' ||
        url.pathname === '/repos/Ozwasyd/FsusBlog/installation')
    ) {
      return sendJson(response, 200, {
        id: url.pathname.includes('FsusUI') ? 10 : 20,
      })
    }
    if (
      method === 'POST' &&
      (url.pathname === '/app/installations/10/access_tokens' ||
        url.pathname === '/app/installations/20/access_tokens')
    ) {
      const requestBody = JSON.parse(await readBody(request))
      state.tokenRequests.push(requestBody)
      const source = requestBody.repositories[0] === 'FsusUI'
      return sendJson(response, 201, {
        token: source
          ? 'source-installation-token'
          : 'target-installation-token',
        permissions: source ? sourcePermissions : targetPermissions,
        repositories: [
          { full_name: source ? 'Ozwasyd/FsusUI' : 'Ozwasyd/FsusBlog' },
        ],
      })
    }
    if (method === 'GET' && url.pathname === '/repos/Ozwasyd/FsusUI')
      return sendJson(response, 200, { full_name: 'Ozwasyd/FsusUI' })
    if (
      method === 'POST' &&
      url.pathname === '/repos/Ozwasyd/FsusBlog/dispatches'
    ) {
      state.dispatches.push({
        authorization: request.headers.authorization,
        body: JSON.parse(await readBody(request)),
      })
      response.writeHead(204)
      return response.end()
    }
    sendJson(response, 404, { error: `${method} ${url.pathname}` })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  servers.push(server)
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}/`
  return { baseUrl, state }
}

const runFixture = async (fixture, services, overrides = {}) =>
  runReleaseDispatch({
    candidatePath: fixture.candidatePath,
    candidateManifestPath: fixture.candidateManifestPath,
    crossGateReceiptPath: fixture.crossGateReceiptPath,
    expectedCrossGateReceiptSha256: fixture.crossGateReceiptSha256,
    sourceCommit: SOURCE_COMMIT,
    releaseTag: `v${VERSION}`,
    distTag: 'latest',
    publishRunId: RUN_ID,
    receiptPath: fixture.receiptPath,
    downloadedTarballPath: fixture.downloadedTarballPath,
    registry: services.baseUrl,
    githubApiBase: services.baseUrl,
    appId: '416',
    privateKey: PRIVATE_KEY,
    fetchFn: globalThis.fetch,
    timeoutMs: 25,
    intervalMs: 5,
    allowInsecureFixtureRegistry: true,
    allowInsecureFixtureApi: true,
    ...overrides,
  })

test('stable latest publish verifies npm and sends one exact event', async () => {
  const fixture = createFixture()
  const services = await startServices(fixture)
  const result = await runFixture(fixture, services)
  assert.equal(result.status, 'sent')
  assert.equal(services.state.dispatches.length, 1)
  assert.equal(
    services.state.dispatches[0].authorization,
    'Bearer target-installation-token',
  )
  assert.deepEqual(services.state.dispatches[0].body, {
    event_type: 'fsusui-npm-published-v1',
    client_payload: result.receipt.payload,
  })
  validatePayload(result.receipt.payload)
  assert.equal(result.receipt.payload.candidateSha256, fixture.candidateSha256)
  assert.equal(
    result.receipt.payload.candidateManifestSha256,
    fixture.candidateManifestSha256,
  )
  assert.equal(
    result.receipt.payload.crossGateReceiptSha256,
    fixture.crossGateReceiptSha256,
  )
  assert.deepEqual(services.state.tokenRequests, [
    { repositories: ['FsusUI'], permissions: {} },
    {
      repositories: ['FsusBlog'],
      permissions: { contents: 'write', pull_requests: 'write' },
    },
  ])
  const stored = readFileSync(fixture.receiptPath, 'utf8')
  assert.doesNotMatch(stored, /PRIVATE KEY|installation-token|authorization/iu)
})

test('preview, next, and prerelease channels never dispatch', async () => {
  assert.deepEqual(dispatchEligibility({ version: VERSION, distTag: 'next' }), {
    eligible: false,
    reason: 'non-latest',
  })
  assert.deepEqual(
    dispatchEligibility({ version: `${VERSION}-beta.1`, distTag: 'latest' }),
    { eligible: false, reason: 'prerelease' },
  )
  for (const release of [
    { releaseTag: `v${VERSION}`, distTag: 'next' },
    { releaseTag: `v${VERSION}-preview.1`, distTag: 'preview' },
    { releaseTag: `v${VERSION}-rc.1`, distTag: 'latest' },
  ]) {
    const result = await runReleaseDispatch(release)
    assert.equal(result.status, 'skipped')
  }
})

test('npm version unreadable timeout prevents dispatch', async () => {
  const fixture = createFixture()
  const services = await startServices(fixture, { versionReadable: false })
  let clock = 0
  await assert.rejects(
    runFixture(fixture, services, {
      now: () => clock,
      sleep: async (duration) => {
        clock += duration
      },
    }),
    /did not become readable before timeout/u,
  )
  assert.equal(services.state.dispatches.length, 0)
})

test('production sender rejects every non-canonical registry', async () => {
  await assert.rejects(
    pollPublishedPackage({
      registry: 'https://registry.example.test/',
      version: VERSION,
    }),
    /canonical public npm registry/u,
  )
})

test('npm integrity mismatch prevents dispatch', async () => {
  const fixture = createFixture()
  const services = await startServices(fixture, {
    integrity: `sha512-${Buffer.alloc(64, 7).toString('base64')}`,
  })
  await assert.rejects(runFixture(fixture, services), /dist\.integrity/u)
  assert.equal(services.state.dispatches.length, 0)
})

test('npm tarball SHA mismatch prevents dispatch', async () => {
  const fixture = createFixture()
  const otherRoot = mkdtempSync(path.join(os.tmpdir(), 'fsusui-release-other-'))
  temporaryRoots.push(otherRoot)
  const other = readFileSync(writePackageTarball(otherRoot))
  other[other.length - 8] ^= 1
  const services = await startServices(fixture, { tarballBytes: other })
  await assert.rejects(runFixture(fixture, services), /SHA-256/u)
  assert.equal(services.state.dispatches.length, 0)
})

test('npm package name and version mismatch prevent dispatch', async () => {
  for (const override of [
    { metadataName: '@example/not-fsusui' },
    { metadataVersion: '1.2.4' },
  ]) {
    const fixture = createFixture()
    const services = await startServices(fixture, override)
    await assert.rejects(runFixture(fixture, services), /name\/version/u)
    assert.equal(services.state.dispatches.length, 0)
  }
})

test('npm latest dist-tag mismatch prevents dispatch', async () => {
  const fixture = createFixture()
  const services = await startServices(fixture, { distTag: '1.2.2' })
  await assert.rejects(runFixture(fixture, services), /latest dist-tag/u)
  assert.equal(services.state.dispatches.length, 0)
})

test('#318 receipt missing or digest/candidate mismatch fails closed', () => {
  const fixture = createFixture()
  const common = {
    candidatePath: fixture.candidatePath,
    candidateManifestPath: fixture.candidateManifestPath,
    crossGateReceiptPath: fixture.crossGateReceiptPath,
    expectedCrossGateReceiptSha256: fixture.crossGateReceiptSha256,
    sourceCommit: SOURCE_COMMIT,
    releaseTag: `v${VERSION}`,
  }
  assert.throws(
    () =>
      verifyLocalBindings({
        ...common,
        crossGateReceiptPath: `${fixture.root}/missing`,
      }),
    /#318 receipt is missing/u,
  )
  assert.throws(
    () =>
      verifyLocalBindings({
        ...common,
        expectedCrossGateReceiptSha256: 'c'.repeat(64),
      }),
    /trusted output/u,
  )
  const receipt = JSON.parse(readFileSync(fixture.crossGateReceiptPath, 'utf8'))
  receipt.candidate.sha256 = 'd'.repeat(64)
  writeFileSync(fixture.crossGateReceiptPath, canonicalJson(receipt))
  assert.throws(
    () =>
      verifyLocalBindings({
        ...common,
        expectedCrossGateReceiptSha256: sha256(
          readFileSync(fixture.crossGateReceiptPath),
        ),
      }),
    /not bound to this candidate/u,
  )
})

test('payload rejects missing, extra, and malformed fields', async () => {
  const fixture = createFixture()
  const services = await startServices(fixture)
  const { receipt } = await runFixture(fixture, services)
  const missing = structuredClone(receipt.payload)
  delete missing.publishRunId
  assert.throws(() => validatePayload(missing), /missing or unknown fields/u)
  assert.throws(
    () => validatePayload({ ...receipt.payload, unknown: true }),
    /missing or unknown fields/u,
  )
  assert.throws(
    () => validatePayload({ ...receipt.payload, sourceCommit: 'short' }),
    /full SHA/u,
  )
})

test('duplicate execution reuses identical receipt and sends no second event', async () => {
  const fixture = createFixture()
  const services = await startServices(fixture)
  const first = await runFixture(fixture, services)
  const second = await runFixture(fixture, services)
  assert.equal(first.status, 'sent')
  assert.equal(second.status, 'already-sent')
  assert.deepEqual(second.receipt.payload, first.receipt.payload)
  assert.equal(services.state.dispatches.length, 1)
})

test('missing App credentials prevent dispatch', async () => {
  const fixture = createFixture()
  const services = await startServices(fixture)
  await assert.rejects(
    runFixture(fixture, services, { appId: undefined, privateKey: undefined }),
    /APP_ID/u,
  )
  assert.equal(services.state.dispatches.length, 0)
})

test('excessive or insufficient App token permissions prevent dispatch', async () => {
  for (const targetPermissions of [
    {
      metadata: 'read',
      contents: 'write',
      pull_requests: 'write',
      issues: 'write',
    },
    { metadata: 'read', contents: 'read', pull_requests: 'write' },
  ]) {
    const fixture = createFixture()
    const services = await startServices(fixture, { targetPermissions })
    await assert.rejects(runFixture(fixture, services), /permissions|contents/u)
    assert.equal(services.state.dispatches.length, 0)
  }
})

test('excessive or insufficient App registration permissions prevent dispatch', async () => {
  for (const appPermissions of [
    {
      metadata: 'read',
      contents: 'write',
      pull_requests: 'write',
      administration: 'read',
    },
    { metadata: 'read', contents: 'write', pull_requests: 'read' },
  ]) {
    const fixture = createFixture()
    const services = await startServices(fixture, { appPermissions })
    await assert.rejects(
      runFixture(fixture, services),
      /permissions|pull_requests/u,
    )
    assert.equal(services.state.dispatches.length, 0)
  }
})

test('FsusUI App token is metadata-only', async () => {
  const fixture = createFixture()
  const services = await startServices(fixture, {
    sourcePermissions: { metadata: 'read', contents: 'read' },
  })
  await assert.rejects(runFixture(fixture, services), /metadata permissions/u)
  assert.equal(services.state.dispatches.length, 0)
})
