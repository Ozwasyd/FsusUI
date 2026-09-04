import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { generateKeyPairSync } from 'node:crypto'
import { createServer } from 'node:http'
import { after, test } from 'node:test'
import { URL } from 'node:url'
import {
  validateCrossRepoAppEvidence,
  verifyCrossRepoApp,
} from './cross-repo-app-verifier.mjs'

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' })
const servers = []

after(async () => {
  await Promise.all(
    servers.map(
      (server) => new Promise((resolve) => server.close(() => resolve())),
    ),
  )
})

const json = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

const bodyOf = async (request) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const service = async ({ permissions, missingRepository, allowWrite } = {}) => {
  const state = { readTokenRequests: 0, deniedWriteRequests: 0 }
  const appPermissions = permissions ?? { metadata: 'read', contents: 'read' }
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://fixture/')
    if (request.method === 'GET' && url.pathname === '/app')
      return json(response, 200, { permissions: appPermissions })
    const install = url.pathname.match(
      /^\/repos\/Ozwasyd\/(FsusUI|FsusBlog)\/installation$/u,
    )
    if (request.method === 'GET' && install) {
      if (missingRepository === install[1]) return json(response, 404, {})
      return json(response, 200, { id: install[1] === 'FsusUI' ? 10 : 20 })
    }
    const token = url.pathname.match(
      /^\/app\/installations\/(10|20)\/access_tokens$/u,
    )
    if (request.method === 'POST' && token) {
      const requestBody = await bodyOf(request)
      const name = requestBody.repositories[0]
      if (requestBody.permissions?.contents === 'write') {
        state.deniedWriteRequests += 1
        return allowWrite
          ? json(response, 201, {
              token: 'unexpected-write-token',
              permissions: { metadata: 'read', contents: 'write' },
              repositories: [{ full_name: `Ozwasyd/${name}` }],
            })
          : json(response, 422, { message: 'permission not granted' })
      }
      state.readTokenRequests += 1
      return json(response, 201, {
        token: `token-${name}`,
        permissions: appPermissions,
        repositories: [{ full_name: `Ozwasyd/${name}` }],
      })
    }
    const repo = url.pathname.match(/^\/repos\/Ozwasyd\/(FsusUI|FsusBlog)$/u)
    if (request.method === 'GET' && repo)
      return json(response, 200, { full_name: `Ozwasyd/${repo[1]}` })
    const contents = url.pathname.match(
      /^\/repos\/Ozwasyd\/(FsusUI|FsusBlog)\/contents\/$/u,
    )
    if (request.method === 'GET' && contents) return json(response, 200, [])
    return json(response, 404, {})
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  servers.push(server)
  return {
    state,
    apiBase: `http://127.0.0.1:${server.address().port}/`,
  }
}

const verify = (apiBase, overrides = {}) =>
  verifyCrossRepoApp({
    trustedContext: true,
    appId: '422',
    privateKey: PRIVATE_KEY,
    apiBase,
    allowInsecureFixtureApi: true,
    ...overrides,
  })

test('read-only App verifies both exact repository installations', async () => {
  const fixture = await service()
  const evidence = await verify(fixture.apiBase)
  assert.equal(evidence.status, 'success')
  assert.deepEqual(
    evidence.repositories.map((entry) => entry.repository),
    ['Ozwasyd/FsusUI', 'Ozwasyd/FsusBlog'],
  )
  assert.equal(evidence.checks.writeCapability, 'absent')
  assert.equal(fixture.state.readTokenRequests, 2)
  assert.equal(fixture.state.deniedWriteRequests, 2)
  assert.doesNotMatch(JSON.stringify(evidence), /token|private|authorization/iu)
})

test('untrusted context never reads credentials or calls the App API', async () => {
  const result = await verifyCrossRepoApp({ trustedContext: false })
  assert.deepEqual(result, { status: 'skipped-untrusted' })
})

test('unexpected write capability fails the verification', async () => {
  const fixture = await service({ allowWrite: true })
  await assert.rejects(verify(fixture.apiBase), /denial probe failed/u)
})

test('missing configuration and installation fail closed', async () => {
  const fixture = await service()
  await assert.rejects(
    verify(fixture.apiBase, { appId: undefined, privateKey: undefined }),
    /APP_ID/u,
  )
  const missing = await service({ missingRepository: 'FsusBlog' })
  await assert.rejects(verify(missing.apiBase), /installation lookup failed/u)
})

test('insufficient or excessive App permissions fail closed', async () => {
  for (const permissions of [
    { metadata: 'read' },
    { metadata: 'read', contents: 'write' },
    { metadata: 'read', contents: 'read', issues: 'read' },
  ]) {
    const fixture = await service({ permissions })
    await assert.rejects(verify(fixture.apiBase), /permissions|contents/u)
  }
})

test('sanitized evidence is closed against missing or unknown fields', async () => {
  const fixture = await service()
  const evidence = await verify(fixture.apiBase)
  assert.throws(
    () => validateCrossRepoAppEvidence({ ...evidence, secret: 'no' }),
    /missing or excessive fields/u,
  )
  const missing = structuredClone(evidence)
  delete missing.checks.writeCapability
  assert.throws(() => validateCrossRepoAppEvidence(missing), /checks/u)
})
