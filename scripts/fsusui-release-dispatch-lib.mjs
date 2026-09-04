import { createHash, createSign, timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { setTimeout as wait } from 'node:timers/promises'
import { URL } from 'node:url'

export const EVENT_TYPE = 'fsusui-npm-published-v1'
export const PUBLIC_REGISTRY = 'https://registry.npmjs.org/'
export const SOURCE_REPOSITORY = 'Ozwasyd/FsusUI'
export const TARGET_REPOSITORY = 'Ozwasyd/FsusBlog'
export const PACKAGE_NAME = '@ozwasyd/element-plus'

const HEX_40 = /^[a-f0-9]{40}$/u
const HEX_64 = /^[a-f0-9]{64}$/u
const STABLE_VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u
const SHA512_INTEGRITY = /^sha512-([A-Za-z0-9+/]+={0,2})$/u
const RUN_ID = /^[1-9]\d*$/u
const CROSS_GATE_NAMES = [
  'published-package-typecheck',
  'fsusui-export-boundary',
  'frontend-production-build',
  'worker-wasm-package-path',
  'single-vue-runtime',
]

const PAYLOAD_KEYS = [
  'schemaVersion',
  'package',
  'version',
  'distTag',
  'registry',
  'sourceRepository',
  'sourceCommit',
  'releaseTag',
  'candidateSha256',
  'candidateManifestSha256',
  'crossGateReceiptSha256',
  'npmIntegrity',
  'npmTarballSha256',
  'publishRunId',
]

const RECEIPT_KEYS = [
  'schemaVersion',
  'eventType',
  'payload',
  'payloadSha256',
  'dispatch',
]

const canonicalValue = (value) => {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    )
  }
  return value
}

export const canonicalJson = (value) =>
  `${JSON.stringify(canonicalValue(value))}\n`

export const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex')

const sha256File = (filePath) => sha256(readFileSync(filePath))

const readJson = (filePath, label) => {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    throw new Error(`${label} is missing or is not valid JSON.`)
  }
}

const assertExactKeys = (value, keys, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object.`)
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${label} has missing or unknown fields.`)
  }
}

const assertString = (value, label) => {
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(`${label} must be a non-empty string.`)
}

const assertHex = (value, expression, label) => {
  if (typeof value !== 'string' || !expression.test(value))
    throw new Error(`${label} has an invalid digest format.`)
}

export function validatePayload(payload) {
  assertExactKeys(payload, PAYLOAD_KEYS, 'Release dispatch payload')
  if (payload.schemaVersion !== 1)
    throw new Error('Release dispatch payload schemaVersion must be 1.')
  if (payload.package !== PACKAGE_NAME)
    throw new Error('Release dispatch payload package is not canonical.')
  if (!STABLE_VERSION.test(payload.version))
    throw new Error('Release dispatch payload version must be stable semver.')
  if (payload.distTag !== 'latest')
    throw new Error('Release dispatch payload distTag must be latest.')
  if (payload.registry !== PUBLIC_REGISTRY)
    throw new Error('Release dispatch payload registry is not canonical.')
  if (payload.sourceRepository !== SOURCE_REPOSITORY)
    throw new Error(
      'Release dispatch payload sourceRepository is not canonical.',
    )
  if (!HEX_40.test(payload.sourceCommit))
    throw new Error('Release dispatch payload sourceCommit must be a full SHA.')
  if (payload.releaseTag !== `v${payload.version}`)
    throw new Error(
      'Release dispatch payload releaseTag does not match version.',
    )
  for (const key of [
    'candidateSha256',
    'candidateManifestSha256',
    'crossGateReceiptSha256',
    'npmTarballSha256',
  ]) {
    assertHex(payload[key], HEX_64, `Release dispatch payload ${key}`)
  }
  if (payload.npmTarballSha256 !== payload.candidateSha256)
    throw new Error('npm tarball SHA-256 does not match the candidate.')
  if (
    typeof payload.npmIntegrity !== 'string' ||
    !SHA512_INTEGRITY.test(payload.npmIntegrity)
  ) {
    throw new Error(
      'Release dispatch payload npmIntegrity must use sha512 SRI.',
    )
  }
  if (
    typeof payload.publishRunId !== 'string' ||
    !RUN_ID.test(payload.publishRunId)
  )
    throw new Error('Release dispatch payload publishRunId is invalid.')
  return payload
}

export function dispatchEligibility({ version, distTag }) {
  if (distTag !== 'latest') return { eligible: false, reason: 'non-latest' }
  if (!STABLE_VERSION.test(version))
    return { eligible: false, reason: 'prerelease' }
  return { eligible: true, reason: 'stable-latest' }
}

const packageJsonFromTarball = (tarballPath) => {
  let content
  try {
    content = execFileSync(
      'tar',
      ['-xOzf', tarballPath, 'package/package.json'],
      {
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024,
      },
    )
  } catch {
    throw new Error('npm tarball does not contain a readable package.json.')
  }
  try {
    return JSON.parse(content)
  } catch {
    throw new Error('npm tarball package.json is invalid.')
  }
}

const assertCandidateManifest = ({
  manifest,
  candidateSha256,
  sourceCommit,
  releaseTag,
}) => {
  if (
    manifest.schemaVersion !== 1 ||
    manifest.sourceProfile !== 'Release' ||
    manifest.commitSha !== sourceCommit ||
    manifest.package?.name !== PACKAGE_NAME ||
    manifest.package?.version !== releaseTag.slice(1) ||
    manifest.package?.distTag !== 'latest' ||
    manifest.artifact?.sha256 !== candidateSha256 ||
    manifest.metadata?.registry !== PUBLIC_REGISTRY
  ) {
    throw new Error(
      'Candidate manifest identity does not match stable release.',
    )
  }
}

const assertCrossGateReceipt = ({
  receipt,
  candidateSha256,
  candidateManifestSha256,
  sourceCommit,
  releaseTag,
}) => {
  assertExactKeys(
    receipt,
    [
      'schemaVersion',
      'status',
      'fsusui',
      'candidate',
      'fsusblog',
      'toolchain',
      'gates',
      'workingTree',
      'startedAt',
      'completedAt',
      'workflow',
      'diagnostics',
    ],
    '#318 receipt',
  )
  assertExactKeys(
    receipt.fsusui,
    ['repository', 'sourceCommit', 'releaseTag'],
    '#318 receipt FsusUI identity',
  )
  assertExactKeys(
    receipt.candidate,
    ['package', 'version', 'sha256', 'manifestSha256', 'bindingSha256'],
    '#318 receipt candidate identity',
  )
  assertExactKeys(
    receipt.fsusblog,
    ['repository', 'defaultBranch', 'commitSha'],
    '#318 receipt FsusBlog identity',
  )
  assertExactKeys(
    receipt.toolchain,
    ['node', 'npm', 'vue', 'vite', 'typescript', 'vueTsc'],
    '#318 receipt toolchain',
  )
  assertExactKeys(
    receipt.workingTree,
    ['before', 'after'],
    '#318 receipt working tree',
  )
  assertExactKeys(
    receipt.workflow,
    ['runId', 'runUrl'],
    '#318 receipt workflow',
  )
  if (
    receipt.schemaVersion !== 1 ||
    receipt.status !== 'success' ||
    receipt.fsusui?.repository !== SOURCE_REPOSITORY ||
    receipt.fsusui?.sourceCommit !== sourceCommit ||
    receipt.fsusui?.releaseTag !== releaseTag ||
    receipt.candidate?.package !== PACKAGE_NAME ||
    receipt.candidate?.version !== releaseTag.slice(1) ||
    receipt.candidate?.sha256 !== candidateSha256 ||
    receipt.candidate?.manifestSha256 !== candidateManifestSha256 ||
    !HEX_64.test(receipt.candidate?.bindingSha256 ?? '') ||
    receipt.fsusblog?.repository !== TARGET_REPOSITORY ||
    typeof receipt.fsusblog?.defaultBranch !== 'string' ||
    receipt.fsusblog.defaultBranch.length === 0 ||
    !HEX_40.test(receipt.fsusblog?.commitSha ?? '') ||
    Object.values(receipt.toolchain).some(
      (value) => typeof value !== 'string' || value.length === 0,
    ) ||
    receipt.workingTree.before !== 'clean' ||
    receipt.workingTree.after !== 'clean' ||
    !Array.isArray(receipt.gates) ||
    receipt.gates.length !== CROSS_GATE_NAMES.length ||
    CROSS_GATE_NAMES.some((name) => {
      const gates = receipt.gates.filter((gate) => gate?.name === name)
      return (
        gates.length !== 1 ||
        Object.keys(gates[0]).length !== 3 ||
        gates[0].status !== 'success' ||
        !Number.isInteger(gates[0].durationMs) ||
        gates[0].durationMs < 0
      )
    }) ||
    !Array.isArray(receipt.diagnostics) ||
    receipt.diagnostics.length !== 0 ||
    typeof receipt.startedAt !== 'string' ||
    typeof receipt.completedAt !== 'string' ||
    receipt.completedAt < receipt.startedAt ||
    !RUN_ID.test(receipt.workflow.runId ?? '') ||
    !/^https:\/\//u.test(receipt.workflow.runUrl ?? '')
  ) {
    throw new Error(
      '#318 receipt is not successful or is not bound to this candidate.',
    )
  }
}

export function verifyLocalBindings({
  candidatePath,
  candidateManifestPath,
  crossGateReceiptPath,
  expectedCrossGateReceiptSha256,
  sourceCommit,
  releaseTag,
}) {
  assertHex(sourceCommit, HEX_40, 'Source commit')
  if (!STABLE_VERSION.test(releaseTag?.slice(1) ?? '') || releaseTag[0] !== 'v')
    throw new Error('Release tag must identify a stable version.')
  for (const [filePath, label] of [
    [candidatePath, 'Candidate tarball'],
    [candidateManifestPath, 'Candidate manifest'],
    [crossGateReceiptPath, '#318 receipt'],
  ]) {
    if (!filePath || !existsSync(filePath))
      throw new Error(`${label} is missing.`)
  }
  assertHex(
    expectedCrossGateReceiptSha256,
    HEX_64,
    'Expected #318 receipt SHA-256',
  )

  const candidateSha256 = sha256File(candidatePath)
  const candidateManifestSha256 = sha256File(candidateManifestPath)
  const crossGateReceiptSha256 = sha256File(crossGateReceiptPath)
  if (crossGateReceiptSha256 !== expectedCrossGateReceiptSha256)
    throw new Error('#318 receipt SHA-256 does not match its trusted output.')

  const manifest = readJson(candidateManifestPath, 'Candidate manifest')
  assertCandidateManifest({
    manifest,
    candidateSha256,
    sourceCommit,
    releaseTag,
  })
  const candidatePackage = packageJsonFromTarball(candidatePath)
  if (
    candidatePackage.name !== PACKAGE_NAME ||
    candidatePackage.version !== releaseTag.slice(1)
  ) {
    throw new Error(
      'Candidate tarball package identity does not match release.',
    )
  }

  const crossGateReceipt = readJson(crossGateReceiptPath, '#318 receipt')
  assertCrossGateReceipt({
    receipt: crossGateReceipt,
    candidateSha256,
    candidateManifestSha256,
    sourceCommit,
    releaseTag,
  })
  return {
    candidateSha256,
    candidateManifestSha256,
    crossGateReceiptSha256,
    package: PACKAGE_NAME,
    version: releaseTag.slice(1),
  }
}

const packageMetadataUrl = (registry, packageName, version) =>
  new URL(`${encodeURIComponent(packageName)}/${version}`, registry).toString()

const packageRootUrl = (registry, packageName) =>
  new URL(encodeURIComponent(packageName), registry).toString()

const responseJson = async (response, label) => {
  try {
    return await response.json()
  } catch {
    throw new Error(`${label} returned invalid JSON.`)
  }
}

export async function pollPublishedPackage({
  fetchFn = globalThis.fetch,
  registry = PUBLIC_REGISTRY,
  packageName = PACKAGE_NAME,
  version,
  timeoutMs = 180_000,
  intervalMs = 5_000,
  now = Date.now,
  sleep = wait,
  allowInsecureFixtureRegistry = false,
}) {
  if (registry !== PUBLIC_REGISTRY && !allowInsecureFixtureRegistry)
    throw new Error('Only the canonical public npm registry is allowed.')
  const deadline = now() + timeoutMs
  let lastStatus = 'not requested'
  while (now() <= deadline) {
    const response = await fetchFn(
      packageMetadataUrl(registry, packageName, version),
      {
        headers: { accept: 'application/json' },
        redirect: 'error',
      },
    )
    lastStatus = String(response.status)
    if (response.ok) {
      const versionMetadata = await responseJson(
        response,
        'npm version metadata',
      )
      const rootResponse = await fetchFn(
        packageRootUrl(registry, packageName),
        {
          headers: { accept: 'application/json' },
          redirect: 'error',
        },
      )
      if (!rootResponse.ok)
        throw new Error(
          `npm package metadata lookup failed (${rootResponse.status}).`,
        )
      const rootMetadata = await responseJson(
        rootResponse,
        'npm package metadata',
      )
      return { versionMetadata, rootMetadata }
    }
    if (response.status !== 404 && response.status < 500)
      throw new Error(`npm version lookup failed (${response.status}).`)
    if (now() > deadline) break
    await sleep(intervalMs)
  }
  throw new Error(
    `npm version did not become readable before timeout (last status ${lastStatus}).`,
  )
}

const assertTarballRegistry = ({
  tarballUrl,
  registry,
  allowInsecureFixtureRegistry,
}) => {
  let parsed
  try {
    parsed = new URL(tarballUrl)
  } catch {
    throw new Error('npm dist.tarball is not a valid URL.')
  }
  const canonical = new URL(registry)
  if (
    parsed.origin !== canonical.origin ||
    parsed.username ||
    parsed.password ||
    (!allowInsecureFixtureRegistry && parsed.protocol !== 'https:')
  ) {
    throw new Error('npm dist.tarball does not use the fixed registry.')
  }
}

export async function downloadAndVerifyPublishedTarball({
  fetchFn = globalThis.fetch,
  registry = PUBLIC_REGISTRY,
  versionMetadata,
  rootMetadata,
  packageName = PACKAGE_NAME,
  version,
  candidateSha256,
  tarballPath,
  allowInsecureFixtureRegistry = false,
}) {
  if (
    versionMetadata.name !== packageName ||
    versionMetadata.version !== version
  ) {
    throw new Error('npm metadata package name/version does not match release.')
  }
  if (rootMetadata['dist-tags']?.latest !== version)
    throw new Error(
      'npm latest dist-tag does not point to the published version.',
    )
  const integrity = versionMetadata.dist?.integrity
  const integrityMatch =
    typeof integrity === 'string' ? integrity.match(SHA512_INTEGRITY) : null
  if (!integrityMatch)
    throw new Error('npm dist.integrity is missing or not sha512 SRI.')
  const tarballUrl = versionMetadata.dist?.tarball
  assertString(tarballUrl, 'npm dist.tarball')
  assertTarballRegistry({ tarballUrl, registry, allowInsecureFixtureRegistry })
  const response = await fetchFn(tarballUrl, { redirect: 'error' })
  if (!response.ok)
    throw new Error(`npm tarball download failed (${response.status}).`)
  const bytes = Buffer.from(await response.arrayBuffer())
  const expectedIntegrity = Buffer.from(integrityMatch[1], 'base64')
  const actualIntegrity = createHash('sha512').update(bytes).digest()
  if (
    expectedIntegrity.length !== actualIntegrity.length ||
    !timingSafeEqual(expectedIntegrity, actualIntegrity)
  ) {
    throw new Error('npm tarball does not match dist.integrity.')
  }
  const npmTarballSha256 = sha256(bytes)
  if (npmTarballSha256 !== candidateSha256)
    throw new Error('npm tarball SHA-256 does not match the candidate.')
  mkdirSync(path.dirname(tarballPath), { recursive: true })
  writeFileSync(tarballPath, bytes)
  const npmPackage = packageJsonFromTarball(tarballPath)
  if (npmPackage.name !== packageName || npmPackage.version !== version)
    throw new Error(
      'Downloaded npm tarball package name/version does not match.',
    )
  return { integrity, npmTarballSha256 }
}

export function buildPayload({
  bindings,
  npm,
  sourceCommit,
  releaseTag,
  publishRunId,
}) {
  const payload = {
    schemaVersion: 1,
    package: PACKAGE_NAME,
    version: bindings.version,
    distTag: 'latest',
    registry: PUBLIC_REGISTRY,
    sourceRepository: SOURCE_REPOSITORY,
    sourceCommit,
    releaseTag,
    candidateSha256: bindings.candidateSha256,
    candidateManifestSha256: bindings.candidateManifestSha256,
    crossGateReceiptSha256: bindings.crossGateReceiptSha256,
    npmIntegrity: npm.integrity,
    npmTarballSha256: npm.npmTarballSha256,
    publishRunId: String(publishRunId),
  }
  return validatePayload(payload)
}

const base64url = (value) => Buffer.from(value).toString('base64url')

export function createAppJwt({ appId, privateKey, nowSeconds }) {
  if (!/^[1-9]\d*$/u.test(String(appId ?? '')))
    throw new Error('FSUS_RELEASE_TRAIN_APP_ID is missing or invalid.')
  if (typeof privateKey !== 'string' || !privateKey.includes('PRIVATE KEY'))
    throw new Error('FSUS_RELEASE_TRAIN_APP_PRIVATE_KEY is missing or invalid.')
  const issuedAt = nowSeconds - 60
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(
    JSON.stringify({ iat: issuedAt, exp: issuedAt + 540, iss: String(appId) }),
  )
  const unsigned = `${header}.${payload}`
  try {
    const signer = createSign('RSA-SHA256')
    signer.update(unsigned)
    signer.end()
    return `${unsigned}.${signer.sign(privateKey, 'base64url')}`
  } catch {
    throw new Error('FSUS_RELEASE_TRAIN_APP_PRIVATE_KEY is invalid.')
  }
}

const exactPermissions = (actual, expected, label) => {
  assertExactKeys(actual, Object.keys(expected), `${label} permissions`)
  for (const [permission, level] of Object.entries(expected)) {
    if (actual[permission] !== level)
      throw new Error(`${label} permission ${permission} must be ${level}.`)
  }
}

const exactRepository = (repositories, fullName, label) => {
  if (
    !Array.isArray(repositories) ||
    repositories.length !== 1 ||
    repositories[0]?.full_name !== fullName
  ) {
    throw new Error(`${label} token must be scoped to exactly ${fullName}.`)
  }
}

const apiJson = async (fetchFn, url, init, label) => {
  const response = await fetchFn(url, init)
  const body =
    response.status === 204 ? null : await responseJson(response, label)
  if (!response.ok) throw new Error(`${label} failed (${response.status}).`)
  return { response, body }
}

const installationFor = async ({ fetchFn, apiBase, repository, jwt }) => {
  const { body } = await apiJson(
    fetchFn,
    new URL(`repos/${repository}/installation`, apiBase),
    {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${jwt}`,
        'x-github-api-version': '2022-11-28',
      },
    },
    'GitHub App installation lookup',
  )
  if (!Number.isSafeInteger(body?.id) || body.id <= 0)
    throw new Error('GitHub App installation lookup returned an invalid id.')
  return body.id
}

const installationToken = async ({
  fetchFn,
  apiBase,
  installationId,
  jwt,
  repository,
  permissions,
  fullName,
  label,
}) => {
  const { body } = await apiJson(
    fetchFn,
    new URL(`app/installations/${installationId}/access_tokens`, apiBase),
    {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${jwt}`,
        'content-type': 'application/json',
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify({ repositories: [repository], permissions }),
    },
    `${label} token request`,
  )
  assertString(body?.token, `${label} token`)
  exactPermissions(
    body.permissions,
    { metadata: 'read', ...permissions },
    label,
  )
  exactRepository(body.repositories, fullName, label)
  return body.token
}

export async function mintLeastPrivilegeTokens({
  fetchFn = globalThis.fetch,
  apiBase = 'https://api.github.com/',
  appId,
  privateKey,
  nowSeconds = Math.floor(Date.now() / 1000),
  allowInsecureFixtureApi = false,
}) {
  if (new URL(apiBase).protocol !== 'https:' && !allowInsecureFixtureApi)
    throw new Error('GitHub API must use HTTPS.')
  const jwt = createAppJwt({ appId, privateKey, nowSeconds })
  const app = await apiJson(
    fetchFn,
    new URL('app', apiBase),
    {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${jwt}`,
        'x-github-api-version': '2022-11-28',
      },
    },
    'GitHub App permission check',
  )
  exactPermissions(
    app.body?.permissions,
    { metadata: 'read', contents: 'write', pull_requests: 'write' },
    'Release train App',
  )
  const sourceInstallationId = await installationFor({
    fetchFn,
    apiBase,
    repository: SOURCE_REPOSITORY,
    jwt,
  })
  const sourceToken = await installationToken({
    fetchFn,
    apiBase,
    installationId: sourceInstallationId,
    jwt,
    repository: 'FsusUI',
    permissions: {},
    fullName: SOURCE_REPOSITORY,
    label: 'FsusUI metadata',
  })
  const sourceMetadata = await apiJson(
    fetchFn,
    new URL(`repos/${SOURCE_REPOSITORY}`, apiBase),
    {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${sourceToken}`,
        'x-github-api-version': '2022-11-28',
      },
    },
    'FsusUI metadata check',
  )
  if (sourceMetadata.body?.full_name !== SOURCE_REPOSITORY)
    throw new Error('FsusUI metadata check returned the wrong repository.')

  const targetInstallationId = await installationFor({
    fetchFn,
    apiBase,
    repository: TARGET_REPOSITORY,
    jwt,
  })
  const targetToken = await installationToken({
    fetchFn,
    apiBase,
    installationId: targetInstallationId,
    jwt,
    repository: 'FsusBlog',
    permissions: { contents: 'write', pull_requests: 'write' },
    fullName: TARGET_REPOSITORY,
    label: 'FsusBlog release train',
  })
  return { targetToken }
}

const validateStoredReceipt = (receipt) => {
  assertExactKeys(receipt, RECEIPT_KEYS, 'Release dispatch receipt')
  if (
    receipt.schemaVersion !== 1 ||
    receipt.eventType !== EVENT_TYPE ||
    receipt.dispatch?.repository !== TARGET_REPOSITORY ||
    receipt.dispatch?.status !== 'sent' ||
    receipt.dispatch?.httpStatus !== 204
  ) {
    throw new Error('Existing release dispatch receipt is invalid.')
  }
  validatePayload(receipt.payload)
  if (receipt.payloadSha256 !== sha256(canonicalJson(receipt.payload)))
    throw new Error(
      'Existing release dispatch receipt payload digest is invalid.',
    )
  return receipt
}

export async function sendDispatch({
  fetchFn = globalThis.fetch,
  apiBase = 'https://api.github.com/',
  token,
  payload,
}) {
  const { response } = await apiJson(
    fetchFn,
    new URL(`repos/${TARGET_REPOSITORY}/dispatches`, apiBase),
    {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify({ event_type: EVENT_TYPE, client_payload: payload }),
    },
    'FsusBlog repository dispatch',
  )
  if (response.status !== 204)
    throw new Error('FsusBlog repository dispatch did not return HTTP 204.')
  return response.status
}

const persistReceipt = (receiptPath, receipt) => {
  mkdirSync(path.dirname(receiptPath), { recursive: true })
  const temporary = `${receiptPath}.tmp`
  writeFileSync(temporary, canonicalJson(receipt), { mode: 0o600 })
  renameSync(temporary, receiptPath)
}

export async function runReleaseDispatch({
  candidatePath,
  candidateManifestPath,
  crossGateReceiptPath,
  expectedCrossGateReceiptSha256,
  sourceCommit,
  releaseTag,
  distTag,
  publishRunId,
  receiptPath,
  downloadedTarballPath,
  registry = PUBLIC_REGISTRY,
  githubApiBase = 'https://api.github.com/',
  appId,
  privateKey,
  fetchFn = globalThis.fetch,
  timeoutMs,
  intervalMs,
  now,
  sleep,
  nowSeconds,
  allowInsecureFixtureRegistry = false,
  allowInsecureFixtureApi = false,
}) {
  const version = releaseTag?.startsWith('v') ? releaseTag.slice(1) : ''
  const eligibility = dispatchEligibility({ version, distTag })
  if (!eligibility.eligible)
    return { status: 'skipped', reason: eligibility.reason }

  const bindings = verifyLocalBindings({
    candidatePath,
    candidateManifestPath,
    crossGateReceiptPath,
    expectedCrossGateReceiptSha256,
    sourceCommit,
    releaseTag,
  })
  const metadata = await pollPublishedPackage({
    fetchFn,
    registry,
    packageName: bindings.package,
    version: bindings.version,
    timeoutMs,
    intervalMs,
    now,
    sleep,
    allowInsecureFixtureRegistry,
  })
  const npm = await downloadAndVerifyPublishedTarball({
    fetchFn,
    registry,
    ...metadata,
    packageName: bindings.package,
    version: bindings.version,
    candidateSha256: bindings.candidateSha256,
    tarballPath: downloadedTarballPath,
    allowInsecureFixtureRegistry,
  })
  const payload = buildPayload({
    bindings,
    npm,
    sourceCommit,
    releaseTag,
    publishRunId,
  })
  const payloadSha256 = sha256(canonicalJson(payload))

  if (existsSync(receiptPath)) {
    const existing = validateStoredReceipt(
      readJson(receiptPath, 'Existing release dispatch receipt'),
    )
    if (existing.payloadSha256 !== payloadSha256)
      throw new Error('Publish run already has a different dispatch payload.')
    return { status: 'already-sent', receipt: existing }
  }

  const { targetToken } = await mintLeastPrivilegeTokens({
    fetchFn,
    apiBase: githubApiBase,
    appId,
    privateKey,
    nowSeconds,
    allowInsecureFixtureApi,
  })
  const httpStatus = await sendDispatch({
    fetchFn,
    apiBase: githubApiBase,
    token: targetToken,
    payload,
  })
  const receipt = {
    schemaVersion: 1,
    eventType: EVENT_TYPE,
    payload,
    payloadSha256,
    dispatch: {
      repository: TARGET_REPOSITORY,
      status: 'sent',
      httpStatus,
    },
  }
  persistReceipt(receiptPath, receipt)
  return { status: 'sent', receipt }
}

export const internal = {
  assertCrossGateReceipt,
  validateStoredReceipt,
}
