import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  access,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  validateHistoricalSdkPolicy,
  prepareHistoricalSdk,
  assertHistoricalIdentity,
} from './historical-render-environment.mjs'

validateHistoricalSdkPolicy(
  { version: '10.0.108', rollForward: 'latestFeature' },
  '10.0.401',
)
validateHistoricalSdkPolicy(
  { version: '10.0.401', rollForward: 'disable' },
  '10.0.401',
)
for (const [policy, selected] of [
  [{ version: '10.0.108', rollForward: 'latestPatch' }, '10.0.401'],
  [{ version: '10.0.108', rollForward: 'disable' }, '10.0.401'],
  [{ version: '10.0.108', rollForward: 'latestFeature' }, '11.0.401'],
  [{ version: '10.0.108', rollForward: 'latestFeature' }, '10.0.100'],
  [{ version: '10.0.108', rollForward: 'latestFeature' }, '10.0.401-preview.1'],
  [
    { version: '10.0.108', rollForward: 'latestFeature', paths: ['/other'] },
    '10.0.401',
  ],
])
  assert.throws(() => validateHistoricalSdkPolicy(policy, selected))

const temp = await mkdtemp(
  path.join(os.tmpdir(), 'historical-environment-test-'),
)
const repository = path.join(temp, "fixture with ' quotes")
try {
  await mkdir(repository)
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: repository,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  git('init')
  await writeFile(path.join(repository, 'tracked fixture.txt'), 'before\n')
  git('add', 'tracked fixture.txt')
  git(
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-m',
    'Synthetic source identity fixture',
  )
  const sha = git('rev-parse', 'HEAD')
  const output = path.join(temp, 'evidence')
  await assertHistoricalIdentity(repository, sha, output, 'before')
  await writeFile(path.join(repository, 'tracked fixture.txt'), 'after\n')
  await assert.rejects(
    assertHistoricalIdentity(repository, sha, output, 'after'),
    /tracked source drift/u,
  )
  assert.deepEqual(
    JSON.parse(
      await readFile(
        path.join(output, 'historical-source-drift-after.json'),
        'utf8',
      ),
    ).paths,
    [{ status: 'M', path: 'tracked fixture.txt' }],
  )
  await assert.rejects(
    assertHistoricalIdentity(repository, '0'.repeat(40), output, 'before'),
    /HEAD mismatch/u,
  )
  if (process.argv.includes('--sdk-smoke')) {
    await mkdir(path.join(repository, 'dotnet'))
    await writeFile(
      path.join(repository, 'dotnet/global.json'),
      JSON.stringify({
        sdk: { version: '10.0.108', rollForward: 'latestFeature' },
      }),
    )
    const root = path.resolve(import.meta.dirname, '..')
    const ambient = await prepareHistoricalSdk(repository, root)
    assert.equal(ambient.evidence.selection, 'ambient-exact')
    await ambient.cleanup()
    // Model a different ambient CLI while retaining the real installed SDK list.
    const dispatch = path.join(temp, 'ambient-cli')
    await mkdir(dispatch)
    const realHost = path.join(process.env.DOTNET_ROOT, 'dotnet')
    const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`
    await writeFile(
      path.join(dispatch, 'dotnet'),
      `#!/bin/sh\nif [ "$1" = "--version" ]; then echo 10.0.999; else exec ${quote(realHost)} "$@"; fi\n`,
      { mode: 0o700 },
    )
    const sdk = await prepareHistoricalSdk(repository, root, {
      ...process.env,
      PATH: `${dispatch}${path.delimiter}${process.env.PATH}`,
    })
    assert.equal(sdk.evidence.selection, 'explicit-entrypoint')
    const launcher = sdk.env.PATH.split(path.delimiter)[0]
    try {
      assert.equal(sdk.env.RestoreLockedMode, 'true')
      assert.equal(
        execFileSync('dotnet', ['--version'], {
          cwd: repository,
          env: sdk.env,
          encoding: 'utf8',
        }).trim(),
        sdk.evidence.version,
      )
      // Dependency-free CLI/MSBuild/runtime smoke; all restore sources are explicitly empty.
      await writeFile(
        path.join(repository, 'Proof.csproj'),
        '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>',
      )
      await writeFile(
        path.join(repository, 'Program.cs'),
        'System.Console.WriteLine("historical-sdk-runtime-ok");',
      )
      await writeFile(
        path.join(repository, 'NuGet.Config'),
        '<configuration><packageSources><clear /></packageSources></configuration>',
      )
      execFileSync(
        'dotnet',
        ['restore', '--configfile', path.join(repository, 'NuGet.Config')],
        { cwd: repository, env: sdk.env, stdio: 'pipe' },
      )
      const run = execFileSync(
        'dotnet',
        [
          'run',
          '--project',
          path.join(repository, 'Proof.csproj'),
          '--no-restore',
          '-m:1',
          '-nr:false',
        ],
        { cwd: repository, env: sdk.env, encoding: 'utf8' },
      )
      assert.match(run, /historical-sdk-runtime-ok/u)
      await assert.rejects(access(path.join(repository, 'global.json')))
    } finally {
      await sdk.cleanup()
    }
    await assert.rejects(access(launcher))
  }
  console.info(
    'Historical environment tests passed: SDK policies, source drift and HEAD rejection; optional --sdk-smoke verifies CLI/MSBuild/runtime and cleanup.',
  )
} finally {
  await rm(temp, { recursive: true, force: true })
}
