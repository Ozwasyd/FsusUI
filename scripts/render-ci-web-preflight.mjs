import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  expectedBrowserVersion,
  selectRenderBrowser,
} from './pin-render-browser.mjs'
import { captureIdleCadence } from './web-idle-cadence.mjs'

export async function verifyWebRunner(
  executable,
  { select = selectRenderBrowser, launch, capture = captureIdleCadence },
) {
  const selected = select(executable)
  const browser = await launch({
    headless: true,
    executablePath: selected.executable,
    chromiumSandbox: true,
    timeout: 10_000,
  })
  try {
    assert.equal(
      browser.version(),
      expectedBrowserVersion,
      'launched browser differs from pin',
    )
    return { selected, idleCadence: await capture(browser) }
  } finally {
    await browser.close()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const output = path.resolve(process.argv[2])
  await mkdir(path.dirname(output), { recursive: true })
  let result
  try {
    const { chromium } = await import('@playwright/test')
    result = {
      status: 'READY',
      formalAcceptance: false,
      ...(await verifyWebRunner(process.env.FSUSUI_PERF_BROWSER_EXECUTABLE, {
        launch: (options) => chromium.launch(options),
      })),
    }
  } catch (error) {
    result = {
      status: 'ENVIRONMENT_NOT_READY',
      formalAcceptance: false,
      reason: error instanceof Error ? error.message : String(error),
    }
    process.exitCode = 1
  }
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, {
    flag: 'wx',
  })
  if (process.exitCode)
    console.error(
      'Web performance environment not ready; no product result was measured.',
    )
  console.log(JSON.stringify(result, null, 2))
}
