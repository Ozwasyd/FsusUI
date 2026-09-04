import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const committedDir = path.join(root, 'spec/avalonia/semantic')
const project = path.join(
  root,
  'dotnet/FsusUI.Avalonia.ApiTool/FsusUI.Avalonia.ApiTool.csproj',
)

const expectedFiles = [
  'FsusUI.Avalonia.semantic.json',
  'FsusUI.Avalonia.Themes.semantic.json',
  'FsusUI.Avalonia.Icons.semantic.json',
]

const read = (file) => fs.readFileSync(file, 'utf8')
const exists = (file) => fs.existsSync(file)

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

for (const file of expectedFiles) {
  assert(
    exists(path.join(committedDir, file)),
    `${file} must exist under spec/avalonia/semantic`,
  )
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avalonia-semantic-'))
try {
  execFileSync(
    'dotnet',
    [
      'run',
      '--project',
      project,
      '--',
      '--verify-source-semantics',
      '--output',
      tmpDir,
    ],
    {
      cwd: root,
      stdio: 'inherit',
      encoding: 'utf8',
    },
  )

  for (const file of expectedFiles) {
    const generated = read(path.join(tmpDir, file))
    const committed = read(path.join(committedDir, file))
    assert(
      generated === committed,
      `${file} drifted from the committed Avalonia semantic baseline; run pnpm run avalonia:semantic`,
    )
    console.log(`avalonia:semantic:check passed ${file}`)
  }
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true })
}
