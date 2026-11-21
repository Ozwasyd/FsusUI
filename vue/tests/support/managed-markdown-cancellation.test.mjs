import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import {
  instrumentManagedBridgeTeardown,
  isManagedMarkdownBridgeModule,
  observeManagedMarkdownCancellation,
} from './managed-markdown-cancellation.ts'

const source = ts.transpileModule(
  readFileSync(
    new URL(
      '../../packages/wasm/markdown-heavy-feature-resource.ts',
      import.meta.url,
    ),
    'utf8',
  ),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
    },
  },
).outputText
const bridgeModule = await import(
  `data:text/javascript;base64,${Buffer.from(instrumentManagedBridgeTeardown(source)).toString('base64')}`
)

test('only active external bridge teardown observes the exact request; normal/error cleanup and settled replay do not', async () => {
  const observed = []
  globalThis.window = {
    __fsusObserveBridgeAbort: (request) => observed.push(request),
  }
  const request = { lifecycleKey: 'doc:1:node:mermaid', kind: 'mermaid' }
  for (const mode of ['abort', 'resolve', 'reject']) {
    let resolve,
      reject,
      teardowns = 0
    const promise = new Promise((yes, no) => {
      resolve = yes
      reject = no
    })
    const bridge =
      bridgeModule.createMarkdownHeavyFeatureAdapterResourceBridgeInternal(
        undefined,
        () => ({
          promise,
          resources: () => ({
            listeners: 0,
            observers: 0,
            runtimes: 0,
            tasks: 1,
          }),
          teardown: () => {
            teardowns++
            reject(new globalThis.DOMException('Aborted', 'AbortError'))
          },
        }),
      )
    const result = bridge.run(
      new globalThis.AbortController().signal,
      async () => 'unused',
      request,
    )
    if (mode === 'abort') bridge.teardown()
    else if (mode === 'resolve') resolve('ok')
    else reject(new Error('normal failure'))
    if (mode === 'resolve') assert.equal(await result, 'ok')
    else await assert.rejects(result)
    assert.equal(teardowns, 1)
    bridge.teardown()
    assert.equal(teardowns, 1)
  }
  assert.deepEqual(observed, [request])
  assert.throws(
    () => instrumentManagedBridgeTeardown('unrecognized module'),
    /boundary missing/,
  )
})

test('late managed frame needs exact fixture identity, explicit abort intent and detach; unrelated/live/non-abort remain failures', async () => {
  const events = new Map()
  let binding, init
  const main = {}
  const page = {
    route: async () => {},
    addInitScript: async (callback) => {
      init = callback
    },
    exposeBinding: async (_name, callback) => {
      binding = callback
    },
    on: (event, callback) => events.set(event, callback),
    mainFrame: () => main,
  }
  const filter = await observeManagedMarkdownCancellation(page)
  let domFrames = []
  const identity = { documentKey: 'doc', documentEpoch: 1, nodeId: 'late' }
  globalThis.window = { __fsusMeasuredMarkdownScroll: true }
  globalThis.document = {
    querySelectorAll: (selector) =>
      selector.startsWith('.markdown-stress-content')
        ? [
            {
              dataset: {
                markdownHeavyLifecycle: JSON.stringify({
                  identitySequences: { mermaid: [identity] },
                }),
              },
            },
          ]
        : domFrames,
  }
  init()
  const makeFrame = () => ({ parentFrame: () => main, isDetached: () => false })
  const late = makeFrame(),
    live = makeFrame(),
    unrelated = makeFrame()
  const element = (frame, key = 'doc:1:late:mermaid') => ({
    dataset: {
      fsusMarkdownHeavyNode: key,
      fsusMarkdownHeavyPending: 'mermaid',
    },
    getAttribute: () => 'true',
    contentWindow: {
      __fsusCaptureScrollMarkdownRealm: async () => binding({ frame }),
    },
  })
  // No pre-scroll frame exists. Only actual teardown observation sees this late realm.
  assert.equal(domFrames.length, 0)
  domFrames = [element(late)]
  window.__fsusObserveBridgeAbort({
    lifecycleKey: 'doc:1:late:mermaid',
    kind: 'mermaid',
  })
  domFrames = [element(live)]
  window.__fsusObserveBridgeAbort({
    lifecycleKey: 'doc:1:late:mermaid',
    kind: 'mermaid',
  })
  domFrames = [element(unrelated, 'other:1:late:mermaid')]
  window.__fsusObserveBridgeAbort({
    lifecycleKey: 'other:1:late:mermaid',
    kind: 'mermaid',
  })
  const failures = [
    [late, 'net::ERR_ABORTED'],
    [live, 'net::ERR_ABORTED'],
    [unrelated, 'net::ERR_ABORTED'],
    [late, 'net::ERR_FAILED'],
    [main, 'net::ERR_ABORTED'],
  ]
  const messages = failures.map(([frame, error], index) => {
    const request = {
      frame: () => frame,
      failure: () => ({ errorText: error }),
      method: () => 'GET',
      url: () => `https://fixture.invalid/${index}`,
    }
    events.get('request')(request)
    events.get('requestfailed')(request)
    return `requestfailed: GET ${request.url()} ${error}`
  })
  assert.deepEqual(filter(messages), messages)
  late.isDetached = unrelated.isDetached = () => true
  events.get('framedetached')(late)
  events.get('framedetached')(unrelated)
  assert.deepEqual(filter(messages), messages.slice(1))
  delete globalThis.window
  delete globalThis.document
})

test('only the exact Vite resource module pathname matches, with optional query', () => {
  const base =
    'http://127.0.0.1:5187/@fs/Users/fixture/FsusUI/vue/packages/wasm/'
  for (const suffix of [
    'markdown-heavy-feature-resource.ts',
    'markdown-heavy-feature-resource.ts?t=123',
  ])
    assert.equal(isManagedMarkdownBridgeModule(new URL(base + suffix)), true)
  for (const suffix of [
    'markdown-heavy-feature-resource-mutations.ts',
    'markdown-heavy-feature-resource.ts.map',
    'other.ts?module=markdown-heavy-feature-resource.ts',
  ])
    assert.equal(isManagedMarkdownBridgeModule(new URL(base + suffix)), false)
  assert.equal(
    isManagedMarkdownBridgeModule(
      new URL(
        'http://127.0.0.1:5187/unrelated/markdown-heavy-feature-resource.ts',
      ),
    ),
    false,
  )
})
