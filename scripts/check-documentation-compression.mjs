#!/usr/bin/env node

/**
 * Documentation compression acceptance checks.
 *
 * This checker deliberately stays independent of a Markdown parser.  The
 * repository has a large amount of prose, examples, generated output, and
 * fixture material; a small, deterministic scanner makes the acceptance
 * boundary inspectable and keeps this gate usable before dependencies are
 * installed.
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_PATH = fileURLToPath(import.meta.url)

export const DESIGN_FILE = 'docs/design.md'
export const FROZEN_DESIGN_SHA256 =
  '24c88676101dde43bb0907ed173f001b6e1659973caf19701ea57eddf0617039'

export const REQUIRED_AVALONIA_HEADINGS = [
  'Avalonia API',
  'Vue Contract Mapping',
  'Supported Platform Differences',
  'Theme Tokens',
  'Minimal Avalonia Example',
  'Known Limitations',
]

export const NORMATIVE_RULES = [
  {
    id: 'must-not',
    rank: 6,
    patterns: [
      /\bmust\s+not\b/giu,
      /\bmustn['’]t\b/giu,
      /不得/gu,
      /禁止/gu,
      /严禁/gu,
    ],
  },
  {
    id: 'never',
    rank: 6,
    patterns: [/\bnever\b/giu, /绝不/gu, /永不/gu],
  },
  {
    id: 'must',
    rank: 5,
    patterns: [
      /\bmust\b/giu,
      /必须/gu,
      /须知/gu,
      /务必/gu,
    ],
  },
  {
    id: 'should-not',
    rank: 4,
    patterns: [
      /\bshould\s+not\b/giu,
      /\bshouldn['’]t\b/giu,
      /不应/gu,
      /不该/gu,
      /不宜/gu,
    ],
  },
  {
    id: 'should',
    rank: 3,
    patterns: [/\bshould\b/giu, /应当/gu, /应该/gu, /应/gu],
  },
  {
    id: 'may',
    rank: 2,
    patterns: [/\bmay\b/giu, /可以/gu, /可/gu],
  },
  {
    id: 'only',
    rank: 4,
    patterns: [/\bonly\b/giu, /仅/gu, /只有/gu],
  },
  {
    id: 'unless',
    rank: 3,
    patterns: [/\bunless\b/giu, /除非/gu],
  },
  {
    id: 'except',
    rank: 3,
    patterns: [/\bexcept\b/giu, /除了/gu, /除外/gu],
  },
  {
    id: 'by-default',
    rank: 3,
    patterns: [/\bby\s+default\b/giu, /默认/gu],
  },
  {
    id: 'recommended',
    rank: 2,
    patterns: [/\brecommended\b/giu, /建议/gu, /推荐/gu],
  },
  {
    id: 'optional',
    rank: 1,
    patterns: [/\boptional\b/giu, /可选/gu],
  },
]

/**
 * Corrections which are allowed to replace a stale technical literal.
 *
 * Every entry has to name the source document, the old and new literal, and
 * repository evidence.  This is intentionally narrow: an arbitrary removed
 * command, path, or package is a protected-entity regression, not a
 * compression edit.
 */
export const CORRECTION_ALLOWLIST = [
  {
    kind: 'path',
    source: 'docs/engineering-handoff.md',
    old: '/data/projects/FsusUI/vitest.setup.ts:1',
    new: 'vue/vitest.setup.ts',
    evidence: 'vue/vitest.setup.ts',
    reason: 'Replace a stale absolute checkout path with the tracked setup file.',
  },
  {
    kind: 'path',
    source: 'docs/engineering-handoff.md',
    old: '/data/projects/FsusUI/vue/vitest.config.ts:1',
    new: 'vue/vitest.config.ts',
    evidence: 'vue/vitest.config.ts',
    reason: 'Replace a stale absolute checkout path with a repository-relative path.',
  },
  {
    kind: 'path',
    source: 'docs/engineering-handoff.md',
    old: '/data/projects/FsusUI/vue/playwright.config.ts:1',
    new: 'vue/playwright.config.ts',
    evidence: 'vue/playwright.config.ts',
    reason: 'Replace a stale absolute checkout path with a repository-relative path.',
  },
  {
    kind: 'path',
    source: 'docs/engineering-handoff.md',
    old: '/data/projects/FsusUI/vue/tests/visual/demo-app.spec.ts:1',
    new: 'vue/tests/visual/capture-all.spec.ts',
    evidence: 'vue/tests/visual/capture-all.spec.ts',
    reason: 'Point the handoff guide at the current visual capture entry point.',
  },
  {
    kind: 'path',
    source: 'docs/engineering-handoff.md',
    old: '/data/projects/FsusUI/vue/packages/demo-app/src/VisualFixtures.vue:1',
    new: 'vue/packages/demo-app/src/AuditFixtures.vue',
    evidence: 'vue/packages/demo-app/src/AuditFixtures.vue',
    reason: 'Point the handoff guide at the current tracked demo fixture entry point.',
  },
  {
    kind: 'path',
    source: 'docs/engineering-handoff.md',
    old: '/data/projects/FsusUI/vue/packages/demo-app/src/main.ts:1',
    new: 'vue/packages/demo-app/src/App.vue',
    evidence: 'vue/packages/demo-app/src/App.vue',
    reason: 'Point the handoff guide at the current tracked demo application entry point.',
  },
  {
    kind: 'command',
    source: 'vue/packages/theme-chalk/README.md',
    old: 'npm i element-plus',
    new: 'npm install @ozwasyd/element-plus',
    evidence: 'vue/packages/element-plus/package.json',
    reason: 'Use the current public-preview package and explicit npm install syntax.',
  },
  {
    kind: 'path',
    source: 'docs/engineering-handoff.md',
    old: 'vue/packages/icons-vue/build/**',
    new: 'vue/packages/icons-vue/dist',
    evidence: 'vue/packages/icons-vue/package.json',
    reason: 'Update the cache/documentation path to the generated icon distribution directory.',
  },
  {
    kind: 'path',
    source: 'docs/releases/governance.md',
    old: 'base.css',
    new: 'dist/fsus.css',
    evidence: 'vue/packages/element-plus/package.json',
    reason: 'Replace the stale base stylesheet name with the current published CSS entry.',
  },
  {
    kind: 'version',
    source: 'docs/project-overview.md',
    old: '0.0.0-dev.2',
    new: '1.5.1',
    evidence: 'vue/packages/element-plus/package.json',
    reason: 'Refresh the orientation snapshot to the current workspace package version.',
  },
]

const PRESERVED_PATTERNS = [
  /^\.changeset\//u,
  /(?:^|\/)CHANGELOG(?:\.[^/]+)?$/iu,
  /^docs\/releases\/evidence\//u,
  /^docs\/archive(?:\/|$)/u,
  /(?:^|\/)generated(?:\/|$)/u,
  /^tests\/fixtures\//u,
  /^\.agents\/skills\//u,
]

const EXTERNAL_LINK = /^(?:https?:|mailto:|app:|data:|tel:|javascript:|\/\/)/iu
const LINE_SUFFIX = /:\d+(?::\d+)?$/u
const DEFAULT_BASE_CANDIDATES = ['origin/main', 'HEAD']
const MAX_FAILURE_DETAILS = 24

const toPosix = (value) => value.split(path.sep).join('/')

const normalizeRelative = (value) => toPosix(path.normalize(value))

const isMarkdown = (file) => /\.(?:md|markdown)$/iu.test(file)

const isPreserved = (file) => PRESERVED_PATTERNS.some((pattern) => pattern.test(file))

const isFixture = (file) => /^tests\/fixtures\//u.test(file)

const sha256 = (value) =>
  createHash('sha256').update(value, 'utf8').digest('hex')

const countLines = (value) => (value.match(/\n/gu) ?? []).length

const wordCount = (value) => {
  if (typeof Intl?.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('en', { granularity: 'word' })
    let count = 0
    for (const part of segmenter.segment(value)) {
      if (part.isWordLike) count += 1
    }
    return count
  }

  return (value.match(/[\p{Letter}\p{Number}]+/gu) ?? []).length
}

const measure = (value) => ({
  lines: countLines(value),
  words: wordCount(value),
  // A dependency-free estimate is sufficient for a ratchet.  Keep the
  // estimate explicitly labelled so it is never mistaken for model BPE data.
  tokens: Math.ceil([...value].length / 4),
})

const addMeasures = (files) => {
  const result = { files: files.size, lines: 0, words: 0, tokens: 0 }
  for (const value of files.values()) {
    const stats = measure(value)
    result.lines += stats.lines
    result.words += stats.words
    result.tokens += stats.tokens
  }
  return result
}

const runGit = (root, args, options = {}) => {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
      ...options,
    })
  } catch {
    return null
  }
}

const resolveGitRef = (root, requested) => {
  if (!requested) {
    for (const candidate of DEFAULT_BASE_CANDIDATES) {
      const resolved = resolveGitRef(root, candidate)
      if (resolved) return resolved
    }
    return null
  }

  return (
    runGit(root, ['rev-parse', '--verify', `${requested}^{commit}`])?.trim() ??
    null
  )
}

const trackedFiles = (root) => {
  const output = runGit(root, ['ls-files', '-z'])
  if (output === null) {
    throw new Error('Git is required to inventory tracked Markdown files.')
  }

  return output
    .split('\0')
    .filter(Boolean)
    .map(toPosix)
    .filter(isMarkdown)
    .sort()
}

const treeFiles = (root, ref) => {
  const output = runGit(root, ['ls-tree', '-r', '--name-only', '-z', ref])
  if (output === null) return []
  return output
    .split('\0')
    .filter(Boolean)
    .map(toPosix)
}

const readCurrent = (root, files) => {
  const contents = new Map()
  for (const file of files) {
    const absolute = path.join(root, file)
    if (!existsSync(absolute) || !statSync(absolute).isFile()) continue
    contents.set(file, readFileSync(absolute, 'utf8'))
  }
  return contents
}

const readAtRef = (root, ref, files) => {
  const contents = new Map()
  for (const file of files) {
    const value = runGit(root, ['show', `${ref}:${file}`])
    if (value !== null) contents.set(file, value)
  }
  return contents
}

const stripFencedCode = (content) =>
  content.replace(
    /^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\2+\s*$/gmu,
    (block) => block.replace(/[^\n]/gu, ' '),
  )

const collectFences = (content) => {
  const fences = []
  const pattern = /^( {0,3})(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^\1\2+\s*$/gmu
  for (const match of content.matchAll(pattern)) {
    const info = match[3].trim()
    const body = match[4]
    fences.push({
      info,
      body,
      value: `${info}\n${body}`,
    })
  }
  return fences
}

const findUnclosedFence = (content) => {
  let open = null
  for (const [lineNumber, line] of content.split(/\r?\n/u).entries()) {
    const match = /^ {0,3}(`{3,}|~{3,})(?:[^`~].*)?$/u.exec(line)
    if (!match) continue
    const marker = match[1]
    const character = marker[0]
    if (!open) {
      open = { character, length: marker.length, lineNumber: lineNumber + 1 }
      continue
    }
    if (open.character === character && marker.length >= open.length) open = null
  }
  return open
}

const checkCodeFenceBalance = ({ files, contents }) => {
  const failures = []
  for (const file of files) {
    const open = findUnclosedFence(contents.get(file) ?? '')
    if (open) failures.push(`${file} has an unclosed ${open.character}-fence opened at line ${open.lineNumber}`)
  }
  return failures
}

const headingText = (value) =>
  value
    .replace(/\s+#+\s*$/u, '')
    .replace(/<[^>]*>/gu, '')
    .replace(/&(?:amp|lt|gt|quot|#39);/giu, ' ')
    .replace(/`/gu, '')
    .trim()

const slugify = (value) =>
  headingText(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s_-]/gu, '')
    .replace(/[\s]+/gu, '-')
    .replace(/^-+|-+$/gu, '')

const collectAnchors = (content) => {
  const anchors = new Set()
  const counts = new Map()
  const visible = stripFencedCode(content)
  const headings = []

  for (const match of visible.matchAll(/^ {0,3}#{1,6}\s+(.+)$/gmu)) {
    headings.push({ offset: match.index ?? 0, text: match[1] })
  }

  // Setext headings are still valid Markdown and participate in the same
  // GitHub-style anchor space as ATX headings.  Do not treat a horizontal
  // rule after a blank line as a heading.
  const visibleLines = visible.split(/\r?\n/u)
  let offset = 0
  for (let index = 0; index + 1 < visibleLines.length; index += 1) {
    const text = visibleLines[index].trim()
    if (!text || /^ {0,3}(?:[-=]){3,}\s*$/u.test(visibleLines[index - 1] ?? '')) {
      offset += visibleLines[index].length + 1
      continue
    }
    const underline = visibleLines[index + 1]
    if (/^ {0,3}(?:=+|-+)\s*$/u.test(underline)) {
      headings.push({ offset, text })
    }
    offset += visibleLines[index].length + 1
  }

  headings.sort((left, right) => left.offset - right.offset)
  for (const { text } of headings) {
    const anchor = slugify(text)
    if (!anchor) continue
    const occurrence = counts.get(anchor) ?? 0
    counts.set(anchor, occurrence + 1)
    anchors.add(occurrence > 0 ? `${anchor}-${occurrence}` : anchor)
  }

  for (const match of visible.matchAll(
    /<a\s+(?:[^>]*?\s)?(?:id|name)=["']([^"']+)["'][^>]*>/giu,
  )) {
    anchors.add(match[1].trim().toLowerCase())
  }

  for (const match of visible.matchAll(
    /<h[1-6]\b[^>]*\bid=["']([^"']+)["'][^>]*>/giu,
  )) {
    anchors.add(match[1].trim().toLowerCase())
  }

  for (const match of visible.matchAll(/^\s*\{#([^}]+)\}\s*$/gmu)) {
    anchors.add(match[1].trim().toLowerCase())
  }

  return anchors
}

const findClosingBracket = (source, start, opening, closing) => {
  let depth = 0
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '\\') {
      index += 1
      continue
    }
    if (source[index] === opening) depth += 1
    if (source[index] === closing) {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

const collectReferenceDefinitions = (content) => {
  const definitions = new Map()
  for (const match of content.matchAll(
    /^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/gmu,
  )) {
    definitions.set(match[1].trim().toLowerCase(), match[2] ?? match[3])
  }
  return definitions
}

const collectLinks = (content) => {
  const links = []
  const source = stripFencedCode(content)
  const definitions = collectReferenceDefinitions(source)

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== '[' || (index > 0 && source[index - 1] === '\\')) {
      continue
    }

    const labelEnd = findClosingBracket(source, index, '[', ']')
    if (labelEnd === -1) continue
    const cursor = labelEnd + 1

    if (source[cursor] === '(') {
      const targetEnd = findClosingBracket(source, cursor, '(', ')')
      if (targetEnd === -1) continue
      const raw = source.slice(cursor + 1, targetEnd).trim()
      // Images have the same target semantics as links and are intentionally
      // checked as well.
      links.push({ rawTarget: raw, label: source.slice(index + 1, labelEnd) })
      index = targetEnd
      continue
    }

    if (source[cursor] === '[') {
      const referenceEnd = findClosingBracket(source, cursor, '[', ']')
      if (referenceEnd === -1) continue
      const reference = source
        .slice(cursor + 1, referenceEnd)
        .trim()
        .toLowerCase()
      const target = definitions.get(
        reference || source.slice(index + 1, labelEnd).trim().toLowerCase(),
      )
      if (target) {
        links.push({ rawTarget: target, label: source.slice(index + 1, labelEnd) })
      }
      index = referenceEnd
      continue
    }

    // A collapsed reference link (`[label]`) uses its label as the
    // definition key.  Definitions are collected from the same fenced-code-
    // free source, so this branch cannot mistake an ordinary paragraph for a
    // link unless an explicit definition exists.
    const collapsedTarget = definitions.get(
      source.slice(index + 1, labelEnd).trim().toLowerCase(),
    )
    if (collapsedTarget) {
      links.push({
        rawTarget: collapsedTarget,
        label: source.slice(index + 1, labelEnd),
      })
    }
  }

  return links
}

const trimLinkTarget = (rawTarget) => {
  let value = rawTarget.trim()
  if (value.startsWith('<')) {
    const end = value.indexOf('>')
    if (end !== -1) value = value.slice(1, end)
  } else {
    // Titles are not part of the target.  Paths containing spaces should be
    // written in angle brackets by Markdown authors; preserve ordinary paths.
    const title = value.search(/\s+["'][^"']*["']\s*$/u)
    if (title !== -1) value = value.slice(0, title)
  }
  return value.replace(/\\([()[\]<>])/gu, '$1')
}

const decodeSafe = (value) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const splitLinkTarget = (rawTarget) => {
  const target = trimLinkTarget(rawTarget)
  const hashIndex = target.indexOf('#')
  const beforeHash = hashIndex === -1 ? target : target.slice(0, hashIndex)
  const anchor = hashIndex === -1 ? '' : decodeSafe(target.slice(hashIndex + 1))
  const queryIndex = beforeHash.indexOf('?')
  let targetPath = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex)
  targetPath = decodeSafe(targetPath)
  const line = LINE_SUFFIX.exec(targetPath)
  if (line) targetPath = targetPath.slice(0, line.index)
  return { target, targetPath, anchor }
}

const resolveLinkPath = (file, targetPath) => {
  if (targetPath === '') return file
  if (targetPath.startsWith('/')) {
    return normalizeRelative(targetPath.slice(1))
  }
  const candidate = normalizeRelative(path.posix.join(path.posix.dirname(file), targetPath))
  const relative = path.posix.relative('.', candidate)
  if (relative.startsWith('../') || relative === '..') return candidate
  return candidate
}

const linkExists = (targetFile, root, fileSet) =>
  fileSet.has(targetFile) || existsSync(path.join(root, targetFile))

const linkKey = (file, rawTarget) => `${file}\u0000${rawTarget}`

const analyseLinks = ({
  files,
  root,
  read,
  knownFiles,
  designExceptions = false,
  fixtureExceptions = false,
  baselineBroken = new Set(),
}) => {
  const failures = []
  const exceptions = []
  const broken = []
  const anchorsCache = new Map()
  let total = 0

  const anchorsFor = (file) => {
    if (!anchorsCache.has(file)) anchorsCache.set(file, collectAnchors(read(file)))
    return anchorsCache.get(file)
  }

  for (const file of files) {
    const content = read(file)
    for (const { rawTarget } of collectLinks(content)) {
      const { target, targetPath, anchor } = splitLinkTarget(rawTarget)
      if (EXTERNAL_LINK.test(target)) continue
      total += 1

      const targetFile = resolveLinkPath(file, targetPath)
      const exists = linkExists(targetFile, root, knownFiles)
      const brokenPath = !exists
      const brokenAnchor =
        exists && anchor && isMarkdown(targetFile) && !anchorsFor(targetFile).has(anchor.toLowerCase())

      if (!brokenPath && !brokenAnchor) continue

      const reason = brokenPath
        ? `missing ${targetPath || targetFile}`
        : `missing anchor #${anchor} in ${targetFile}`
      broken.push({ file, rawTarget, reason })
      const exception =
        (designExceptions && file === DESIGN_FILE) ||
        (fixtureExceptions && isFixture(file) && baselineBroken.has(linkKey(file, rawTarget)))

      if (exception) {
        exceptions.push({ file, target, reason })
      } else {
        failures.push(`${file} links to ${target}: ${reason}`)
      }
    }
  }

  return { failures, exceptions, broken, total }
}

const baselineBrokenLinks = ({ files, root, contents, knownFiles }) => {
  const read = (file) => contents.get(file) ?? ''
  const result = analyseLinks({
    files,
    root,
    read,
    knownFiles,
  })
  return new Set(result.broken.map(({ file, rawTarget }) => linkKey(file, rawTarget)))
}

const parseGalleryIds = (root) => {
  const registry = path.join(
    root,
    'dotnet/FsusUI.Avalonia.Demo/Gallery/FsusAvaloniaGalleryRegistry.cs',
  )
  if (!existsSync(registry)) return []
  const content = readFileSync(registry, 'utf8')
  return [...content.matchAll(/Entry\("([^"\n]+)",\s*"([^"\n]+)"\)/gu)].map(
    ([, id, title]) => ({ id, title }),
  )
}

const checkAvaloniaHeadings = ({ root, files, contents }) => {
  const componentFiles = files.filter((file) =>
    /^docs\/avalonia\/components\/[^/]+\.md$/u.test(file),
  )
  if (componentFiles.length === 0) return { failures: [], checked: 0 }

  const galleryIds = parseGalleryIds(root)
  const targets = galleryIds.length
    ? galleryIds.map(({ id, title }) => ({
        file: `docs/avalonia/components/${id}.md`,
        title,
      }))
    : componentFiles.map((file) => ({ file }))
  const failures = []

  for (const { file, title } of targets) {
    if (!contents.has(file)) {
      failures.push(`${file} missing`)
      continue
    }
    const content = contents.get(file)
    if (title && !content.includes(title)) {
      failures.push(`${file} missing stable title ${title}`)
    }
    const headings = new Set(
      [...stripFencedCode(content).matchAll(/^ {0,3}##\s+(.+?)\s*$/gmu)].map(
        ([, value]) => headingText(value),
      ),
    )
    for (const required of REQUIRED_AVALONIA_HEADINGS) {
      if (!headings.has(required)) failures.push(`${file} missing ## ${required}`)
    }
  }

  return { failures, checked: targets.length }
}

const extractComponentLinks = (content, file) =>
  collectLinks(content)
    .map(({ rawTarget }) => splitLinkTarget(rawTarget))
    .filter(({ target }) => !EXTERNAL_LINK.test(target))
    .map(({ targetPath }) => resolveLinkPath(file, targetPath))

const checkComponentOverview = ({ files, contents }) => {
  const componentFiles = files.filter(
    (file) => /^docs\/components\/[^/]+\.md$/u.test(file) && file !== 'docs/components/overview.md',
  )
  if (componentFiles.length === 0) return { failures: [], checked: 0, links: 0 }

  const overview = 'docs/components/overview.md'
  if (!contents.has(overview)) return { failures: [`${overview} missing`], checked: componentFiles.length, links: 0 }

  const links = new Set(extractComponentLinks(contents.get(overview), overview))
  const missing = componentFiles
    .filter((file) => !links.has(file))
    .map((file) => `${overview} missing link to ${file}`)
  return {
    failures: missing,
    checked: componentFiles.length,
    links: links.size,
  }
}

const isCommand = (value) => {
  const candidate = value.trim().replace(/^(?:[$>]\s*)/u, '')
  if (
    !/^(?:pnpm|npm|yarn|node|npx|deno|bun|dotnet|git|curl|vite|vitest|playwright|cargo|python3?|bash|sh)\b/u.test(
      candidate,
    )
  ) {
    return false
  }
  // A prose label such as "npm public registry primary" is not a shell
  // command. Keep the command ledger focused on executable invocations.
  return !/^(?:npm|pnpm|yarn|bun)\s+public\b/iu.test(candidate)
}

const isPathLike = (value) => {
  const candidate = value.trim()
  if (
    /[<>]/u.test(candidate) ||
    /(?:^|\/)\d{4}-\d{2}-\d{2}\.md$/u.test(candidate) ||
    /(?:^|\/)(?:owner-repository|issue)-\d+\.md$/u.test(candidate)
  ) {
    return false
  }
  return (
    /^(?:\/?(?:\.{1,2}\/|(?:docs|spec|vue|dotnet|tests|scripts|packages|internal|dist|build|\.github|\.changeset)\/)|[A-Za-z]:[\\/]|\/data\/|\/home\/)[^\s]+$/u.test(
      candidate,
    ) ||
    /^(?:[^\s/]+\/)+[^\s/]+\.(?:md|markdown|json|ya?ml|ts|tsx|js|mjs|cjs|vue|cs|csproj|slnx|scss|css|html|svg|png|wasm|sh)(?::\d+(?::\d+)?)?$/iu.test(
      candidate,
    ) ||
    /^[^\s/]+\.(?:md|markdown|json|ya?ml|ts|tsx|js|mjs|cjs|vue|cs|csproj|slnx|scss|css|html|svg|png|wasm|sh)(?::\d+(?::\d+)?)?$/iu.test(
      candidate,
    )
  )
}

const isVersion = (value) =>
  /^(?:v)?\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?$/u.test(value.trim()) ||
  /^(?:Node(?:\.js)?|pnpm|TypeScript|Vue|Emscripten|Sass)\s+v?\d+(?:\.\d+){0,3}(?:[-+][0-9A-Za-z.-]+)?$/iu.test(
    value.trim(),
  )

const isPort = (value) =>
  /^(?:port\s*[:=]?\s*|localhost:)(\d{2,5})$/iu.test(value.trim()) ||
  /^(?:https?:\/\/)?localhost:\d{2,5}(?:\/[^\s]*)?$/iu.test(value.trim())

const isConfigKey = (value) => {
  const candidate = value.trim()
  if (/^--[A-Za-z0-9_-]+$/u.test(candidate)) return true
  if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/u.test(candidate)) return true
  if (!/^[a-z][A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+$/u.test(candidate)) return false
  return !/\.(?:c|cjs|css|html|json|js|md|mjs|png|scss|sh|svg|ts|tsx|vue|wasm|ya?ml)$/iu.test(candidate)
}

const isApi = (value) =>
  /^(?:@[^\s]+|<[A-Za-z][^>]+>|(?:Fsus|El)[A-Z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)*|[a-z][A-Za-z0-9_]+\([^)]*\)|(?:v-|use|is|create|resolve|plan|commit|render|parse|check)[A-Z][A-Za-z0-9_-]+)$/u.test(value.trim())

const isStatus = (value) =>
  /^(?:baseline-unavailable|contract-changed|failed|failure|error|warning|success|ready|partial|blocked|active|paused|disabled|loading|selected|invalid|empty)$/iu.test(
    value.trim(),
  )

const addEntity = (map, kind, value) => {
  const normalized = value.trim().replace(/\s+/gu, ' ')
  if (!normalized || normalized.length < 2) return
  if (!map.has(kind)) map.set(kind, new Set())
  map.get(kind).add(normalized)
}

const extractProtectedEntities = (contents) => {
  const entities = new Map()
  for (const [file, content] of contents) {
    const fences = collectFences(content)
    for (const fence of fences) {
      addEntity(entities, 'code-fence', fence.value)
      addEntity(entities, 'example-i/o', fence.value)
      for (const line of fence.body.split(/\r?\n/u)) {
        const value = line.trim()
        if (isCommand(value)) addEntity(entities, 'command', value)
      }
      for (const match of fence.body.matchAll(
        /\b(?:Fsus|El|use|create|resolve|plan|commit|render|parse|check)[A-Z][A-Za-z0-9_.:-]*/gu,
      )) {
        addEntity(entities, 'api', match[0])
      }
      for (const match of fence.body.matchAll(/--[A-Za-z0-9_-]+/gu)) {
        addEntity(entities, 'config-key', match[0])
      }
    }

    const prose = stripFencedCode(content)
    // Link labels are navigation text; their targets are checked by the link
    // graph. Exclude label code spans so shortening a label does not look
    // like deleting a repository path or API.
    const proseWithoutLinkLabels = prose.replace(/\[[^\]]*\]\([^)]*\)/gu, '')
    for (const match of proseWithoutLinkLabels.matchAll(/`([^`\n]+)`/gu)) {
      const value = match[1]
      addEntity(entities, 'technical', value)
      if (isCommand(value) && /\s/u.test(value.trim())) {
        addEntity(entities, 'command', value)
      }
      if (isPathLike(value)) addEntity(entities, 'path', value)
      if (isVersion(value)) addEntity(entities, 'version', value)
      if (isPort(value)) addEntity(entities, 'port', value)
      if (isConfigKey(value)) addEntity(entities, 'config-key', value)
      if (isApi(value)) addEntity(entities, 'api', value)
      if (isStatus(value)) addEntity(entities, 'status/error', value)
    }

    for (const match of prose.matchAll(/https?:\/\/[^\s)\]>"']+/giu)) {
      addEntity(
        entities,
        'url',
        match[0]
          .split(/[，。；！？`]/u, 1)[0]
          .replace(/[.,;!?，。；！？`）】》]+$/u, ''),
      )
    }
    for (const match of prose.matchAll(/\b(?:port\s*[:=]?\s*|localhost:)(\d{2,5})\b/giu)) {
      addEntity(entities, 'port', match[1])
    }
    for (const { rawTarget } of collectLinks(prose)) {
      const { target, targetPath } = splitLinkTarget(rawTarget)
      if (!EXTERNAL_LINK.test(target) && targetPath) {
        const pathLiteral = trimLinkTarget(rawTarget).split('#', 1)[0].split('?', 1)[0]
        // Relative navigation is covered by the link graph. Only retain
        // absolute/line-addressed link literals in the protected path ledger.
        if (/^(?:\/?(?:data|home)\/|[A-Za-z]:[\\/])|:\d+(?::\d+)?$/u.test(pathLiteral)) {
          addEntity(entities, 'path', pathLiteral)
        }
      }
    }
    // Bare numeric strings in prose are often section numbers or measurements;
    // version literals remain protected when written as code spans or package
    // entities in a fenced example.
    for (const match of prose.matchAll(
      /\b(?:baseline-unavailable|contract-changed|failed|failure|error|warning|success|ready|partial|blocked)\b/giu,
    )) {
      addEntity(entities, 'status/error', match[0])
    }

    // Keep the filename in the extraction loop so a future diagnostic can
    // identify ownership without changing the global comparison semantics.
    void file
  }
  return entities
}

const sentenceFor = (content, index) => {
  const start = Math.max(
    content.lastIndexOf('\n', index) + 1,
    content.lastIndexOf('.', index) + 1,
    content.lastIndexOf('。', index) + 1,
  )
  const endings = [
    content.indexOf('\n', index),
    content.indexOf('.', index),
    content.indexOf('。', index),
  ].filter((value) => value !== -1)
  const end = endings.length ? Math.min(...endings) : content.length
  return content.slice(start, end).trim()
}

const collectNormative = (contents) => {
  const counts = new Map(NORMATIVE_RULES.map(({ id }) => [id, 0]))
  const atoms = new Set()

  for (const content of contents.values()) {
    const source = stripFencedCode(content)
    const occupied = []
    const hasOverlap = (start, end) =>
      occupied.some(([from, to]) => start < to && end > from)

    for (const rule of NORMATIVE_RULES) {
      for (const pattern of rule.patterns) {
        for (const match of source.matchAll(pattern)) {
          const start = match.index ?? 0
          const end = start + match[0].length
          if (hasOverlap(start, end)) continue
          occupied.push([start, end])
          counts.set(rule.id, (counts.get(rule.id) ?? 0) + 1)
          const sentence = sentenceFor(source, start)
            .toLowerCase()
            .replace(/`[^`]*`/gu, '`code`')
            .replace(/\s+/gu, ' ')
            .trim()
          atoms.add(`${rule.id}|${sentence}`)
        }
      }
    }
  }

  return { counts, atoms }
}

const buildFileAtomLedger = (files, current, baseline) =>
  Object.fromEntries(
    files.map((file) => {
      const currentContent = current.get(file) ?? ''
      const baselineContent = baseline.get(file) ?? ''
      const currentNormative = collectNormative(
        new Map([[file, currentContent]]),
      )
      const baselineNormative = collectNormative(
        new Map([[file, baselineContent]]),
      )
      return [
        file,
        {
          changed: currentContent !== baselineContent,
          current: {
            ...measure(currentContent),
            normativeAtoms: currentNormative.atoms.size,
          },
          baseline: baseline.has(file)
            ? {
                ...measure(baselineContent),
                normativeAtoms: baselineNormative.atoms.size,
              }
            : null,
        },
      ]
    }),
  )

const formatEntity = (value) => {
  const oneLine = value.replace(/\s+/gu, ' ').trim()
  return oneLine.length > 160 ? `${oneLine.slice(0, 157)}...` : oneLine
}

const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')

const containsToken = (content, value) =>
  new RegExp(
    `(?<![\\p{Letter}\\p{Number}_$.-])${escapeRegExp(value)}(?![\\p{Letter}\\p{Number}_$.-])`,
    'u',
  ).test(content)

const normalizeCommand = (value) => {
  let command = value.trim().replace(/^(?:[$>]\s*)/u, '')
  // Package-manager wrappers are operationally equivalent for repository
  // scripts. Keep the command body and its arguments for the comparison.
  command = command.replace(/^(?:pnpm|npm|yarn|bun)\s+(?:run|exec)\s+/iu, '')
  command = command.replace(/^(?:pnpm|npm|yarn|bun)\s+/iu, '')
  command = command.replace(/(^|\s)-C\s+(?:vue\/)?packages\//gu, '$1-C packages/')
  command = command.replace(/(^|\s)(?:vue\/)?packages\//gu, '$1packages/')
  return command.replace(/\s+/gu, ' ').trim()
}

const commandEquivalent = (value, currentCommands) => {
  const expected = normalizeCommand(value)
  if (!expected) return false
  return [...currentCommands].some((candidate) => {
    const actual = normalizeCommand(candidate)
    if (actual === expected) return true
    // A short base command such as `dotnet test` remains protected when the
    // current guide shows the concrete project invocation.
    if (actual.startsWith(`${expected} `)) return true
    const expectedTokens = expected.split(' ')
    let cursor = 0
    for (const token of actual.split(' ')) {
      if (token === expectedTokens[cursor]) cursor += 1
      if (cursor === expectedTokens.length) return true
    }
    return false
  })
}

const pathVariants = (value) => {
  const trimmed = value.trim()
  const withoutPrefix = trimmed.replace(/^\.\//u, '')
  const variants = new Set([trimmed, withoutPrefix])
  const addPrefixAlias = (from, to) => {
    if (withoutPrefix.startsWith(from)) variants.add(`${to}${withoutPrefix.slice(from.length)}`)
  }
  addPrefixAlias('packages/', 'vue/packages/')
  addPrefixAlias('examples/', 'vue/examples/')
  addPrefixAlias('docs/archive/github-vue/', 'docs/archive/github-packages/')
  if (withoutPrefix === 'docs/archive/github-vue/packages/') {
    variants.add('docs/archive/github-packages/')
  }
  return [...variants]
}

const pathEquivalent = (value, { currentContents, currentEntities }) => {
  const text = [...currentContents.values()].join('\n')
  for (const variant of pathVariants(value)) {
    const base = variant.replace(/^\.\//u, '')
    const globBase = base.replace(/(?:\/\*\*|\/\*)$/u, '')
    const directoryBase = base.replace(/\/$/u, '')
    if (containsToken(text, base) || text.includes(base)) return true
    if (globBase && text.includes(`${globBase}/`)) return true
    if (directoryBase && text.includes(`${directoryBase}/`)) return true
    if (base.includes('*')) {
      const globPattern = new RegExp(
        escapeRegExp(base)
          .replace(/\\\*\\\*/gu, '.*')
          .replace(/\\\*/gu, '[^/]*'),
        'u',
      )
      if (globPattern.test(text)) return true
    }
    if (
      [...(currentEntities.get('path') ?? new Set())].some((candidate) => {
        const normalized = candidate.replace(/^\.\//u, '')
        return (
          normalized === base ||
          normalized.startsWith(`${directoryBase}/`) ||
          normalized.startsWith(`${globBase}/`)
        )
      })
    ) {
      return true
    }
  }
  return false
}

const entityRetained = (kind, value, { currentContents, currentEntities, currentCommands }) => {
  if (kind === 'command') return commandEquivalent(value, currentCommands)
  if (kind === 'path') return pathEquivalent(value, { currentContents, currentEntities })
  const text = [...currentContents.values()].join('\n')
  // Config keys, API names, versions, URLs, ports, and statuses may be
  // embedded in a longer code expression after prose is compressed.
  return text.includes(value)
}

const correctionAllows = ({ kind, value, source, root, currentContents }) =>
  CORRECTION_ALLOWLIST.some((entry) => {
    if (entry.kind !== kind || entry.source !== source || entry.old !== value) return false
    const evidence = path.join(root, entry.evidence)
    return existsSync(evidence) && Boolean(currentContents.get(source)?.includes(entry.new))
  })

const compareProtectedEntities = ({
  current,
  baseline,
  changedFiles,
  root,
  currentContents = new Map(),
}) => {
  const failures = []
  const corrections = []
  const kinds = new Set([...current.keys(), ...baseline.keys()])
  const currentCommands = current.get('command') ?? new Set()

  for (const kind of kinds) {
    // `technical`/fence categories are inventories, not set-level semantic
    // assertions. Compression may merge equivalent fences or move a short
    // example into prose while retaining its high-risk literals. Commands,
    // paths, APIs, config keys, versions, URLs, ports, and statuses remain
    // strict below; fence balance and the classified entity ledgers provide
    // the structural/example checks.
    if (kind === 'technical' || kind === 'code-fence' || kind === 'example-i/o') continue
    const before = baseline.get(kind) ?? new Set()
    const after = current.get(kind) ?? new Set()
    const missing = [...before].filter((value) => !after.has(value))
    for (const value of missing) {
      if (
        entityRetained(kind, value, {
          currentContents,
          currentEntities: current,
          currentCommands,
        })
      ) {
        continue
      }
      const source = [...changedFiles].find((file) => {
        const entry = CORRECTION_ALLOWLIST.find(
          (candidate) => candidate.kind === kind && candidate.old === value && candidate.source === file,
        )
        return Boolean(entry)
      })
      if (source && correctionAllows({ kind, value, source, root, currentContents })) {
        const entry = CORRECTION_ALLOWLIST.find(
          (candidate) => candidate.kind === kind && candidate.old === value && candidate.source === source,
        )
        corrections.push({ ...entry })
      } else {
        failures.push(`protected ${kind} removed: ${formatEntity(value)}`)
      }
    }
  }

  return { failures, corrections }
}

const normativeLineInfo = (line) => {
  const result = collectNormative(new Map([['line', line]]))
  const rules = new Map(NORMATIVE_RULES.map((rule) => [rule.id, rule]))
  const ids = [...result.counts.entries()]
    .filter(([, count]) => count > 0)
    .map(([id]) => id)
  return {
    ids,
    strongest: ids.reduce(
      (rank, id) => Math.max(rank, rules.get(id)?.rank ?? 0),
      0,
    ),
  }
}

const comparableWords = (line) =>
  new Set(
    (line.toLowerCase().match(/[\p{Letter}\p{Number}]{3,}/gu) ?? []).filter(
      (word) =>
        !new Set([
          'the',
          'and',
          'for',
          'with',
          'from',
          'that',
          'this',
          'must',
          'should',
          'may',
          'only',
          'not',
          'code',
          'api',
          'default',
          'optional',
          'required',
          'current',
          'source',
        ]).has(word),
    ),
  )

const multisetDifference = (before, after) => {
  const remaining = new Map()
  for (const value of after) remaining.set(value, (remaining.get(value) ?? 0) + 1)
  const removed = []
  for (const value of before) {
    const count = remaining.get(value) ?? 0
    if (count > 0) remaining.set(value, count - 1)
    else removed.push(value)
  }
  return removed
}

const compareNormative = (
  current,
  baseline,
  { changedFiles = new Set(), currentContents = new Map(), baselineContents = new Map() } = {},
) => {
  const failures = []
  const details = {}
  for (const rule of NORMATIVE_RULES) {
    const before = baseline.counts.get(rule.id) ?? 0
    const after = current.counts.get(rule.id) ?? 0
    details[rule.id] = { before, after, delta: after - before }
  }

  // Compare changed lines when the old and new sentence share subject/context
  // words.  This catches `must not` -> `should` (and similar downgrades) while
  // allowing the planned Chinese-to-English rewrite, whose lines naturally
  // have no lexical overlap.
  for (const file of changedFiles) {
    const beforeLines = (baselineContents.get(file) ?? '').split(/\r?\n/u)
    const afterLines = (currentContents.get(file) ?? '').split(/\r?\n/u)
    const removed = multisetDifference(beforeLines, afterLines)
    const added = multisetDifference(afterLines, beforeLines)
    const addedInfo = added.map((line) => ({
      line,
      info: normativeLineInfo(line),
      words: comparableWords(line),
    }))
    for (const [lineIndex, oldLine] of removed.entries()) {
      const oldInfo = normativeLineInfo(oldLine)
      if (!oldInfo.ids.length) continue
      const oldWords = comparableWords(oldLine)
      const candidate = addedInfo[lineIndex]
      if (!candidate?.info.ids.length) continue
      // A line whose language changed is a planned prose translation, not an
      // evidence-bearing strength downgrade.  Direct edits retain enough
      // lexical context to be checked below.
      if (/[\p{Script=Han}]/u.test(oldLine) !== /[\p{Script=Han}]/u.test(candidate.line)) continue
      const overlap = [...oldWords].filter((word) => candidate.words.has(word)).length
      if (overlap < 3) continue
      if (candidate.info.strongest < oldInfo.strongest) {
        failures.push(
          `normative strength downgraded in ${file}: ${formatEntity(oldLine)} -> ${formatEntity(candidate.line)}`,
        )
      }
    }
  }

  // A marker count increase is a useful fallback for compact one-line edits
  // that do not retain enough context for the line matcher.  Ignore `only`,
  // `by-default`, `recommended`, and `optional`: their counts legitimately
  // move when prose is translated or callouts are consolidated.  The explicit
  // should-not category is kept here so it cannot silently become should.
  for (const rule of NORMATIVE_RULES.filter(({ id }) =>
    ['must-not', 'never', 'must', 'should-not', 'should', 'may', 'unless', 'except'].includes(id),
  )) {
    const before = baseline.counts.get(rule.id) ?? 0
    const after = current.counts.get(rule.id) ?? 0
    if (after <= before) continue
    const strongerDecreased = NORMATIVE_RULES.some((candidate) => {
      if (candidate.rank <= rule.rank) return false
      const candidateBefore = baseline.counts.get(candidate.id) ?? 0
      const candidateAfter = current.counts.get(candidate.id) ?? 0
      return candidateAfter < candidateBefore
    })
    if (strongerDecreased) failures.push(`normative ${rule.id} increased from ${before} to ${after}`)
  }

  // In an untranslated fixture, a unique normative atom disappearing is a
  // semantic-loss regression.  During the documented Chinese-to-English
  // migration, skip this lexical check because wording changes invalidate the
  // sentence fingerprint even when the strength is preserved.
  const translationLikely = [...changedFiles].some((file) => {
    const before = baselineContents.get(file) ?? ''
    const after = currentContents.get(file) ?? ''
    return /[\p{Script=Han}]/u.test(before) && !/[\p{Script=Han}]/u.test(after)
  })
  if (!translationLikely) {
    const missingAtoms = [...baseline.atoms].filter((atom) => !current.atoms.has(atom))
    for (const atom of missingAtoms) {
      const separator = atom.indexOf('|')
      const id = atom.slice(0, separator)
      const before = baseline.counts.get(id) ?? 0
      const after = current.counts.get(id) ?? 0
      // Duplicate copies are represented by one set member and may be removed;
      // a missing unique atom is only actionable when its category decreased.
      if (after < before) {
        failures.push(`normative atom removed: ${formatEntity(atom.slice(separator + 1))}`)
      }
    }
  }
  return { failures, details }
}

const compareCompression = (current, baseline, changed) => {
  if (!baseline || !changed) return []
  const failures = []
  // Line and word counts are the stable readability measures. The token
  // estimate is intentionally heuristic and can rise when Chinese prose is
  // translated to English even as the document corpus becomes shorter.
  if (current.lines >= baseline.lines && current.words >= baseline.words) {
    failures.push('edited Markdown corpus did not achieve a net reduction in lines or words')
  }
  return failures
}

const changedPathSet = (current, baseline) => {
  const files = new Set([...current.keys(), ...baseline.keys()])
  return new Set(
    [...files].filter((file) => current.get(file) !== baseline.get(file)),
  )
}

const checkPreservedFiles = ({ root, current, baseline }) => {
  const failures = []
  const changed = []
  for (const file of baseline.keys()) {
    if (!isPreserved(file)) continue
    if (!current.has(file)) {
      failures.push(`preserved file removed: ${file}`)
      changed.push(file)
    } else if (current.get(file) !== baseline.get(file)) {
      failures.push(`preserved file changed: ${file}`)
      changed.push(file)
    }
  }
  // Keep root in the signature so callers can extend this to compare a
  // future generated-artifact digest without changing the public result.
  void root
  return { failures, changed }
}

const fileCategory = (file) =>
  file === DESIGN_FILE
    ? 'frozen'
    : file.startsWith('.changeset/')
      ? 'changesets'
      : file.startsWith('tests/fixtures/')
        ? 'fixtures'
        : file.startsWith('.agents/skills/')
          ? 'skills'
          : isPreserved(file)
            ? 'preserved'
            : 'editable'

const categoryCounts = (files) => {
  const result = new Map()
  for (const file of files) {
    const category = fileCategory(file)
    result.set(category, (result.get(category) ?? 0) + 1)
  }
  return Object.fromEntries(result)
}

const makeBaselineSource = ({ root, baseRef }) => {
  if (!baseRef) return null
  const allBaseFiles = treeFiles(root, baseRef)
  const markdown = allBaseFiles.filter(isMarkdown).sort()
  const allFiles = new Set(allBaseFiles)
  const contents = readAtRef(root, baseRef, markdown)
  return { files: markdown, allFiles, contents }
}

const parseOptions = (argv) => {
  const options = { root: process.cwd(), base: undefined, json: false, designSha: FROZEN_DESIGN_SHA256 }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--root' && argv[index + 1]) {
      options.root = path.resolve(argv[++index])
    } else if (argument === '--base' && argv[index + 1]) {
      options.base = argv[++index]
    } else if (argument === '--design-sha' && argv[index + 1]) {
      options.designSha = argv[++index]
    } else if (argument === '--json') {
      options.json = true
    } else if (argument === '--help' || argument === '-h') {
      options.help = true
    }
  }
  return options
}

export const runDocumentationCompressionCheck = (input = {}) => {
  const options = {
    root: path.resolve(input.root ?? process.cwd()),
    base: input.base,
    designSha: input.designSha ?? FROZEN_DESIGN_SHA256,
  }
  const failures = []
  const warnings = []
  const exceptions = []
  const corrections = []

  let files
  try {
    files = trackedFiles(options.root)
  } catch (error) {
    return {
      ok: false,
      failures: [error instanceof Error ? error.message : String(error)],
      warnings,
      exceptions,
      corrections,
      summary: null,
    }
  }
  const current = readCurrent(options.root, files)
  for (const file of files) {
    if (!current.has(file)) failures.push(`tracked Markdown file missing from working tree: ${file}`)
  }
  failures.push(...checkCodeFenceBalance({ files, contents: current }))
  const currentStats = addMeasures(current)
  const frozen = {
    file: DESIGN_FILE,
    expectedSha256: options.designSha,
    actualSha256: current.has(DESIGN_FILE) ? sha256(current.get(DESIGN_FILE)) : null,
  }
  if (!current.has(DESIGN_FILE)) {
    failures.push(`${DESIGN_FILE} missing (frozen document)`)
  } else if (frozen.actualSha256 !== frozen.expectedSha256) {
    failures.push(
      `${DESIGN_FILE} SHA-256 changed: expected ${frozen.expectedSha256}, got ${frozen.actualSha256}`,
    )
  }

  const baseRef = resolveGitRef(options.root, options.base)
  const baselineSource = makeBaselineSource({ root: options.root, baseRef })
  const baseline = baselineSource?.contents ?? new Map()
  const baselineStats = baselineSource ? addMeasures(baseline) : null
  const changedFiles = baselineSource ? changedPathSet(current, baseline) : new Set()
  const docsChanged = changedFiles.size > 0

  if (!baseRef) {
    warnings.push('No commit baseline was available; compression ratchet and protected-entity comparison were skipped.')
  }

  if (baselineSource) {
    const preserved = checkPreservedFiles({ root: options.root, current, baseline })
    failures.push(...preserved.failures)

    const baselineBroken = baselineBrokenLinks({
      files: baselineSource.files,
      root: options.root,
      contents: baseline,
      knownFiles: baselineSource.allFiles,
    })
    const links = analyseLinks({
      files,
      root: options.root,
      read: (file) => current.get(file) ?? '',
      knownFiles: new Set(files),
      designExceptions: true,
      fixtureExceptions: true,
      baselineBroken,
    })
    failures.push(...links.failures)
    exceptions.push(...links.exceptions)
  } else {
    const links = analyseLinks({
      files,
      root: options.root,
      read: (file) => current.get(file) ?? '',
      knownFiles: new Set(files),
      designExceptions: true,
      fixtureExceptions: false,
    })
    failures.push(...links.failures)
    exceptions.push(...links.exceptions)
  }

  const avalonia = checkAvaloniaHeadings({ root: options.root, files, contents: current })
  failures.push(...avalonia.failures)
  const overview = checkComponentOverview({ root: options.root, files, contents: current })
  failures.push(...overview.failures)

  const currentEntities = extractProtectedEntities(current)
  const baselineEntities = baselineSource
    ? extractProtectedEntities(baseline)
    : new Map()
  if (baselineSource) {
    const protectedResult = compareProtectedEntities({
      current: currentEntities,
      baseline: baselineEntities,
      changedFiles,
      root: options.root,
      currentContents: current,
    })
    failures.push(...protectedResult.failures)
    corrections.push(...protectedResult.corrections)
  }

  const currentNormative = collectNormative(current)
  const baselineNormative = baselineSource
    ? collectNormative(baseline)
    : { counts: new Map(), atoms: new Set() }
  if (baselineSource) {
    const normative = compareNormative(currentNormative, baselineNormative, {
      changedFiles,
      currentContents: current,
      baselineContents: baseline,
    })
    failures.push(...normative.failures)
    normative.details.atoms = {
      before: baselineNormative.atoms.size,
      after: currentNormative.atoms.size,
    }
  }

  failures.push(...compareCompression(currentStats, baselineStats, docsChanged))

  const entitySummary = Object.fromEntries(
    [...new Set([...currentEntities.keys(), ...baselineEntities.keys()])].map((kind) => [
      kind,
      {
        before: (baselineEntities.get(kind) ?? new Set()).size,
        after: (currentEntities.get(kind) ?? new Set()).size,
      },
    ]),
  )
  const normativeSummary = Object.fromEntries(
    NORMATIVE_RULES.map(({ id }) => [
      id,
      {
        before: baselineNormative.counts.get(id) ?? 0,
        after: currentNormative.counts.get(id) ?? 0,
      },
    ]),
  )
  const inventoryFiles = [
    ...new Set([...files, ...baseline.keys()]),
  ].sort()
  const fileStats = inventoryFiles.map((file) => ({
    file,
    category: fileCategory(file),
    changed: current.get(file) !== baseline.get(file),
    current: current.has(file) ? measure(current.get(file)) : null,
    baseline: baseline.has(file) ? measure(baseline.get(file)) : null,
  }))
  const fileAtomLedger = buildFileAtomLedger(
    inventoryFiles,
    current,
    baseline,
  )

  const summary = {
    inventory: {
      trackedMarkdown: files.length,
      trackedMarkdownCategories: categoryCounts(files),
      current: currentStats,
      baseline: baselineStats,
      changedFiles: changedFiles.size,
      baseRef,
      files: fileStats,
    },
    frozen,
    preserved: {
      trackedFiles: files.filter(isPreserved).length,
      frozenFiles: current.has(DESIGN_FILE) ? 1 : 0,
      baselineExceptions: exceptions.length,
    },
    links: {
      baselineExceptions: exceptions.length,
      exceptionDetails: exceptions.slice(0, MAX_FAILURE_DETAILS),
    },
    avalonia: {
      checked: avalonia.checked,
      requiredHeadings: REQUIRED_AVALONIA_HEADINGS,
    },
    componentsOverview: overview,
    protectedEntities: entitySummary,
    normativeStrength: normativeSummary,
    atomLedger: {
      normativeAtoms: {
        before: baselineNormative.atoms.size,
        after: currentNormative.atoms.size,
      },
      protectedEntityKinds: Object.keys(entitySummary).length,
      files: fileAtomLedger,
    },
    corrections,
  }

  return {
    ok: failures.length === 0,
    failures,
    warnings,
    exceptions,
    corrections,
    summary,
  }
}

const printHuman = (result) => {
  const { summary } = result
  if (!summary) {
    console.error('Documentation compression check failed.')
  } else {
    const inventory = summary.inventory
    console.log(
      `Documentation compression inventory: ${inventory.trackedMarkdown} tracked Markdown files, ${inventory.current.lines} lines, ${inventory.current.words} words, ${inventory.current.tokens} estimated tokens.`,
    )
    console.log(
      `Base: ${inventory.baseRef ?? 'none'}; changed Markdown files: ${inventory.changedFiles}.`,
    )
    console.log(
      `Preserved/frozen files: ${summary.preserved.trackedFiles} preserved, docs/design.md SHA ${summary.frozen.actualSha256 ?? 'missing'}.`,
    )
    console.log(
      `Links: ${summary.links.baselineExceptions} baseline exceptions; Avalonia pages checked: ${summary.avalonia.checked}; component overview entries checked: ${summary.componentsOverview.checked}.`,
    )
    console.log(
      `Protected entity kinds: ${summary.atomLedger.protectedEntityKinds}; normative atoms: ${summary.atomLedger.normativeAtoms.after}; corrections: ${summary.corrections.length}.`,
    )
  }

  if (result.warnings.length) {
    console.warn('Documentation compression warnings:')
    for (const warning of result.warnings) console.warn(`- ${warning}`)
  }
  if (result.exceptions.length) {
    console.warn('Allowed baseline link exceptions:')
    for (const exception of result.exceptions.slice(0, MAX_FAILURE_DETAILS)) {
      console.warn(`- ${exception.file} -> ${exception.target}: ${exception.reason}`)
    }
    if (result.exceptions.length > MAX_FAILURE_DETAILS) {
      console.warn(`- ... ${result.exceptions.length - MAX_FAILURE_DETAILS} more`)
    }
  }
  if (result.failures.length) {
    console.error('Documentation compression violations:')
    for (const failure of result.failures.slice(0, MAX_FAILURE_DETAILS)) console.error(`- ${failure}`)
    if (result.failures.length > MAX_FAILURE_DETAILS) {
      console.error(`- ... ${result.failures.length - MAX_FAILURE_DETAILS} more`)
    }
  } else {
    console.log('Documentation compression contract passed.')
  }
}

const main = () => {
  const options = parseOptions(process.argv.slice(2))
  if (options.help) {
    console.log(
      'Usage: node scripts/check-documentation-compression.mjs [--root DIR] [--base REF] [--design-sha SHA256] [--json]',
    )
    return
  }
  const result = runDocumentationCompressionCheck(options)
  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    printHuman(result)
  }
  if (!result.ok) process.exitCode = 1
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(SCRIPT_PATH).href
) {
  main()
}
