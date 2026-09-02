import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const editorRoot = resolve(__dirname, '..')

function readEditorSource(file: string) {
  return readFileSync(resolve(editorRoot, 'src', file), 'utf8')
}

/**
 * Every source that defines or consumes the unified command registry. Issue
 * #432 forbids the legacy apply path, command-local parsing/DOM, private editor
 * access, and label-driven dispatch across all of them, not just the model file.
 */
const commandSources = [
  'markdown-editor.ts',
  'markdown-editor-anchor-commands.ts',
  'markdown-editor-command-async.ts',
  'markdown-editor-command-snapshot.ts',
  'markdown-editor-selection-toolbar.ts',
  'markdown-editor-surfaces.ts',
] as const

const mutationFixtureMarker = /^export const evaluateMarkdown\w*Mutations\b/gmu

/**
 * Mutation fixtures deliberately contain the forbidden pattern they kill, so
 * only the production region of a source is scanned.
 */
function stripMutationFixtures(source: string) {
  let stripped = source
  let marker = mutationFixtureMarker.exec(stripped)
  while (marker) {
    const start = marker.index
    const bodyStart = stripped.indexOf('{', start)
    if (bodyStart === -1) break
    let depth = 0
    let end = bodyStart
    for (; end < stripped.length; end += 1) {
      if (stripped[end] === '{') depth += 1
      else if (stripped[end] === '}') {
        depth -= 1
        if (depth === 0) break
      }
    }
    stripped = stripped.slice(0, start) + stripped.slice(end + 1)
    mutationFixtureMarker.lastIndex = start
    marker = mutationFixtureMarker.exec(stripped)
  }
  mutationFixtureMarker.lastIndex = 0
  return stripped
}

const forbiddenCommandSourcePatterns = [
  { rule: 'old-apply', pattern: /\bapplyMarkdownEditorCommand\b/u },
  { rule: 'old-apply', pattern: /\bapply\s*\(\s*value\s*,\s*selection\s*\)/u },
  { rule: 'old-apply', pattern: /^\s*apply\s*:\s*\(/mu },
  {
    rule: 'command-local-parser',
    pattern: /\.(?:exec|match|test)\(\s*(?:candidate|context)\.value/u,
  },
  { rule: 'command-local-parser', pattern: /\bnew\s+RegExp\s*\(/u },
  { rule: 'command-local-dom', pattern: /\bquerySelector(?:All)?\s*\(/u },
  { rule: 'command-local-dom', pattern: /\binnerHTML\b/u },
  {
    rule: 'command-local-dom',
    pattern: /\bdocument\s*\.\s*(?:body|createElement|getElementById|querySelector)/u,
  },
  {
    rule: 'private-editor-access',
    pattern: /\b(?:editorRef|textarea|textareaRef)\s*\.\s*value\b/u,
  },
  {
    rule: 'private-editor-access',
    pattern:
      /(?:\bfrom\b|\brequire\s*\()\s*['"][^'"]*\b(?:codemirror|monaco|prosemirror)\b/iu,
  },
  {
    rule: 'private-editor-access',
    pattern: /\b(?:codemirror|monaco|prosemirror)\s*[.(]/iu,
  },
  { rule: 'label-dispatch', pattern: /\.label\s*===/u },
  {
    rule: 'label-dispatch',
    pattern: /\.label\s*\.\s*(?:includes|indexOf|startsWith|toLowerCase)\s*\(/u,
  },
] as const

describe('Markdown editor command contract', () => {
  // #268 is a tracking parent: automated source checks may protect the
  // transaction contract, but cannot substitute for a real native-IME matrix.
  it('forbids old apply, command-local parser/DOM, private editor access, and label dispatch in every command source', () => {
    const violations: string[] = []
    for (const file of commandSources) {
      const source = stripMutationFixtures(readEditorSource(file))
      for (const { pattern, rule } of forbiddenCommandSourcePatterns) {
        const match = pattern.exec(source)
        if (match) violations.push(`${file} ${rule} ${match[0]}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('keeps the command source scan meaningful by detecting the fixtures it excludes', () => {
    const detectedInRawSource = (file: string, rule: string) =>
      forbiddenCommandSourcePatterns
        .filter((candidate) => candidate.rule === rule)
        .some((candidate) =>
          candidate.pattern.test(readEditorSource(file)),
        )

    expect(detectedInRawSource('markdown-editor-command-snapshot.ts', 'old-apply')).toBe(
      true,
    )
    expect(
      detectedInRawSource(
        'markdown-editor-command-snapshot.ts',
        'command-local-parser',
      ),
    ).toBe(true)
    expect(detectedInRawSource('markdown-editor.ts', 'label-dispatch')).toBe(true)
    for (const file of commandSources) {
      expect(stripMutationFixtures(readEditorSource(file)).length).toBeLessThanOrEqual(
        readEditorSource(file).length,
      )
    }
  })

  it('detects a representative violation for every forbidden command source rule', () => {
    const violatingSnippets: Readonly<Record<string, string>> = Object.freeze({
      'command-local-dom':
        'document.body.querySelector("textarea").innerHTML = value',
      'command-local-parser':
        'const when = (context) => /x/u.test(context.value) && new RegExp("y").test(candidate.value)',
      'label-dispatch':
        'if (command.label === "bold") run()\ncommand.label.toLowerCase().includes("bold")',
      'old-apply':
        'export const applyMarkdownEditorCommand = (value, selection) => apply(value, selection)\nconst legacy = {\n  apply: (context) => ({}),\n}',
      'private-editor-access':
        'import { EditorView } from "codemirror"\ntextareaRef.value = monaco.editor.getModel()',
    })

    const rules = [
      ...new Set(forbiddenCommandSourcePatterns.map((candidate) => candidate.rule)),
    ].sort()
    expect(rules).toEqual(Object.keys(violatingSnippets).sort())

    for (const [rule, snippet] of Object.entries(violatingSnippets)) {
      const patterns = forbiddenCommandSourcePatterns.filter(
        (candidate) => candidate.rule === rule,
      )
      expect(patterns.some((candidate) => candidate.pattern.test(snippet)), rule).toBe(
        true,
      )
    }
  })

  it('exposes a single public command model without a legacy apply execution path', () => {
    const source = readEditorSource('markdown-editor.ts')

    expect(source).toMatch(/MarkdownEditorCommandContext/)
    expect(source).toMatch(/MarkdownEditorCommandResult/)
    expect(source).toMatch(/\brun\s*:/)
    expect(source).not.toMatch(/\bapply\s*\(\s*value\s*,\s*selection\s*\)/)
    expect(source).not.toMatch(/applyMarkdownEditorCommand/)
  })

  it('keeps command context on stable editor projections and transactions', () => {
    const source = readEditorSource('markdown-editor.ts')

    expect(source).toMatch(/documentIdentity/)
    expect(source).toMatch(/revision/)
    expect(source).toMatch(/selection/)
    expect(source).toMatch(/mode/)
    expect(source).toMatch(/syntax/)
    expect(source).toMatch(/dispatch/)
    expect(source).toMatch(/signal/)
    expect(source).not.toMatch(/querySelector|textarea\.value|\.innerHTML/)
  })

  it('declares presentation and availability separately for shared command surfaces', () => {
    const source = readEditorSource('markdown-editor.ts')

    expect(source).toMatch(/presentation/)
    expect(source).toMatch(/\bwhen\s*:/)
    expect(source).toMatch(/\benabled\s*:/)
    expect(source).toMatch(/shortcut/)
    expect(source).toMatch(/group/)
  })

  it('models async lifecycle outcomes without committing stale selections', () => {
    const source = `${readEditorSource('markdown-editor.ts')}\n${readEditorSource('markdown-editor-transaction.ts')}`

    expect(source).toMatch(/pending/)
    expect(source).toMatch(/aborted/)
    expect(source).toMatch(/stale/)
    expect(source).toMatch(/positionMap|rebase/)
    expect(source).not.toMatch(/selection(?:Start|End)?\s*[=:].*\+\s*\w*(?:delta|change)/)
  })

  it('requires command lifecycle ownership instead of creating a controller for each invocation', () => {
    const component = readFileSync(resolve(editorRoot, 'src', 'markdown-editor.vue'), 'utf8')

    expect(component).toMatch(/pending.*command|command.*pending/is)
    expect(component).toMatch(/abort\(/)
    expect(component).not.toMatch(/const controller = new AbortController\(\)/)
  })

  it('keeps the command source shared by every command surface', () => {
    const component = readFileSync(resolve(editorRoot, 'src', 'markdown-editor.vue'), 'utf8')

    expect(component).toMatch(/isMarkdownEditorCommandVisible/)
    expect(component).toMatch(/isMarkdownEditorCommandEnabled/)
    expect(component).not.toMatch(/props\.commands\.slice\(0, 6\)/)
  })

  it('does not present simulated composition coverage as native IME acceptance', () => {
    const interactionTests = readFileSync(
      resolve(editorRoot, '__tests__', 'markdown-editor.test.tsx'),
      'utf8',
    )

    expect(interactionTests).not.toMatch(/native[- ]IME.*(?:passed|accepted)/i)
  })
})
