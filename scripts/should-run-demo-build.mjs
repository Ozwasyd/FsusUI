import { appendFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const pathGroups = [
  {
    id: 'demo',
    patterns: [
      /^vue\/packages\/demo-app\//,
      /^vue\/tests\/visual\//,
      /^vue\/playwright(\.[^.]+)?\.config\.ts$/,
    ],
  },
  {
    id: 'component',
    patterns: [
      /^vue\/packages\/components\//,
      /^vue\/packages\/hooks\//,
      /^vue\/packages\/directives\//,
      /^vue\/packages\/utils\//,
      /^vue\/packages\/constants\//,
      /^vue\/packages\/locale\//,
      /^vue\/packages\/motion\//,
      /^vue\/packages\/wasm\//,
    ],
  },
  {
    id: 'theme',
    patterns: [/^vue\/packages\/theme-chalk\//],
  },
  {
    id: 'public-api',
    patterns: [
      /^vue\/packages\/element-plus\//,
      /^vue\/packages\/icons-vue\//,
      /^vue\/packages\/icons-svg\//,
      /^vue\/typings\//,
    ],
  },
  {
    id: 'build-config',
    patterns: [
      /^package\.json$/,
      /^pnpm-lock\.yaml$/,
      /^pnpm-workspace\.yaml$/,
      /^vue\/tsconfig[^/]*\.json$/,
      /^vite\.config\./,
      /^vue\/vitest\.config\./,
      /^vue\/packages\/demo-app\/(package\.json|tsconfig\.json|vite\.config\.ts)$/,
      /^vue\/internal\/build\//,
      /^scripts\/(should-run-demo-build|check-demo-build-path-policy|with-node-heap|ensure-wasm-artifacts|run-wasm-build)\.mjs$/,
    ],
  },
]

const skippableMetadataPatterns = [
  /^docs\//,
  /^\.github\/(ISSUE_TEMPLATE|PULL_REQUEST_TEMPLATE\.md)/,
  /^\.changeset\//,
  /^release-evidence\//,
  /^\.vscode\//,
  /^\.editorconfig$/,
  /^\.gitattributes$/,
  /^\.gitignore$/,
  /^\.npmignore$/,
  /^CLAUDE\.md$/,
  /^CODE_OF_CONDUCT\.md$/,
  /^CONTRIBUTING\.md$/,
  /^LICENSE$/,
  /^NOTICE$/,
  /^README\.md$/,
  /^SECURITY\.md$/,
]

const normalizePath = (file) => file.trim().replaceAll('\\', '/')

function git(args) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  return result.status === 0 ? result.stdout.trim() : ''
}

function parseEnvFiles(value) {
  return String(value ?? '')
    .split(/[\n,]/u)
    .map(normalizePath)
    .filter(Boolean)
}

function mergeBaseRef() {
  const explicit = process.env.FSUSUI_DEMO_BUILD_BASE_REF
  if (explicit) return explicit

  const base = process.env.GITHUB_BASE_REF
  if (!base) return ''

  const remoteRef = `origin/${base}`
  const mergeBase = git(['merge-base', 'HEAD', remoteRef])
  return mergeBase || remoteRef
}

function changedFiles() {
  const envFiles = parseEnvFiles(process.env.FSUSUI_DEMO_BUILD_FILES)
  if (envFiles.length > 0) return envFiles

  const baseRef = mergeBaseRef()
  if (baseRef) {
    const files = git(['diff', '--name-only', `${baseRef}...HEAD`])
    if (files) return files.split('\n').map(normalizePath).filter(Boolean)
  }

  const localFiles = git(['diff', '--name-only', 'HEAD'])
  const untrackedFiles = git(['ls-files', '--others', '--exclude-standard'])
  const localChanges = [
    ...localFiles.split('\n'),
    ...untrackedFiles.split('\n'),
  ]
    .map(normalizePath)
    .filter(Boolean)

  if (localChanges.length > 0) return [...new Set(localChanges)]

  const previousCommitFiles = git(['diff', '--name-only', 'HEAD~1..HEAD'])
  return previousCommitFiles
    ? previousCommitFiles.split('\n').map(normalizePath).filter(Boolean)
    : []
}

const matchesAny = (file, patterns) => patterns.some((pattern) => pattern.test(file))

function matchingGroups(files) {
  return pathGroups
    .map((group) => ({
      id: group.id,
      files: files.filter((file) => matchesAny(file, group.patterns)),
    }))
    .filter((group) => group.files.length > 0)
}

function isSkippableMetadata(file) {
  return matchesAny(file, skippableMetadataPatterns)
}

function decide(files) {
  if (files.length === 0) {
    return {
      run: false,
      reason: 'no changed files detected',
      groups: [],
    }
  }

  const groups = matchingGroups(files)
  if (groups.length > 0) {
    const labels = groups.map((group) => group.id).join(',')
    const samples = groups
      .flatMap((group) => group.files.slice(0, 3).map((file) => `${group.id}:${file}`))
      .slice(0, 8)
      .join('; ')
    return {
      run: true,
      reason: `matched ${labels} path filters (${samples})`,
      groups,
    }
  }

  if (files.every(isSkippableMetadata)) {
    return {
      run: false,
      reason: `only docs/metadata changed (${files.slice(0, 8).join('; ')})`,
      groups: [],
    }
  }

  return {
    run: true,
    reason: `unclassified files changed; running demo build defensively (${files
      .slice(0, 8)
      .join('; ')})`,
    groups: [],
  }
}

function writeOutput(name, value) {
  const output = process.env.GITHUB_OUTPUT
  if (!output) return
  appendFileSync(output, `${name}=${String(value).replaceAll(/\r?\n/gu, ' ')}\n`)
}

const files = changedFiles()
const decision = decide(files)
const run = decision.run ? 'true' : 'false'

console.log(`[demo-build-path] files=${files.length === 0 ? '(none)' : files.join(',')}`)
console.log(`[demo-build-path] demo-build-run=${run}`)
console.log(`[demo-build-path] demo-build-reason=${decision.reason}`)

writeOutput('run', run)
writeOutput('reason', decision.reason)
writeOutput('groups', decision.groups.map((group) => group.id).join(','))
