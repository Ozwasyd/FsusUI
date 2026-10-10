import path from 'node:path'
import { PKG_NAME, PKG_PREFIX } from '@element-plus/build-constants'
import { buildConfig } from '../build-info'

import type { Module } from '../build-info'

/** used for type generator */
export const pathRewriter = (module: Module, declarationPath?: string) => {
  const config = buildConfig[module]

  return (id: string) => {
    if (declarationPath) {
      const directory = path.posix.dirname(declarationPath.replaceAll('\\', '/'))
      id = id.replaceAll(
        new RegExp(`(['"])${PKG_PREFIX}/wasm/([^'"]+)\\1`, 'g'),
        (_, quote, internalPath) => {
          const relativePath = path.posix.relative(directory, `wasm/${internalPath}`)
          const specifier = relativePath.startsWith('.')
            ? relativePath
            : `./${relativePath}`
          return `${quote}${specifier}${quote}`
        },
      )
    }
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
