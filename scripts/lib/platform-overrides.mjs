import fs from 'node:fs'
import path from 'node:path'

const parseValue = (value) => {
  const trimmed = value.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return trimmed.replace(/^['"]|['"]$/g, '')
}

export function readPlatformOverrideFile(root, absolutePath) {
  const entries = []
  let current
  let pendingKey
  for (const line of fs.readFileSync(absolutePath, 'utf8').split('\n')) {
    const start = line.match(/^ {2}- id:\s*(.+)$/)
    if (start) {
      pendingKey = undefined
      current = {
        id: parseValue(start[1]),
        file: path.relative(root, absolutePath).split(path.sep).join('/'),
      }
      entries.push(current)
      continue
    }
    if (!current) continue
    if (pendingKey) {
      const continuation = line.match(/^ {6,}(.+)$/)
      if (continuation) {
        current[pendingKey] = parseValue(continuation[1])
        pendingKey = undefined
        continue
      }
    }
    const field = line.match(/^ {4}([A-Za-z][A-Za-z0-9]*):\s*(.*)$/)
    if (field) {
      if (field[2].trim() === '') {
        pendingKey = field[1]
      } else {
        current[field[1]] = parseValue(field[2])
        pendingKey = undefined
      }
    }
  }
  return entries
}

export function readPlatformOverrides(root) {
  const directory = path.join(root, 'spec/platform-overrides')
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith('.yaml'))
    .sort()
    .flatMap((file) =>
      readPlatformOverrideFile(root, path.join(directory, file)),
    )
}
