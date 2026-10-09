import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

export const regions = [
  {
    component: 'color-picker',
    file: 'color-picker',
    owner: 'colorPickerEmits',
    events: ['focus', 'blur'],
  },
  {
    component: 'inbox-primitives',
    file: 'shared',
    owner: 'conversationListItemEmits',
    events: ['select'],
  },
  {
    component: 'tree-v2',
    file: 'virtual-tree',
    owner: 'treeEmits',
    events: ['NODE_CONTEXTMENU'],
  },
]

export function parse(text, filename) {
  const source = ts.createSourceFile(
    filename,
    text,
    ts.ScriptTarget.Latest,
    true,
  )
  assert.deepEqual(source.parseDiagnostics, [], `Parse failed: ${filename}`)
  return source
}

export function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

// Alpha-normalize only the validator payload binding. Event-name literal
// parameters and property names (including consumer data.event) stay intact.
export function canonical(text, filename, region) {
  const source = parse(text, filename)
  const result = ts.transform(source, [
    (context) => {
      const renameBody = (node, name) => {
        if (
          ts.isIdentifier(node) &&
          node.text === name &&
          !(
            ts.isPropertyAccessExpression(node.parent) &&
            node.parent.name === node
          ) &&
          !(ts.isPropertyAssignment(node.parent) && node.parent.name === node)
        ) {
          return ts.factory.createIdentifier('__payload__')
        }
        return ts.visitEachChild(
          node,
          (child) => renameBody(child, name),
          context,
        )
      }
      const visit = (node) => {
        if (
          ts.isArrowFunction(node) &&
          ts.isPropertyAssignment(node.parent) &&
          region.events.includes(
            node.parent.name.getText(source).replace(/^\[|\]$/g, ''),
          )
        ) {
          const owner = node.parent.parent.parent
          if (
            ts.isVariableDeclaration(owner) &&
            owner.name.getText(source) === region.owner
          ) {
            const first = node.parameters[0]
            assert.ok(ts.isIdentifier(first.name))
            assert.ok(['event', 'payload'].includes(first.name.text))
            return ts.factory.updateArrowFunction(
              node,
              node.modifiers,
              node.typeParameters,
              node.parameters.map((parameter, index) =>
                index === 0
                  ? ts.factory.updateParameterDeclaration(
                      parameter,
                      parameter.modifiers,
                      parameter.dotDotDotToken,
                      ts.factory.createIdentifier('__payload__'),
                      parameter.questionToken,
                      parameter.type,
                      parameter.initializer,
                    )
                  : parameter,
              ),
              node.type,
              node.equalsGreaterThanToken,
              renameBody(node.body, first.name.text),
            )
          }
        }
        if (
          ts.isParameter(node) &&
          ts.isIdentifier(node.name) &&
          ['event', 'payload'].includes(node.name.text) &&
          node.type &&
          ['Event', 'FocusEvent', 'MouseEvent'].includes(
            node.type.getText(source),
          )
        ) {
          return ts.factory.updateParameterDeclaration(
            node,
            node.modifiers,
            node.dotDotDotToken,
            ts.factory.createIdentifier('__payload__'),
            node.questionToken,
            node.type,
            node.initializer,
          )
        }
        return ts.visitEachChild(node, visit, context)
      }
      return (node) => ts.visitNode(node, visit)
    },
  ])
  const printed = ts
    .createPrinter({ removeComments: true })
    .printFile(result.transformed[0])
  result.dispose()
  return createHash('sha256').update(printed).digest('hex')
}

export function filesBelow(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name)
    return entry.isDirectory() ? filesBelow(target) : [target]
  })
}

export function diagnosticBag(diagnostics, packageRoot) {
  packageRoot = realpathSync(packageRoot)
  const counts = new Map()
  for (const diagnostic of diagnostics) {
    assert.ok(
      diagnostic.file,
      `Unexpected compiler diagnostic ${diagnostic.code}`,
    )
    const file = path
      .relative(packageRoot, diagnostic.file.fileName)
      .replaceAll(path.sep, '/')
    assert.ok(
      !file.startsWith('../'),
      `Diagnostic outside installed package: ${file}`,
    )
    const message = ts
      .flattenDiagnosticMessageText(diagnostic.messageText, '\n')
      .replaceAll(packageRoot, '@ozwasyd/element-plus')
    const key = JSON.stringify({ file, code: diagnostic.code, message })
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => ({ ...JSON.parse(key), count }))
}

export function strictProgram(configPath, extraFile) {
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  assert.equal(config.error, undefined)
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configPath),
  )
  assert.deepEqual(parsed.errors, [])
  assert.equal(parsed.options.strict, true)
  assert.equal(parsed.options.skipLibCheck, false)
  assert.ok(parsed.fileNames.length > 0)
  const program = ts.createProgram({
    rootNames: extraFile ? [...parsed.fileNames, extraFile] : parsed.fileNames,
    options: parsed.options,
  })
  return ts.getPreEmitDiagnostics(program)
}

export function snapshot(root, packageRoot) {
  const hashes = {}
  for (const region of regions) {
    const sourceFile = `vue/packages/components/${region.component}/src/${region.file}.ts`
    hashes[sourceFile] = canonical(
      readFileSync(path.join(root, sourceFile), 'utf8'),
      sourceFile,
      region,
    )
    for (const mode of ['es', 'lib']) {
      const directory = path.join(
        packageRoot,
        mode,
        'components',
        region.component,
      )
      for (const file of filesBelow(directory)) {
        if (
          file.endsWith('.d.ts') ||
          file.endsWith(`/src/${region.file}.${mode === 'es' ? 'mjs' : 'js'}`)
        ) {
          const relative = path
            .relative(packageRoot, file)
            .replaceAll(path.sep, '/')
          hashes[relative] = canonical(readFileSync(file, 'utf8'), file, region)
        }
      }
    }
  }
  return hashes
}
