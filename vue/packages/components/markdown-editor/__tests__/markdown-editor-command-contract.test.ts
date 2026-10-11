import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { commandLifecycleViolations } from './markdown-editor-command-lifecycle-guard'

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

    expect(commandLifecycleViolations(component)).toEqual([])
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

// Exact historical per-invocation owner before3179ca0d, from80c1a14f9ab911b81af64e2fd77d30216c25c50b.
const historicalPerInvocationRun = `const runCommand = async (command: MarkdownEditorCommand) => {
  if (editingBlocked.value || nativeMachine.freezeSmartInput) return
  if (pendingCommandKeys.value.has(command.key)) return

  const selection = captureSelection()
  const commandController = new AbortController()
  commandControllers.set(command.key, commandController)
  pendingCommandKeys.value = new Set(pendingCommandKeys.value).add(command.key)
  const revision = transactionStore.revision
  const value = transactionStore.value
  try {
    const context = {
      dispatch: { dispatch: dispatchTransaction },
      documentIdentity,
      mode: currentMode.value,
      readonly: editingBlocked.value,
      revision,
      selection,
      signal: commandController.signal,
      value,
    }
    if (!isMarkdownEditorCommandVisible(command, context) || !isMarkdownEditorCommandEnabled(command, context)) return
    const result = await runMarkdownEditorCommand(command, context)
    if (commandController.signal.aborted || commandControllers.get(command.key) !== commandController) return
    if (!result?.transaction) return
    const dispatchResult = dispatchTransaction({
      ...result.transaction,
      expectedRevision: revision,
      history: result.transaction.history ?? 'separate',
      metadata: Object.freeze({ command: command.key }),
      origin: 'command',
    })
    if (dispatchResult.accepted) emit('command', command)
  } finally {
    if (commandControllers.get(command.key) === commandController) {
      commandControllers.delete(command.key)
      const pending = new Set(pendingCommandKeys.value)
      pending.delete(command.key)
      pendingCommandKeys.value = pending
    }
  }
}

`

describe('Markdown editor command lifecycle source guard controls', () => {
  const component = readFileSync(
    resolve(editorRoot, 'src', 'markdown-editor.vue'),
    'utf8',
  )
  const replace = (from: string, to: string) => {
    expect(component.includes(from), from).toBe(true)
    const changed = component.replace(from, to)
    expect(changed).not.toBe(component)
    return changed
  }
  const historical = () => {
    const start = component.indexOf('const runCommand = async (')
    const end = component.indexOf('const runAction = (', start)
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(start)
    return (
      component.slice(0, start) +
      historicalPerInvocationRun +
      component.slice(end)
    )
  }

  it.each(['original', 'renamed-and-reformatted', 'comment-decoy'] as const)(
    'rejects the historical per-invocation command owner: %s',
    (kind) => {
      let source = historical()
      if (kind === 'renamed-and-reformatted')
        source = source
          .replaceAll('commandController', 'otherCancellationOwner')
          .replaceAll('new AbortController()', 'new   AbortController ( )')
      if (kind === 'comment-decoy') {
        const start = component.indexOf('const runCommand = async (')
        const end = component.indexOf('const runAction = (', start)
        source = source.replace(
          '</script>',
          `/* ${component.slice(start, end)} */\n</script>`,
        )
      }
      const violations = commandLifecycleViolations(source)
      expect(violations).toContain('command-local-controller')
      expect(violations).toContain('real-session-factory')
    },
  )

  it.each([
    [
      'a command-local controller regardless of its name',
      'const session = createMarkdownEditorCommandSession(',
      'const differentlyNamedOwner = new   AbortController ( )\n  const session = createMarkdownEditorCommandSession(',
      'command-local-controller',
    ],
    [
      'an aliased command-local controller constructor',
      'const activeSession = commandSessions.get(command.key)',
      'const CancellationOwner = AbortController\n  const hiddenOwner = new CancellationOwner()\n  const activeSession = commandSessions.get(command.key)',
      'command-local-controller',
    ],
    [
      'a foreign signal',
      'signal: session.abort.signal,',
      'signal: commandContextSignal,',
      'original-session-signal',
    ],
    [
      'a fabricated factory call',
      'const session = createMarkdownEditorCommandSession(',
      'const session = fabricatedSessionFactory(',
      'real-session-factory',
    ],
    [
      'a factory imported from a different module',
      "from './markdown-editor-command-async'",
      "from './fake-command-async'",
      'real-session-factory',
    ],
    [
      'a shadowed factory with the right name',
      'const session = createMarkdownEditorCommandSession(',
      'const createMarkdownEditorCommandSession = (...args: unknown[]) => ({ abort: { signal: commandContextSignal } })\n  const session = createMarkdownEditorCommandSession(',
      'real-session-factory',
    ],
    [
      'a private registry passed to the factory',
      'activeSessions: commandSessions,',
      'activeSessions: new Map(),',
      'shared-session-registry',
    ],
    [
      'a shadowed shared registry',
      'const activeSession = commandSessions.get(command.key)',
      'const commandSessions = new Map()\n  const activeSession = commandSessions.get(command.key)',
      'shared-session-registry',
    ],
    [
      'missing shared registration',
      'commandSessions.set(command.key, session)',
      'void session',
      'register-original-session',
    ],
    [
      'registration of a session clone',
      'commandSessions.set(command.key, session)',
      'commandSessions.set(command.key, { ...session })',
      'register-original-session',
    ],
    [
      'registration under a different key',
      'commandSessions.set(command.key, session)',
      "commandSessions.set('foreign', session)",
      'register-original-session',
    ],
    [
      'missing pending publication',
      "commandRuntimeStates.value.set(command.key, { state: 'pending' })",
      'void command.key',
      'publish-pending-session',
    ],
    [
      'missing post-await ownership check',
      'if (commandSessions.get(command.key) !== session) return',
      '',
      'post-await-original-session',
    ],
    [
      'checking ownership before await only',
      'const result = await runMarkdownEditorCommand(command, context)\n    if (commandSessions.get(command.key) !== session) return',
      'if (commandSessions.get(command.key) !== session) return\n    const result = await runMarkdownEditorCommand(command, context)',
      'post-await-original-session',
    ],
    [
      'a copied session in the post-await check',
      'if (commandSessions.get(command.key) !== session) return',
      'if (commandSessions.get(command.key) !== { ...session }) return',
      'post-await-original-session',
    ],
    [
      'post-await lookup under a different key',
      'if (commandSessions.get(command.key) !== session) return',
      "if (commandSessions.get('foreign') !== session) return",
      'post-await-original-session',
    ],
    [
      'a different executor',
      'await runMarkdownEditorCommand(command, context)',
      'await fabricatedExecutor(command, context)',
      'await-real-command',
    ],
    [
      'a different rebase helper',
      'const rebasedState = rebaseMarkdownEditorCommandSession(',
      'const rebasedState = fabricatedRebase(',
      'rebase-original-session',
    ],
    [
      'rebasing a session copy',
      'session,\n      currentContext,\n      positionMap,',
      '{ ...session },\n      currentContext,\n      positionMap,',
      'rebase-original-session',
    ],
    [
      'an unrelated revision map',
      'session.revision,\n      currentContext.revision,',
      '0,\n      currentContext.revision,',
      'rebase-original-session',
    ],
    [
      'resolving a session copy',
      "session,\n      currentContext,\n      'resolved-current',",
      "{ ...session },\n      currentContext,\n      'resolved-current',",
      'resolve-original-session',
    ],
    [
      'missing rebase outcome guard',
      "if (rebasedState !== 'pending') {",
      'if (false) {',
      'guard-current-commit',
    ],
    [
      'missing resolution outcome guard',
      "if (resolvedState !== 'resolved-current') return",
      '',
      'guard-current-commit',
    ],
    [
      'dispatch before current-session resolution',
      'const result = await runMarkdownEditorCommand(command, context)',
      "dispatchTransaction({ changes: [], history: 'skip', origin: 'command' })\n    const result = await runMarkdownEditorCommand(command, context)",
      'guard-current-commit',
    ],
    [
      'a copied session in finally',
      'if (commandSessions.get(command.key) === session) {',
      'if (commandSessions.get(command.key) === { ...session }) {',
      'retire-original-session',
    ],
    [
      'missing session retirement',
      'commandSessions.delete(command.key)',
      'void command.key',
      'retire-original-session',
    ],
    [
      'a shadowed cancellation helper',
      'const abortPendingCommands = () => {',
      'const abortPendingCommands = () => {\n  const abortMarkdownEditorCommandSessions = () => undefined',
      'abort-shared-sessions',
    ],
    [
      'a private cancellation registry',
      'const abortPendingCommands = () => {',
      'const abortPendingCommands = () => {\n  const commandSessions = new Map()',
      'abort-shared-sessions',
    ],
    [
      'a shadowed model-reset canceller',
      '    abortPendingCommands()\n    // Document switch:',
      '    const abortPendingCommands = () => undefined\n    abortPendingCommands()\n    // Document switch:',
      'cancel-model-reset',
    ],
    [
      'missing imported cancellation',
      "abortMarkdownEditorCommandSessions(commandSessions.values(), 'editor-reset')",
      'void commandSessions.values()',
      'abort-shared-sessions',
    ],
    [
      'cancellation of another registry',
      "abortMarkdownEditorCommandSessions(commandSessions.values(), 'editor-reset')",
      "abortMarkdownEditorCommandSessions(new Map().values(), 'editor-reset')",
      'abort-shared-sessions',
    ],
    [
      'missing registry cleanup',
      'commandSessions.clear()',
      'void commandSessions',
      'abort-shared-sessions',
    ],
    [
      'missing original controller abort',
      "session.abort.abort('editor-reset')",
      'void session',
      'abort-original-controllers',
    ],
    [
      'missing model-reset cancellation',
      '    abortPendingCommands()\n    // Document switch:',
      '    // Document switch:',
      'cancel-model-reset',
    ],
    [
      'missing document-reset cancellation',
      'const previousHistory = transactionStore.history\n    abortPendingCommands()',
      'const previousHistory = transactionStore.history',
      'cancel-document-reset',
    ],
    [
      'missing unmount cancellation',
      'languageToolsController = null\n  abortPendingCommands()',
      'languageToolsController = null',
      'cancel-unmount',
    ],
  ] as const)('rejects %s', (_name, from, to, rule) => {
    expect(commandLifecycleViolations(replace(from, to))).toContain(rule)
  })

  it('accepts legitimate local binding renames and formatting', () => {
    const renamed = component
      .replaceAll('commandSessions', 'ownedAttempts')
      .replace(/\bsession\b/gu, 'attempt')
      .replaceAll('attempt.abort.signal', 'attempt . abort . signal')
    expect(renamed).toContain('attempt . abort . signal')
    expect(commandLifecycleViolations(renamed)).toEqual([])
  })

  it('accepts the actual imported factory through its local import alias', () => {
    const aliased = component
      .replace(
        '  createMarkdownEditorCommandSession,',
        '  createMarkdownEditorCommandSession as createOwnedSession,',
      )
      .replace(
        'const session = createMarkdownEditorCommandSession(',
        'const session = createOwnedSession(',
      )
    expect(aliased).not.toBe(component)
    expect(commandLifecycleViolations(aliased)).toEqual([])
  })

  it('allows the independent native attachment controller boundary unchanged', () => {
    expect(component).toContain('const controller = new AbortController()')
    expect(component).toContain(
      'const fileControllers = files.map(() => new AbortController())',
    )
    expect(commandLifecycleViolations(component)).toEqual([])
    const extended = component.replace(
      '<script lang="ts" setup>',
      '<script lang="ts" setup>\nconst unrelatedOwner = new AbortController()',
    )
    expect(commandLifecycleViolations(extended)).toEqual([])
  })
})
