#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const root = process.cwd()
const violations = []

const semanticExampleDir = 'examples/ux-semantics'
const consumerScanDirs = ['packages/demo-app/src', semanticExampleDir]
const genericActionLabels = new Set([
  '确定',
  '提交',
  '确认',
  'ok',
  'submit',
  'confirm',
])

const requiredDocs = [
  {
    file: 'docs/ux/dont-make-me-think-guidelines.md',
    terms: [
      '用户不会阅读',
      '我在哪',
      '下一步',
      '按钮必须说出结果',
      '高级选项',
      '危险操作',
      '空状态',
      '列表',
      '推荐动作',
    ],
  },
  {
    file: 'docs/ux/task-oriented-components.md',
    terms: [
      'TaskPageHeader',
      'TaskActionBar',
      'TaskPrimaryAction',
      'TaskSecondaryAction',
      'DangerAction',
      'EmptyState',
      'FilterStateSummary',
      'ContextBar',
      'RecommendationBanner',
      'ActionPreviewDialog',
    ],
  },
  {
    file: 'docs/ux/fsusblog-consumption-examples.md',
    terms: [
      '文章编辑器',
      '评论审核',
      '消息中心',
      'Dashboard 今日待处理',
      '管理导航分组',
    ],
  },
]

const requiredExampleFiles = [
  'article-editor.vue',
  'comment-moderation.vue',
  'message-center.vue',
  'dashboard-today.vue',
  'admin-navigation.vue',
]

const addViolation = (file, line, message) => {
  violations.push(`${file}:${line}: ${message}`)
}

const lineNumberOf = (source, index) =>
  source.slice(0, Math.max(index, 0)).split('\n').length

const listFiles = (dir, extensions) => {
  const absDir = resolve(root, dir)
  if (!existsSync(absDir)) return []

  const files = []
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const abs = join(current, entry.name)
      if (entry.isDirectory()) {
        if (
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === 'coverage'
        ) {
          continue
        }
        visit(abs)
        continue
      }
      if (extensions.some((extension) => entry.name.endsWith(extension))) {
        files.push(relative(root, abs))
      }
    }
  }

  visit(absDir)
  return files.sort()
}

const readText = (file) => readFileSync(resolve(root, file), 'utf8')

const stripComments = (source) =>
  source.replaceAll(/<!--[\s\S]*?-->/g, '').replaceAll(/\/\*[\s\S]*?\*\//g, '')

const hasAttr = (attrs, name) => {
  const escaped = name.replaceAll('-', String.raw`\-`)
  return new RegExp(
    String.raw`(?:^|\s)(?::|v-bind:)?${escaped}(?:\s*=|\s|$)`,
  ).test(attrs)
}

const hasAnyAttr = (attrs, names) => names.some((name) => hasAttr(attrs, name))

const getAttrValue = (attrs, name) => {
  const escaped = name.replaceAll('-', String.raw`\-`)
  const match = attrs.match(
    new RegExp(
      String.raw`(?:^|\s)(?::|v-bind:)?${escaped}\s*=\s*(?:"([^"]*)"|'([^']*)')`,
    ),
  )
  return match?.[1] ?? match?.[2] ?? ''
}

const visibleButtonText = (body) =>
  body
    .replaceAll(/<template\s+#[\w-]+[\s\S]*?<\/template>/gi, '')
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()

const normalizedActionLabel = (label) =>
  label.replaceAll(/\s+/g, ' ').trim().toLowerCase()

const parseButtons = (source) => {
  const buttons = []
  const pairedPattern =
    /<(el-button|ElButton|button)\b([^>]*)>([\s\S]*?)<\/\1>/g
  const selfClosingPattern = /<(el-button|ElButton|button)\b([^>]*)\/>/g

  for (const match of source.matchAll(pairedPattern)) {
    buttons.push({
      tag: match[1],
      attrs: match[2] ?? '',
      body: match[3] ?? '',
      index: match.index ?? 0,
      selfClosing: false,
    })
  }

  for (const match of source.matchAll(selfClosingPattern)) {
    buttons.push({
      tag: match[1],
      attrs: match[2] ?? '',
      body: '',
      index: match.index ?? 0,
      selfClosing: true,
    })
  }

  return buttons.sort((left, right) => left.index - right.index)
}

const checkIconOnlyButtons = (file, source) => {
  for (const button of parseButtons(source)) {
    const attrs = button.attrs
    const body = button.body
    const visibleText = visibleButtonText(body)
    const hasIcon =
      hasAttr(attrs, 'icon') ||
      hasAttr(attrs, 'circle') ||
      /<template\s+#icon\b/i.test(body) ||
      /<el-icon\b|<ElIcon\b/i.test(body)
    const isIconOnly = hasIcon && visibleText.length === 0

    if (
      isIconOnly &&
      !hasAnyAttr(attrs, ['aria-label', 'aria-labelledby', 'title'])
    ) {
      addViolation(
        file,
        lineNumberOf(source, button.index),
        'icon-only button must provide aria-label, aria-labelledby, or title',
      )
    }
  }
}

const checkGenericSubmitLabels = (file, source) => {
  for (const button of parseButtons(source)) {
    const attrs = button.attrs
    const label = normalizedActionLabel(
      visibleButtonText(button.body) || getAttrValue(attrs, 'aria-label'),
    )
    const isSubmit =
      /native-type\s*=\s*["']submit["']/.test(attrs) ||
      (button.tag === 'button' && /\stype\s*=\s*["']submit["']/.test(attrs))
    const isPrimaryAction = hasAttr(attrs, 'data-ux-primary-action')

    if (
      (isSubmit || isPrimaryAction) &&
      genericActionLabels.has(label) &&
      !(
        hasAttr(attrs, 'data-ux-allow-generic-label') &&
        hasAttr(attrs, 'data-ux-label-context')
      )
    ) {
      addViolation(
        file,
        lineNumberOf(source, button.index),
        `submit/main action label "${label}" is too generic`,
      )
    }
  }
}

const checkDangerActions = (file, source) => {
  const destructiveTextPattern =
    /(永久删除|删除|拒绝|隐藏|关闭|delete|remove|destroy|reject|hide|close)/i

  for (const button of parseButtons(source)) {
    const attrs = button.attrs
    const label =
      visibleButtonText(button.body) || getAttrValue(attrs, 'aria-label')
    const actionSurface = `${attrs} ${label}`
    const isDanger =
      hasAttr(attrs, 'data-ux-danger-action') ||
      /type\s*=\s*["']danger["']/.test(attrs) ||
      destructiveTextPattern.test(actionSurface)

    if (!isDanger) continue

    const line = lineNumberOf(source, button.index)
    if (!hasAnyAttr(attrs, ['data-ux-confirmation', 'data-ux-undo'])) {
      addViolation(
        file,
        line,
        'destructive action must declare confirmation or undo path',
      )
    }
    if (!hasAttr(attrs, 'data-ux-consequence')) {
      addViolation(
        file,
        line,
        'destructive action must explain the consequence',
      )
    }
    for (const attr of [
      'data-ux-reversible',
      'data-ux-notification',
      'data-ux-audit',
    ]) {
      if (!hasAttr(attrs, attr)) {
        addViolation(file, line, `destructive action must declare ${attr}`)
      }
    }
  }
}

const checkEmptyStates = (file, source) => {
  const emptyPattern = /<(el-empty|ElEmpty)\b([^>]*)(?:\/>|>[\s\S]*?<\/\1>)/g
  for (const match of source.matchAll(emptyPattern)) {
    const block = match[0] ?? ''
    const attrs = match[2] ?? ''
    if (
      !(
        hasAttr(attrs, 'data-ux-empty-action') ||
        hasAttr(attrs, 'data-ux-empty-reason') ||
        hasAttr(attrs, 'data-ux-no-empty-action-reason') ||
        /data-ux-empty-action|data-ux-empty-reason|data-ux-no-empty-action-reason/.test(
          block,
        )
      )
    ) {
      addViolation(
        file,
        lineNumberOf(source, match.index ?? 0),
        'empty state must provide next action or a clear no-action reason',
      )
    }
  }
}

const checkSemanticPage = (file, source) => {
  const cleanSource = stripComments(source)
  if (!cleanSource.includes('data-ux-page')) {
    addViolation(file, 1, 'semantic example page must declare data-ux-page')
  }

  const h1Count = [...cleanSource.matchAll(/<h1\b/gi)].length
  if (h1Count !== 1) {
    addViolation(file, 1, `page must contain exactly one h1; found ${h1Count}`)
  }

  if (!/data-ux-(page-description|task-intro)/.test(cleanSource)) {
    addViolation(file, 1, 'page must include a description or task intro')
  }

  if (
    !cleanSource.includes('data-ux-primary-action') &&
    !cleanSource.includes('data-ux-no-primary-action-reason')
  ) {
    addViolation(
      file,
      1,
      'task page must declare a primary action or explicit no-action reason',
    )
  }

  if (
    /data-ux-filter-control|data-ux-filterable-list|<el-table\b|<ElTable\b|<el-table-v2\b|<ElTableV2\b/i.test(
      cleanSource,
    ) &&
    /data-ux-filter-control|data-ux-filterable-list/i.test(cleanSource) &&
    !cleanSource.includes('data-ux-filter-summary')
  ) {
    addViolation(
      file,
      1,
      'filterable table/list page must include data-ux-filter-summary',
    )
  }

  const loadingMarkers = [
    ...cleanSource.matchAll(
      /data-ux-loading-threshold-ms\s*=\s*["'](\d+)["']/g,
    ),
  ]
  for (const marker of loadingMarkers) {
    const threshold = Number(marker[1])
    if (Number.isFinite(threshold) && threshold > 300) {
      addViolation(
        file,
        lineNumberOf(cleanSource, marker.index ?? 0),
        'loading threshold should be 300ms or lower',
      )
    }
  }
  if (
    loadingMarkers.length > 0 &&
    !(
      /<el-skeleton\b|<ElSkeleton\b/i.test(cleanSource) ||
      cleanSource.includes('data-ux-loading-status')
    )
  ) {
    addViolation(
      file,
      1,
      'loading state over threshold must provide skeleton or status text',
    )
  }

  if (cleanSource.includes('data-ux-async-action')) {
    for (const attr of [
      'data-ux-pending-state',
      'data-ux-success-state',
      'data-ux-error-state',
    ]) {
      if (!cleanSource.includes(attr)) {
        addViolation(file, 1, `async action must expose ${attr}`)
      }
    }
  }

  checkGenericSubmitLabels(file, cleanSource)
  checkDangerActions(file, cleanSource)
  checkEmptyStates(file, cleanSource)
}

for (const { file, terms } of requiredDocs) {
  if (!existsSync(resolve(root, file))) {
    addViolation(file, 1, 'required UX semantics document is missing')
    continue
  }
  const source = readText(file)
  for (const term of terms) {
    if (!source.includes(term)) {
      addViolation(file, 1, `required UX semantics term is missing: ${term}`)
    }
  }
}

for (const name of requiredExampleFiles) {
  const file = `${semanticExampleDir}/${name}`
  if (!existsSync(resolve(root, file))) {
    addViolation(
      file,
      1,
      'required UX semantics consumption example is missing',
    )
  }
}

for (const dir of consumerScanDirs) {
  for (const file of listFiles(dir, ['.vue'])) {
    checkIconOnlyButtons(file, stripComments(readText(file)))
  }
}

for (const file of listFiles(semanticExampleDir, ['.vue'])) {
  checkSemanticPage(file, readText(file))
}

if (violations.length > 0) {
  console.error('UX semantics check failed:')
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  process.exit(1)
}

console.log('UX semantics check passed.')
