import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const declarationPath = path.join(root, 'vue/packages/wasm/dist/index.d.ts')
const nativeFingerprintPath = path.join(
  root,
  'vue/packages/wasm/dist/.native-artifact-fingerprint',
)

const ensure = () =>
  execFileSync('pnpm', ['run', 'ensure:wasm'], {
    cwd: root,
    encoding: 'utf8',
  })

test('valid source fingerprint rejects and recovers a postinstall stub without rebuilding native artifacts', () => {
  ensure()
  const nativeBefore = readFileSync(nativeFingerprintPath, 'utf8')
  writeFileSync(
    declarationPath,
    `export * from ${JSON.stringify(path.join(root, 'vue/packages/wasm/index.js'))};\n`,
  )

  const output = ensure()
  assert.match(output, /bundle artifact content digest changed/u)
  assert.match(output, /building vue\/packages\/wasm bundle artifacts/u)

  const declaration = readFileSync(declarationPath, 'utf8')
  assert.match(declaration, /MarkdownSafeHtml/u)
  assert.match(declaration, /MarkdownSafeRenderResult/u)
  assert.ok(!declaration.includes(root))
  assert.equal(readFileSync(nativeFingerprintPath, 'utf8'), nativeBefore)
  assert.match(ensure(), /cache-hit/u)
})
