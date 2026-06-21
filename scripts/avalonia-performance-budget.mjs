import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const generatedBy = 'scripts/avalonia-performance-budget.mjs'
const budgetPath = 'spec/components/avalonia-stable-performance-budgets.json'
const measurementPath =
  'tests/conformance/performance/avalonia-measurements.json'
const dataSizePath = 'tests/conformance/performance/data-size-fixtures.json'
const invalidFixturePath =
  'tests/fixtures/avalonia-performance-budget/invalid-cases.json'
const firstSubsetPath = 'spec/components/avalonia-first-subset.yaml'
const complexRoadmapPath = 'spec/components/complex-components-roadmap.yaml'

const outputPaths = {
  report: 'tests/conformance/performance/artifacts/avalonia-budget-report.json',
  releaseEvidence: 'docs/releases/avalonia-performance-budgets.md',
  generatedTests:
    'dotnet/FsusUI.Avalonia.PerformanceTests/Generated/PerformanceBudgetTests.cs',
}

const maxMetrics = [
  'constructionMs',
  'firstLayoutMs',
  'interactionLatencyMs',
  'frameTimeMs',
  'allocationsKb',
  'retainedControlCount',
  'disposalMs',
]

const minMetrics = ['mountUnmountCycles']
const requiredMetrics = [...maxMetrics, ...minMetrics]

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8')

const readJson = (relativePath) => JSON.parse(read(relativePath))

const sha256 = (content) =>
  crypto.createHash('sha256').update(content).digest('hex')

const deepClone = (value) => JSON.parse(JSON.stringify(value))

const setByPath = (target, dottedPath, value) => {
  const parts = dottedPath.split('.')
  let cursor = target
  for (const part of parts.slice(0, -1)) cursor = cursor[part]
  cursor[parts.at(-1)] = value
}

const deleteByPath = (target, dottedPath) => {
  const parts = dottedPath.split('.')
  let cursor = target
  for (const part of parts.slice(0, -1)) cursor = cursor[part]
  delete cursor[parts.at(-1)]
}

const csString = (value) =>
  `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`

const parseFirstSubsetIds = () => {
  const ids = []
  for (const line of read(firstSubsetPath).split('\n')) {
    const match = line.match(/^ {2}- id:\s*(.+)$/)
    if (match) ids.push(match[1].trim())
  }
  return ids
}

const parseComplexRoadmap = (content = read(complexRoadmapPath)) => {
  const entries = []
  let current
  for (const line of content.split('\n')) {
    const start = line.match(/^ {2}- id:\s*(.+)$/)
    if (start) {
      current = { id: start[1].trim() }
      entries.push(current)
      continue
    }
    if (!current) continue
    const field = line.match(/^ {4}([A-Za-z][A-Za-z0-9]*):\s*(.+)$/)
    if (field) current[field[1]] = field[2].trim()
  }
  return entries
}

const validateBudgets = (budgetData, complexRoadmapContent) => {
  const errors = []
  const firstSubsetIds = parseFirstSubsetIds()
  const budgetMap = new Map(
    budgetData.components.map((component) => [component.id, component]),
  )

  for (const id of firstSubsetIds) {
    const component = budgetMap.get(id)
    if (!component) {
      errors.push(`${id} stable component missing performance budget`)
      continue
    }
    for (const metric of requiredMetrics) {
      if (typeof component.budgets?.[metric] !== 'number') {
        errors.push(`${id} budget missing ${metric}`)
      }
    }
  }

  for (const component of parseComplexRoadmap(complexRoadmapContent)) {
    if (component.phase !== 'stable') continue
    if (!budgetMap.has(component.id)) {
      errors.push(
        `${component.id} complex component stable without numeric budgets`,
      )
    }
  }

  return {
    budgetMap,
    errors,
  }
}

const validateDataSizeFixtures = (dataSizes) => {
  const requiredFamilies = ['list', 'table', 'tree', 'markdown', 'upload']
  const ids = new Set(dataSizes.fixtures.map((fixture) => fixture.family))
  return requiredFamilies
    .filter((family) => !ids.has(family))
    .map((family) => `${family} data-size fixture missing`)
}

const validateMeasurement = (measurement, budgetMap) => {
  const errors = []
  const componentBudget = budgetMap.get(measurement.component)
  if (!componentBudget) {
    return {
      id: measurement.id,
      component: measurement.component,
      passed: false,
      errors: [`${measurement.component} measurement missing component budget`],
    }
  }
  if (
    !measurement.artifact?.startsWith(
      'tests/conformance/performance/artifacts/measurements/',
    )
  ) {
    errors.push(
      `${measurement.id} measurement artifact path is not deterministic`,
    )
  }
  for (const metric of requiredMetrics) {
    if (typeof measurement.metrics?.[metric] !== 'number') {
      errors.push(`${measurement.id} missing metric ${metric}`)
    }
  }
  for (const metric of maxMetrics) {
    const actual = measurement.metrics?.[metric]
    const budget = componentBudget.budgets[metric]
    if (typeof actual === 'number' && actual > budget) {
      errors.push(`${measurement.id} ${metric} exceeded ${budget}: ${actual}`)
    }
  }
  for (const metric of minMetrics) {
    const actual = measurement.metrics?.[metric]
    const budget = componentBudget.budgets[metric]
    if (typeof actual === 'number' && actual < budget) {
      errors.push(`${measurement.id} ${metric} below ${budget}: ${actual}`)
    }
  }
  return {
    id: measurement.id,
    component: measurement.component,
    scenario: measurement.scenario,
    metrics: measurement.metrics,
    budgets: componentBudget.budgets,
    artifact: measurement.artifact,
    passed: errors.length === 0,
    errors,
  }
}

const validateAll = (
  budgetData,
  measurementData,
  dataSizes,
  complexRoadmapContent,
) => {
  const budgetValidation = validateBudgets(budgetData, complexRoadmapContent)
  const measurementResults = measurementData.measurements.map((measurement) =>
    validateMeasurement(measurement, budgetValidation.budgetMap),
  )
  const errors = [
    ...budgetValidation.errors,
    ...validateDataSizeFixtures(dataSizes),
    ...measurementResults.flatMap((result) => result.errors),
  ]
  return {
    measurementResults,
    errors,
  }
}

const applyInvalidMutation = (
  budgetData,
  measurementData,
  dataSizes,
  testCase,
) => {
  const nextBudgets = deepClone(budgetData)
  const nextMeasurements = deepClone(measurementData)
  const nextDataSizes = deepClone(dataSizes)
  let complexRoadmapContent = read(complexRoadmapPath)

  if (testCase.measurementMutation) {
    const measurement = nextMeasurements.measurements.find(
      (entry) => entry.id === testCase.measurementMutation.id,
    )
    if (!measurement)
      throw new Error(`missing measurement ${testCase.measurementMutation.id}`)
    setByPath(
      measurement,
      testCase.measurementMutation.path,
      testCase.measurementMutation.value,
    )
  }
  if (testCase.budgetMutation) {
    const component = nextBudgets.components.find(
      (entry) => entry.id === testCase.budgetMutation.id,
    )
    if (!component)
      throw new Error(`missing budget ${testCase.budgetMutation.id}`)
    if (testCase.budgetMutation.delete) {
      deleteByPath(component, testCase.budgetMutation.path)
    } else {
      setByPath(
        component,
        testCase.budgetMutation.path,
        testCase.budgetMutation.value,
      )
    }
  }
  if (testCase.complexRoadmapMutation) {
    complexRoadmapContent = complexRoadmapContent.replace(
      `  - id: ${testCase.complexRoadmapMutation.id}\n    publicName: FsusDataTable\n    phase: deferred`,
      `  - id: ${testCase.complexRoadmapMutation.id}\n    publicName: FsusDataTable\n    phase: stable`,
    )
  }
  return {
    budgetData: nextBudgets,
    measurementData: nextMeasurements,
    dataSizes: nextDataSizes,
    complexRoadmapContent,
  }
}

const validateInvalidFixtures = (budgetData, measurementData, dataSizes) => {
  const invalid = readJson(invalidFixturePath)
  for (const testCase of invalid.cases ?? []) {
    let message = ''
    try {
      const mutated = applyInvalidMutation(
        budgetData,
        measurementData,
        dataSizes,
        testCase,
      )
      const result = validateAll(
        mutated.budgetData,
        mutated.measurementData,
        mutated.dataSizes,
        mutated.complexRoadmapContent,
      )
      message = result.errors.join('\n')
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    if (!message.includes(testCase.expectedError)) {
      throw new Error(
        `${testCase.name} expected ${testCase.expectedError}, got ${message || 'success'}`,
      )
    }
  }
}

const renderReport = (budgetData, measurementData, dataSizes, results) =>
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedBy,
      sources: [
        { path: budgetPath, sha256: sha256(read(budgetPath)) },
        { path: measurementPath, sha256: sha256(read(measurementPath)) },
        { path: dataSizePath, sha256: sha256(read(dataSizePath)) },
      ],
      summary: {
        budgetedComponents: budgetData.components.length,
        measurements: results.length,
        passed: results.filter((result) => result.passed).length,
        dataSizeFixtures: dataSizes.fixtures.length,
      },
      dataSizeFixtures: dataSizes.fixtures,
      measurements: results,
      measurementOutput: measurementData.measurements.map(
        (entry) => entry.artifact,
      ),
    },
    null,
    2,
  )}\n`

const renderMeasurementArtifact = (measurement) =>
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedBy,
      measurement,
    },
    null,
    2,
  )}\n`

const renderReleaseEvidence = (results) => `# Avalonia Performance Budgets

This file is generated by \`${generatedBy}\`.

| Measurement | Component | Construction | First layout | Interaction | Frame | Allocations | Retained | Disposal | Mount cycles |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${results
  .map(
    (result) =>
      `| \`${result.id}\` | \`${result.component}\` | ${result.metrics.constructionMs}ms / ${result.budgets.constructionMs}ms | ${result.metrics.firstLayoutMs}ms / ${result.budgets.firstLayoutMs}ms | ${result.metrics.interactionLatencyMs}ms / ${result.budgets.interactionLatencyMs}ms | ${result.metrics.frameTimeMs}ms / ${result.budgets.frameTimeMs}ms | ${result.metrics.allocationsKb}KB / ${result.budgets.allocationsKb}KB | ${result.metrics.retainedControlCount} / ${result.budgets.retainedControlCount} | ${result.metrics.disposalMs}ms / ${result.budgets.disposalMs}ms | ${result.metrics.mountUnmountCycles} / ${result.budgets.mountUnmountCycles} |`,
  )
  .join('\n')}
`

const renderTests = (results) => {
  const rows = results
    .map(
      (result) =>
        `    yield return new object[] { ${csString(result.id)}, ${csString(
          result.component,
        )}, ${result.metrics.constructionMs}, ${result.budgets.constructionMs}, ${
          result.metrics.firstLayoutMs
        }, ${result.budgets.firstLayoutMs}, ${result.metrics.allocationsKb}, ${
          result.budgets.allocationsKb
        }, ${result.metrics.retainedControlCount}, ${
          result.budgets.retainedControlCount
        }, ${result.metrics.mountUnmountCycles}, ${
          result.budgets.mountUnmountCycles
        } };`,
    )
    .join('\n')

  return `// <auto-generated />
// Generated by scripts/avalonia-performance-budget.mjs. Do not edit manually.
using System.Collections.Generic;

namespace FsusUI.Avalonia.PerformanceTests.Generated;

public class PerformanceBudgetTests
{
  public static IEnumerable<object[]> Measurements()
  {
${rows}
  }

  [Theory]
  [MemberData(nameof(Measurements))]
  public void GeneratedMeasurementStaysWithinBudget(
    string id,
    string component,
    double constructionMs,
    double constructionBudgetMs,
    double firstLayoutMs,
    double firstLayoutBudgetMs,
    double allocationsKb,
    double allocationsBudgetKb,
    int retainedControlCount,
    int retainedControlBudget,
    int mountUnmountCycles,
    int requiredMountUnmountCycles)
  {
    Assert.False(string.IsNullOrWhiteSpace(id));
    Assert.False(string.IsNullOrWhiteSpace(component));
    Assert.True(constructionMs <= constructionBudgetMs);
    Assert.True(firstLayoutMs <= firstLayoutBudgetMs);
    Assert.True(allocationsKb <= allocationsBudgetKb);
    Assert.True(retainedControlCount <= retainedControlBudget);
    Assert.True(mountUnmountCycles >= requiredMountUnmountCycles);
  }
}
`
}

const renderAll = () => {
  const budgetData = readJson(budgetPath)
  const measurementData = readJson(measurementPath)
  const dataSizes = readJson(dataSizePath)
  validateInvalidFixtures(budgetData, measurementData, dataSizes)
  const result = validateAll(
    budgetData,
    measurementData,
    dataSizes,
    read(complexRoadmapPath),
  )
  if (result.errors.length > 0) {
    throw new Error(
      `Avalonia performance budget failed:\n- ${result.errors.join('\n- ')}`,
    )
  }

  const files = {
    [outputPaths.report]: renderReport(
      budgetData,
      measurementData,
      dataSizes,
      result.measurementResults,
    ),
    [outputPaths.releaseEvidence]: renderReleaseEvidence(
      result.measurementResults,
    ),
    [outputPaths.generatedTests]: renderTests(result.measurementResults),
  }
  for (const measurement of measurementData.measurements) {
    files[measurement.artifact] = renderMeasurementArtifact(measurement)
  }
  return files
}

const prettierConfig = await resolveConfig(path.join(root, 'package.json'))

const formatGeneratedContent = async (relativePath, content) => {
  if (relativePath.endsWith('.cs')) return content
  return format(content, {
    ...(prettierConfig ?? {}),
    filepath: path.join(root, relativePath),
  })
}

const renderFormatted = async () => {
  const files = renderAll()
  return Object.fromEntries(
    await Promise.all(
      Object.entries(files).map(async ([relativePath, content]) => [
        relativePath,
        await formatGeneratedContent(relativePath, content),
      ]),
    ),
  )
}

const writeFiles = (files) => {
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath)
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    fs.writeFileSync(absolutePath, content)
    console.log(`wrote ${relativePath}`)
  }
}

const checkFiles = (files) => {
  const failures = []
  for (const [relativePath, expected] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath)
    if (!fs.existsSync(absolutePath)) {
      failures.push(`${relativePath} is missing`)
      continue
    }
    if (fs.readFileSync(absolutePath, 'utf8') !== expected) {
      failures.push(`${relativePath} is stale`)
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `Avalonia performance budget artifacts are not current:\n${failures.join('\n')}`,
    )
  }
  console.log('Avalonia performance budgets passed.')
}

const command = process.argv[2] ?? 'check'

try {
  const files = await renderFormatted()
  if (command === 'generate') writeFiles(files)
  else if (command === 'check') checkFiles(files)
  else
    throw new Error(
      'Usage: node scripts/avalonia-performance-budget.mjs <generate|check>',
    )
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
