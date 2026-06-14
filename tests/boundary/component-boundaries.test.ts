import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import fg from 'fast-glob'
import { describe, expect, it } from 'vitest'
import {
  boundaryTypes,
  groupedComponentCoverage,
  publicComponentBoundaries,
  rawHtmlBoundaryComponents,
} from './component-boundaries'
import { auditComponentNames } from '../../packages/demo-app/src/ui-audit-manifest'

const componentsRoot = resolve(process.cwd(), 'packages/components')
const rootComponentsIndex = resolve(componentsRoot, 'index.ts')

const publicComponentDirs = readdirSync(componentsRoot, {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => existsSync(resolve(componentsRoot, name, 'index.ts')))
  .sort()

const rootIndexSource = readFileSync(rootComponentsIndex, 'utf8')
const rootExportedComponentDirs = Array.from(
  rootIndexSource.matchAll(/^export \* from '\.\/([^']+)'/gm),
  (match) => match[1],
).sort()

const unitTestExists = (componentDir: string) => {
  const testDir = resolve(componentsRoot, componentDir, '__tests__')
  return (
    existsSync(testDir) &&
    readdirSync(testDir).some((file) => file.includes('.test.'))
  )
}

const exportStatements = (componentDir: string) => {
  const indexPath = resolve(componentsRoot, componentDir, 'index.ts')
  const source = readFileSync(indexPath, 'utf8')
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('export '))
}

const visualAuditExclusions = new Set([
  'collection',
  'focus-trap',
  'infinite-scroll',
  'loading',
  'message',
  'message-box',
  'notification',
  'roving-focus-group',
  'slot',
  'teleport',
  'virtual-list',
])

const visualAuditNameOverrides: Record<string, string> = {
  'settings-primitives': 'ElSectionNav',
  'visual-hidden': 'ElVisuallyHidden',
}

const toAuditComponentName = (componentDir: string) =>
  visualAuditNameOverrides[componentDir] ??
  `El${componentDir
    .split('-')
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join('')}`

describe('component boundary coverage registry', () => {
  it('tracks every component package index', () => {
    for (const componentDir of publicComponentDirs) {
      expect(
        publicComponentBoundaries[componentDir],
        `${componentDir} is missing from component boundary coverage`,
      ).toBeDefined()
    }
  })

  it('tracks every root public component export', () => {
    for (const componentDir of rootExportedComponentDirs) {
      expect(
        publicComponentBoundaries[componentDir],
        `${componentDir} is exported from packages/components but missing boundary coverage`,
      ).toBeDefined()
    }
  })

  it('declares complete export coverage and valid boundary types', () => {
    const validBoundaryTypes = new Set(boundaryTypes)

    for (const componentDir of publicComponentDirs) {
      const coverage = publicComponentBoundaries[componentDir]
      expect(
        coverage.exports,
        `${componentDir} must cover all public exports`,
      ).toBe('all')
      expect(
        coverage.boundaries.length,
        `${componentDir} must list boundaries`,
      ).toBeGreaterThan(0)

      for (const boundary of coverage.boundaries) {
        expect(
          validBoundaryTypes.has(boundary),
          `${componentDir} declares unknown boundary ${boundary}`,
        ).toBe(true)
      }

      expect(
        exportStatements(componentDir).length,
        `${componentDir} must expose public exports from index.ts`,
      ).toBeGreaterThan(0)
    }
  })

  it('declares responsive boundary coverage for every public component', () => {
    for (const componentDir of publicComponentDirs) {
      const coverage = publicComponentBoundaries[componentDir]

      expect(
        coverage.boundaries,
        `${componentDir} must be covered by desktop/mobile boundary audit`,
      ).toContain('responsive-desktop-mobile')
      expect(
        coverage.boundaries,
        `${componentDir} must be covered by tiny viewport boundary audit`,
      ).toContain('responsive-tiny')
    }
  })

  it('declares explicit default-safe raw HTML contracts for raw-capable components', () => {
    for (const componentDir of rawHtmlBoundaryComponents) {
      const coverage = publicComponentBoundaries[componentDir]

      expect(
        coverage.boundaries,
        `${componentDir} must cover safe text`,
      ).toContain('safe-text')
      expect(
        coverage.boundaries,
        `${componentDir} must cover SQL/XSS-like payload strings`,
      ).toContain('injection-payload')
      expect(
        coverage.boundaries,
        `${componentDir} must document the raw HTML opt-in boundary`,
      ).toContain('raw-html-opt-in')
    }
  })

  it('has unit tests or visual fixture coverage for each public package', () => {
    for (const componentDir of publicComponentDirs) {
      const coverage = publicComponentBoundaries[componentDir]
      const coveredBy =
        coverage.coveredBy ?? groupedComponentCoverage[componentDir]
      const hasDirectUnitTest = unitTestExists(componentDir)
      const hasGroupedUnitTest = coveredBy ? unitTestExists(coveredBy) : false
      const hasFixture = Boolean(coverage.fixtureModes?.length)

      expect(
        hasDirectUnitTest || hasGroupedUnitTest || hasFixture,
        `${componentDir} must have unit tests, grouped tests, or fixture coverage`,
      ).toBe(true)
    }
  })

  it('keeps visual boundary audit aligned with renderable public components', () => {
    const auditNames = new Set(auditComponentNames)

    for (const componentDir of publicComponentDirs) {
      if (visualAuditExclusions.has(componentDir)) continue

      const auditName = toAuditComponentName(componentDir)
      expect(
        auditNames.has(auditName as (typeof auditComponentNames)[number]),
        `${componentDir} must have a UI boundary audit fixture named ${auditName}`,
      ).toBe(true)
    }
  })

  it('keeps demo-app runtime imports behind the demo contract', async () => {
    const demoFiles = await fg('packages/demo-app/src/**/*.{ts,vue}', {
      cwd: process.cwd(),
      absolute: true,
    })
    const forbiddenDeepImport =
      /from ['"]\.\.\/\.\.\/components\/(?!.*style\/css)/

    for (const file of demoFiles) {
      const source = readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('import type '))
        .join('\n')
      expect(
        forbiddenDeepImport.test(source),
        `${file} must import runtime components through demo-contract/element-plus boundaries`,
      ).toBe(false)
    }
  })
})
