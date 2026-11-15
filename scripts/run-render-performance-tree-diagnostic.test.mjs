import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { URL } from 'node:url'
import vm from 'node:vm'

const source = await readFile(
  new URL('./run-render-performance.mjs', import.meta.url),
  'utf8',
)
const marker = 'Avalonia Tree diagnostic: '
const unavailable = 'Avalonia Tree diagnostic unavailable.'
const privateValue = 'unit-private-sentinel /private/absolute/path'
const fixture = () => ({
  SchemaVersion: 2,
  Kind: 'real-avalonia-render-measurement',
  Profile: 'quick',
  Environment: {
    RequestedBackend: 'auto',
    RenderingBackend: 'Avalonia.Rendering.Composition.CompositingRenderer',
    PlatformGraphicsBackend: 'software-no-platform-graphics',
    CPU: privateValue,
    OS: privateValue,
    credentials: privateValue,
  },
  Runner: {
    Warmups: 1,
    Samples: 21,
    LongScrollIterations: 256,
    extra: privateValue,
  },
  Results: [
    {
      Id: 'tree-expand-scroll',
      FrameMs: { P95: 3000, Samples: 21, extra: privateValue },
      MeasureArrangeMs: { P95: 2800, Samples: 21 },
      DrawMs: { P95: 12, Samples: 21 },
      LongScroll: { Iterations: 256 },
      raw: privateValue,
    },
  ],
  absolutePath: privateValue,
})

// Unit-only in-memory imports. No subprocess, artifact, log or network is read.
async function evaluate(summary, options = {}) {
  const logs = []
  const calls = []
  const events = []
  const reads = []
  const environment = { DISPLAY: ':unit', DO_NOT_PRINT: privateValue }
  const unitProcess = {
    argv: ['node', 'unit-runner', ...(options.args ?? [])],
    env: environment,
    platform: 'linux',
    execPath: 'unit-node',
  }
  const context = vm.createContext({
    console: {
      info: (line) => {
        logs.push(line)
        events.push(line)
      },
    },
  })
  const exports = {
    'node:child_process': {
      spawn: (command, args, config) => {
        calls.push({ command, args, config })
        events.push(command === 'dotnet' ? 'native-child' : args[0])
        const child = new EventEmitter()
        const exit =
          command === 'dotnet'
            ? (options.nativeExit ?? 0)
            : args[0] === 'scripts/check-render-performance-results.mjs'
              ? (options.checkerExit ?? 0)
              : 0
        globalThis.queueMicrotask(() => child.emit('exit', exit, null))
        return child
      },
    },
    'node:fs/promises': {
      access: async () => {},
      mkdir: async () => {},
      writeFile: async () => {
        throw new Error('Unexpected unit write')
      },
      readFile: async (file) => {
        reads.push(file)
        assert.equal(
          file,
          '/unit-repository/.tmp/performance/current/avalonia/summary.json',
        )
        if (options.readError) throw new Error(privateValue)
        return options.text ?? JSON.stringify(summary)
      },
    },
    'node:path': { default: path },
    'node:process': { default: unitProcess },
    './render-performance-impact.mjs': {
      verifyImpactPlan: () => {
        throw new Error('Unexpected impact-plan route')
      },
    },
  }
  const module = new vm.SourceTextModule(source, {
    context,
    initializeImportMeta: (meta) => {
      meta.dirname = '/unit-repository/scripts'
    },
  })
  await module.link((name) => {
    assert.ok(Object.hasOwn(exports, name), name)
    const values = exports[name]
    return new vm.SyntheticModule(
      Object.keys(values),
      function () {
        for (const [key, value] of Object.entries(values))
          this.setExport(key, value)
      },
      { context },
    )
  })
  let error
  try {
    await module.evaluate()
  } catch (caught) {
    error = caught
  }
  return { logs, calls, events, reads, error, environment }
}

test('tree diagnostic outputs only validated fields before checker', async () => {
  const result = await evaluate(fixture())
  assert.equal(result.error, undefined)
  const line = result.logs.find((value) => value.startsWith(marker))
  assert.deepEqual(JSON.parse(line.slice(marker.length)), {
    profile: 'quick',
    requestedBackend: 'auto',
    renderingBackend: 'Avalonia.Rendering.Composition.CompositingRenderer',
    platformGraphicsBackend: 'software-no-platform-graphics',
    scenario: 'tree-expand-scroll',
    frameP95Ms: 3000,
    layoutP95Ms: 2800,
    drawP95Ms: 12,
    warmups: 1,
    samples: 21,
    longScrollIterations: 256,
  })
  assert.ok(
    result.events.indexOf(line) <
      result.events.indexOf('scripts/check-render-performance-results.mjs'),
  )
  assert.equal(result.logs.join('\n').includes(privateValue), false)
  assert.equal(result.reads.length, 1)
})

test('tree diagnostic rejects unknown profile and backend values', async () => {
  const mutations = [
    (value) => {
      value.Profile = privateValue
    },
    (value) => {
      value.Environment.RequestedBackend = privateValue
    },
    (value) => {
      value.Environment.RenderingBackend = privateValue
    },
    (value) => {
      value.Environment.PlatformGraphicsBackend = privateValue
    },
    (value) => {
      value.Profile = 1
    },
    (value) => {
      value.Environment.RequestedBackend = null
    },
  ]
  for (const mutate of mutations) {
    const value = fixture()
    mutate(value)
    const result = await evaluate(value)
    assert.ok(result.logs.includes(unavailable))
    assert.equal(
      result.logs.some((line) => line.startsWith(marker)),
      false,
    )
    assert.equal(result.logs.join('\n').includes(privateValue), false)
    assert.ok(
      result.calls.some(
        (call) =>
          call.args[0] === 'scripts/check-render-performance-results.mjs',
      ),
    )
  }
})

test('tree diagnostic refuses nonfinite metrics and invalid counts', async () => {
  for (const metric of ['FrameMs', 'MeasureArrangeMs', 'DrawMs']) {
    for (const invalid of [NaN, Infinity, -1, '3000', null]) {
      const value = fixture()
      value.Results[0][metric].P95 = invalid
      assert.ok((await evaluate(value)).logs.includes(unavailable))
    }
  }
  assert.ok(
    (
      await evaluate(fixture(), {
        text: JSON.stringify(fixture()).replace('"P95":3000', '"P95":1e309'),
      })
    ).logs.includes(unavailable),
  )
  for (const mutate of [
    (value) => {
      value.Runner.Warmups = -1
    },
    (value) => {
      value.Runner.Samples = 0
    },
    (value) => {
      value.Runner.Samples = '21'
    },
    (value) => {
      value.Runner.LongScrollIterations = 2 ** 53
    },
    (value) => {
      value.Results[0].DrawMs.Samples = 20
    },
    (value) => {
      value.Results[0].LongScroll.Iterations = 255
    },
  ]) {
    const value = fixture()
    mutate(value)
    assert.ok((await evaluate(value)).logs.includes(unavailable))
  }
})

test('tree diagnostic ignores absent Tree and refuses ambiguous schema', async () => {
  const absent = fixture()
  absent.Results = [{ Id: 'input-continuous', arbitrary: privateValue }]
  const result = await evaluate(absent)
  assert.equal(
    result.logs.some((line) => line.startsWith('Avalonia Tree diagnostic')),
    false,
  )
  for (const mutate of [
    (value) => {
      value.Results.push(structuredClone(value.Results[0]))
    },
    (value) => {
      value.SchemaVersion = 1
    },
    (value) => {
      value.Kind = privateValue
    },
  ]) {
    const value = fixture()
    mutate(value)
    assert.ok((await evaluate(value)).logs.includes(unavailable))
  }
})

test('tree diagnostic preserves original child argv and environment', async () => {
  const value = fixture()
  value.Profile = 'full'
  value.Environment.RequestedBackend = 'gpu'
  value.Environment.PlatformGraphicsBackend =
    'Avalonia.X11.Glx.GlxPlatformGraphics'
  value.Runner.Warmups = 3
  value.Runner.Samples = 12
  for (const key of ['FrameMs', 'MeasureArrangeMs', 'DrawMs'])
    value.Results[0][key].Samples = 12
  const result = await evaluate(value, {
    args: [
      '--profile',
      'full',
      '--warmups',
      '3',
      '--samples',
      '12',
      '--long-scroll-iterations',
      '256',
      '--backend',
      'gpu',
      '--scenario',
      'tree-expand-scroll',
    ],
  })
  const native = result.calls.filter((call) => call.command === 'dotnet')
  assert.equal(native.length, 1)
  assert.deepEqual(Array.from(native[0].args), [
    'run',
    '--project',
    'dotnet/FsusUI.Avalonia.Demo/FsusUI.Avalonia.Demo.csproj',
    '--configuration',
    'Release',
    '--',
    '--render-performance',
    '--profile',
    'full',
    '--warmups',
    '3',
    '--samples',
    '12',
    '--long-scroll-iterations',
    '256',
    '--backend',
    'gpu',
    '--output',
    '/unit-repository/.tmp/performance/current/avalonia/summary.json',
    '--scenario',
    'tree-expand-scroll',
  ])
  assert.equal(native[0].config.env, result.environment)
  assert.equal(native[0].config.cwd, '/unit-repository')
  assert.equal(native[0].config.stdio, 'inherit')
  assert.ok(result.logs.some((line) => line.startsWith(marker)))
})

test('tree diagnostic does not swallow native child failure', async () => {
  const result = await evaluate(fixture(), { nativeExit: 17 })
  assert.match(result.error.message, /dotnet exited with 17/)
  assert.equal(result.reads.length, 0)
  assert.equal(
    result.calls.some(
      (call) => call.args[0] === 'scripts/check-render-performance-results.mjs',
    ),
    false,
  )
})

test('tree diagnostic keeps checker failure after numeric output', async () => {
  const result = await evaluate(fixture(), { checkerExit: 1 })
  assert.match(result.error.message, /unit-node exited with 1/)
  assert.equal(
    result.calls.filter((call) => call.command === 'dotnet').length,
    1,
  )
  const line = result.logs.find((value) => value.startsWith(marker))
  assert.equal(JSON.parse(line.slice(marker.length)).frameP95Ms, 3000)
  assert.ok(
    result.events.indexOf(line) <
      result.events.indexOf('scripts/check-render-performance-results.mjs'),
  )
})

test('tree diagnostic suppresses malformed content without hiding gate failure', async () => {
  for (const options of [
    { readError: true },
    { text: `{invalid ${privateValue}` },
  ]) {
    const result = await evaluate(fixture(), { ...options, checkerExit: 1 })
    assert.ok(result.logs.includes(unavailable))
    assert.equal(result.logs.join('\n').includes(privateValue), false)
    assert.match(result.error.message, /unit-node exited with 1/)
    assert.equal(
      result.calls.filter((call) => call.command === 'dotnet').length,
      1,
    )
  }
})
