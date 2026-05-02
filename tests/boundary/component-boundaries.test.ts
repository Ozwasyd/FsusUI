import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  boundaryTypes,
  groupedComponentCoverage,
  publicComponentBoundaries,
} from './component-boundaries'

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
  (match) => match[1]
).sort()

const unitTestExists = (componentDir: string) => {
  const testDir = resolve(componentsRoot, componentDir, '__tests__')
  return existsSync(testDir) && readdirSync(testDir).some((file) => file.includes('.test.'))
}

const exportStatements = (componentDir: string) => {
  const indexPath = resolve(componentsRoot, componentDir, 'index.ts')
  const source = readFileSync(indexPath, 'utf8')
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('export '))
}

describe('component boundary coverage registry', () => {
  it('tracks every component package index', () => {
    for (const componentDir of publicComponentDirs) {
      expect(
        publicComponentBoundaries[componentDir],
        `${componentDir} is missing from component boundary coverage`
      ).toBeDefined()
    }
  })

  it('tracks every root public component export', () => {
    for (const componentDir of rootExportedComponentDirs) {
      expect(
        publicComponentBoundaries[componentDir],
        `${componentDir} is exported from packages/components but missing boundary coverage`
      ).toBeDefined()
    }
  })

  it('declares complete export coverage and valid boundary types', () => {
    const validBoundaryTypes = new Set(boundaryTypes)

    for (const componentDir of publicComponentDirs) {
      const coverage = publicComponentBoundaries[componentDir]
      expect(coverage.exports, `${componentDir} must cover all public exports`).toBe('all')
      expect(coverage.boundaries.length, `${componentDir} must list boundaries`).toBeGreaterThan(0)

      for (const boundary of coverage.boundaries) {
        expect(
          validBoundaryTypes.has(boundary),
          `${componentDir} declares unknown boundary ${boundary}`
        ).toBe(true)
      }

      expect(
        exportStatements(componentDir).length,
        `${componentDir} must expose public exports from index.ts`
      ).toBeGreaterThan(0)
    }
  })

  it('has unit tests or visual fixture coverage for each public package', () => {
    for (const componentDir of publicComponentDirs) {
      const coverage = publicComponentBoundaries[componentDir]
      const coveredBy = coverage.coveredBy ?? groupedComponentCoverage[componentDir]
      const hasDirectUnitTest = unitTestExists(componentDir)
      const hasGroupedUnitTest = coveredBy ? unitTestExists(coveredBy) : false
      const hasFixture = Boolean(coverage.fixtureModes?.length)

      expect(
        hasDirectUnitTest || hasGroupedUnitTest || hasFixture,
        `${componentDir} must have unit tests, grouped tests, or fixture coverage`
      ).toBe(true)
    }
  })
})
