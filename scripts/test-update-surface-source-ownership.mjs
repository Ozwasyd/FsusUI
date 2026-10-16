import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { auditModels } from './check-update-surface.mjs'
import { listControlledManifests } from './npm-authority-lib.mjs'
import { buildExpectedUpdateSurface } from './update-surface-lib.mjs'

const require = createRequire(import.meta.url)
const JSON5 = require('json5')
const isDockerfile = (relative) =>
  /(^|\/)Dockerfile(?:\.[^/]+)?$/u.test(relative)

export function testUpdateSurfaceSourceOwnership(root) {
  const read = (relative) => readFileSync(path.join(root, relative), 'utf8')
  const surface = JSON.parse(read('config/dependencies/update-surface.json'))
  const schema = JSON.parse(
    read('config/dependencies/update-surface.schema.json'),
  )
  const renovate = JSON5.parse(read('renovate.json5'))
  const baseline = buildExpectedUpdateSurface(root)
  const inputs = new Set([
    'config/dependencies/npm-authority.json',
    'dotnet/Directory.Packages.props',
    'dotnet/Directory.Build.props',
    ...listControlledManifests(root).map((entry) => entry.relative),
    ...baseline.surfaces
      .flatMap((entry) => entry.files)
      .filter(
        (relative) =>
          /\.(?:csproj|props|ya?ml)$/u.test(relative) || isDockerfile(relative),
      ),
  ])
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'fsusui-update-source-'))
  const project = () => buildExpectedUpdateSurface(fixture)
  const audit = (expected) =>
    auditModels({ surface, schema, renovate, expected })
  const write = (relative, text) => {
    const absolute = path.join(fixture, relative)
    mkdirSync(path.dirname(absolute), { recursive: true })
    writeFileSync(absolute, text)
  }
  try {
    for (const relative of inputs) {
      const destination = path.join(fixture, relative)
      mkdirSync(path.dirname(destination), { recursive: true })
      copyFileSync(path.join(root, relative), destination)
    }
    assert.deepEqual(
      project(),
      baseline,
      'fixture must retain the full source projection',
    )
    assert.deepEqual(
      audit(project()),
      [],
      'original repository model must pass',
    )

    write('emsdk-cache/emsdk-main/docker/Dockerfile', 'FROM ubuntu:22.04\n')
    assert.deepEqual(
      project(),
      baseline,
      'ignored root SDK cache must not change ownership',
    )
    assert.deepEqual(audit(project()), [])

    const owned = [
      ['Dockerfile.source-ownership', 'node'],
      ['source-ownership/Dockerfile', 'alpine'],
      ['source-ownership/emsdk-cache/Dockerfile', 'debian'],
    ]
    for (const [relative, image] of owned) {
      write(relative, `FROM ${image}:1\n`)
      const next = project()
      assert.ok(
        next.surfaces.some(
          (entry) =>
            entry.datasource === 'docker' &&
            entry.packageName === image &&
            entry.files.includes(relative),
        ),
        `repository Dockerfile must remain discoverable: ${relative}`,
      )
      assert.match(audit(next).join('\n'), /update-surface\.json is stale/u)
    }
    write('Dockerfile.source-ownership', 'FROM source-ownership-changed:2\n')
    const changed = project()
    assert.ok(
      changed.surfaces.some(
        (entry) =>
          entry.packageName === 'source-ownership-changed' &&
          entry.files.includes('Dockerfile.source-ownership'),
      ),
      'a changed repository base image must remain discoverable',
    )
    assert.match(audit(changed).join('\n'), /update-surface\.json is stale/u)

    for (const [relative] of owned) rmSync(path.join(fixture, relative))
    assert.deepEqual(
      project(),
      baseline,
      'only the root cache remains excluded',
    )
    assert.deepEqual(audit(project()), [])
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
}
