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
    ? ['vue/packages/components/**/src/*.vue']
    : ['vue/packages/components/**/src/*.vue']

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
    reviewPotentialSavings: analysis.reviewFindings.reduce(
      (sum, finding) => sum + finding.estimatedSavings,
      0,
    ),
    manualReviewCount:
      analysis.issues.filter((issue) => issue.manualReview).length +
      analysis.reviewFindings.length,
    deprecatedSyntax: deprecatedFindings,
    issues: analysis.issues,
    reviewFindings: analysis.reviewFindings,
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
  const totalReviewFindings = files.reduce(
    (sum, item) => sum + item.reviewFindings.length,
    0,
  )
  const totalNodes = files.reduce((sum, item) => sum + item.nodeCount, 0)
  const totalSavings = files.reduce(
    (sum, item) => sum + item.potentialSavings,
    0,
  )
  const totalReviewSavings = files.reduce(
    (sum, item) => sum + item.reviewPotentialSavings,
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

  const byReviewCategory = files
    .flatMap((item) => item.reviewFindings)
    .reduce((acc, finding) => {
      acc[finding.category] = (acc[finding.category] ?? 0) + 1
      return acc
    }, {})

  return {
    filesScanned: files.length,
    totalNodes,
    totalIssues,
    totalReviewFindings,
    totalPotentialSavings: totalSavings,
    totalReviewPotentialSavings: totalReviewSavings,
    deprecatedSyntaxCount,
    byRisk,
    byCategory,
    byReviewCategory,
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

  const topReviewFiles = [...files]
    .filter((item) => item.reviewFindings.length > 0)
    .sort((a, b) => {
      if (b.reviewPotentialSavings !== a.reviewPotentialSavings) {
        return b.reviewPotentialSavings - a.reviewPotentialSavings
      }
      return b.reviewFindings.length - a.reviewFindings.length
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

  const reviewCategoryLines = Object.entries(totals.byReviewCategory)
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

  const reviewFileLines = topReviewFiles
    .map((item) => {
      const topFindings = item.reviewFindings
        .slice()
        .sort((a, b) => severityRank(a.risk) - severityRank(b.risk))
        .slice(0, 4)
        .map(
          (finding) =>
            `L${finding.line} ${finding.category} [${finding.risk}] - ${finding.summary}`,
        )
        .join('；')

      return `- \`${item.file}\`：review 候选 ${item.reviewFindings.length}，预估可审查 ${item.reviewPotentialSavings} 个节点。${topFindings}`
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
- Structural review findings: ${totals.totalReviewFindings}
- Estimated reviewable nodes: ${totals.totalReviewPotentialSavings}
- Deprecated syntax hits: ${totals.deprecatedSyntaxCount}

## Risk Breakdown

${riskLines || '- none'}

## Finding Categories

${categoryLines || '- none'}

## Structural Wrapper Review

${reviewCategoryLines || '- none'}

## Deprecated Syntax

${deprecatedSection}

## Highest Yield Files

${fileLines || '- none'}

## Highest Review Yield Files

${reviewFileLines || '- none'}

## Review Notes

- high 风险候选通常带有 ref、事件、ARIA/role、键盘焦点、复杂指令，或承担明显的样式锚点。
- medium 风险候选多为有 class/style 的结构包裹层，适合配合主题样式一起改。
- low 风险候选一般是单子节点纯结构容器，可优先处理。
- Structural Wrapper Review 是人工审查候选，不与 hard findings 混淆；CI 可以只对 hard findings fail，对 review findings warning。
- 完整明细请查看同目录下的 \`runtime-template-audit.json\`。
`
}

function analyzeTemplateAst(ast, templateLineOffset) {
  let nodeCount = 0
  let componentCount = 0
  const issues = []
  const reviewFindings = []

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
        maybeCollectStructuralReview(
          node,
          parent,
          templateLineOffset,
          reviewFindings,
        )
        maybeCollectVForIssue(node, templateLineOffset, issues)
        maybeCollectVShowSiblingReview(node, templateLineOffset, reviewFindings)

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

  return { nodeCount, componentCount, issues, reviewFindings }
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

function maybeCollectStructuralReview(
  node,
  parent,
  templateLineOffset,
  reviewFindings,
) {
  if (!wrapperTags.has(node.tag)) return

  const meaningfulChildren = getMeaningfulChildren(node.children)
  if (meaningfulChildren.length !== 1) return

  const child = meaningfulChildren[0]
  if (hasAdjacentMeaningfulText(node, parent, child)) return

  const attrs = inspectNodeProps(node)
  const reviewable =
    !attrs.hasRef &&
    !attrs.hasEvent &&
    !attrs.hasAria &&
    !attrs.hasRole &&
    !attrs.hasTabindex &&
    !attrs.hasNonStructuralDirective

  if (!reviewable) return

  const wrapsSlotLike =
    child.type === NodeTypes.SLOT_OUTLET ||
    (child.type === NodeTypes.ELEMENT && child.tag === 'slot')
  const wrapsComponent =
    child.type === NodeTypes.ELEMENT && child.tagType === ElementTypes.COMPONENT

  let category = ''
  let summary = ''
  let suggestion = ''
  let risk = 'medium'

  if (attrs.hasVFor && wrapsComponent) {
    category = 'v-for-item-shell-wrapper'
    summary = `${node.tag} 在 v-for 中只包裹 ${describeChild(child)}`
    suggestion = '检查是否可把 item class 上提到子组件 root，减少每项外壳'
  } else if (wrapsSlotLike) {
    category = 'slot-passthrough-wrapper'
    summary = `${node.tag} 只包裹 slot 内容`
    suggestion = '检查是否可用宿主 class、slot root class 或既有 slot 容器替代'
    risk = attrs.hasStyle ? 'medium' : 'low'
  } else if (wrapsComponent) {
    category = 'component-wrapper-around-component-root'
    summary = `${node.tag} 只包裹 ${describeChild(child)}`
    suggestion = '检查子组件 root 是否支持 class/attrs 透传，再评估移除外壳'
  } else if (attrs.hasClass && !attrs.hasStyle) {
    category = 'class-only-single-child-wrapper'
    summary = `${node.tag} 带 class 且只包裹 ${describeChild(child)}`
    suggestion = '检查 class 是否可上提到子节点，或改为更轻量的布局锚点'
  }

  if (!category) return

  pushReviewFinding(reviewFindings, {
    line: templateLineOffset + node.loc.start.line,
    category,
    risk,
    estimatedSavings: 1,
    summary,
    suggestion,
  })
}

function maybeCollectVShowSiblingReview(
  node,
  templateLineOffset,
  reviewFindings,
) {
  if (!Array.isArray(node.children) || node.children.length < 2) return

  const vShowBranches = getMeaningfulChildren(node.children).filter((child) => {
    if (child.type !== NodeTypes.ELEMENT) return false
    return inspectNodeProps(child).hasVShow
  })

  if (vShowBranches.length < 2) return

  const containsHeavyBranch = vShowBranches.some((branch) =>
    containsSlotOrComponent(branch),
  )

  pushReviewFinding(reviewFindings, {
    line: templateLineOffset + node.loc.start.line,
    category: 'v-show-sibling-branches',
    risk: containsHeavyBranch ? 'medium' : 'low',
    estimatedSavings: vShowBranches.length - 1,
    summary: `${node.tag} 下存在 ${vShowBranches.length} 个 v-show sibling branches`,
    suggestion:
      '检查是否应改成 lazy v-if、render strategy 或按场景只挂载当前分支',
  })
}

function pushReviewFinding(reviewFindings, finding) {
  const key = `${finding.line}:${finding.category}:${finding.summary}`
  if (
    reviewFindings.some(
      (item) => `${item.line}:${item.category}:${item.summary}` === key,
    )
  ) {
    return
  }

  reviewFindings.push(finding)
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
  let hasVShow = false
  let hasNonStructuralDirective = false

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
    hasVShow ||= prop.name === 'show'
    hasRef ||=
      prop.name === 'bind' &&
      prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
      prop.arg.content === 'ref'

    const isStructuralBind =
      prop.name === 'bind' &&
      prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
      ['class', 'style'].includes(prop.arg.content)

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
    if (
      !['if', 'else', 'else-if', 'show', 'for'].includes(prop.name) &&
      !isStructuralBind
    ) {
      hasNonStructuralDirective = true
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
    hasVShow,
    hasNonStructuralDirective,
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

function containsSlotOrComponent(node) {
  if (!node) return false
  if (node.type === NodeTypes.SLOT_OUTLET) return true
  if (node.type === NodeTypes.ELEMENT) {
    if (node.tag === 'slot' || node.tagType === ElementTypes.COMPONENT) {
      return true
    }
  }
  if (node.type === NodeTypes.IF) {
    return node.branches.some((branch) =>
      branch.children.some((child) => containsSlotOrComponent(child)),
    )
  }
  if (node.type === NodeTypes.FOR) {
    return node.children.some((child) => containsSlotOrComponent(child))
  }
  if ('children' in node && Array.isArray(node.children)) {
    return node.children.some((child) => containsSlotOrComponent(child))
  }

  return false
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
