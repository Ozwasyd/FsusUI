import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '..', '..', '..')
const iconsSvgRoot = path.join(repoRoot, 'packages', 'icons-svg')
const componentsRoot = path.join(
  repoRoot,
  'packages',
  'icons-vue',
  'src',
  'components',
)

const toPascalCase = (name: string) =>
  name
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')

const readSorted = (dir: string, extension: string) =>
  readdirSync(dir)
    .filter((file) => file.endsWith(extension))
    .sort((a, b) => a.localeCompare(b))

const requiredSvgPatterns = [
  /stroke-linejoin="round"/u,
  /stroke-linecap="round"/u,
  /stroke-width="32"/u,
  /stroke="currentColor"/u,
  /viewBox="0 0 1024 1024"/u,
  /fill="currentColor"/u,
]

describe('icons-vue design alignment', () => {
  it('mirrors every icons-svg source without stale component files', () => {
    const svgNames = readSorted(iconsSvgRoot, '.svg').map((file) =>
      file.replace(/\.svg$/u, ''),
    )
    const componentNames = readSorted(componentsRoot, '.vue').map((file) =>
      file.replace(/\.vue$/u, ''),
    )

    expect(componentNames).toEqual(svgNames)
    expect(svgNames).toHaveLength(293)
  })

  it('keeps every source svg and generated vue icon on the FsusUI round-stroke contract', () => {
    const svgFiles = readSorted(iconsSvgRoot, '.svg')
    const index = readFileSync(path.join(componentsRoot, 'index.ts'), 'utf8')

    for (const file of svgFiles) {
      const name = file.replace(/\.svg$/u, '')
      const componentName = toPascalCase(name)
      const source = readFileSync(path.join(iconsSvgRoot, file), 'utf8')
      const component = readFileSync(
        path.join(componentsRoot, `${name}.vue`),
        'utf8',
      )

      for (const pattern of requiredSvgPatterns) {
        expect(source, `${file} source should match ${pattern}`).toMatch(
          pattern,
        )
        expect(component, `${name}.vue should match ${pattern}`).toMatch(
          pattern,
        )
      }

      expect(component).toContain(`name: '${componentName}'`)
      expect(index).toContain(
        `export { default as ${componentName} } from './${name}.vue'`,
      )
    }
  })

  it('exports registry semantic aliases without duplicating component files', () => {
    const index = readFileSync(path.join(componentsRoot, 'index.ts'), 'utf8')

    expect(index).toContain(
      "export { default as ChevronRight } from './arrow-right.vue'",
    )
    expect(index).toContain(
      "export { default as Settings } from './setting.vue'",
    )
    expect(index).toContain(
      "export { default as Magnifier } from './search.vue'",
    )
    expect(index).toContain(
      "export { default as Next } from './arrow-right.vue'",
    )
  })
})
