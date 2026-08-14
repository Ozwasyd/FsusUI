import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const editorRoot = resolve(__dirname, '..')

function readEditorSource(file: string) {
  return readFileSync(resolve(editorRoot, 'src', file), 'utf8')
}

describe('Markdown editor command contract', () => {
  // #268 is a tracking parent: automated source checks may protect the
  // transaction contract, but cannot substitute for a real native-IME matrix.
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
