#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  CROSS_THEME_CONTRACTS,
  VISUAL_PROJECT_NAMES,
} from './visual-variant.mjs'

const visualSpecDirectory = 'vue/tests/visual'

const readVisualSpecs = (directory = visualSpecDirectory) =>
  new Map(
    readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
      .map((entry) => [
        entry.name,
        readFileSync(join(directory, entry.name), 'utf8'),
      ]),
  )

const addViolation = (violations, file, rule) => {
  violations.push(`${file}: ${rule}`)
}

export const validateVisualVariantOwnership = ({
  specs,
  previewConfig,
  screenshotConfig,
}) => {
  const violations = []
  const registeredCrossThemeFiles = new Set(
    CROSS_THEME_CONTRACTS.map((contract) => contract.file),
  )

  for (const contract of CROSS_THEME_CONTRACTS) {
    if (!contract.owner.trim() || !contract.reason.trim()) {
      addViolation(
        violations,
        contract.file,
        'cross-theme registration requires a non-empty owner and reason',
      )
    }
    if (!VISUAL_PROJECT_NAMES.includes(contract.project)) {
      addViolation(
        violations,
        contract.file,
        `cross-theme registration uses unknown project ${contract.project}`,
      )
    }
  }

  for (const [file, source] of specs) {
    const containsThemeLoop =
      /for\s*\([^)]*(?:theme|mode)[^)]*(?:light|dark)|for\s*\([^)]*(?:light|dark)[^)]*\)/u.test(
        source,
      )
    if (containsThemeLoop && !registeredCrossThemeFiles.has(file)) {
      addViolation(
        violations,
        file,
        'light/dark iteration is not a registered cross-theme contract',
      )
    }
    if (!containsThemeLoop && registeredCrossThemeFiles.has(file)) {
      addViolation(
        violations,
        file,
        'registered cross-theme contract no longer contains an explicit theme comparison',
      )
    }

    for (const [pattern, rule] of [
      [/[?&]theme=(?:light|dark)\b/u, 'hard-coded theme query'],
      [/\.setViewportSize\s*\(/u, 'spec-owned viewport mutation'],
      [
        /(?:includes|startsWith)\s*\(\s*['"](?:dark|light|mobile|desktop)['"]\s*\)/u,
        'local project-name parsing',
      ],
      [
        /switch\s*\(\s*(?:projectName|testInfo\.project\.name)\s*\)/u,
        'local project-name switch',
      ],
      [
        /test\.skip\s*\([\s\S]{0,180}(?:projectName|project\.name)/u,
        'runtime project skip instead of project selection',
      ],
      [
        /(?:['"`])screenshots[\\/]/u,
        'hand-written shared screenshot directory',
      ],
    ]) {
      if (pattern.test(source)) addViolation(violations, file, rule)
    }

    if (
      /project\.name|test\.info\(\)\.project\.name/u.test(source) &&
      !source.includes('visual-variant.mjs')
    ) {
      addViolation(
        violations,
        file,
        'project-aware spec must consume the canonical visual variant helper',
      )
    }

    const pathAssignments = source.matchAll(/\bpath\s*:\s*([^,}\n]+)/gu)
    const safePathVariables = new Set(
      [
        ...source.matchAll(
          /const\s+(\w+)\s*=\s*screenshotPath\(\s*testInfo\b/gu,
        ),
      ].map((match) => match[1]),
    )
    for (const match of pathAssignments) {
      const expression = match[1].trim()
      if (
        !expression.startsWith('testInfo.outputPath(') &&
        !safePathVariables.has(expression)
      ) {
        addViolation(
          violations,
          file,
          `screenshot path ${JSON.stringify(expression)} is not isolated by testInfo.outputPath()`,
        )
      }
    }
  }

  for (const projectName of VISUAL_PROJECT_NAMES) {
    const nameFragment = `name: '${projectName}'`
    const selectionFragment = `testIgnore: visualProjectTestIgnore('${projectName}')`
    if (previewConfig.split(nameFragment).length - 1 !== 1) {
      addViolation(
        violations,
        'vue/playwright.config.ts',
        `${projectName} must be declared exactly once`,
      )
    }
    if (!previewConfig.includes(selectionFragment)) {
      addViolation(
        violations,
        'vue/playwright.config.ts',
        `${projectName} must use canonical spec ownership selection`,
      )
    }
    if (!screenshotConfig.includes(selectionFragment)) {
      addViolation(
        violations,
        'vue/playwright.screenshot.config.ts',
        `${projectName} must use canonical spec ownership selection`,
      )
    }
  }

  if (!previewConfig.includes("from '../scripts/visual-variant.mjs'")) {
    addViolation(
      violations,
      'vue/playwright.config.ts',
      'preview config must import the canonical visual variant helper',
    )
  }

  return violations
}

export const readVisualVariantPolicyInputs = () => ({
  specs: readVisualSpecs(),
  previewConfig: readFileSync('vue/playwright.config.ts', 'utf8'),
  screenshotConfig: readFileSync('vue/playwright.screenshot.config.ts', 'utf8'),
})

const isMain =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url

if (isMain) {
  const violations = validateVisualVariantOwnership(
    readVisualVariantPolicyInputs(),
  )
  if (violations.length > 0) {
    console.error(
      `[visual-variant-policy] ${violations.length} violation(s):\n${violations
        .map((violation) => `- ${violation}`)
        .join('\n')}`,
    )
    process.exitCode = 1
  } else {
    console.log(
      `[visual-variant-policy] ok (${VISUAL_PROJECT_NAMES.length} projects, ${readVisualSpecs().size} specs, ${CROSS_THEME_CONTRACTS.length} registered cross-theme contract)`,
    )
  }
}
