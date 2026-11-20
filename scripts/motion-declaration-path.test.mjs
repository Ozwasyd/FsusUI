import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
const { pathRewriter } = require('../vue/internal/build/src/utils/pkg.ts')

for (const [format, directory] of [
  ['esm', 'es'],
  ['cjs', 'lib'],
]) {
  test(`${format} motion facade declarations resolve the implementation index`, () => {
    const rewrite = pathRewriter(format)
    const declaration = `export { useScrollReveal } from '@element-plus/motion';\nexport type { ScrollRevealOptions } from "@element-plus/motion";`
    const result = rewrite(declaration)
    assert.equal(
      result,
      `export { useScrollReveal } from 'element-plus/${directory}/motion/index';\nexport type { ScrollRevealOptions } from "element-plus/${directory}/motion/index";`,
    )
    assert.doesNotMatch(result, /(['"])element-plus\/(?:es|lib)\/motion\1/)
  })

  test(`${format} preserves existing motion leaf and unrelated package mappings`, () => {
    const declaration =
      "export * from '@element-plus/motion/types';\nexport * from '@element-plus/motion-extra';\nexport * from '@element-plus/components/button';\nimport '@element-plus/theme-chalk/src/base.scss';"
    assert.equal(
      pathRewriter(format)(declaration),
      `export * from 'element-plus/${directory}/motion/types';\nexport * from 'element-plus/${directory}/motion-extra';\nexport * from 'element-plus/${directory}/components/button';\nimport 'element-plus/theme-chalk/src/base.scss';`,
    )
  })
}
