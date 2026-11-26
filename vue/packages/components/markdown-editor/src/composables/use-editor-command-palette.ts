import { computed, nextTick, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { MarkdownStableProjection } from '../../../../wasm/markdown-runtime'
import {
  groupMarkdownEditorCommandSnapshot,
  resolveMarkdownSlashTrigger,
  searchMarkdownEditorCommandSnapshot,
} from '../markdown-editor-surfaces'
import type { MarkdownEditorCommandSnapshotItem } from '../markdown-editor-command-snapshot'
import type {
  MarkdownEditorCommand,
  MarkdownEditorDocumentIdentity,
  MarkdownEditorSurfaceOptions,
} from '../markdown-editor'
import type { MarkdownEditorSelection } from '../markdown-editor-transaction'

export const useEditorCommandPalette = (options: {
  activateCommand: (command: MarkdownEditorCommand) => void
  captureSelection: (breakMerge?: boolean) => MarkdownEditorSelection
  commandSnapshot: ComputedRef<readonly MarkdownEditorCommandSnapshotItem[]>
  documentIdentity: MarkdownEditorDocumentIdentity
  editingBlocked: ComputedRef<boolean>
  editorProjection: ComputedRef<MarkdownStableProjection | undefined>
  editorRevision: Ref<number>
  editorSelection: Ref<MarkdownEditorSelection>
  editorValue: Ref<string>
  focusPaletteInput: () => void
  focusTextarea: () => void
  getPaletteInputElement: () => HTMLInputElement | null
  isCommandDisabled: (command: MarkdownEditorCommand) => boolean
  isComposing: Ref<boolean>
  paletteListId: string
  restoreTextareaSelection: (
    selection: MarkdownEditorSelection,
    focus?: boolean,
  ) => Promise<void>
  rootElementRef: Ref<HTMLElement | null>
  runSlashCommand: (
    command: MarkdownEditorCommand,
    slashRange: Readonly<{ start: number; end: number }>,
  ) => Promise<void>
  slashMenuId: string
  surfaceOptions: ComputedRef<Required<MarkdownEditorSurfaceOptions>>
}) => {
  const slashTrigger = computed(() => {
    if (
      !options.surfaceOptions.value.slashMenu ||
      options.editingBlocked.value ||
      options.isComposing.value
    )
      return null
    return resolveMarkdownSlashTrigger(
      options.editorValue.value,
      options.editorSelection.value.start,
      {
        blockOnly: true,
        documentEpoch: options.documentIdentity.epoch,
        isComposing: options.isComposing.value,
        projection: options.editorProjection.value,
        revision: options.editorRevision.value,
      },
    )
  })

  const slashCommands = computed(() => {
    if (!slashTrigger.value) return []
    return searchMarkdownEditorCommandSnapshot(
      options.commandSnapshot.value,
      slashTrigger.value.query,
      'slash',
    ).map((item) => item.command)
  })

  const activeSlashIndex = ref(0)
  const dismissedSlashTrigger = ref('')

  const activeSlashTrigger = computed(() => {
    const trigger = slashTrigger.value
    if (!trigger) return null
    if (
      trigger.documentEpoch !== options.documentIdentity.epoch ||
      trigger.revision !== options.editorRevision.value ||
      (trigger.nodeId &&
        options.editorProjection.value?.resolve(trigger.nodeId).status !==
          'current')
    )
      return null
    const identity = `${trigger.documentEpoch}:${trigger.revision}:${trigger.nodeId ?? 'document'}:${trigger.range.start}:${trigger.range.end}`
    return dismissedSlashTrigger.value === identity ? null : trigger
  })

  const closeSlashMenu = () => {
    const trigger = slashTrigger.value
    if (trigger) {
      dismissedSlashTrigger.value = `${trigger.documentEpoch}:${trigger.revision}:${trigger.nodeId ?? 'document'}:${trigger.range.start}:${trigger.range.end}`
    }
    options.focusTextarea()
  }

  const executeSlashCommand = (command: MarkdownEditorCommand) => {
    if (!activeSlashTrigger.value) return
    if (options.isCommandDisabled(command)) return
    void options.runSlashCommand(command, activeSlashTrigger.value.range)
  }

  const slashItemId = (key: string) =>
    `${options.slashMenuId}-${key.replace(/[^a-zA-Z0-9_-]/gu, '-')}`

  const moveSlashIndex = (direction: 1 | -1) => {
    if (!slashCommands.value.length) return
    for (let step = 1; step <= slashCommands.value.length; step += 1) {
      const candidate =
        (activeSlashIndex.value +
          direction * step +
          slashCommands.value.length) %
        slashCommands.value.length
      const command = slashCommands.value[candidate]
      if (command && !options.isCommandDisabled(command)) {
        activeSlashIndex.value = candidate
        return
      }
    }
  }

  const commandPaletteOpen = ref(false)
  const commandPaletteDirection = ref<'ltr' | 'rtl'>('ltr')
  const paletteQuery = ref('')
  const activePaletteIndex = ref(0)
  const paletteRestoreSelection = ref<MarkdownEditorSelection | null>(null)

  const paletteCommandItems = computed(() =>
    searchMarkdownEditorCommandSnapshot(
      options.commandSnapshot.value,
      paletteQuery.value,
    ),
  )

  const paletteCommands = computed(() =>
    paletteCommandItems.value.map((item) => item.command),
  )

  const paletteCommandGroups = computed(() =>
    groupMarkdownEditorCommandSnapshot(paletteCommandItems.value),
  )

  const activePaletteCommand = computed(
    () => paletteCommands.value[activePaletteIndex.value],
  )

  const paletteItemId = (key: string) =>
    `${options.paletteListId}-${key.replace(/[^a-zA-Z0-9_-]/gu, '-')}`

  const paletteItemIndex = (key: string) =>
    paletteCommands.value.findIndex((command) => command.key === key)

  const openCommandPalette = () => {
    if (options.editingBlocked.value || options.isComposing.value) return
    const directionOwner = options.rootElementRef.value
    const declaredDirection =
      directionOwner?.closest<HTMLElement>('[dir]')?.dir ?? ''
    commandPaletteDirection.value =
      declaredDirection === 'rtl' ||
      (declaredDirection !== 'ltr' &&
        directionOwner &&
        getComputedStyle(directionOwner).direction === 'rtl')
        ? 'rtl'
        : 'ltr'
    paletteRestoreSelection.value = options.captureSelection(false)
    commandPaletteOpen.value = true
    paletteQuery.value = ''
    activePaletteIndex.value = Math.max(
      0,
      paletteCommands.value.findIndex(
        (command) => !options.isCommandDisabled(command),
      ),
    )
    void nextTick(() => options.focusPaletteInput())
  }

  const closeCommandPalette = () => {
    commandPaletteOpen.value = false
    const selection = paletteRestoreSelection.value
    paletteRestoreSelection.value = null
    if (selection) {
      void options.restoreTextareaSelection(selection)
    } else {
      options.focusTextarea()
    }
  }

  const movePaletteIndex = (direction: 1 | -1) => {
    if (!paletteCommands.value.length) return
    for (let step = 1; step <= paletteCommands.value.length; step += 1) {
      const candidate =
        (activePaletteIndex.value +
          direction * step +
          paletteCommands.value.length) %
        paletteCommands.value.length
      const command = paletteCommands.value[candidate]
      if (command && !options.isCommandDisabled(command)) {
        activePaletteIndex.value = candidate
        return
      }
    }
  }

  const selectNextPaletteItem = () => movePaletteIndex(1)
  const selectPreviousPaletteItem = () => movePaletteIndex(-1)

  const executePaletteCommand = (command: MarkdownEditorCommand) => {
    if (options.isCommandDisabled(command)) return
    closeCommandPalette()
    options.activateCommand(command)
  }

  const executeActivePaletteItem = (event: KeyboardEvent) => {
    if (event.isComposing || event.keyCode === 229) return
    event.preventDefault()
    const command = paletteCommands.value[activePaletteIndex.value]
    if (command && !options.isCommandDisabled(command)) {
      executePaletteCommand(command)
    }
  }

  const handleCommandPaletteKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeCommandPalette()
      return
    }
    if (event.key !== 'Tab') return
    const controls = [
      options.getPaletteInputElement(),
      ...Array.from(
        document
          .getElementById(options.paletteListId)
          ?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
      ),
    ].filter(
      (control): control is HTMLInputElement | HTMLButtonElement =>
        control !== null,
    )
    if (!controls.length) return
    const currentIndex = controls.indexOf(
      document.activeElement as HTMLInputElement | HTMLButtonElement,
    )
    const nextIndex = event.shiftKey
      ? (currentIndex - 1 + controls.length) % controls.length
      : (currentIndex + 1) % controls.length
    event.preventDefault()
    controls[nextIndex]?.focus()
  }

  const resetPaletteAndSlash = () => {
    commandPaletteOpen.value = false
    paletteRestoreSelection.value = null
    dismissedSlashTrigger.value = ''
  }

  watch(slashCommands, (commands) => {
    if (!commands.length) {
      activeSlashIndex.value = 0
      return
    }
    if (
      activeSlashIndex.value >= commands.length ||
      options.isCommandDisabled(commands[activeSlashIndex.value]!)
    ) {
      activeSlashIndex.value = 0
      if (options.isCommandDisabled(commands[0]!)) moveSlashIndex(1)
    }
  })

  watch(paletteCommands, (commands) => {
    if (!commands.length) {
      activePaletteIndex.value = 0
      return
    }
    if (
      activePaletteIndex.value >= commands.length ||
      options.isCommandDisabled(commands[activePaletteIndex.value]!)
    ) {
      activePaletteIndex.value = 0
      if (options.isCommandDisabled(commands[0]!)) movePaletteIndex(1)
    }
  })

  return {
    activePaletteCommand,
    activePaletteIndex,
    activeSlashIndex,
    activeSlashTrigger,
    closeCommandPalette,
    closeSlashMenu,
    commandPaletteDirection,
    commandPaletteOpen,
    executeActivePaletteItem,
    executePaletteCommand,
    executeSlashCommand,
    handleCommandPaletteKeydown,
    moveSlashIndex,
    openCommandPalette,
    paletteCommandGroups,
    paletteCommands,
    paletteItemId,
    paletteItemIndex,
    paletteQuery,
    resetPaletteAndSlash,
    selectNextPaletteItem,
    selectPreviousPaletteItem,
    slashCommands,
    slashItemId,
  }
}
