import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

try {
  await import('./check-package-build-smoke.mjs')
} catch (error) {
  try {
    const css = await readFile('vue/packages/theme-chalk/dist/fsus.css')
    console.error(
      `[package-smoke] complete theme actual sha256=${createHash('sha256').update(css).digest('hex')} bytes=${css.byteLength}`,
    )
  } catch (diagnosticError) {
    console.error(
      `[package-smoke] unable to inspect complete theme: ${diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError)}`,
    )
  }
  throw error
}
