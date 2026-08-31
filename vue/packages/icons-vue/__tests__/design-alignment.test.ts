import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..')
const vueRoot = path.join(repoRoot, 'vue')
const iconsSvgRoot = path.join(vueRoot, 'packages', 'icons-svg')
const componentsRoot = path.join(
  vueRoot,
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

const commonSvgPatterns = [/viewBox="0 0 1024 1024"/u, /fill="currentColor"/u]

const tokenEntries = JSON.parse(
  readFileSync(path.join(repoRoot, 'spec', 'tokens', 'tokens.json'), 'utf8'),
) as { tokens: Array<{ name: string; value: string }> }

const tokenValue = (name: string) => {
  const token = tokenEntries.tokens.find((entry) => entry.name === name)
  if (!token) throw new Error(`Missing token ${name}`)
  return token.value
}

const parsePx = (value: string) => {
  const match = value.match(/^(\d+(?:\.\d+)?)px$/u)
  if (!match) throw new Error(`Expected px token value, received ${value}`)
  return Number(match[1])
}

const renderedIconSizePx = parsePx(tokenValue('icon.size.md'))
const visualStrokePx = Number(tokenValue('icon.stroke.md'))

const viewBoxWidth = (source: string) => {
  const match = source.match(/viewBox="0 0 (?<width>\d+) \d+"/u)
  if (!match?.groups?.width) throw new Error('Missing icon viewBox width')
  return Number(match.groups.width)
}

const sourceStrokeWidth = (source: string) => {
  const match = source.match(/stroke-width="(?<width>\d+(?:\.\d+)?)"/u)
  if (!match?.groups?.width) throw new Error('Missing icon stroke-width')
  return Number(match.groups.width)
}

const expectedSourceStrokeWidth = (source: string) =>
  (visualStrokePx * viewBoxWidth(source)) / renderedIconSizePx

const lineSvgStaticPatterns = [
  /stroke-linejoin="round"/u,
  /stroke-linecap="round"/u,
  /stroke="currentColor"/u,
]

const solidSvgPatterns = [/fill="currentColor"/u]
const solidForbiddenSvgPatterns = [
  /stroke-linejoin=/u,
  /stroke-linecap=/u,
  /stroke-width=/u,
  /stroke="currentColor"/u,
]

const isSolidIcon = (name: string) => /(?:^|-)filled$/u.test(name)

describe('icons-vue design alignment', () => {
  it('mirrors every icons-svg source without stale component files', () => {
    const svgNames = readSorted(iconsSvgRoot, '.svg').map((file) =>
      file.replace(/\.svg$/u, ''),
    )
    const componentNames = readSorted(componentsRoot, '.vue').map((file) =>
      file.replace(/\.vue$/u, ''),
    )

    expect(componentNames).toEqual(svgNames)
    expect(svgNames).toHaveLength(302)
  })

  it('classifies line and solid source icon contracts separately', () => {
    const svgNames = readSorted(iconsSvgRoot, '.svg').map((file) =>
      file.replace(/\.svg$/u, ''),
    )
    const solidNames = svgNames.filter(isSolidIcon)
    const lineNames = svgNames.filter((name) => !isSolidIcon(name))

    expect(solidNames).toEqual(
      expect.arrayContaining([
        'bell-filled',
        'circle-check-filled',
        'chrome-filled',
      ]),
    )
    expect(lineNames).toEqual(
      expect.arrayContaining(['search', 'setting', 'warning']),
    )
    expect(solidNames).toHaveLength(28)
    expect(lineNames.length + solidNames.length).toBe(svgNames.length)
  })

  it('keeps line icons on the FsusUI round-stroke contract and solid icons on fill contract', () => {
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

      for (const pattern of commonSvgPatterns) {
        expect(source, `${file} source should match ${pattern}`).toMatch(
          pattern,
        )
        expect(component, `${name}.vue should match ${pattern}`).toMatch(
          pattern,
        )
      }

      const contractPatterns = isSolidIcon(name)
        ? solidSvgPatterns
        : lineSvgStaticPatterns
      for (const pattern of contractPatterns) {
        expect(source, `${file} contract should match ${pattern}`).toMatch(
          pattern,
        )
        expect(
          component,
          `${name}.vue contract should match ${pattern}`,
        ).toMatch(pattern)
      }

      if (!isSolidIcon(name)) {
        const expectedStrokeWidth = expectedSourceStrokeWidth(source)
        const expectedStrokePattern = new RegExp(
          `stroke-width="${expectedStrokeWidth}"`,
          'u',
        )

        expect(source, `${file} should derive stroke from icon tokens`).toMatch(
          expectedStrokePattern,
        )
        expect(
          component,
          `${name}.vue should derive stroke from icon tokens`,
        ).toMatch(expectedStrokePattern)
        expect(
          (sourceStrokeWidth(source) * renderedIconSizePx) /
            viewBoxWidth(source),
        ).toBeCloseTo(visualStrokePx, 5)
      } else {
        for (const pattern of solidForbiddenSvgPatterns) {
          expect(source, `${file} should not inherit ${pattern}`).not.toMatch(
            pattern,
          )
          expect(
            component,
            `${name}.vue should not inherit ${pattern}`,
          ).not.toMatch(pattern)
        }
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

  it('binds the confirm registry entry to the existing check component exactly once', () => {
    const registry = readFileSync(
      path.join(repoRoot, 'spec', 'icons', 'registry.yaml'),
      'utf8',
    )
    const confirmEntry = registry.match(
      /^[ ]{2}- id: confirm\n(?<body>(?:[ ]{4}.+\n)+)/mu,
    )
    const index = readFileSync(path.join(componentsRoot, 'index.ts'), 'utf8')

    expect(confirmEntry?.groups?.body).toContain(
      'source: vue/packages/icons-svg/check.svg',
    )
    expect(
      index.match(/export \{ default as Confirm \} from '\.\/check\.vue'/gu),
    ).toHaveLength(1)
    expect(index).toContain("export { default as Check } from './check.vue'")
    expect(readSorted(componentsRoot, '.vue')).toContain('check.vue')
    expect(readSorted(componentsRoot, '.vue')).not.toContain('confirm.vue')
  })
})
