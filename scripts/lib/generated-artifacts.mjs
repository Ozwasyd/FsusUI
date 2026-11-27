import fs from 'node:fs'
import path from 'node:path'

export function writeGeneratedArtifacts(root, files) {
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath)
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    fs.writeFileSync(absolutePath, content)
    console.log(`wrote ${relativePath}`)
  }
}

export function checkGeneratedArtifacts(root, files, label) {
  const failures = []
  for (const [relativePath, expected] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath)
    if (!fs.existsSync(absolutePath)) {
      failures.push(`${relativePath} is missing`)
      continue
    }
    if (fs.readFileSync(absolutePath, 'utf8') !== expected) {
      failures.push(`${relativePath} is stale`)
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `${label} artifacts are not current:\n${failures.join('\n')}`,
    )
  }
}
