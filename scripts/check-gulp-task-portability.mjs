import { readFileSync } from 'node:fs'

const taskFiles = [
  'internal/build/gulpfile.ts',
  'internal/build/src/tasks/full-bundle.ts',
  'packages/theme-chalk/gulpfile.ts',
]

let failures = 0

function fail(message) {
  failures += 1
  console.error(`[gulp-task-portability] ${message}`)
}

for (const file of taskFiles) {
  const source = readFileSync(file, 'utf8')

  if (!source.includes("import type { TaskFunction } from 'gulp'")) {
    fail(`${file} must import TaskFunction as a type-only gulp import`)
  }

  const directDefaultTask = /export\s+default\s+(series|parallel)\s*\(/u.exec(source)
  if (directDefaultTask) {
    fail(
      `${file} must assign default ${directDefaultTask[1]} task to a TaskFunction-typed const before exporting`,
    )
  }

  const inferredTaskExports = source.matchAll(
    /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*(series|parallel)\s*\(/gu,
  )
  for (const match of inferredTaskExports) {
    fail(`${file} export ${match[1]} must be annotated as TaskFunction`)
  }
}

if (failures > 0) {
  process.exitCode = 1
} else {
  console.log('[gulp-task-portability] ok')
}
