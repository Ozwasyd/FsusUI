import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const evidenceRoot = resolve(
  process.cwd(),
  'tests/conformance/visual/artifacts',
)

export const writeIssue468TextEvidence = async (
  name: string,
  content: string,
) => {
  await mkdir(evidenceRoot, { recursive: true })
  await writeFile(resolve(evidenceRoot, name), content)
}

export const writeIssue468ScreenshotEvidence = async (
  name: string,
  content: Buffer,
) => {
  const screenshotRoot = resolve(evidenceRoot, 'screenshots/web')
  await mkdir(screenshotRoot, { recursive: true })
  await writeFile(resolve(screenshotRoot, name), content)
}
