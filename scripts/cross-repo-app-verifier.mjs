#!/usr/bin/env node
import { Buffer } from 'node:buffer'
import { createSign } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { canonicalJson } from './fsusui-release-dispatch-lib.mjs'

const REPOSITORIES = ['Ozwasyd/FsusUI', 'Ozwasyd/FsusBlog']
const PERMISSIONS = { metadata: 'read', contents: 'read' }

const assertExactKeys = (value, expected, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object.`)
  const actual = Object.keys(value).sort()
  const keys = [...expected].sort()
  if (
    actual.length !== keys.length ||
    actual.some((key, index) => key !== keys[index])
  ) {
    throw new Error(`${label} has missing or excessive fields.`)
  }
}

const assertPermissions = (permissions, label) => {
  assertExactKeys(permissions, Object.keys(PERMISSIONS), `${label} permissions`)
  for (const [name, level] of Object.entries(PERMISSIONS)) {
    if (permissions[name] !== level)
      throw new Error(`${label} permission ${name} must be ${level}.`)
  }
}

const appJwt = ({ appId, privateKey, nowSeconds }) => {
  if (!/^[1-9]\d*$/u.test(String(appId ?? '')))
    throw new Error('FSUS_CROSS_REPO_APP_ID is missing or invalid.')
  if (typeof privateKey !== 'string' || !privateKey.includes('PRIVATE KEY'))
    throw new Error('FSUS_CROSS_REPO_APP_PRIVATE_KEY is missing or invalid.')
  const encoded = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  const issuedAt = nowSeconds - 60
  const unsigned = `${encoded({ alg: 'RS256', typ: 'JWT' })}.${encoded({
    iat: issuedAt,
    exp: issuedAt + 540,
    iss: String(appId),
  })}`
  try {
    const signer = createSign('RSA-SHA256')
    signer.update(unsigned)
    signer.end()
    return `${unsigned}.${signer.sign(privateKey, 'base64url')}`
  } catch {
    throw new Error('FSUS_CROSS_REPO_APP_PRIVATE_KEY is invalid.')
  }
}

const api = async (fetchFn, url, init, label) => {
  const response = await fetchFn(url, init)
  let body
  try {
    body = await response.json()
  } catch {
    throw new Error(`${label} returned invalid JSON.`)
  }
  if (!response.ok) throw new Error(`${label} failed (${response.status}).`)
  return body
}

const headers = (credential) => ({
  accept: 'application/vnd.github+json',
  authorization: `Bearer ${credential}`,
  'x-github-api-version': '2022-11-28',
})

const installation = async ({ fetchFn, apiBase, repository, jwt }) => {
  const body = await api(
    fetchFn,
    new URL(`repos/${repository}/installation`, apiBase),
    { headers: headers(jwt) },
    `${repository} installation lookup`,
  )
  if (!Number.isSafeInteger(body.id) || body.id <= 0)
    throw new Error(`${repository} installation id is invalid.`)
  return body.id
}

const tokenFor = async ({
  fetchFn,
  apiBase,
  repository,
  installationId,
  jwt,
}) => {
  const shortName = repository.split('/')[1]
  const body = await api(
    fetchFn,
    new URL(`app/installations/${installationId}/access_tokens`, apiBase),
    {
      method: 'POST',
      headers: { ...headers(jwt), 'content-type': 'application/json' },
      body: JSON.stringify({
        repositories: [shortName],
        permissions: { contents: 'read' },
      }),
    },
    `${repository} token request`,
  )
  if (typeof body.token !== 'string' || body.token.length === 0)
    throw new Error(`${repository} token request returned no token.`)
  assertPermissions(body.permissions, repository)
  if (
    !Array.isArray(body.repositories) ||
    body.repositories.length !== 1 ||
    body.repositories[0]?.full_name !== repository
  ) {
    throw new Error(`${repository} token is not repository-scoped.`)
  }
  return body.token
}

export function validateCrossRepoAppEvidence(evidence) {
  assertExactKeys(
    evidence,
    [
      'schemaVersion',
      'appId',
      'permissions',
      'repositories',
      'checks',
      'status',
    ],
    'Cross-repo App evidence',
  )
  if (evidence.schemaVersion !== 1 || !/^[1-9]\d*$/u.test(evidence.appId))
    throw new Error('Cross-repo App evidence identity is invalid.')
  assertPermissions(evidence.permissions, 'Cross-repo App evidence')
  if (
    !Array.isArray(evidence.repositories) ||
    evidence.repositories.length !== 2 ||
    !REPOSITORIES.every((repository) =>
      evidence.repositories.some(
        (entry) =>
          entry.repository === repository &&
          Number.isSafeInteger(entry.installationId) &&
          entry.installationId > 0 &&
          entry.selection === 'selected' &&
          Object.keys(entry).length === 3,
      ),
    )
  ) {
    throw new Error(
      'Cross-repo App evidence repository installations are invalid.',
    )
  }
  assertExactKeys(
    evidence.checks,
    ['metadataRead', 'contentsRead', 'writeCapability'],
    'Cross-repo App evidence checks',
  )
  if (
    evidence.checks.metadataRead !== 'success' ||
    evidence.checks.contentsRead !== 'success' ||
    evidence.checks.writeCapability !== 'absent' ||
    evidence.status !== 'success'
  ) {
    throw new Error('Cross-repo App evidence is not successful and read-only.')
  }
  return evidence
}

export async function verifyCrossRepoApp({
  trustedContext,
  appId,
  privateKey,
  apiBase = 'https://api.github.com/',
  fetchFn = globalThis.fetch,
  nowSeconds = Math.floor(Date.now() / 1000),
  allowInsecureFixtureApi = false,
}) {
  if (!trustedContext) return { status: 'skipped-untrusted' }
  if (new URL(apiBase).protocol !== 'https:' && !allowInsecureFixtureApi)
    throw new Error('GitHub API must use HTTPS.')
  const jwt = appJwt({ appId, privateKey, nowSeconds })
  const app = await api(
    fetchFn,
    new URL('app', apiBase),
    { headers: headers(jwt) },
    'Cross-repo App permission lookup',
  )
  assertPermissions(app.permissions, 'Cross-repo App')

  const repositories = []
  for (const repository of REPOSITORIES) {
    const installationId = await installation({
      fetchFn,
      apiBase,
      repository,
      jwt,
    })
    const token = await tokenFor({
      fetchFn,
      apiBase,
      repository,
      installationId,
      jwt,
    })
    const metadata = await api(
      fetchFn,
      new URL(`repos/${repository}`, apiBase),
      { headers: headers(token) },
      `${repository} metadata smoke`,
    )
    if (metadata.full_name !== repository)
      throw new Error(
        `${repository} metadata smoke returned the wrong repository.`,
      )
    await api(
      fetchFn,
      new URL(`repos/${repository}/contents/`, apiBase),
      { headers: headers(token) },
      `${repository} contents smoke`,
    )
    repositories.push({ repository, installationId, selection: 'selected' })
  }
  return validateCrossRepoAppEvidence({
    schemaVersion: 1,
    appId: String(appId),
    permissions: PERMISSIONS,
    repositories,
    checks: {
      metadataRead: 'success',
      contentsRead: 'success',
      writeCapability: 'absent',
    },
    status: 'success',
  })
}

const option = (name) => {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

export async function main() {
  const output = option('--output')
  if (!output) throw new Error('--output is required.')
  const evidence = await verifyCrossRepoApp({
    trustedContext: option('--trusted-context') === 'true',
    appId: process.env.FSUS_CROSS_REPO_APP_ID,
    privateKey: process.env.FSUS_CROSS_REPO_APP_PRIVATE_KEY,
  })
  if (evidence.status !== 'success')
    throw new Error('Cross-repo App verification requires a trusted context.')
  const resolved = path.resolve(output)
  mkdirSync(path.dirname(resolved), { recursive: true })
  writeFileSync(resolved, canonicalJson(evidence), { mode: 0o600 })
  process.stdout.write(canonicalJson({ status: 'success', output: resolved }))
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  main().catch((error) => {
    console.error(
      `[cross-repo-app] ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 1
  })
}
