import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const themeSourceRoot = 'packages/theme-chalk/src'

const weakFocusRingPattern =
  /(?:box-shadow:\s*inset 0 0 0 1px var\(--fsus-scholarly-blue\b|@include\s+a11y-focus-ring\(\s*1px\b)/

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8')

const walkFiles = (relativeDir, predicate, files = []) => {
  const absoluteDir = path.join(root, relativeDir)

  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = path.join(relativeDir, entry.name)

    if (entry.isDirectory()) {
      walkFiles(relativePath, predicate, files)
      continue
    }

    if (entry.isFile() && predicate(relativePath)) {
      files.push(relativePath.replaceAll(path.sep, '/'))
    }
  }

  return files
}

const failures = []

for (const file of walkFiles(themeSourceRoot, (name) => name.endsWith('.scss'))) {
  const lines = read(file).split(/\r?\n/u)

  lines.forEach((line, index) => {
    if (weakFocusRingPattern.test(line)) {
      failures.push(`${file}:${index + 1}`)
    }
  })
}

if (failures.length > 0) {
  console.error(
    [
      'production SCSS must not use 1px Scholarly Blue focus rings.',
      ...failures,
    ].join('\n'),
  )
  process.exitCode = 1
} else {
  console.log('focus-ring-contract check passed')
}
