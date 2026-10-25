import { PKG_NAME, PKG_PREFIX } from '@element-plus/build-constants'
import path from 'node:path'
import { buildConfig } from '../build-info'

import type { Module } from '../build-info'

/** used for type generator */
export const pathRewriter = (module: Module, declarationPath?: string) => {
  const config = buildConfig[module]
  const declarationTarget = (entry: string) => {
    if (!declarationPath) return `${config.bundle.path}/${entry}`
    const relative = path
      .relative(path.dirname(declarationPath), entry)
      .split(path.sep)
      .join('/')
    return relative.startsWith('.') ? relative : `./${relative}`
  }

  return (id: string) => {
    if (declarationPath) {
      id = id.replace(
        /(['"])@element-plus\/([^'"]+)\1/gu,
        (_match, quote: string, sourceEntry: string) => {
          if (
            declarationPath === 'index.d.ts' &&
            sourceEntry === 'components'
          ) {
            return `${quote}${config.bundle.path}/${sourceEntry}${quote}`
          }
          if (sourceEntry.startsWith('theme-chalk/')) {
            return `${quote}${PKG_NAME}/${sourceEntry}${quote}`
          }
          const owners: Record<string, string> = {
            motion: 'motion/index',
            'icons-vue': 'icons-vue/src/index',
            wasm: 'wasm/index',
            'element-plus': 'index',
          }
          const entry =
            owners[sourceEntry] ?? sourceEntry.replace(/^element-plus\//u, '')
          return `${quote}${declarationTarget(entry)}${quote}`
        },
      )
    }
    for (const entry of ['motion/index', 'icons-vue/src/index', 'wasm/index']) {
      const owner = entry.split('/')[0]
      id = id.replaceAll(
        `${PKG_PREFIX}/${owner}'`,
        `${config.bundle.path}/${entry}'`,
      )
      id = id.replaceAll(
        `${PKG_PREFIX}/${owner}"`,
        `${config.bundle.path}/${entry}"`,
      )
    }
    id = id.replaceAll(`${PKG_PREFIX}/theme-chalk`, `${PKG_NAME}/theme-chalk`)
    id = id.replaceAll(`${PKG_PREFIX}/`, `${config.bundle.path}/`)
    return id
  }
}
