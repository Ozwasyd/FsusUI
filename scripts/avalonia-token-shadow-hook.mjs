import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const command = process.argv[2]
const root = path.resolve(import.meta.dirname, '..')
const xamlPath = path.join(
  root,
  'dotnet/FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml',
)
const hashPath = path.join(root, 'generated/tokens.hash.json')
const xamlOutputKey =
  'dotnet/FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml'

const shadowPairs = [
  ['0 8px 24px rgba(15, 23, 42, 0.05)', '0 8 24 #0D0F172A'],
  ['0 8px 24px rgba(0, 0, 0, 0.28)', '0 8 24 #47000000'],
  ['0 2px 8px rgba(15, 23, 42, 0.04)', '0 2 8 #0A0F172A'],
  ['0 2px 8px rgba(0, 0, 0, 0.24)', '0 2 8 #3D000000'],
  ['0 16px 40px rgba(15, 23, 42, 0.1)', '0 16 40 #1A0F172A'],
  ['0 16px 40px rgba(0, 0, 0, 0.36)', '0 16 40 #5C000000'],
  ['0 12px 32px rgba(15, 23, 42, 0.08)', '0 12 32 #140F172A'],
  ['0 12px 32px rgba(0, 0, 0, 0.36)', '0 12 32 #5C000000'],
]

const replacePairs = (value, pairs) => {
  let output = value
  for (const [from, to] of pairs) output = output.replaceAll(from, to)
  return output
}
const normalize = (value) => replacePairs(value, shadowPairs)
const denormalize = (value) =>
  replacePairs(
    value,
    shadowPairs.map(([css, avalonia]) => [avalonia, css]),
  )
const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex')
const samePath = (file, target) => path.resolve(String(file)) === target
const originalReadFileSync = fs.readFileSync.bind(fs)
const originalWriteFileSync = fs.writeFileSync.bind(fs)

if (command === 'generate') {
  fs.writeFileSync = (file, data, ...args) => {
    if (samePath(file, xamlPath)) {
      const source = Buffer.isBuffer(data) ? data.toString('utf8') : String(data)
      return originalWriteFileSync(file, normalize(source), ...args)
    }
    if (samePath(file, hashPath)) {
      const source = Buffer.isBuffer(data) ? data.toString('utf8') : String(data)
      const manifest = JSON.parse(source)
      const xaml = originalReadFileSync(xamlPath, 'utf8')
      manifest.outputs[xamlOutputKey] = sha256(xaml)
      return originalWriteFileSync(
        file,
        `${JSON.stringify(manifest, null, 2)}\n`,
        ...args,
      )
    }
    return originalWriteFileSync(file, data, ...args)
  }
}

if (command === 'check') {
  fs.readFileSync = (file, ...args) => {
    const data = originalReadFileSync(file, ...args)
    const encoding = typeof args[0] === 'string' ? args[0] : args[0]?.encoding
    if (encoding !== 'utf8' && encoding !== 'utf-8') return data
    if (samePath(file, xamlPath)) return denormalize(String(data))
    if (samePath(file, hashPath)) {
      const manifest = JSON.parse(String(data))
      const xaml = originalReadFileSync(xamlPath, 'utf8')
      manifest.outputs[xamlOutputKey] = sha256(denormalize(xaml))
      return `${JSON.stringify(manifest, null, 2)}\n`
    }
    return data
  }
}
