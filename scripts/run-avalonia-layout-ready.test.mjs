import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { avaloniaRuntimeCommand, launchAvaloniaLayoutReady, nativeDriverHash, nativeSplitProtocol, readNativeBinding } from './run-avalonia-layout-ready.mjs'

test('historical SDK shim is not used for the runtime DLL', () => {
  const env = {
    PATH: '/tmp/fsus-historical-sdk-test:/usr/bin',
    DOTNET_HOST_PATH: '/usr/share/dotnet/dotnet',
  }
  assert.deepEqual(avaloniaRuntimeCommand('/tmp/Demo.dll', ['--render-performance'], env, 'linux'), {
    command: '/usr/bin/xvfb-run',
    args: ['-a', '/usr/share/dotnet/dotnet', '/tmp/Demo.dll', '--render-performance'],
  })
  assert.equal(avaloniaRuntimeCommand('/tmp/Demo.dll', [], { ...env, DISPLAY: ':5' }, 'linux').command, '/usr/share/dotnet/dotnet')
})

test('ambient runs keep the default host, and relative overrides fail closed', () => {
  assert.deepEqual(avaloniaRuntimeCommand('/tmp/Demo.dll', [], {}, 'darwin'), {
    command: 'dotnet',
    args: ['/tmp/Demo.dll'],
  })
  assert.throws(() => avaloniaRuntimeCommand('/tmp/Demo.dll', [], { DOTNET_HOST_PATH: './dotnet' }), /must be absolute/u)
})

test('split builds once and launches two separately bound child processes', async () => {
  const root = path.resolve(import.meta.dirname, '..')
  const productSha = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding:'utf8'}).trim()
  const scratch = await mkdtemp(path.join(tmpdir(), 'fsus-test-split-launch-'))
  const output = path.join(scratch, 'output')
  const launches = []
  let builds = 0
  const display = process.env.DISPLAY
  process.env.DISPLAY = ':test'
  try {
    await launchAvaloniaLayoutReady({
      controllerRoot: root, productRoot: root, output, scenario: '', protocol: nativeSplitProtocol,
      appArgs: ['--render-performance', '--profile', 'quick', '--output', path.join(output, 'summary.json')],
      run: async (command, args, { env }) => {
        if (args[0] === 'build') {
          builds += 1
          const directory = args[args.indexOf('--output') + 1]
          await mkdir(directory, {recursive: true})
          await writeFile(path.join(directory, 'FsusUI.Avalonia.Demo.dll'), 'synthetic/test-only')
          return
        }
        const summary = args[args.indexOf('--output') + 1]
        const partition = env.FSUSUI_AVALONIA_MEASUREMENT_PARTITION
        const launchId = env.FSUSUI_AVALONIA_MEASUREMENT_LAUNCH_ID
        const assembly = args.find(arg => arg.endsWith('FsusUI.Avalonia.Demo.dll'))
        launches.push({ partition, launchId, assembly })
        await mkdir(path.join(path.dirname(summary), 'raw'), {recursive: true})
        await writeFile(summary, JSON.stringify({
          GitSha: productSha, MeasurementProtocol: nativeSplitProtocol, MeasurementPartition: partition,
          ProcessId: 100 + launches.length, LaunchId: launchId,
        }))
        await writeFile(path.join(path.dirname(summary), 'raw', `${partition}.raw.json`), '{}')
      },
    })
    assert.equal(builds, 1)
    assert.deepEqual(launches.map(x => x.partition), ['canonical', 'sustained'])
    assert.equal(launches[0].assembly, launches[1].assembly)
    assert.notEqual(launches[0].launchId, launches[1].launchId)
    const proof = await readNativeBinding(output, productSha, await nativeDriverHash(root), '', nativeSplitProtocol)
    assert.deepEqual(proof.partitions.map(x => x.processId), [101, 102])
  } finally {
    if (display === undefined) delete process.env.DISPLAY
    else process.env.DISPLAY = display
    await rm(scratch, {recursive: true, force: true})
  }
})
