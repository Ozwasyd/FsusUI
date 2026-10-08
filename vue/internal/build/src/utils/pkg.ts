import { PKG_NAME, PKG_PREFIX } from '@element-plus/build-constants'
import { buildConfig } from '../build-info'

import type { Module } from '../build-info'

/** used for type generator */
export const pathRewriter = (module: Module) => {
  const config = buildConfig[module]

  return (id: string) => {
    // The motion facade is motion.d.ts; its declarations must use the index owner.
    id = id.replaceAll(
      new RegExp(`(['"])${PKG_PREFIX}/motion\\1`, 'g'),
      (_, quote) => `${quote}${config.bundle.path}/motion/index${quote}`,
    )
    id = id.replaceAll(`${PKG_PREFIX}/theme-chalk`, `${PKG_NAME}/theme-chalk`)
    id = id.replaceAll(`${PKG_PREFIX}/`, `${config.bundle.path}/`)
    return id
  }
}
