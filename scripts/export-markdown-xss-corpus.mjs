import { cp, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  corpusPath,
  manifestPath,
  schemaPath,
  validateMarkdownXssCorpus,
} from './markdown-xss-corpus.mjs'

const outFlag = process.argv.indexOf('--out')
if (outFlag < 0 || !process.argv[outFlag + 1]) {
  throw new Error('Usage: node scripts/export-markdown-xss-corpus.mjs --out <directory>')
}

await validateMarkdownXssCorpus()
const output = resolve(process.cwd(), process.argv[outFlag + 1])
await mkdir(output, { recursive: true })
for (const source of [corpusPath, schemaPath, manifestPath]) {
  await cp(source, resolve(output, source.split('/').at(-1)))
}
console.log(`[markdown-xss] exported test-only corpus to ${output}`)
