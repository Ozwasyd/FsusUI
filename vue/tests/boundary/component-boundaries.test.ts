import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import fg from 'fast-glob'
import { describe, expect, it } from 'vitest'

const componentsSrcRoot = resolve(process.cwd(), 'vue/packages/components/src')
const rootComponentsIndex = resolve(componentsSrcRoot, 'index.ts')

const componentDirs = readdirSync(componentsSrcRoot, {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => !name.startsWith('__'))
  .sort()

describe('component boundary coverage registry', () => {
  it('exports every component module directory from vue/packages/components/src/index.ts', () => {
    expect(existsSync(rootComponentsIndex)).toBe(true)
    const indexSource = readFileSync(rootComponentsIndex, 'utf8')
    expect(componentDirs.length).toBeGreaterThan(30)

    for (const componentDir of componentDirs) {
      expect(
        indexSource.includes(`./${componentDir}/`) ||
          indexSource.includes(`./${componentDir}'`),
        `${componentDir} must be referenced by vue/packages/components/src/index.ts`,
      ).toBe(true)
    }
  })

  it('keeps demo-app runtime imports on public @ozwasyd/fsusui or demo-contract boundaries', async () => {
    const demoFiles = await fg('vue/packages/demo-app/src/**/*.{ts,vue}', {
      cwd: process.cwd(),
      absolute: true,
    })
    expect(demoFiles.length).toBeGreaterThan(0)
    const forbiddenDeepImport = /from ['"]\.\.\/\.\.\/components\//

    for (const file of demoFiles) {
      const source = readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('import type '))
        .join('\n')
      expect(
        forbiddenDeepImport.test(source),
        `${file} must import runtime components through demo-contract/@ozwasyd/fsusui boundaries`,
      ).toBe(false)
    }
  })
})
