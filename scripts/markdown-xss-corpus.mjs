import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'

const repositoryRoot = resolve(import.meta.dirname, '..')

export const corpusPath = resolve(
  repositoryRoot,
  'spec/security/markdown-xss-corpus.json',
)
export const schemaPath = resolve(
  repositoryRoot,
  'spec/security/markdown-xss-corpus.schema.json',
)
export const manifestPath = resolve(
  repositoryRoot,
  'spec/security/markdown-xss-consumer-manifest.json',
)

export const REQUIRED_CATEGORIES = Object.freeze([
  'raw-event',
  'malformed-separator',
  'entity-control-protocol',
  'dangerous-url',
  'namespace',
  'container-navigation',
  'mutation-serialization',
  'feature-output',
  'resource-boundary',
])

export const SOURCE_SURFACES = Object.freeze([
  'core-sync',
  'wasm',
  'worker',
  'chunked',
  'ssr-no-dom',
  'initial-render',
  'browser-dom',
])

export const FEATURE_SURFACES = Object.freeze([
  'feature-gateway',
  'browser-dom',
])

export const KILL_CONTROL_IDS = Object.freeze([
  'raw-html-enabled',
  'string-safe-sink',
  'feature-direct-dom',
  'dangerous-url-allowed',
  'event-attribute-allowed',
  'namespace-allowed',
])

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

export const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex')

export const loadMarkdownXssCorpus = async () => readJson(corpusPath)
export const loadMarkdownXssManifest = async () => readJson(manifestPath)

export const getMarkdownXssCase = (corpus, id) => {
  const entry = corpus.cases.find((candidate) => candidate.id === id)
  if (!entry) throw new Error(`[markdown-xss] missing case ${id}`)
  return entry
}

export const getMarkdownXssSource = (corpus, id) => {
  const entry = getMarkdownXssCase(corpus, id)
  if (typeof entry.source !== 'string') {
    throw new Error(`[markdown-xss] source missing for ${id}`)
  }
  return entry.source
}

export const getMarkdownXssSourceAttackFragment = (corpus, id) => {
  const source = getMarkdownXssSource(corpus, id)
  const separator = source.indexOf('\n\n')
  return separator < 0 ? source : source.slice(separator + 2)
}

const sameMembers = (actual, expected) =>
  actual.length === expected.length &&
  expected.every((entry) => actual.includes(entry))

const assert = (condition, message) => {
  if (!condition) throw new Error(`[markdown-xss] ${message}`)
}

export const validateMarkdownXssCorpus = async () => {
  const [corpusText, corpus, schema, manifest] = await Promise.all([
    readFile(corpusPath, 'utf8'),
    loadMarkdownXssCorpus(),
    readJson(schemaPath),
    loadMarkdownXssManifest(),
  ])

  assert(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'schema must use draft 2020-12')
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictRequired: false,
  })
  const validate = ajv.compile(schema)
  assert(
    validate(corpus),
    `schema validation failed: ${ajv.errorsText(validate.errors, {
      separator: '; ',
    })}`,
  )
  const negativeProbes = [
    {
      label: 'additionalProperties',
      mutate: (copy) => {
        copy.cases[0].unexpected = true
      },
    },
    {
      label: 'oneOf',
      mutate: (copy) => {
        copy.cases[0].featureOutput = {
          kind: 'mermaid',
          payload: '<svg></svg>',
        }
      },
    },
    {
      label: 'id',
      mutate: (copy) => {
        copy.cases[0].id = 'unstable id'
      },
    },
    {
      label: 'category',
      mutate: (copy) => {
        copy.cases[0].category = 'unknown'
      },
    },
    {
      label: 'surface',
      mutate: (copy) => {
        copy.cases[0].surfaces.push('unknown')
      },
    },
  ]
  for (const probe of negativeProbes) {
    const copy = structuredClone(corpus)
    probe.mutate(copy)
    assert(!validate(copy), `negative schema probe passed: ${probe.label}`)
  }
  assert(schema.properties?.cases?.minItems === 60, 'schema must require at least 60 cases')
  assert(corpus.version === 1 && manifest.version === 1, 'unsupported corpus or manifest version')
  assert(sameMembers(corpus.categories, REQUIRED_CATEGORIES), 'category registry drift')
  assert(corpus.cases.length >= 60, `expected >=60 cases, received ${corpus.cases.length}`)

  const ids = new Set()
  const counts = Object.fromEntries(REQUIRED_CATEGORIES.map((category) => [category, 0]))
  for (const entry of corpus.cases) {
    assert(/^mxss-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(entry.id), `invalid case ID ${entry.id}`)
    assert(!ids.has(entry.id), `duplicate case ID ${entry.id}`)
    ids.add(entry.id)
    assert(REQUIRED_CATEGORIES.includes(entry.category), `${entry.id}: unknown category`)
    counts[entry.category] += 1
    const hasSource = typeof entry.source === 'string'
    const hasFeature = entry.featureOutput !== undefined
    assert(hasSource !== hasFeature, `${entry.id}: exactly one input owner is required`)
    assert(entry.reviewed === true, `${entry.id}: manual review declaration missing`)
    assert(
      sameMembers(entry.surfaces, hasSource ? SOURCE_SURFACES : FEATURE_SURFACES),
      `${entry.id}: surface coverage drift`,
    )
    assert(
      Array.isArray(entry.invariants?.forbidSelectors) &&
        entry.invariants.forbidSelectors.length > 0 &&
        entry.invariants.forbidExternalUrls === true &&
        Array.isArray(entry.invariants.allowedNamespaces),
      `${entry.id}: incomplete DOM invariants`,
    )
    assert(
      Array.isArray(entry.preserve?.text) &&
        Array.isArray(entry.preserve?.selectors),
      `${entry.id}: legal-content preservation declaration missing`,
    )
  }
  for (const category of REQUIRED_CATEGORIES) {
    assert(counts[category] >= 3, `${category}: expected >=3 reviewed cases`)
  }

  const digest = sha256(corpusText)
  assert(manifest.sha256 === digest, `manifest SHA drift: expected ${digest}`)
  assert(manifest.caseCount === corpus.cases.length, 'manifest case count drift')
  assert(
    JSON.stringify(manifest.categories) === JSON.stringify(counts),
    'manifest category counts drift',
  )
  assert(manifest.fuzz.seed === corpus.seed, 'manifest fuzz seed drift')
  assert(manifest.fuzz.fastIterations >= 2_000, 'fast fuzz count is below 2,000')
  assert(manifest.fuzz.releaseIterations >= 20_000, 'release fuzz count is below 20,000')
  assert(manifest.productionExport === false, 'corpus must remain test-only')

  return { corpus, counts, digest, manifest }
}

export const createXorshift32 = (initialSeed) => {
  let state = initialSeed >>> 0
  if (state === 0) state = 0x9e3779b9
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state >>> 0
  }
}

const mutationTokens = Object.freeze([
  '<',
  '>',
  '"',
  "'",
  '`',
  '/',
  '\\',
  '\u0000',
  '\u0009',
  '\u000a',
  '\u000d',
  '&#x3a;',
  '&#58;',
  'javascript:',
  'onerror=',
  '<svg>',
  '</template>',
])

export const mutateMarkdownXssInput = (source, random) => {
  const first = random()
  const second = random()
  const position = first % (source.length + 1)
  const token = mutationTokens[second % mutationTokens.length]
  switch (first % 4) {
    case 0:
      return `${source.slice(0, position)}${token}${source.slice(position)}`
    case 1: {
      const end = Math.min(source.length, position + (second % 8))
      return `${source.slice(0, position)}${source.slice(end)}`
    }
    case 2:
      return `${source.slice(0, position)}${source.slice(position, position + 16)}${source.slice(position)}`
    default:
      return `${source.slice(0, position)}${token}${source.slice(position + (second % 3))}`
  }
}

export const minimizeReproduction = (source, fails) => {
  let current = source
  for (let width = Math.floor(current.length / 2); width > 0; width = Math.floor(width / 2)) {
    for (let start = 0; start + width <= current.length; start += Math.max(1, width)) {
      const candidate = `${current.slice(0, start)}${current.slice(start + width)}`
      if (candidate && fails(candidate)) {
        current = candidate
        break
      }
    }
  }
  return current
}

export const minimizeReproductionAsync = async (source, fails) => {
  let current = source
  for (
    let width = Math.floor(current.length / 2);
    width > 0;
    width = Math.floor(width / 2)
  ) {
    for (
      let start = 0;
      start + width <= current.length;
      start += Math.max(1, width)
    ) {
      const candidate = `${current.slice(0, start)}${current.slice(start + width)}`
      if (candidate && (await fails(candidate))) {
        current = candidate
        break
      }
    }
  }
  return current
}

export const formatMarkdownXssFailure = ({
  caseId,
  input,
  seed,
  surface,
}) =>
  [
    '[markdown-xss] invariant failure',
    `case=${caseId}`,
    `surface=${surface}`,
    `seed=${seed}`,
    `minimal=${JSON.stringify(input)}`,
  ].join(' ')
