#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditModels } from './check-update-surface.mjs'
import {
  buildExpectedUpdateSurface,
  listDockerDependencyFiles,
} from './update-surface-lib.mjs'

const require = createRequire(import.meta.url)
const JSON5 = require('json5')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => readFileSync(path.join(root, relative), 'utf8')
const clone = (value) => structuredClone(value)

const surface = JSON.parse(read('config/dependencies/update-surface.json'))
const schema = JSON.parse(
  read('config/dependencies/update-surface.schema.json'),
)
const renovate = JSON5.parse(read('renovate.json5'))
const expected = buildExpectedUpdateSurface(root)

function errorsFor(
  nextSurface = surface,
  nextRenovate = renovate,
  nextExpected = expected,
) {
  return auditModels({
    surface: nextSurface,
    schema,
    renovate: nextRenovate,
    expected: nextExpected,
    now: new Date('2026-08-27T00:00:00Z'),
  })
}

assert.deepEqual(errorsFor(), [], 'the unmodified governance model must pass')

const mutations = [
  {
    name: 'permanent ignore',
    mutate(next) {
      next.renovate.ignorePaths = ['config/dependencies/**']
    },
    expected: /ignorePaths entry/u,
  },
  {
    name: 'disabled update type',
    mutate(next) {
      next.renovate.packageRules.push({
        matchUpdateTypes: ['major'],
        enabled: false,
      })
    },
    expected: /disabled update surface forbidden/u,
  },
  {
    name: 'disabled automerge',
    mutate(next) {
      next.renovate.automerge = false
    },
    expected: /automerge/u,
  },
  {
    name: 'direct push automerge',
    mutate(next) {
      next.renovate.automergeType = 'branch'
    },
    expected: /automergeType|direct-push/u,
  },
  {
    name: 'non-platform automerge',
    mutate(next) {
      next.renovate.platformAutomerge = false
    },
    expected: /platformAutomerge|platform automerge/u,
  },
  {
    name: 'lockfile automerge disabled',
    mutate(next) {
      next.renovate.lockFileMaintenance.automerge = false
    },
    expected: /automerge|lockFileMaintenance/u,
  },
  {
    name: 'stale generated inventory',
    mutate(next) {
      next.surface.surfaces.pop()
    },
    expected: /is stale/u,
  },
  {
    name: 'duplicate manager identity',
    mutate(next) {
      next.surface.surfaces.push(clone(next.surface.surfaces[0]))
    },
    expected: /duplicate surface id|duplicate package identity/u,
  },
  {
    name: 'overlapping group',
    mutate(next) {
      const firstGroup = next.renovate.packageRules.find(
        (rule) => rule.groupName === 'vue-build-toolchain',
      )
      const secondGroup = next.renovate.packageRules.find(
        (rule) => rule.groupName === 'vue-runtime-dependencies',
      )
      secondGroup.matchPackageNames.push(firstGroup.matchPackageNames[0])
    },
    expected: /overlapping groups|must map exactly/u,
  },
]

for (const mutation of mutations) {
  const next = {
    renovate: clone(renovate),
    surface: clone(surface),
  }
  mutation.mutate(next)
  const errors = errorsFor(next.surface, next.renovate)
  assert.match(
    errors.join('\n'),
    mutation.expected,
    `${mutation.name} mutation must fail closed`,
  )
}

const fixture = JSON.parse(
  read('tests/fixtures/dependencies/renovate-custom-managers.json'),
)
const managers = new Map(
  renovate.customManagers
    .filter((manager) => manager.customType === 'regex')
    .map((manager) => [manager.description, manager]),
)

function fileMatches(manager, relative) {
  return manager.managerFilePatterns.some((pattern) =>
    new RegExp(
      pattern.startsWith('/') && pattern.endsWith('/')
        ? pattern.slice(1, -1)
        : pattern,
      'u',
    ).test(relative),
  )
}

function extractedValues(manager, text) {
  const values = []
  for (const pattern of manager.matchStrings) {
    const expression = new RegExp(pattern, 'gmu')
    for (const match of text.matchAll(expression)) {
      if (match.groups?.currentValue) values.push(match.groups.currentValue)
    }
  }
  return values
}

for (const candidate of fixture.positive) {
  const manager = managers.get(candidate.manager)
  assert.ok(manager, `fixture manager missing: ${candidate.manager}`)
  assert.ok(
    fileMatches(manager, candidate.file),
    `${candidate.manager} must own ${candidate.file}`,
  )
  assert.deepEqual(
    extractedValues(manager, candidate.text),
    candidate.values,
    `${candidate.manager} must extract the expected version`,
  )
}

for (const candidate of fixture.negative) {
  const manager = managers.get(candidate.manager)
  assert.ok(manager, `fixture manager missing: ${candidate.manager}`)
  assert.ok(
    !fileMatches(manager, candidate.file) ||
      extractedValues(manager, candidate.text).length === 0,
    `${candidate.manager} must reject the negative fixture`,
  )
}

console.log(
  `Renovate governance mutation contract passed: mutations=${mutations.length} positive=${fixture.positive.length} negative=${fixture.negative.length}.`,
)

// A CI-installed Emscripten tree must not become a repository dependency owner.
const dockerFixture = mkdtempSync(path.join(tmpdir(), 'fsus-update-surface-'))
try {
  execFileSync('git', ['init', '--quiet', dockerFixture])
  const write = (relative, content) => {
    const file = path.join(dockerFixture, relative)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, content)
  }
  write('.gitignore', '/emsdk-cache/\n')
  write('Dockerfile', 'FROM node:22\n')
  execFileSync('git', ['-C', dockerFixture, 'add', 'Dockerfile'])
  write(
    'emsdk-cache/emsdk-main/docker/Dockerfile',
    'FROM ubuntu:noble AS stage_build\n',
  )
  write('deploy/Dockerfile.worker', 'FROM node:22\n')
  assert.deepEqual(
    listDockerDependencyFiles(dockerFixture),
    ['Dockerfile', 'deploy/Dockerfile.worker'],
    'ignored toolchain files must not change the update surface; new source Dockerfiles still must',
  )
  execFileSync('git', [
    '-C',
    dockerFixture,
    'add',
    '-f',
    'emsdk-cache/emsdk-main/docker/Dockerfile',
  ])
  assert.deepEqual(
    listDockerDependencyFiles(dockerFixture),
    [
      'Dockerfile',
      'deploy/Dockerfile.worker',
      'emsdk-cache/emsdk-main/docker/Dockerfile',
    ],
    'a deliberately tracked source remains an owner even beneath an ignored directory',
  )
  rmSync(path.join(dockerFixture, 'Dockerfile'))
  assert(
    !listDockerDependencyFiles(dockerFixture).includes('Dockerfile'),
    'a deleted tracked Dockerfile must not be read from a stale index entry',
  )
} finally {
  rmSync(dockerFixture, { recursive: true, force: true })
}
