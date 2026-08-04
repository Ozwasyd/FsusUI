import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const registry = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'spec/ci/playwright-suites.json'), 'utf8'),
)

export const playwrightSuiteProjectContracts = Object.freeze(
  Object.fromEntries(
    registry.suites.map((suite) => [
      suite.id,
      Object.freeze(suite.cells.map((cell) => Object.freeze({ ...cell }))),
    ]),
  ),
)

export function projectsForSuite(id) {
  const cells = playwrightSuiteProjectContracts[id]
  if (!cells) throw new Error(`Unknown Playwright suite project contract: ${id}.`)
  return cells
}
