import corpusJson from '../../../spec/security/markdown-xss-corpus.json'
import type { FeatureRenderOutput } from '../../packages/wasm/markdown-feature-output-gateway'

export type MarkdownXssCorpusCase = (typeof corpusJson.cases)[number]

const casesById = new Map(
  corpusJson.cases.map((entry) => [entry.id, entry] as const),
)

export const getMarkdownXssCorpusCase = (id: string) => {
  const entry = casesById.get(id)
  if (!entry) throw new Error(`markdown_xss_case_missing:${id}`)
  return entry
}

export const getMarkdownXssSource = (id: string) => {
  const entry = getMarkdownXssCorpusCase(id)
  if (!('source' in entry) || typeof entry.source !== 'string') {
    throw new Error(`markdown_xss_source_missing:${id}`)
  }
  return entry.source
}

export const getMarkdownXssSourceAttackFragment = (id: string) => {
  const source = getMarkdownXssSource(id)
  const separator = source.indexOf('\n\n')
  return separator < 0 ? source : source.slice(separator + 2)
}

export const getMarkdownXssFeatureOutput = (id: string) => {
  const entry = getMarkdownXssCorpusCase(id)
  if (!('featureOutput' in entry) || !entry.featureOutput) {
    throw new Error(`markdown_xss_feature_output_missing:${id}`)
  }
  return entry.featureOutput as FeatureRenderOutput
}

export const formatMarkdownXssCaseFailure = (
  entry: {
    featureOutput?: unknown
    id: string
    source?: string
  },
  surface: string,
  seed = 2_662_026,
) =>
  [
    `case=${entry.id}`,
    `surface=${surface}`,
    `seed=${seed}`,
    `minimal=${JSON.stringify(entry.source ?? entry.featureOutput ?? '')}`,
  ].join(' ')
