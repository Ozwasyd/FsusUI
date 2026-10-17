import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { waitForBoundaryServer } from '../scripts/boundary-playwright-owner-run.mjs'

const startChild = (t, port, bind = true) => {
  const child = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      bind
        ? `
          import { createServer } from 'node:http'
          const server = createServer((request, response) => {
            response.writeHead(200, { 'X-Fsus-Visual-Runtime': 'fixture' }).end()
          })
          server.listen(${port}, '127.0.0.1', () => {
            process.send({ type: 'visual-runtime-ready', host: '127.0.0.1',
              port: ${port}, fingerprint: 'fixture' })
          })
        `
        : 'process.exit(1)',
    ],
    { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] },
  )
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill()
  })
  return child
}

test('managed server readiness requires the launched child to bind', async (t) => {
  const probe = createServer()
  probe.listen(0, '127.0.0.1')
  await once(probe, 'listening')
  const port = probe.address().port
  await new Promise((resolve) => probe.close(resolve))
  await waitForBoundaryServer(
    startChild(t, port),
    `http://127.0.0.1:${port}`,
    5000,
  )
})

for (const bind of [true, false]) {
  test(`an unrelated HTTP 200 cannot admit a child that ${bind ? 'fails to bind' : 'exits without binding'}`, async (t) => {
    let requests = 0
    const unrelated = createServer((request, response) => {
      requests++
      response.writeHead(200, { 'X-Fsus-Visual-Runtime': 'fixture' }).end()
    })
    unrelated.listen(0, '127.0.0.1')
    await once(unrelated, 'listening')
    t.after(() => new Promise((resolve) => unrelated.close(resolve)))
    const port = unrelated.address().port
    await assert.rejects(
      waitForBoundaryServer(
        startChild(t, port, bind),
        `http://127.0.0.1:${port}`,
        5000,
      ),
      /exited before binding/,
    )
    assert.equal(requests, 0)
  })
}
