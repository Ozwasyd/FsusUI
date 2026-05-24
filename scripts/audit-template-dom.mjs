import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'
import { parse as parseSfc } from '@vue/compiler-sfc'
import {
  ElementTypes,
  NodeTypes,
  parse as parseTemplate,
} from '@vue/compiler-dom'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const docsDir = path.join(rootDir, 'docs')
const reportJsonPath = path.join(docsDir, 'runtime-template-audit.json')
const reportMdPath = path.join(docsDir, 'runtime-template-audit.md')
const pathArgs = process.argv
  .flatMap((arg, index, args) => {
    if (arg === '--paths') return (args[index + 1] ?? '').split(',')
    if (arg.startsWith('--paths='))
      return arg.slice('--paths='.length).split(',')
    return []
  })
  .filter(Boolean)
const incremental = process.argv.includes('--incremental')
const sourcePatterns = pathArgs.length
  ? pathArgs
  : incremental
    ? ['packages/components/**/src/*.vue']
    : ['packages/components/**/src/*.vue']

const componentFiles = await fg(sourcePatterns, {
  cwd: rootDir,
  absolute: true,
})

const deprecatedChecks = [
  {
    category: 'deprecated-slot-scope',
    label: '`slot-scope`',
    regex: /\bslot-scope\s*=/g,
  },
  {
    category: 'deprecated-template-slot',
    label: '`template slot=`',
    regex: /<template[^>]+\bslot\s*=/g,
  },
  {
    category: 'deprecated-inline-template',
    label: '`inline-template`',
    regex: /\binline-template\b/g,
  },
  {
    category: 'deprecated-native-modifier',
    label: '`.native`',
    regex: /@\w[\w-]*\.native(?:\b|=)|v-on:[\w-]+\.native(?:\b|=)/g,
  },
  {
    category: 'deprecated-sync-modifier',
    label: '`.sync`',
    regex: /:\w[\w-]*\.sync(?:\b|=)|v-bind:[\w-]+\.sync(?:\b|=)/g,
  },
]

const wrapperTags = new Set(['div', 'span'])
const titleLikeTokens = [
  'title',
  'subtitle',
  'sub-title',
  'extra',
  'prefix',
  'suffix',
  'header',
  'content',
]
const transitionLikeTags = new Set([
  'transition',
  'transition-group',
  'teleport',
  'keep-alive',
])

const report = []

for (const file of componentFiles.sort()) {
  const source = await readFile(file, 'utf8')
  const { descriptor } = parseSfc(source, { filename: file })
  if (!descriptor.template) continue

  const templateBlock = descriptor.template
  const templateSource = templateBlock.content
  const templateAst = parseTemplate(templateSource, { comments: false })
  const templateLineOffset = templateBlock.loc.start.line - 1
  const deprecatedFindings = findDeprecatedSyntax(
    templateSource,
    templateLineOffset,
  )
  const analysis = analyzeTemplateAst(templateAst, templateLineOffset)

  report.push({
    file: path.relative(rootDir, file),
    nodeCount: analysis.nodeCount,
    componentCount: analysis.componentCount,
    potentialSavings: analysis.issues.reduce(
      (sum, issue) => sum + issue.estimatedSavings,
      0,
    ),
    manualReviewCount: analysis.issues.filter((issue) => issue.manualReview)
      .length,
    deprecatedSyntax: deprecatedFindings,
    issues: analysis.issues,
  })
}

const totals = buildTotals(report)
const markdown = buildMarkdown(report, totals)

await mkdir(docsDir, { recursive: true })
await writeFile(
  reportJsonPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), totals, files: report }, null, 2)}\n`,
)
await writeFile(reportMdPath, markdown)

console.log(
  `Template audit complete: ${report.length} files -> ${path.relative(rootDir, reportMdPath)}`,
)

function buildTotals(files) {
  const totalIssues = files.reduce((sum, item) => sum + item.issues.length, 0)
  const totalNodes = files.reduce((sum, item) => sum + item.nodeCount, 0)
  const totalSavings = files.reduce(
    (sum, item) => sum + item.potentialSavings,
    0,
  )
  const deprecatedSyntaxCount = files.reduce(
    (sum, item) => sum + item.deprecatedSyntax.length,
    0,
  )

  const byRisk = files
    .flatMap((item) => item.issues)
    .reduce((acc, issue) => {
      acc[issue.risk] = (acc[issue.risk] ?? 0) + 1
      return acc
    }, {})

  const byCategory = files
    .flatMap((item) => item.issues)
    .reduce((acc, issue) => {
      acc[issue.category] = (acc[issue.category] ?? 0) + 1
      return acc
    }, {})

  return {
    filesScanned: files.length,
    totalNodes,
    totalIssues,
    totalPotentialSavings: totalSavings,
    deprecatedSyntaxCount,
    byRisk,
    byCategory,
  }
}

function buildMarkdown(files, totals) {
  const topFiles = [...files]
    .filter((item) => item.issues.length > 0)
    .sort((a, b) => {
      if (b.potentialSavings !== a.potentialSavings) {
        return b.potentialSavings - a.potentialSavings
      }
      return b.issues.length - a.issues.length
    })
    .slice(0, 25)

  const deprecatedHits = files
    .flatMap((item) =>
      item.deprecatedSyntax.map((finding) => ({
        file: item.file,
        ...finding,
      })),
    )
    .slice(0, 20)

  const categoryLines = Object.entries(totals.byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => `- ${category}: ${count}`)
    .join('\n')

  const riskLines = Object.entries(totals.byRisk)
    .sort((a, b) => severityRank(a[0]) - severityRank(b[0]))
    .map(([risk, count]) => `- ${risk}: ${count}`)
    .join('\n')

  const fileLines = topFiles
    .map((item) => {
      const topIssues = item.issues
        .slice()
        .sort((a, b) => severityRank(a.risk) - severityRank(b.risk))
        .slice(0, 3)
        .map(
          (issue) =>
            `L${issue.line} ${issue.category} [${issue.risk}] - ${issue.summary}`,
        )
        .join('；')

      return `- \`${item.file}\`：节点 ${item.nodeCount}，疑似问题 ${item.issues.length}，预估可减少 ${item.potentialSavings} 个节点。${topIssues}`
    })
    .join('\n')

  const deprecatedSection =
    deprecatedHits.length === 0
      ? '- 本轮未发现 `slot-scope`、`template slot=`、`inline-template`、`.native`、`.sync` 命中。'
      : deprecatedHits
          .map(
            (finding) =>
              `- \`${finding.file}:L${finding.line}\` 命中 ${finding.label}`,
          )
          .join('\n')

  return `# Runtime Template Audit

Generated at: ${new Date().toISOString()}

## Summary

- Scanned files: ${totals.filesScanned}
- Total element/component nodes: ${totals.totalNodes}
- Total findings: ${totals.totalIssues}
- Estimated removable nodes: ${totals.totalPotentialSavings}
- Deprecated syntax hits: ${totals.deprecatedSyntaxCount}

## Risk Breakdown

${riskLines || '- none'}

## Finding Categories

${categoryLines || '- none'}

## Deprecated Syntax

${deprecatedSection}

## Highest Yield Files

${fileLines || '- none'}

## Review Notes

- high 风险候选通常带有 ref、事件、ARIA/role、键盘焦点、复杂指令，或承担明显的样式锚点。
- medium 风险候选多为有 class/style 的结构包裹层，适合配合主题样式一起改。
- low 风险候选一般是单子节点纯结构容器，可优先处理。
- 完整明细请查看同目录下的 \`runtime-template-audit.json\`。
`
}

function analyzeTemplateAst(ast, templateLineOffset) {
  let nodeCount = 0
  let componentCount = 0
  const issues = []

  const visit = (node, parent = null) => {
    if (!node) return

    switch (node.type) {
      case NodeTypes.ROOT:
        node.children.forEach((child) => visit(child, node))
        return
      case NodeTypes.ELEMENT: {
        if (node.tag !== 'template') {
          nodeCount += 1
        }
        if (node.tagType === ElementTypes.COMPONENT) {
          componentCount += 1
        }

        maybeCollectWrapperIssue(node, parent, templateLineOffset, issues)
        maybeCollectVForIssue(node, templateLineOffset, issues)

        node.children.forEach((child) => visit(child, node))
        return
      }
      case NodeTypes.IF:
        maybeCollectIfDuplicateIssue(node, templateLineOffset, issues)
        node.branches.forEach((branch) =>
          branch.children.forEach((child) => visit(child, node)),
        )
        return
      case NodeTypes.FOR:
        node.children.forEach((child) => visit(child, node))
        return
      default:
        if ('children' in node && Array.isArray(node.children)) {
          node.children.forEach((child) => visit(child, node))
        }
    }
  }

  visit(ast)

  return { nodeCount, componentCount, issues }
}

function maybeCollectWrapperIssue(node, parent, templateLineOffset, issues) {
  if (!wrapperTags.has(node.tag)) return

  const meaningfulChildren = getMeaningfulChildren(node.children)
  if (meaningfulChildren.length !== 1) return

  const child = meaningfulChildren[0]
  if (hasAdjacentMeaningfulText(node, parent, child)) return

  const attrs = inspectNodeProps(node)
  const preserveWrapper =
    attrs.hasRef ||
    attrs.hasEvent ||
    attrs.hasAria ||
    attrs.hasRole ||
    attrs.hasTabindex ||
    attrs.hasNonControlDirective ||
    attrs.hasClass ||
    attrs.hasStyle

  if (preserveWrapper) return

  const tokens = extractNodeTokens(node)
  const matchedTitleToken = titleLikeTokens.find((token) =>
    tokens.includes(token),
  )
  const childName = describeChild(child)
  const isTitleLike = Boolean(matchedTitleToken)
  const wrapsSlotLike =
    child.type === NodeTypes.SLOT_OUTLET ||
    (child.type === NodeTypes.ELEMENT &&
      (child.tag === 'slot' ||
        child.tag === 'el-icon' ||
        child.tag === 'component'))

  const riskyAnchor = false
  const manualReview = transitionLikeTags.has(parent?.tag)

  let category = 'single-child-wrapper'
  let summary = `单子节点 ${node.tag} 包裹了 ${childName}`

  if (wrapsSlotLike) {
    category = 'slot-or-icon-wrapper'
    summary = `${node.tag} 仅包裹 ${childName}，可评估并入宿主节点`
  } else if (isTitleLike) {
    category = 'slot-title-wrapper'
    summary = `${node.tag} 承担 ${matchedTitleToken} 区域包裹`
  }

  issues.push({
    line: templateLineOffset + node.loc.start.line,
    category,
    risk: classifyRisk({
      manualReview,
      riskyAnchor,
      attrs,
      parent,
      node,
    }),
    estimatedSavings: 1,
    manualReview,
    summary,
    suggestion: buildSuggestion(category, node.tag, childName),
  })
}

function hasAdjacentMeaningfulText(node, parent, child) {
  if (
    node.tag !== 'span' ||
    child.type !== NodeTypes.INTERPOLATION ||
    !parent ||
    !Array.isArray(parent.children)
  ) {
    return false
  }

  return parent.children.some(
    (sibling) =>
      sibling !== node &&
      ((sibling.type === NodeTypes.TEXT && sibling.content.trim().length > 0) ||
        sibling.type === NodeTypes.INTERPOLATION),
  )
}

function maybeCollectVForIssue(node, templateLineOffset, issues) {
  const attrs = inspectNodeProps(node)
  if (!attrs.hasVFor || !wrapperTags.has(node.tag)) return

  if (attrs.hasRef || attrs.hasEvent || attrs.hasClass || attrs.hasStyle) return

  const meaningfulChildren = getMeaningfulChildren(node.children)
  if (meaningfulChildren.length !== 1) return

  const child = meaningfulChildren[0]
  if (child.type !== NodeTypes.ELEMENT) return

  issues.push({
    line: templateLineOffset + node.loc.start.line,
    category: 'v-for-shell-wrapper',
    risk: attrs.hasEvent || attrs.hasRef ? 'high' : 'medium',
    estimatedSavings: 1,
    manualReview: true,
    summary: `${node.tag} 在 v-for 中只承担一层列表外壳`,
    suggestion: '检查是否可把 class/style 上提到子节点，避免每项多一层容器',
  })
}

function maybeCollectIfDuplicateIssue(node, templateLineOffset, issues) {
  if (!node.branches || node.branches.length < 2) return

  const roots = node.branches
    .map((branch) => getMeaningfulChildren(branch.children))
    .filter((children) => children.length === 1)
    .map((children) => children[0])

  if (roots.length !== node.branches.length) return
  if (!roots.every((root) => root.type === NodeTypes.ELEMENT)) return

  const first = roots[0]
  const sameTag = roots.every((root) => root.tag === first.tag)
  if (!sameTag) return

  issues.push({
    line: templateLineOffset + node.loc.start.line,
    category: 'branch-outer-shell-duplication',
    risk: 'medium',
    estimatedSavings: node.branches.length - 1,
    manualReview: true,
    summary: `v-if 分支重复使用 ${first.tag} 作为外层容器`,
    suggestion: '优先改成稳定外壳 + 内部差异渲染，减少重复节点和样式分支',
  })
}

function inspectNodeProps(node) {
  let hasRef = false
  let hasEvent = false
  let hasDirective = false
  let hasNonControlDirective = false
  let hasRole = false
  let hasTabindex = false
  let hasAria = false
  let hasStyle = false
  let hasClass = false
  let hasVFor = false

  for (const prop of node.props) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      hasClass ||= prop.name === 'class'
      hasStyle ||= prop.name === 'style'
      hasRole ||= prop.name === 'role'
      hasTabindex ||= prop.name === 'tabindex'
      hasAria ||= prop.name.startsWith('aria-')
      hasRef ||= prop.name === 'ref'
      continue
    }

    hasDirective = true
    hasEvent ||= prop.name === 'on'
    hasVFor ||= prop.name === 'for'
    hasRef ||=
      prop.name === 'bind' &&
      prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
      prop.arg.content === 'ref'

    if (
      prop.name === 'bind' &&
      prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
    ) {
      const arg = prop.arg.content
      hasClass ||= arg === 'class'
      hasStyle ||= arg === 'style'
      hasRole ||= arg === 'role'
      hasTabindex ||= arg === 'tabindex'
      hasAria ||= arg.startsWith('aria-')
      hasRef ||= arg === 'ref'
    }

    if (!['if', 'else', 'else-if', 'show', 'for'].includes(prop.name)) {
      hasNonControlDirective = true
    }
  }

  return {
    hasRef,
    hasEvent,
    hasDirective,
    hasNonControlDirective,
    hasRole,
    hasTabindex,
    hasAria,
    hasStyle,
    hasClass,
    hasVFor,
  }
}

function classifyRisk({ manualReview, riskyAnchor, attrs, parent, node }) {
  if (manualReview) return 'high'
  if (
    riskyAnchor ||
    attrs.hasDirective ||
    attrs.hasVFor ||
    transitionLikeTags.has(node.tag) ||
    transitionLikeTags.has(parent?.tag)
  ) {
    return 'medium'
  }

  return 'low'
}

function buildSuggestion(category, tag, childName) {
  switch (category) {
    case 'slot-or-icon-wrapper':
      return `优先尝试移除 ${tag}，把 class/style 合并到 ${childName} 或既有宿主节点`
    case 'slot-title-wrapper':
      return '保留槽位语义不变，评估把 title/subtitle/extra/prefix/suffix 的默认实现并入外层节点'
    case 'v-for-shell-wrapper':
      return '检查列表项样式锚点，若无直接子选择器依赖，可把每项容器下沉'
    default:
      return `若 ${tag} 只承担布局，可合并到 ${childName} 或其父节点`
  }
}

function getMeaningfulChildren(children = []) {
  return children.filter((child) => {
    if (child.type === NodeTypes.COMMENT) return false
    if (child.type === NodeTypes.TEXT) return child.content.trim().length > 0
    return true
  })
}

function describeChild(child) {
  if (!child) return 'unknown'
  if (child.type === NodeTypes.SLOT_OUTLET) return '<slot>'
  if (child.type === NodeTypes.ELEMENT) {
    return child.tagType === ElementTypes.COMPONENT
      ? `<${child.tag} component>`
      : `<${child.tag}>`
  }
  if (child.type === NodeTypes.TEXT_CALL) return 'text call'
  if (child.type === NodeTypes.INTERPOLATION) return 'interpolation'
  return `node type ${child.type}`
}

function extractNodeTokens(node) {
  return node.props
    .map((prop) => {
      if (prop.type === NodeTypes.ATTRIBUTE) {
        return `${prop.name}:${prop.value?.content ?? ''}`
      }

      const arg =
        prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION ? prop.arg.content : ''
      const exp =
        prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? prop.exp.content : ''
      return `${prop.name}:${arg}:${exp}`
    })
    .join(' ')
    .toLowerCase()
}

function findDeprecatedSyntax(templateSource, templateLineOffset) {
  const findings = []

  for (const check of deprecatedChecks) {
    for (const match of templateSource.matchAll(check.regex)) {
      findings.push({
        category: check.category,
        label: check.label,
        line:
          templateLineOffset + getLineNumber(templateSource, match.index ?? 0),
      })
    }
  }

  return findings
}

function getLineNumber(source, index) {
  return source.slice(0, index).split('\n').length
}

function severityRank(risk) {
  switch (risk) {
    case 'high':
      return 0
    case 'medium':
      return 1
    default:
      return 2
  }
}
