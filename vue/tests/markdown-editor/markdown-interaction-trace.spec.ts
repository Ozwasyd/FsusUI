import { expect, test } from '@playwright/test'
import {
  assertMarkdownInteractionTrace,
  createMarkdownInteractionTrace,
  evaluateMarkdownInteractionTraceMutations,
} from '../../packages/wasm/markdown-interaction-trace'

import type {
  MarkdownInteractionAction,
  MarkdownInteractionBrowser,
  MarkdownInteractionBrowserIdentity,
  MarkdownInteractionStep,
  MarkdownInteractionTrace,
} from '../../packages/wasm/markdown-interaction-trace'
import type { Browser, Locator, Page, TestInfo } from '@playwright/test'

interface FixtureState {
  runtimeMount: string
  eventNames: string[]
  input: {
    value: string
  }
  dialog: {
    open: boolean
  }
  markdown: {
    capability: {
      capability: string
      documentIdentity: { id: string; epoch: number }
      revision: number
    }
    documentIdentity: { id: string; epoch: number }
    history: {
      undoDepth: number
      redoDepth: number
    }
    lastOperation: {
      accepted: boolean
      history: { undoDepth: number; redoDepth: number }
      revision: number
      selection: { start: number; end: number; direction: string }
      transaction?: { origin: string }
      value: string
    } | null
    revision: number
    selection: { start: number; end: number; direction: string } | null
    value: string
  }
}

interface TraceBuilder {
  readonly artifact: string
  readonly baseline: string
  readonly browserIdentity: MarkdownInteractionBrowserIdentity
  readonly candidate: string
  readonly contract: string
  readonly runtimeComponent: string
  readonly scenario: string
  readonly steps: MarkdownInteractionStep[]
}

interface StepInput {
  readonly action: MarkdownInteractionAction
  readonly target: string
  readonly expected: unknown
  readonly perform: () => Promise<void>
  readonly actual: () => Promise<unknown>
  readonly matches: (actual: unknown) => boolean
}

const baseline =
  process.env.FSUS_INTERACTION_BASELINE ??
  '839c9ec396cc25f1d04970246badf8d5b9226b44'
const candidate = process.env.FSUS_INTERACTION_CANDIDATE ?? 'local-worktree'

const browserIdentityFor = (
  browser: Browser,
  testInfo: TestInfo,
): MarkdownInteractionBrowserIdentity => ({
  name: testInfo.project.name as MarkdownInteractionBrowser,
  project: testInfo.project.name,
  version: browser.version(),
})

const openFixture = async (page: Page) => {
  await page.goto('/?interactionTrace=1', { waitUntil: 'domcontentloaded' })
  const fixture = page.getByTestId('interaction-trace-fixture')
  await expect(fixture).toBeVisible()
  await expect
    .poll(async () => (await readState(page)).runtimeMount)
    .toBe('vue')
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  return fixture
}

const readState = async (page: Page): Promise<FixtureState> => {
  const value = await page.getByTestId('interaction-trace-state').textContent()
  return JSON.parse(value?.trim() || 'null') as FixtureState
}

const executeStep = async (builder: TraceBuilder, input: StepInput) => {
  let actual: unknown
  let actionError: unknown

  try {
    await input.perform()
    actual = await input.actual()
  } catch (error) {
    actionError = error
    actual = {
      error: error instanceof Error ? error.message : String(error),
    }
  }

  const passed = actionError === undefined && input.matches(actual)
  const step: MarkdownInteractionStep = {
    index: builder.steps.length,
    action: input.action,
    target: input.target,
    scenario: builder.scenario,
    contract: builder.contract,
    baseline: builder.baseline,
    candidate: builder.candidate,
    browserIdentity: builder.browserIdentity,
    expected: input.expected,
    actual,
    passed,
    artifact: builder.artifact,
  }
  builder.steps.push(step)

  if (!passed) {
    throw new Error(
      `Interaction trace failed at step ${step.index}, action ${step.action}, target ${step.target}; expected=${JSON.stringify(
        step.expected,
      )}; actual=${JSON.stringify(step.actual)}; artifact=${builder.artifact}`,
    )
  }
}

const buildTrace = (
  builder: TraceBuilder,
  markdown?: MarkdownInteractionTrace['markdown'],
) =>
  createMarkdownInteractionTrace({
    scenario: builder.scenario,
    contract: builder.contract,
    baseline: builder.baseline,
    browser: builder.browserIdentity.name,
    browserIdentity: builder.browserIdentity,
    candidate: builder.candidate,
    runtime: {
      component: builder.runtimeComponent,
      mount: 'vue',
      realBrowser: true,
    },
    steps: builder.steps,
    ...(markdown
      ? {
          nativeImeEvidence: {
            automated: false,
            issueRefs: ['#319', '#320'],
          },
          markdown,
        }
      : {}),
  })

const attachTrace = async (
  testInfo: TestInfo,
  builder: TraceBuilder,
  markdown?: MarkdownInteractionTrace['markdown'],
) => {
  const trace = buildTrace(builder, markdown)
  await testInfo.attach(builder.artifact, {
    body: Buffer.from(`${JSON.stringify(trace, null, 2)}\n`),
    contentType: 'application/json',
  })
  return trace
}

const activeTarget = (page: Page) =>
  page.evaluate(
    () =>
      (document.activeElement as HTMLElement | null)?.textContent?.trim() ??
      null,
  )

const dispatchNativeInput = async (
  textarea: Locator,
  value: string,
  inputType: 'insertFromDrop' | 'insertFromPaste',
) => {
  await textarea.evaluate(
    (element, payload) => {
      const target = element as HTMLTextAreaElement
      const start = target.selectionStart
      const end = target.selectionEnd
      const nextValue =
        target.value.slice(0, start) + payload.value + target.value.slice(end)
      const cursor = start + payload.value.length
      target.dispatchEvent(
        new InputEvent('beforeinput', {
          bubbles: true,
          data: payload.value,
          inputType: payload.inputType,
        }),
      )
      target.value = nextValue
      target.setSelectionRange(cursor, cursor, 'none')
      target.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: payload.value,
          inputType: payload.inputType,
        }),
      )
    },
    { inputType, value },
  )
}

test('mounts representative Vue components and traces real public interactions', async ({
  browser,
  page,
}, testInfo) => {
  const builder: TraceBuilder = {
    artifact: `representative-components-${testInfo.project.name}.interaction-trace.json`,
    baseline,
    browserIdentity: browserIdentityFor(browser, testInfo),
    candidate,
    contract: 'Contract V2 representative Web public interactions',
    runtimeComponent: 'ElButton, ElInput, ElDialog',
    scenario: 'scenario.v2.web.real-components',
    steps: [],
  }

  try {
    await openFixture(page)
    const button = page.getByRole('button', { name: 'Save draft' })

    await executeStep(builder, {
      action: 'focus',
      target: 'ElButton.primary',
      expected: { focusTarget: 'Save draft' },
      perform: () => button.focus(),
      actual: async () => ({ focusTarget: await activeTarget(page) }),
      matches: (actual) =>
        (actual as { focusTarget: string }).focusTarget === 'Save draft',
    })

    await executeStep(builder, {
      action: 'pointer',
      target: 'ElButton.primary',
      expected: { emittedEvents: ['button.click'], activations: 1 },
      perform: () => button.click(),
      actual: async () => {
        const state = await readState(page)
        return {
          emittedEvents: state.eventNames.filter(
            (name) => name === 'button.click',
          ),
          activations: state.eventNames.filter(
            (name) => name === 'button.click',
          ).length,
        }
      },
      matches: (actual) =>
        (actual as { activations: number }).activations === 1,
    })

    await executeStep(builder, {
      action: 'keyboard',
      target: 'ElButton.primary',
      expected: {
        key: 'Enter',
        emittedEvents: ['button.click'],
        activations: 2,
      },
      perform: () => button.press('Enter'),
      actual: async () => {
        const state = await readState(page)
        return {
          key: 'Enter',
          emittedEvents: state.eventNames.filter(
            (name) => name === 'button.click',
          ),
          activations: state.eventNames.filter(
            (name) => name === 'button.click',
          ).length,
        }
      },
      matches: (actual) =>
        (actual as { activations: number }).activations === 2,
    })

    const input = page.getByPlaceholder('Trace input')
    await executeStep(builder, {
      action: 'input',
      target: 'ElInput.modelValue',
      expected: {
        value: 'Trace input value',
        emittedEvents: ['input.input'],
      },
      perform: () => input.fill('Trace input value'),
      actual: async () => {
        const state = await readState(page)
        return {
          value: state.input.value,
          emittedEvents: state.eventNames.filter(
            (name) => name === 'input.input',
          ),
        }
      },
      matches: (actual) =>
        (actual as { value: string; emittedEvents: string[] }).value ===
          'Trace input value' &&
        (actual as { emittedEvents: string[] }).emittedEvents.length > 0,
    })

    await executeStep(builder, {
      action: 'open',
      target: 'ElDialog.modelValue',
      expected: {
        open: true,
        content: 'Real default slot content',
        emittedEvents: ['dialog.open'],
      },
      perform: async () => {
        await page.getByRole('button', { name: 'Open trace dialog' }).click()
        await expect(page.getByTestId('trace-dialog-content')).toBeVisible()
      },
      actual: async () => {
        const state = await readState(page)
        return {
          open: state.dialog.open,
          content: await page.getByTestId('trace-dialog-content').textContent(),
          emittedEvents: state.eventNames.filter((name) =>
            name.startsWith('dialog.open'),
          ),
        }
      },
      matches: (actual) =>
        (actual as { open: boolean; content: string }).open === true &&
        (actual as { content: string }).content === 'Real default slot content',
    })

    await executeStep(builder, {
      action: 'close',
      target: 'ElDialog.modelValue',
      expected: { open: false, emittedEvents: ['dialog.close'] },
      perform: async () => {
        await page.getByRole('button', { name: 'Close trace dialog' }).click()
        await expect(page.getByTestId('trace-dialog-content')).toBeHidden()
      },
      actual: async () => {
        const state = await readState(page)
        return {
          open: state.dialog.open,
          emittedEvents: state.eventNames.filter((name) =>
            name.startsWith('dialog.close'),
          ),
        }
      },
      matches: (actual) => (actual as { open: boolean }).open === false,
    })

    const trace = await attachTrace(testInfo, builder)
    expect(() => assertMarkdownInteractionTrace(trace)).not.toThrow()
  } catch (error) {
    await attachTrace(testInfo, builder)
    throw error
  }
})

test('traces MarkdownEditor input, paste, drop, exposed methods, and public state', async ({
  browser,
  page,
}, testInfo) => {
  const builder: TraceBuilder = {
    artifact: `markdown-editor-${testInfo.project.name}.interaction-trace.json`,
    baseline,
    browserIdentity: browserIdentityFor(browser, testInfo),
    candidate,
    contract: 'ElMarkdownEditor Contract V2 semantic interaction',
    runtimeComponent: 'ElMarkdownEditor',
    scenario: 'scenario.v2.el-markdown-editor.real-interaction-trace',
    steps: [],
  }
  let markdownEvidence: MarkdownInteractionTrace['markdown']

  try {
    const fixture = await openFixture(page)
    const editor = fixture.getByTestId('trace-markdown-editor')
    const textarea = editor.locator('textarea')

    await executeStep(builder, {
      action: 'focus',
      target: 'ElMarkdownEditor.source',
      expected: {
        focusTarget: 'textarea',
        selection: { start: 0, end: 5, direction: 'backward' },
      },
      perform: async () => {
        await textarea.focus()
        await textarea.evaluate((element) => {
          const target = element as HTMLTextAreaElement
          target.setSelectionRange(0, 5, 'backward')
          target.dispatchEvent(new Event('select', { bubbles: true }))
        })
      },
      actual: async () =>
        textarea.evaluate((element) => {
          const target = element as HTMLTextAreaElement
          return {
            focusTarget:
              document.activeElement === target ? 'textarea' : 'other',
            selection: {
              start: target.selectionStart,
              end: target.selectionEnd,
              direction: target.selectionDirection,
            },
          }
        }),
      matches: (actual) =>
        JSON.stringify(actual) ===
        JSON.stringify({
          focusTarget: 'textarea',
          selection: { start: 0, end: 5, direction: 'backward' },
        }),
    })

    await executeStep(builder, {
      action: 'keyboard',
      target: 'ElMarkdownEditor.source',
      expected: { key: 'End', selectionAtEnd: true },
      perform: () => textarea.press('End'),
      actual: async () =>
        textarea.evaluate((element) => {
          const target = element as HTMLTextAreaElement
          return {
            key: 'End',
            selectionAtEnd:
              target.selectionStart === target.value.length &&
              target.selectionEnd === target.value.length,
          }
        }),
      matches: (actual) =>
        (actual as { selectionAtEnd: boolean }).selectionAtEnd,
    })

    await executeStep(builder, {
      action: 'input',
      target: 'ElMarkdownEditor.modelValue',
      expected: {
        value: 'Trace body',
        emittedEvents: [
          'markdown.update:modelValue',
          'markdown.change',
          'markdown.transaction',
        ],
        revisionAtLeast: 1,
      },
      perform: () => textarea.fill('Trace body'),
      actual: async () => {
        const state = await readState(page)
        return {
          value: state.markdown.value,
          emittedEvents: state.eventNames.filter((name) =>
            name.startsWith('markdown.'),
          ),
          revision: state.markdown.revision,
        }
      },
      matches: (actual) => {
        const result = actual as {
          value: string
          emittedEvents: string[]
          revision: number
        }
        return (
          result.value === 'Trace body' &&
          result.revision >= 1 &&
          result.emittedEvents.includes('markdown.update:modelValue') &&
          result.emittedEvents.includes('markdown.transaction')
        )
      },
    })

    await executeStep(builder, {
      action: 'paste',
      target: 'ElMarkdownEditor.clipboard',
      expected: {
        valueSuffix: ' pasted',
        operationResult: { origin: 'paste' },
      },
      perform: () =>
        dispatchNativeInput(textarea, ' pasted', 'insertFromPaste'),
      actual: async () => {
        const state = await readState(page)
        return {
          valueSuffix: state.markdown.value.endsWith(' pasted'),
          operationResult: {
            accepted: state.markdown.lastOperation?.accepted,
            origin: state.markdown.lastOperation?.transaction?.origin,
          },
        }
      },
      matches: (actual) => {
        const result = actual as {
          valueSuffix: boolean
          operationResult: { accepted: boolean; origin: string }
        }
        return (
          result.valueSuffix &&
          result.operationResult.accepted &&
          result.operationResult.origin === 'paste'
        )
      },
    })

    await executeStep(builder, {
      action: 'drop',
      target: 'ElMarkdownEditor.clipboard',
      expected: {
        valueSuffix: ' dropped',
        operationResult: { origin: 'drop' },
      },
      perform: () =>
        dispatchNativeInput(textarea, ' dropped', 'insertFromDrop'),
      actual: async () => {
        const state = await readState(page)
        return {
          valueSuffix: state.markdown.value.endsWith(' dropped'),
          operationResult: {
            accepted: state.markdown.lastOperation?.accepted,
            origin: state.markdown.lastOperation?.transaction?.origin,
          },
        }
      },
      matches: (actual) => {
        const result = actual as {
          valueSuffix: boolean
          operationResult: { accepted: boolean; origin: string }
        }
        return (
          result.valueSuffix &&
          result.operationResult.accepted &&
          result.operationResult.origin === 'drop'
        )
      },
    })

    await executeStep(builder, {
      action: 'pointer',
      target: 'ElMarkdownEditor.toolbar.bold',
      expected: {
        wrappedSelection: '**Trace**',
        emittedEvents: ['markdown.command'],
      },
      perform: async () => {
        await textarea.evaluate((element) => {
          const target = element as HTMLTextAreaElement
          target.setSelectionRange(0, 5, 'forward')
        })
        await editor.locator('.el-markdown-editor__command').first().click()
      },
      actual: async () => {
        const state = await readState(page)
        return {
          wrappedSelection: state.markdown.value.slice(0, 9),
          emittedEvents: state.eventNames.filter(
            (name) => name === 'markdown.command',
          ),
        }
      },
      matches: (actual) =>
        (actual as { wrappedSelection: string }).wrappedSelection ===
          '**Trace**' &&
        (actual as { emittedEvents: string[] }).emittedEvents.length > 0,
    })

    await executeStep(builder, {
      action: 'exposed',
      target: 'ElMarkdownEditor.dispatchTransaction',
      expected: {
        operationResult: { accepted: true },
        valueSuffix: ' exposed',
        emittedEvents: ['markdown.exposed.dispatchTransaction'],
      },
      perform: () => page.getByTestId('trace-markdown-exposed').click(),
      actual: async () => {
        const state = await readState(page)
        return {
          operationResult: {
            accepted: state.markdown.lastOperation?.accepted,
            revision: state.markdown.lastOperation?.revision,
          },
          valueSuffix: state.markdown.value.endsWith(' exposed'),
          emittedEvents: state.eventNames.filter(
            (name) => name === 'markdown.exposed.dispatchTransaction',
          ),
        }
      },
      matches: (actual) => {
        const result = actual as {
          operationResult: { accepted: boolean }
          valueSuffix: boolean
          emittedEvents: string[]
        }
        return (
          result.operationResult.accepted &&
          result.valueSuffix &&
          result.emittedEvents.length === 1
        )
      },
    })

    await executeStep(builder, {
      action: 'exposed',
      target: 'ElMarkdownEditor.undo',
      expected: {
        operationResult: { accepted: true },
        history: { redoDepthAtLeast: 1 },
        emittedEvents: ['markdown.exposed.undo'],
      },
      perform: () => page.getByTestId('trace-markdown-undo').click(),
      actual: async () => {
        const state = await readState(page)
        return {
          operationResult: {
            accepted: state.markdown.lastOperation?.accepted,
            revision: state.markdown.lastOperation?.revision,
          },
          history: state.markdown.history,
          emittedEvents: state.eventNames.filter(
            (name) => name === 'markdown.exposed.undo',
          ),
        }
      },
      matches: (actual) => {
        const result = actual as {
          operationResult: { accepted: boolean }
          history: { redoDepth: number }
          emittedEvents: string[]
        }
        return (
          result.operationResult.accepted &&
          result.history.redoDepth >= 1 &&
          result.emittedEvents.length === 1
        )
      },
    })

    const state = await readState(page)
    const selection = await textarea.evaluate((element) => {
      const target = element as HTMLTextAreaElement
      return {
        direction: target.selectionDirection,
        end: target.selectionEnd,
        start: target.selectionStart,
      }
    })
    markdownEvidence = {
      direction: selection.direction,
      revision: state.markdown.revision,
      history: {
        undoDepth: state.markdown.history.undoDepth,
        redoDepth: state.markdown.history.redoDepth,
      },
      documentIdentity: state.markdown.documentIdentity,
      capability: state.markdown.capability.capability,
    }

    const trace = await attachTrace(testInfo, builder, markdownEvidence)
    expect(() => assertMarkdownInteractionTrace(trace)).not.toThrow()

    const noOpState = await readState(page)
    const noOpBuilder: TraceBuilder = {
      ...builder,
      artifact: `markdown-editor-no-op-${testInfo.project.name}.interaction-trace.json`,
      scenario: 'scenario.v2.el-markdown-editor.mutation.no-op-action',
      steps: [],
    }
    let noOpFailure = ''
    try {
      await executeStep(noOpBuilder, {
        action: 'exposed',
        target: 'ElMarkdownEditor.dispatchTransaction',
        expected: {
          revision: noOpState.markdown.revision + 1,
          emittedEvents: ['markdown.exposed.dispatchTransaction'],
        },
        perform: async () => {},
        actual: async () => {
          const stateAfterNoOp = await readState(page)
          return {
            revision: stateAfterNoOp.markdown.revision,
            emittedEvents: [],
          }
        },
        matches: (actual) =>
          (actual as { revision: number }).revision ===
          noOpState.markdown.revision + 1,
      })
    } catch (error) {
      noOpFailure = error instanceof Error ? error.message : String(error)
    }
    expect(noOpFailure).toContain(
      `Interaction trace failed at step 0, action exposed, target ElMarkdownEditor.dispatchTransaction`,
    )
    expect(noOpFailure).toContain(`expected=`)
    expect(noOpFailure).toContain(`actual=`)
    expect(noOpFailure).toContain(`artifact=${noOpBuilder.artifact}`)
    const noOpTrace = await attachTrace(testInfo, noOpBuilder, markdownEvidence)

    const mutationReport = evaluateMarkdownInteractionTraceMutations(trace)
    expect(mutationReport.mutations.map((mutation) => mutation.kind)).toEqual([
      'no-op-action',
      'uncaptured-event',
      'mock-only',
      'metadata-only',
    ])
    expect(
      mutationReport.mutations.every(
        (mutation) => mutation.accepted === false && mutation.issues.length > 0,
      ),
    ).toBe(true)
    await testInfo.attach(
      `markdown-editor-${testInfo.project.name}.mutation-report.json`,
      {
        body: Buffer.from(
          `${JSON.stringify(
            {
              schema: 'fsusui.interaction-mutations.v1',
              sourceArtifact: builder.artifact,
              noOpArtifact: noOpBuilder.artifact,
              noOpFailure,
              noOpTrace,
              mutations: mutationReport.mutations,
            },
            null,
            2,
          )}\n`,
        ),
        contentType: 'application/json',
      },
    )
  } catch (error) {
    await attachTrace(testInfo, builder, markdownEvidence)
    throw error
  }
})
