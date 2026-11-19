import assert from 'node:assert/strict'
import { test } from 'node:test'
import { avaloniaRuntimeCommand } from './run-avalonia-layout-ready.mjs'

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
