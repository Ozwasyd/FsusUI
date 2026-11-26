import { computed, nextTick, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { MarkdownEditorFrameScheduler } from '@element-plus/hooks'
import type {
  MarkdownAnchorMap,
  MarkdownDocumentIdentity,
  MarkdownStableProjection,
} from '../../../../wasm/markdown-runtime'
import {
  isMarkdownEditorCommandEnabled,
  isMarkdownEditorCommandVisible,
  resolveMarkdownEditorCommandCopy,
  resolveMarkdownEditorOverflowCommands,
  resolveMarkdownEditorPrimaryCommands,
  resolveMarkdownEditorSyntaxContext,
  runMarkdownEditorCommand,
  type MarkdownEditorActionItem,
  type MarkdownEditorActionKey,
  type MarkdownEditorCommand,
  type MarkdownEditorLocaleText,
  type MarkdownEditorMode,
  type MarkdownEditorProps,
  type MarkdownEditorToolbarDensity,
} from '../markdown-editor'
import {
  createMarkdownEditorCommandSnapshot,
  selectMarkdownEditorCommandSnapshot,
  type MarkdownEditorCommandSnapshotItem,
} from '../markdown-editor-command-snapshot'
import { resolveMarkdownSelectionToolbarPlacement } from '../markdown-editor-selection-toolbar'
import { planMarkdownSlashCommit } from '../markdown-editor-surfaces'
import { resolveMarkdownEditorFittingCommandCount } from '../markdown-editor-toolbar-overflow'
import {
  createMarkdownEditorPositionMap,
  type MarkdownEditorDispatchResult,
  type MarkdownEditorSelection,
  type MarkdownEditorTransaction,
} from '../markdown-editor-transaction'
import {
  rebaseMarkdownEditorCommandTransaction,
  type MarkdownEditorKernel,
} from '../kernel/editor-kernel'

export interface UseEditorToolbarCommandsOptions {
  readonly captureSelection: (breakMerge?: boolean) => MarkdownEditorSelection
  readonly commandGroupRef: Ref<HTMLElement | null>
  readonly commandMeasureRef: Ref<HTMLElement | null>
  readonly commandOverflowRef: Ref<HTMLButtonElement | null>
  readonly commandRuntimeVersion: Ref<number>
  readonly commandsExpanded: Ref<boolean>
  readonly commandsRef: Ref<HTMLElement | null>
  readonly commandTrayId: string
  readonly commandTrayRef: Ref<HTMLElement | null>
  readonly currentMode: Ref<MarkdownEditorMode>
  readonly dispatchTransaction: (
    transaction: MarkdownEditorTransaction,
  ) => MarkdownEditorDispatchResult
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly editingBlocked: ComputedRef<boolean>
  readonly editorAnchorMap: ComputedRef<MarkdownAnchorMap | undefined>
  readonly editorProjection: ComputedRef<MarkdownStableProjection | undefined>
  readonly editorRevision: Ref<number>
  readonly editorSelection: Ref<MarkdownEditorSelection>
  readonly editorValue: Ref<string>
  readonly effectiveToolbarDensity: ComputedRef<MarkdownEditorToolbarDensity>
  readonly frameScheduler: MarkdownEditorFrameScheduler
  readonly isComposing: Ref<boolean>
  readonly isFreezeSmartInput: () => boolean
  readonly kernel: MarkdownEditorKernel
  readonly localeText: ComputedRef<MarkdownEditorLocaleText>
  readonly onCommandExecuted: (command: MarkdownEditorCommand) => void
  readonly openContextualSurface: (
    surface: 'anchor-properties' | 'link-properties',
  ) => Promise<void>
  readonly openPasteAsMarkdownSurface: () => Promise<void>
  readonly pasteAsMarkdownBusy: Ref<boolean>
  readonly pasteAsMarkdownDescriptionId: string
  readonly pasteAsMarkdownGate: Ref<unknown>
  readonly props: MarkdownEditorProps
  readonly restoreTextareaSelection: (
    selection: MarkdownEditorSelection,
    focus?: boolean,
  ) => Promise<void>
  readonly textareaRef: Ref<HTMLTextAreaElement | null>
}

export function useEditorToolbarCommands(
  options: UseEditorToolbarCommandsOptions,
) {
  const {
    captureSelection,
    commandGroupRef,
    commandMeasureRef,
    commandOverflowRef,
    commandRuntimeVersion,
    commandsExpanded,
    commandsRef,
    commandTrayId,
    commandTrayRef,
    currentMode,
    dispatchTransaction,
    documentIdentity,
    editingBlocked,
    editorAnchorMap,
    editorProjection,
    editorRevision,
    editorSelection,
    editorValue,
    effectiveToolbarDensity,
    frameScheduler,
    isComposing,
    isFreezeSmartInput,
    kernel,
    localeText,
    onCommandExecuted,
    openContextualSurface,
    openPasteAsMarkdownSurface,
    pasteAsMarkdownBusy,
    pasteAsMarkdownDescriptionId,
    pasteAsMarkdownGate,
    props,
    restoreTextareaSelection,
    textareaRef,
  } = options

  const commandContext = computed(() => ({
    dispatch: {
      dispatch: (transaction: MarkdownEditorTransaction) =>
        dispatchTransaction(transaction),
    },
    documentIdentity,
    mode: currentMode.value,
    ...(editorProjection.value
      ? {
          positionMap: createMarkdownEditorPositionMap([], {
            documentIdentity,
            projection: editorProjection.value,
            source: editorValue.value,
          }),
          projection: editorProjection.value,
        }
      : {}),
    readonly: editingBlocked.value,
    revision: editorRevision.value,
    selection: editorSelection.value,
    signal: kernel.commandContextSignal,
    syntax: editorProjection.value
      ? resolveMarkdownEditorSyntaxContext(
          editorProjection.value,
          editorSelection.value,
        )
      : undefined,
    value: kernel.value,
  }))

  const commandSnapshot = computed(() => {
    void commandRuntimeVersion.value
    return createMarkdownEditorCommandSnapshot(
      props.commands,
      commandContext.value,
      kernel.commandRuntimeStates,
    )
  })
  const toolbarCommands = computed(() =>
    selectMarkdownEditorCommandSnapshot(commandSnapshot.value, 'toolbar').map(
      (item) => item.command,
    ),
  )
  const selectionToolbarCommands = computed(() =>
    selectMarkdownEditorCommandSnapshot(commandSnapshot.value, 'selection').map(
      (item) => item.command,
    ),
  )
  const selectionToolbarPlacement = computed(() =>
    resolveMarkdownSelectionToolbarPlacement(
      editorSelection.value,
      editorRevision.value,
      editorRevision.value,
      {
        anchorMap: editorAnchorMap.value,
        documentEpoch: documentIdentity.epoch,
        expectedEpoch: documentIdentity.epoch,
      },
    ),
  )
  const dismissedSelectionRevision = ref<number | null>(null)
  const selectionToolbarVisible = computed(
    () =>
      selectionToolbarPlacement.value.visible &&
      dismissedSelectionRevision.value !== editorRevision.value,
  )
  const selectionToolbarAnchorId = computed(
    () => selectionToolbarPlacement.value.visual?.anchor.anchorId ?? '',
  )
  const closeSelectionToolbar = () => {
    dismissedSelectionRevision.value = editorRevision.value
    textareaRef.value?.focus()
  }

  const gatedPasteAsMarkdownCommand = computed(() =>
    pasteAsMarkdownGate.value &&
    !resolveMarkdownEditorPrimaryCommands(
      toolbarCommands.value,
      effectiveToolbarDensity.value,
      props.primaryCommandKeys,
    ).some((command) => command.key === 'paste-as-markdown')
      ? toolbarCommands.value.find(
          (command) => command.key === 'paste-as-markdown',
        )
      : undefined,
  )

  const commandCopy = (command: MarkdownEditorCommand) =>
    resolveMarkdownEditorCommandCopy(command, localeText.value)
  const commandName = (command: MarkdownEditorCommand) =>
    commandCopy(command).name
  const commandGroupName = (group: string) =>
    localeText.value.commandGroups[group] ?? group

  const isPasteAsMarkdownCommand = (command: MarkdownEditorCommand) =>
    command.key === 'paste-as-markdown'
  const commandSnapshotItem = (command: MarkdownEditorCommand) =>
    commandSnapshot.value.find((item) => item.key === command.key)
  const isCommandDisabled = (command: MarkdownEditorCommand) => {
    const item = commandSnapshotItem(command)
    return (
      editingBlocked.value ||
      item?.enabled === false ||
      (isPasteAsMarkdownCommand(command) &&
        (Boolean(pasteAsMarkdownGate.value) || pasteAsMarkdownBusy.value))
    )
  }
  const commandStateId = (key: string) =>
    `${commandTrayId}-command-state-${key.replace(/[^a-zA-Z0-9_-]/gu, '-')}`
  const commandStateText = (item: MarkdownEditorCommandSnapshotItem) => {
    if (item.disabledReason && item.state === 'idle') return item.disabledReason
    if (item.state === 'idle') return ''
    return localeText.value.results[item.state]
  }
  const commandDescriptionId = (command: MarkdownEditorCommand) => {
    if (isPasteAsMarkdownCommand(command) && pasteAsMarkdownGate.value) {
      return pasteAsMarkdownDescriptionId
    }
    const item = commandSnapshotItem(command)
    return item && commandStateText(item)
      ? commandStateId(command.key)
      : undefined
  }

  const runCommand = async (
    command: MarkdownEditorCommand,
    slashRange?: Readonly<{ start: number; end: number }>,
  ) => {
    if (editingBlocked.value || isFreezeSmartInput()) return
    const selection = captureSelection()
    const projection = editorProjection.value
    const initialContext = {
      ...commandContext.value,
      selection,
      syntax: projection
        ? resolveMarkdownEditorSyntaxContext(projection, selection)
        : undefined,
    }
    const session = kernel.beginCommandSession(
      command,
      initialContext,
      slashRange ?? selection,
    )
    if (!session) return

    try {
      const context = {
        ...initialContext,
        signal: session.abort.signal,
      }
      if (
        !isMarkdownEditorCommandVisible(command, context) ||
        !isMarkdownEditorCommandEnabled(command, context)
      ) {
        return
      }
      const result = await runMarkdownEditorCommand(command, context)
      if (!kernel.isCurrentCommandSession(command.key, session)) return
      const currentContext = commandContext.value
      const positionMap = kernel.positionMapFromRevision(
        session.revision,
        currentContext.revision,
        editorProjection.value,
      )
      const rebasedState = kernel.rebaseCommandSession(
        session,
        currentContext,
        positionMap,
      )
      if (rebasedState !== 'pending') return

      const resolvedState = kernel.resolveCommandSession(
        session,
        currentContext,
        'resolved-current',
      )
      if (resolvedState !== 'resolved-current') return

      if (result?.surface) {
        await openContextualSurface(result.surface)
        return
      }
      if (!result?.transaction) {
        if (result?.focus !== 'surface' && result?.focus !== 'none') {
          await restoreTextareaSelection(selection)
        }
        return
      }
      const rebasedTransaction = rebaseMarkdownEditorCommandTransaction(
        result.transaction,
        positionMap,
      )
      if (!rebasedTransaction) {
        session.state = 'stale'
        kernel.setCommandRuntimeState(command.key, { state: 'stale' })
        return
      }
      const transaction =
        slashRange && session.anchor
          ? planMarkdownSlashCommit(session.anchor, rebasedTransaction)
          : rebasedTransaction
      const dispatchResult = dispatchTransaction({
        ...transaction,
        expectedRevision: currentContext.revision,
        history: transaction.history ?? 'separate',
        metadata: Object.freeze({ command: command.key }),
        origin: 'command',
      })
      if (dispatchResult.accepted) onCommandExecuted(command)
      if (
        !dispatchResult.accepted &&
        result.focus !== 'surface' &&
        result.focus !== 'none'
      ) {
        await restoreTextareaSelection(selection)
      }
    } catch (error) {
      kernel.resolveCommandSession(
        session,
        commandContext.value,
        'rejected',
        error,
      )
      await restoreTextareaSelection(selection)
    } finally {
      kernel.clearCommandSession(command.key, session)
    }
  }

  const activateCommand = (command: MarkdownEditorCommand) => {
    if (isPasteAsMarkdownCommand(command)) {
      void openPasteAsMarkdownSurface()
      return
    }
    void runCommand(command)
  }

  const activateOverflowCommand = (command: MarkdownEditorCommand) => {
    activateCommand(command)
    commandsExpanded.value = false
  }

  const configuredPrimaryCommands = computed(() =>
    resolveMarkdownEditorPrimaryCommands(
      toolbarCommands.value,
      effectiveToolbarDensity.value,
      props.primaryCommandKeys,
    ),
  )
  const configuredOverflowCommands = computed(() =>
    resolveMarkdownEditorOverflowCommands(
      toolbarCommands.value,
      effectiveToolbarDensity.value,
      props.primaryCommandKeys,
    ),
  )
  const responsivePrimaryLimit = ref<number | null>(null)
  const primaryCommands = computed(() => {
    const configured = configuredPrimaryCommands.value
    const limit = responsivePrimaryLimit.value
    if (limit === null || limit >= configured.length) return configured
    return configured.slice(0, Math.max(0, limit))
  })
  const overflowCommands = computed(() => {
    const configuredPrimary = configuredPrimaryCommands.value
    const configuredOverflow = configuredOverflowCommands.value
    const limit = responsivePrimaryLimit.value
    if (limit === null || limit >= configuredPrimary.length) {
      return configuredOverflow
    }
    return [
      ...configuredPrimary.slice(Math.max(0, limit)),
      ...configuredOverflow,
    ]
  })
  const visibleActions = computed<MarkdownEditorActionItem[]>(() => {
    if (!props.showActions) return []
    const actions: MarkdownEditorActionItem[] = []
    if (props.showImageAction) {
      actions.push({
        key: 'image',
        label: props.imageActionLabel ?? localeText.value.actions.image,
      })
    }
    if (props.showSaveAction) {
      actions.push({
        key: 'save',
        label: props.saveActionLabel ?? localeText.value.actions.save,
      })
    }
    if (props.showSubmitAction) {
      actions.push({
        key: 'submit',
        label: props.submitActionLabel ?? localeText.value.actions.submit,
      })
    }
    return actions
  })
  const actionOverflowKeySet = computed(
    () => new Set<MarkdownEditorActionKey>(props.actionOverflowKeys),
  )
  const primaryActions = computed(() =>
    visibleActions.value.filter(
      (action) => !actionOverflowKeySet.value.has(action.key),
    ),
  )
  const overflowActions = computed(() =>
    visibleActions.value.filter((action) =>
      actionOverflowKeySet.value.has(action.key),
    ),
  )
  const overflowItemCount = computed(
    () => overflowCommands.value.length + overflowActions.value.length,
  )
  const worstCaseOverflowCount = computed(() =>
    Math.max(
      1,
      configuredPrimaryCommands.value.length +
        configuredOverflowCommands.value.length +
        overflowActions.value.length,
    ),
  )

  const resolvedCommandOverflowLabel = computed(
    () => props.commandOverflowLabel ?? localeText.value.overflow,
  )
  const commandOverflowAriaLabel = computed(() =>
    props.commandOverflowLabel
      ? `${props.commandOverflowLabel} (${overflowItemCount.value})`
      : localeText.value.overflowAria(overflowItemCount.value),
  )
  const toolbarMeasureSignature = computed(() =>
    [
      effectiveToolbarDensity.value,
      props.interactionProfile,
      props.mobileLayout,
      props.editorProfile,
      resolvedCommandOverflowLabel.value,
      overflowActions.value.length,
      configuredOverflowCommands.value.length,
      gatedPasteAsMarkdownCommand.value
        ? commandName(gatedPasteAsMarkdownCommand.value)
        : '',
      configuredPrimaryCommands.value
        .map((command) => `${command.key}:${commandName(command)}`)
        .join('|'),
    ].join('\u0000'),
  )

  let toolbarResizeObserver: ResizeObserver | undefined
  let pendingToolbarPrimaryLimit: number | null | undefined
  let lastCommandGroupWidth = -1
  let unmounted = false

  const measureToolbarOverflow = () => {
    const group = commandGroupRef.value
    const probe = commandMeasureRef.value
    if (!group || !probe || typeof window === 'undefined') {
      pendingToolbarPrimaryLimit = null
      return
    }
    const availableWidth = group.clientWidth
    const commandsElement = commandsRef.value
    const groupStyle = window.getComputedStyle(group)
    const groupGap =
      Number.parseFloat(groupStyle.columnGap || groupStyle.gap) || 0
    const commandsStyle = commandsElement
      ? window.getComputedStyle(commandsElement)
      : groupStyle
    const commandsGap =
      Number.parseFloat(commandsStyle.columnGap || commandsStyle.gap) || 0

    const commandWidths = Array.from(
      probe.querySelectorAll<HTMLElement>('[data-measure-role="command"]'),
      (node) => node.getBoundingClientRect().width,
    )
    const reservedEndNode = probe.querySelector<HTMLElement>(
      '[data-measure-role="reserved-end"]',
    )
    const reservedEndWidth = reservedEndNode
      ? reservedEndNode.getBoundingClientRect().width
      : 0
    const moreNode = probe.querySelector<HTMLElement>(
      '[data-measure-role="more"]',
    )
    const overflowTriggerWidth = moreNode
      ? moreNode.getBoundingClientRect().width
      : 0

    pendingToolbarPrimaryLimit = resolveMarkdownEditorFittingCommandCount({
      availableWidth,
      commandWidths,
      commandsGap,
      groupGap,
      hasBaseOverflow:
        configuredOverflowCommands.value.length + overflowActions.value.length >
        0,
      overflowTriggerWidth,
      reservedEndWidth,
    })
  }

  const mutateToolbarOverflow = () => {
    if (pendingToolbarPrimaryLimit === undefined) return
    const nextLimit = pendingToolbarPrimaryLimit
    pendingToolbarPrimaryLimit = undefined
    if (responsivePrimaryLimit.value !== nextLimit) {
      responsivePrimaryLimit.value = nextLimit
    }
  }

  const scheduleToolbarOverflowMeasure = () => {
    if (unmounted || typeof window === 'undefined') return
    if (!commandGroupRef.value || !commandMeasureRef.value) return
    frameScheduler.schedule({
      guard: () =>
        !unmounted && Boolean(commandGroupRef.value && commandMeasureRef.value),
      key: 'toolbar-overflow',
      measure: measureToolbarOverflow,
      mutate: mutateToolbarOverflow,
    })
  }

  const disconnectToolbarResizeObserver = () => {
    toolbarResizeObserver?.disconnect()
    toolbarResizeObserver = undefined
    lastCommandGroupWidth = -1
  }

  const attachToolbarResizeObserver = (element: HTMLElement | null) => {
    disconnectToolbarResizeObserver()
    if (!element) {
      responsivePrimaryLimit.value = null
      return
    }
    if (typeof ResizeObserver !== 'undefined') {
      toolbarResizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0]
        const nextWidth = entry ? entry.contentRect.width : element.clientWidth
        if (
          lastCommandGroupWidth >= 0 &&
          Math.abs(nextWidth - lastCommandGroupWidth) <= 0.5
        ) {
          return
        }
        lastCommandGroupWidth = nextWidth
        scheduleToolbarOverflowMeasure()
      })
      toolbarResizeObserver.observe(element)
    }
    scheduleToolbarOverflowMeasure()
  }

  watch(commandGroupRef, (element) => {
    attachToolbarResizeObserver(element)
  })

  watch(toolbarMeasureSignature, () => {
    void nextTick(() => {
      scheduleToolbarOverflowMeasure()
    })
  })

  const closeCommandOverflow = (restoreFocus = false) => {
    commandsExpanded.value = false
    if (restoreFocus) void nextTick(() => commandOverflowRef.value?.focus())
  }

  const toggleCommands = async () => {
    if (editingBlocked.value || isComposing.value) return
    commandsExpanded.value = !commandsExpanded.value
    if (!commandsExpanded.value) return
    await nextTick()
    commandTrayRef.value
      ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
      ?.focus()
  }

  const mountToolbarOverflow = () => {
    attachToolbarResizeObserver(commandGroupRef.value)
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (!unmounted && commandGroupRef.value && commandMeasureRef.value) {
          scheduleToolbarOverflowMeasure()
        }
      })
    }
  }

  const disposeToolbarOverflow = () => {
    unmounted = true
    disconnectToolbarResizeObserver()
  }

  return {
    activateCommand,
    activateOverflowCommand,
    closeCommandOverflow,
    closeSelectionToolbar,
    commandContext,
    commandCopy,
    commandDescriptionId,
    commandGroupName,
    commandName,
    commandOverflowAriaLabel,
    commandSnapshot,
    commandStateId,
    commandStateText,
    configuredOverflowCommands,
    configuredPrimaryCommands,
    disposeToolbarOverflow,
    gatedPasteAsMarkdownCommand,
    isCommandDisabled,
    isPasteAsMarkdownCommand,
    mountToolbarOverflow,
    overflowActions,
    overflowCommands,
    overflowItemCount,
    primaryActions,
    primaryCommands,
    resolvedCommandOverflowLabel,
    runCommand,
    selectionToolbarAnchorId,
    selectionToolbarCommands,
    selectionToolbarPlacement,
    selectionToolbarVisible,
    toggleCommands,
    toolbarCommands,
    visibleActions,
    worstCaseOverflowCount,
  }
}
