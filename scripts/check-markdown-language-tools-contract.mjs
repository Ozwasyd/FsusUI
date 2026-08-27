import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const MARKDOWN_LANGUAGE_TOOL_PATHS = Object.freeze({
  core: 'vue/packages/components/markdown-editor/src/markdown-editor-language-tools.ts',
  vue: 'vue/packages/components/markdown-editor/src/markdown-editor.vue',
  web: 'vue/packages/components/markdown-editor/src/markdown-editor-language-web.ts',
})

const parse = (source, fileName) =>
  ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )

const identifierText = (node) => (ts.isIdentifier(node) ? node.text : undefined)

const propertyNameText = (node) => {
  if (
    ts.isIdentifier(node) ||
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node)
  ) {
    return node.text
  }
  return undefined
}

const visit = (sourceFile, visitor) => {
  const walk = (node) => {
    visitor(node)
    ts.forEachChild(node, walk)
  }
  walk(sourceFile)
}

const inspectLanguageModule = (source, fileName, errors) => {
  const sourceFile = parse(source, fileName)
  const forbiddenNetwork = new Set([
    'EventSource',
    'WebSocket',
    'XMLHttpRequest',
    'fetch',
  ])
  visit(sourceFile, (node) => {
    if (ts.isCallExpression(node)) {
      const callee = identifierText(node.expression)
      if (callee && forbiddenNetwork.has(callee)) {
        errors.push(`${fileName}: cloud or network fallback is forbidden`)
      }
    }
    if (ts.isNewExpression(node)) {
      const constructor = identifierText(node.expression)
      if (constructor && forbiddenNetwork.has(constructor)) {
        errors.push(`${fileName}: cloud or network fallback is forbidden`)
      }
    }
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      /(?:openai|anthropic|cloud.*(?:spell|grammar)|(?:spell|grammar).*cloud)/i.test(
        node.moduleSpecifier.text,
      )
    ) {
      errors.push(`${fileName}: cloud or language-model import is forbidden`)
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left)
    ) {
      const property = node.left.name.text
      if (property === 'value') {
        errors.push(
          `${fileName}: textarea or DOM value must not become authority`,
        )
      }
      if (
        fileName === MARKDOWN_LANGUAGE_TOOL_PATHS.web &&
        property === 'spellcheck' &&
        node.right.kind === ts.SyntaxKind.FalseKeyword
      ) {
        errors.push(
          `${fileName}: local policy must not globally disable spellcheck`,
        )
      }
    }
    if (
      fileName === MARKDOWN_LANGUAGE_TOOL_PATHS.web &&
      ts.isPropertyAssignment(node) &&
      propertyNameText(node.name) === 'visualOffset' &&
      ts.isIdentifier(node.initializer)
    ) {
      errors.push(
        `${fileName}: raw offsets must not be reused as visual authority`,
      )
    }
  })
}

const inspectProjectionOwnership = (source, errors) => {
  const fileName = MARKDOWN_LANGUAGE_TOOL_PATHS.core
  const sourceFile = parse(source, fileName)
  const forbidden = new Set([
    'createMarkdownAnchorMap',
    'createMarkdownEditorProjection',
    'stabilizeMarkdownEditorProjection',
  ])
  visit(sourceFile, (node) => {
    if (
      ts.isImportSpecifier(node) &&
      forbidden.has(identifierText(node.name) ?? '')
    ) {
      errors.push(
        `${fileName}: language tools must consume caller-owned projection and anchor authority`,
      )
    }
    if (
      ts.isCallExpression(node) &&
      forbidden.has(identifierText(node.expression) ?? '')
    ) {
      errors.push(
        `${fileName}: language tools must consume caller-owned projection and anchor authority`,
      )
    }
  })
}

const inspectCommitGuards = (source, errors) => {
  const fileName = MARKDOWN_LANGUAGE_TOOL_PATHS.core
  const sourceFile = parse(source, fileName)
  let commitBody
  let plannerBody
  visit(sourceFile, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      identifierText(node.name) === 'commitMarkdownLanguageToolMutation' &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer))
    ) {
      commitBody = node.initializer.body
    }
    if (
      ts.isVariableDeclaration(node) &&
      identifierText(node.name) === 'planMarkdownLanguageToolReplacement' &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer))
    ) {
      plannerBody = node.initializer.body
    }
  })

  if (!commitBody || !ts.isBlock(commitBody)) {
    errors.push(`${fileName}: strict language-tool commit adapter is required`)
    return
  }

  const guards = []
  visit(commitBody, (node) => {
    if (ts.isIfStatement(node)) {
      guards.push({
        condition: node.expression.getText(sourceFile),
        statement: node.thenStatement.getText(sourceFile),
      })
    }
  })
  const requireGuard = (conditionParts, reason, label) => {
    const found = guards.some(
      (guard) =>
        conditionParts.every((part) => guard.condition.includes(part)) &&
        guard.statement.includes(reason),
    )
    if (!found) {
      errors.push(`${fileName}: ${label} rejection guard is required`)
    }
  }

  requireGuard(['input.isComposing'], 'composition-active', 'IME interleave')
  requireGuard(['input.rawHtml'], 'dom-authority-rejected', 'DOM authority')
  requireGuard(
    ['input.from === 0', 'input.to === input.source.length', 'input.kind'],
    'full-source-rejected',
    'unexplained full-source replacement',
  )
  requireGuard(
    ['input.currentRevision !== input.revision'],
    'stale-revision',
    'stale revision',
  )
  requireGuard(
    ['input.projectionRevision !== input.currentRevision'],
    'stale-projection',
    'stale projection',
  )
  requireGuard(
    ['input.session.kind !== input.kind'],
    'session-kind-conflict',
    'session kind conflict',
  )
  requireGuard(
    ['input.session.active', 'input.session.revision'],
    'stale-session',
    'stale session',
  )
  requireGuard(
    ['sameSelection', 'input.currentSelection', 'input.session.selection'],
    'stale-selection',
    'stale selection',
  )

  const plannerText = plannerBody?.getText(sourceFile) ?? ''
  if (
    !plannerText.includes("history: 'separate'") ||
    !plannerText.includes("origin: 'input'")
  ) {
    errors.push(
      `${fileName}: one native language-tool commit requires separate input history`,
    )
  }
}

const inspectWebBoundary = (source, errors) => {
  const fileName = MARKDOWN_LANGUAGE_TOOL_PATHS.web
  const sourceFile = parse(source, fileName)
  let preventsReplacementDomMutation = false
  let commitsThroughAdapter = false
  let controllerCommitBody
  visit(sourceFile, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      identifierText(node.name) === 'commit' &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer))
    ) {
      controllerCommitBody = node.initializer.body
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'preventDefault'
    ) {
      preventsReplacementDomMutation = true
    }
    if (
      ts.isCallExpression(node) &&
      identifierText(node.expression) === 'commitMarkdownLanguageToolMutation'
    ) {
      commitsThroughAdapter = true
    }
  })
  if (!preventsReplacementDomMutation) {
    errors.push(
      `${fileName}: native replacement must prevent retained DOM mutation`,
    )
  }
  if (!commitsThroughAdapter) {
    errors.push(
      `${fileName}: native replacement must use the language-tool transaction adapter`,
    )
  }
  const commitText = controllerCommitBody?.getText(sourceFile) ?? ''
  if (
    !commitText.includes('if (unavailableReason)') ||
    !commitText.includes('return rejected(unavailableReason)')
  ) {
    errors.push(
      `${fileName}: direct replacement must enforce current context and tool capability`,
    )
  }
  if (
    !source.includes('const currentSelection = selectionFrom(textarea)') ||
    !source.includes('kind,\n        currentSelection,')
  ) {
    errors.push(
      `${fileName}: mapped replacement target must not replace current selection authority`,
    )
  }
  if (
    source.includes('options.projectionRevision ?? currentRevision') ||
    source.includes('input.projectionRevision ?? input.revision')
  ) {
    errors.push(
      `${fileName}: projection freshness must be supplied by the projection session owner`,
    )
  }
}

const inspectVuePublicSurface = (source, errors) => {
  const exposeMatch = /defineExpose\s*\(\s*\{([\s\S]*?)\}\s*\)/m.exec(source)
  if (
    exposeMatch &&
    /(?:textareaRef|editorRef|contenteditableRef|languageToolsController)/.test(
      exposeMatch[1] ?? '',
    )
  ) {
    errors.push(
      `${MARKDOWN_LANGUAGE_TOOL_PATHS.vue}: private editor or DOM refs must not be exposed`,
    )
  }
}

export const validateMarkdownLanguageToolSources = (sources) => {
  const errors = []
  inspectLanguageModule(sources.core, MARKDOWN_LANGUAGE_TOOL_PATHS.core, errors)
  inspectLanguageModule(sources.web, MARKDOWN_LANGUAGE_TOOL_PATHS.web, errors)
  inspectProjectionOwnership(sources.core, errors)
  inspectCommitGuards(sources.core, errors)
  inspectWebBoundary(sources.web, errors)
  inspectVuePublicSurface(sources.vue, errors)
  return errors
}

export const readMarkdownLanguageToolSources = (base = root) =>
  Object.freeze(
    Object.fromEntries(
      Object.entries(MARKDOWN_LANGUAGE_TOOL_PATHS).map(
        ([key, relativePath]) => [
          key,
          fs.readFileSync(path.join(base, relativePath), 'utf8'),
        ],
      ),
    ),
  )

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const errors = validateMarkdownLanguageToolSources(
    readMarkdownLanguageToolSources(),
  )
  if (errors.length > 0) {
    console.error(errors.join('\n'))
    process.exitCode = 1
  } else {
    console.log('Markdown language-tool authority contract is valid.')
  }
}
