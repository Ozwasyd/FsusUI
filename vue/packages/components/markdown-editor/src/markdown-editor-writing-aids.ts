export type MarkdownEditorTypewriterAnchor = 'center' | 'upper-third'

export interface MarkdownEditorWritingAidsOptions {
  readonly focus?: boolean
  readonly typewriter?: boolean
  readonly typewriterAnchor?: MarkdownEditorTypewriterAnchor
}

export interface MarkdownEditorResolvedWritingAids {
  readonly focus: boolean
  readonly typewriter: boolean
  readonly typewriterAnchor: MarkdownEditorTypewriterAnchor
}

export type MarkdownEditorWritingAidsState =
  | 'idle'
  | 'input-driven'
  | 'explicit-navigation'
  | 'user-scroll-suspended'
  | 'selection-drag-suspended'
  | 'composition-suspended'
  | 'restoring'

export type MarkdownEditorWritingAidsSuspendReason =
  | 'user-scroll'
  | 'selection-drag'
  | 'composition'

const defaults: MarkdownEditorResolvedWritingAids = Object.freeze({
  focus: false,
  typewriter: false,
  typewriterAnchor: 'upper-third',
})

/** Resolves public writing-aid options without reading or retaining editor DOM. */
export const resolveWritingAids = (
  options?:
    | MarkdownEditorWritingAidsOptions
    | (MarkdownEditorWritingAidsOptions & Readonly<Record<string, unknown>>),
): MarkdownEditorResolvedWritingAids => {
  const nested = (options as Readonly<Record<string, unknown>> | undefined)
    ?.writingAids as MarkdownEditorWritingAidsOptions | undefined
  return Object.freeze({
    focus: nested?.focus === true || options?.focus === true,
    typewriter: nested?.typewriter === true || options?.typewriter === true,
    typewriterAnchor:
      nested?.typewriterAnchor ??
      options?.typewriterAnchor ??
      defaults.typewriterAnchor,
  })
}

export interface MarkdownEditorFocusExemptions {
  readonly searchMatches?: readonly (
    | number
    | readonly [number, number]
    | string
  )[]
  readonly diagnostics?: readonly string[]
  readonly propertyEditorNodeId?: string | null
  readonly pendingAttachmentIds?: readonly string[]
  readonly screenReaderBrowseTargetId?: string | null
  readonly atomicNodeIds?: readonly string[]
}

export interface MarkdownEditorFocusBlock {
  readonly id: string
  readonly kind: string
  readonly sourceRange: readonly [number, number]
  readonly active: boolean
  readonly dimmed: boolean
  readonly exempt: boolean
}

export interface MarkdownEditorFocusRange {
  readonly start: number
  readonly end: number
}

export interface MarkdownEditorFocusState {
  readonly enabled: boolean
  readonly activeBlockId: string | null
  readonly activeBlockIds: readonly string[]
  readonly activeRange: MarkdownEditorFocusRange | null
  readonly exemptNodeIds: readonly string[]
  readonly blocks: readonly MarkdownEditorFocusBlock[]
  readonly presentation: {
    readonly dimmedOpacity: number
    readonly blur: false
    readonly hidden: false
    readonly mask: false
  }
}

export interface MarkdownEditorFocusInput {
  readonly writingAids?: MarkdownEditorWritingAidsOptions
  readonly focus?: boolean
  readonly editorProfile?: 'markdown' | 'prose' | string
  readonly mode?: 'source' | 'live' | 'split' | 'preview' | string
  readonly readonly?: boolean
  readonly disabled?: boolean
  readonly source: string
  readonly projection?: {
    readonly nodes?: readonly {
      readonly id: string
      readonly kind: string
      readonly rawRange: { readonly start: number; readonly end: number }
      readonly parentRawRange?: {
        readonly start: number
        readonly end: number
      } | null
    }[]
  } | null
  readonly selection?: {
    readonly start: number
    readonly end: number
    readonly direction?: 'forward' | 'backward' | 'none'
  } | null
  readonly caret?: number
  readonly exemptions?: MarkdownEditorFocusExemptions
  readonly previousDocumentId?: string
  readonly currentDocumentId?: string
  readonly previousEpoch?: number
  readonly currentEpoch?: number
}

export const resolveFocusState = (
  input: MarkdownEditorFocusInput,
): MarkdownEditorFocusState => {
  const isFocusOption =
    input.writingAids?.focus === true || input.focus === true
  const isProse = input.editorProfile === 'prose'
  const isEditable = !input.readonly && !input.disabled
  const isEditableMode = input.mode !== 'preview'
  const isSameDoc =
    (!input.previousDocumentId ||
      !input.currentDocumentId ||
      input.previousDocumentId === input.currentDocumentId) &&
    (!input.previousEpoch ||
      !input.currentEpoch ||
      input.previousEpoch === input.currentEpoch)

  if (
    !isFocusOption ||
    !isProse ||
    !isEditable ||
    !isEditableMode ||
    !isSameDoc
  ) {
    return Object.freeze({
      enabled: false,
      activeBlockId: null,
      activeBlockIds: Object.freeze([]),
      activeRange: null,
      exemptNodeIds: Object.freeze([]),
      blocks: Object.freeze([]),
      presentation: Object.freeze({
        dimmedOpacity: 1.0,
        blur: false as const,
        hidden: false as const,
        mask: false as const,
      }),
    })
  }

  const rawNodes = (input.projection?.nodes ?? []).filter(
    (node) => node.parentRawRange == null,
  )
  const nodes =
    rawNodes.length > 0
      ? rawNodes
      : [
          {
            id: 'block:0',
            kind: 'paragraph',
            rawRange: { start: 0, end: input.source.length },
          },
        ]

  const sel = input.selection ?? {
    start: input.caret ?? 0,
    end: input.caret ?? 0,
  }
  const selStart = Math.min(sel.start, sel.end)
  const selEnd = Math.max(sel.start, sel.end)
  const isCollapsed = selStart === selEnd

  const activeBlockIds: string[] = []
  let activeRange: MarkdownEditorFocusRange | null = null

  if (isCollapsed) {
    let found = nodes.find(
      (n) => n.rawRange.start <= selStart && selStart <= n.rawRange.end,
    )
    if (!found && nodes.length > 0) {
      if (selStart >= nodes[nodes.length - 1]!.rawRange.end) {
        found = nodes[nodes.length - 1]
      } else {
        found = nodes.reduce((prev, curr) =>
          curr.rawRange.start <= selStart ? curr : prev,
        )
      }
    }
    if (found) {
      activeBlockIds.push(found.id)
      activeRange = Object.freeze({
        start: found.rawRange.start,
        end: found.rawRange.end,
      })
    }
  } else {
    const intersecting = nodes.filter(
      (n) => !(n.rawRange.end < selStart || n.rawRange.start > selEnd),
    )
    if (intersecting.length > 0) {
      for (const b of intersecting) {
        activeBlockIds.push(b.id)
      }
      activeRange = Object.freeze({
        start: Math.min(...intersecting.map((n) => n.rawRange.start)),
        end: Math.max(...intersecting.map((n) => n.rawRange.end)),
      })
    }
  }

  const exemptNodeIds: string[] = []
  const ex = input.exemptions
  if (ex) {
    if (ex.propertyEditorNodeId) exemptNodeIds.push(ex.propertyEditorNodeId)
    if (ex.screenReaderBrowseTargetId)
      exemptNodeIds.push(ex.screenReaderBrowseTargetId)
    if (ex.diagnostics) {
      for (const d of ex.diagnostics) exemptNodeIds.push(d)
    }
    if (ex.pendingAttachmentIds) {
      for (const a of ex.pendingAttachmentIds) exemptNodeIds.push(a)
    }
    if (ex.atomicNodeIds) {
      for (const a of ex.atomicNodeIds) exemptNodeIds.push(a)
    }
    if (ex.searchMatches) {
      for (const sm of ex.searchMatches) {
        if (typeof sm === 'string') {
          exemptNodeIds.push(sm)
        } else if (typeof sm === 'number') {
          const matchNode = nodes.find(
            (n) => n.rawRange.start <= sm && sm <= n.rawRange.end,
          )
          if (matchNode && !exemptNodeIds.includes(matchNode.id)) {
            exemptNodeIds.push(matchNode.id)
          }
        } else if (Array.isArray(sm)) {
          const matchNodes = nodes.filter(
            (n) => !(n.rawRange.end < sm[0] || n.rawRange.start > sm[1]),
          )
          for (const mn of matchNodes) {
            if (!exemptNodeIds.includes(mn.id)) exemptNodeIds.push(mn.id)
          }
        }
      }
    }
  }

  const blocks: MarkdownEditorFocusBlock[] = nodes.map((node) => {
    const active = activeBlockIds.includes(node.id)
    const exempt = exemptNodeIds.includes(node.id)
    const dimmed = !active && !exempt
    return Object.freeze({
      id: node.id,
      kind: node.kind,
      sourceRange: Object.freeze([
        node.rawRange.start,
        node.rawRange.end,
      ] as const),
      active,
      dimmed,
      exempt,
    })
  })

  return Object.freeze({
    enabled: true,
    activeBlockId: activeBlockIds[0] ?? null,
    activeBlockIds: Object.freeze(activeBlockIds),
    activeRange,
    exemptNodeIds: Object.freeze(exemptNodeIds),
    blocks: Object.freeze(blocks),
    presentation: Object.freeze({
      dimmedOpacity: 0.72,
      blur: false as const,
      hidden: false as const,
      mask: false as const,
    }),
  })
}

export interface MarkdownEditorFocusSegment {
  readonly key: string
  readonly nodeId?: string
  readonly text: string
  readonly dimmed: boolean
  readonly exempt: boolean
}

/**
 * Projects Focus presentation over the source without changing the editor's
 * reading order, selection owner, or underlying value.
 */
export const createMarkdownFocusSegments = (
  source: string,
  state: MarkdownEditorFocusState,
): readonly MarkdownEditorFocusSegment[] => {
  if (!state.enabled || state.blocks.length === 0) {
    return Object.freeze([
      Object.freeze({
        key: 'document',
        text: source,
        dimmed: false,
        exempt: false,
      }),
    ])
  }

  const segments: MarkdownEditorFocusSegment[] = []
  const ordered = [...state.blocks].sort(
    (left, right) => left.sourceRange[0] - right.sourceRange[0],
  )
  let offset = 0
  for (const block of ordered) {
    const start = Math.max(
      offset,
      Math.min(source.length, block.sourceRange[0]),
    )
    const end = Math.max(start, Math.min(source.length, block.sourceRange[1]))
    if (start > offset) {
      segments.push(
        Object.freeze({
          key: `gap:${offset}:${start}`,
          text: source.slice(offset, start),
          dimmed: false,
          exempt: true,
        }),
      )
    }
    if (end > start) {
      segments.push(
        Object.freeze({
          key: block.id,
          nodeId: block.id,
          text: source.slice(start, end),
          dimmed: block.dimmed,
          exempt: block.exempt,
        }),
      )
    }
    offset = Math.max(offset, end)
  }
  if (offset < source.length) {
    segments.push(
      Object.freeze({
        key: `gap:${offset}:${source.length}`,
        text: source.slice(offset),
        dimmed: false,
        exempt: true,
      }),
    )
  }
  return Object.freeze(segments)
}

export type MarkdownFocusMutationKind =
  | 'blur-hide'
  | 'dom-current-block'
  | 'selection-partial-dim'
  | 'ordinary-profile-observer'

export const evaluateMarkdownFocusMutations = (
  input: MarkdownEditorFocusInput,
) => {
  const authority = resolveFocusState(input)
  const same = (left: unknown, right: unknown) =>
    JSON.stringify(left) === JSON.stringify(right)
  const blurHideMutation = Object.freeze({
    ...authority,
    presentation: Object.freeze({
      dimmedOpacity: 0,
      blur: true,
      hidden: true,
      mask: true,
    }),
  })
  const firstBlock = authority.blocks[0]
  const domCurrentBlockMutation = Object.freeze({
    ...authority,
    activeBlockId: firstBlock?.id ?? null,
    activeBlockIds: Object.freeze(firstBlock ? [firstBlock.id] : []),
    blocks: Object.freeze(
      authority.blocks.map((block) =>
        Object.freeze({
          ...block,
          active: block.id === firstBlock?.id,
          dimmed: block.id !== firstBlock?.id && !block.exempt,
        }),
      ),
    ),
  })
  const selectionAnchor =
    input.selection?.direction === 'backward'
      ? input.selection.end
      : input.selection?.start
  const selectionPartialDimMutation =
    selectionAnchor === undefined
      ? authority
      : resolveFocusState({
          ...input,
          selection: {
            start: selectionAnchor,
            end: selectionAnchor,
            direction: 'none',
          },
        })
  const ordinaryProfileAuthority = resolveFocusState({
    ...input,
    editorProfile: 'markdown',
  })
  const ordinaryProfileObserverMutation = Object.freeze({
    ...ordinaryProfileAuthority,
    enabled: true,
    observerAttached: true,
  })
  const results = [
    ['blur-hide', same(authority, blurHideMutation)],
    ['dom-current-block', same(authority, domCurrentBlockMutation)],
    ['selection-partial-dim', same(authority, selectionPartialDimMutation)],
    [
      'ordinary-profile-observer',
      same(ordinaryProfileAuthority, ordinaryProfileObserverMutation),
    ],
  ] as const

  return Object.freeze({
    authority,
    mutations: Object.freeze([
      ...results.map(([kind, equivalent]) =>
        Object.freeze({ kind, equivalent, accepted: equivalent }),
      ),
    ]),
  })
}

export interface MarkdownEditorTypewriterScrollInput {
  readonly anchor?: MarkdownEditorTypewriterAnchor
  readonly caretSourceOffset: number
  readonly source: string
  readonly viewportHeight: number
  readonly lineHeight: number
  readonly stickyToolbarHeight?: number
  readonly safeAreaInsetTop?: number
  readonly safeAreaInsetBottom?: number
  readonly visualViewportHeight?: number
  readonly visualViewportOffsetTop?: number
  readonly sourceAnchorY?: number
  readonly reducedMotion?: boolean
}

export interface MarkdownEditorTypewriterScrollResult {
  readonly scrollTop: number
  readonly anchorRatio: number
  readonly caretLine: number
  readonly targetOffsetInViewport: number
  readonly smooth: boolean
}

export const calculateTypewriterScrollTarget = (
  input: MarkdownEditorTypewriterScrollInput,
): MarkdownEditorTypewriterScrollResult => {
  const textBefore = input.source.slice(0, input.caretSourceOffset)
  const caretLine = (textBefore.match(/\n/g) || []).length
  const caretY = input.sourceAnchorY ?? caretLine * input.lineHeight

  const effectiveViewportHeight =
    input.visualViewportHeight &&
    input.visualViewportHeight < input.viewportHeight
      ? input.visualViewportHeight
      : input.viewportHeight

  const toolbar = input.stickyToolbarHeight ?? 0
  const viewportOffset = input.visualViewportOffsetTop ?? 0
  const safeTop = input.safeAreaInsetTop ?? 0
  const safeBottom = input.safeAreaInsetBottom ?? 0
  const usableHeight = Math.max(
    100,
    effectiveViewportHeight - toolbar - safeTop - safeBottom,
  )

  const anchorRatio = input.anchor === 'center' ? 0.5 : 1 / 3
  const targetOffsetInViewport =
    viewportOffset + toolbar + safeTop + usableHeight * anchorRatio

  const scrollTop = Math.max(0, Math.round(caretY - targetOffsetInViewport))
  const smooth = input.reducedMotion !== true

  return Object.freeze({
    scrollTop,
    anchorRatio,
    caretLine,
    targetOffsetInViewport: Math.round(targetOffsetInViewport),
    smooth,
  })
}

export type MarkdownTypewriterMutationKind =
  | 'center-default'
  | 'selection-change-recenter'
  | 'dom-anchor'
  | 'scroll-stealing'
  | 'reduced-smooth-motion'

export const evaluateMarkdownTypewriterMutations = (
  options?: MarkdownEditorWritingAidsOptions,
) => {
  const resolved = resolveWritingAids(options)
  const controller = createWritingAidsController(options)

  const defaultResolved = resolveWritingAids()
  const centerDefaultEquivalent = defaultResolved.typewriterAnchor === 'center'

  const selResult = controller.handleSelectionChange()
  const selectionChangeRecenterEquivalent =
    (selResult as { scroll?: boolean }).scroll === true

  const sourceAnchor = calculateTypewriterScrollTarget({
    anchor: resolved.typewriterAnchor,
    caretSourceOffset: 12,
    lineHeight: 20,
    source: 'first\nsecond\nthird',
    viewportHeight: 600,
  })
  const domAnchorMutation = calculateTypewriterScrollTarget({
    anchor: resolved.typewriterAnchor,
    caretSourceOffset: 12,
    lineHeight: 20,
    source: 'first\nsecond\nthird',
    sourceAnchorY: 480,
    viewportHeight: 600,
  })
  const domAnchorEquivalent =
    JSON.stringify(sourceAnchor) === JSON.stringify(domAnchorMutation)

  controller.handleUserScroll()
  const suspendedState = controller.state
  const scrollStealingEquivalent = suspendedState !== 'user-scroll-suspended'

  const reducedController = createWritingAidsController({
    ...options,
    reducedMotion: true,
  } as MarkdownEditorWritingAidsOptions & Readonly<Record<string, unknown>>)
  const reducedResult = reducedController.handleInput()
  const reducedSmoothMotionEquivalent =
    (reducedResult as { smooth?: boolean }).smooth === true

  return Object.freeze({
    resolved,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'center-default' as const,
        equivalent: centerDefaultEquivalent,
        accepted: centerDefaultEquivalent,
      }),
      Object.freeze({
        kind: 'selection-change-recenter' as const,
        equivalent: selectionChangeRecenterEquivalent,
        accepted: selectionChangeRecenterEquivalent,
      }),
      Object.freeze({
        kind: 'dom-anchor' as const,
        equivalent: domAnchorEquivalent,
        accepted: domAnchorEquivalent,
      }),
      Object.freeze({
        kind: 'scroll-stealing' as const,
        equivalent: scrollStealingEquivalent,
        accepted: scrollStealingEquivalent,
      }),
      Object.freeze({
        kind: 'reduced-smooth-motion' as const,
        equivalent: reducedSmoothMotionEquivalent,
        accepted: reducedSmoothMotionEquivalent,
      }),
    ]),
  })
}

export interface MarkdownEditorWritingAidsController {
  readonly options: MarkdownEditorResolvedWritingAids
  readonly state: MarkdownEditorWritingAidsState
  readonly suspendReason?: MarkdownEditorWritingAidsSuspendReason
  input(): MarkdownEditorWritingAidsState
  navigate(): MarkdownEditorWritingAidsState
  resume(): MarkdownEditorWritingAidsState
  suspend(
    reason: MarkdownEditorWritingAidsSuspendReason,
  ): MarkdownEditorWritingAidsState
  readonly currentBlock?: Readonly<Record<string, unknown>> | null
  readonly caretAnchor?: Readonly<Record<string, unknown>> | null
  readonly focusState?: MarkdownEditorFocusState
  calculateScroll(
    input: MarkdownEditorTypewriterScrollInput,
  ): MarkdownEditorTypewriterScrollResult
  handleUserScroll(): Readonly<Record<string, unknown>>
  handleSelectionChange(): Readonly<Record<string, unknown>>
  handleInput(): Readonly<Record<string, unknown>>
  handleExplicitNavigation(): Readonly<Record<string, unknown>>
  handleNavigation(): Readonly<Record<string, unknown>>
  handleCompositionStart(): Readonly<Record<string, unknown>>
  handleCompositionEnd(): Readonly<Record<string, unknown>>
  handleSelectionDragStart(): Readonly<Record<string, unknown>>
  handleSelectionDragEnd(): Readonly<Record<string, unknown>>
  handleProjectionChange(): Readonly<Record<string, unknown>>
  handleAsyncLayoutChange(): Readonly<Record<string, unknown>>
  updateDocument(document?: Readonly<Record<string, unknown>>): void
}

const sameDocumentValue = (left: unknown, right: unknown) => {
  if (left === right) return true
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const a = left as Readonly<Record<string, unknown>>
    const b = right as Readonly<Record<string, unknown>>
    return a.id === b.id && a.epoch === b.epoch
  }
  return false
}

export const createWritingAidsController = (
  options?:
    | MarkdownEditorWritingAidsOptions
    | (MarkdownEditorWritingAidsOptions & Readonly<Record<string, unknown>>),
): MarkdownEditorWritingAidsController => {
  let resolved = resolveWritingAids(options)
  let state: MarkdownEditorWritingAidsState = 'idle'
  let suspendReason: MarkdownEditorWritingAidsSuspendReason | undefined
  let documentState: Readonly<Record<string, unknown>> =
    (options as Readonly<Record<string, unknown>> | undefined) ??
    Object.freeze({})
  const readProjection = () =>
    documentState.projection as Readonly<Record<string, unknown>> | undefined
  const readCurrentBlock = () => {
    const projection = readProjection()
    return (documentState.currentBlock ??
      projection?.currentBlock ??
      projection?.block) as Readonly<Record<string, unknown>> | undefined
  }
  const readCaretAnchor = () => {
    const projection = readProjection()
    return (documentState.caretAnchor ??
      projection?.caretAnchor ??
      projection?.viewportAnchor) as
      | Readonly<Record<string, unknown>>
      | undefined
  }
  let currentBlock: Readonly<Record<string, unknown>> | null | undefined =
    readCurrentBlock()
  let caretAnchor: Readonly<Record<string, unknown>> | null | undefined =
    readCaretAnchor() ??
    (typeof currentBlock?.id === 'string'
      ? Object.freeze({ blockId: currentBlock.id })
      : undefined)
  const reducedMotion = () => documentState.reducedMotion === true
  const response = (scroll: boolean) =>
    Object.freeze({
      scroll,
      smooth: scroll && !reducedMotion(),
      state,
      suspendReason,
    })

  const controller: MarkdownEditorWritingAidsController = {
    get options() {
      return resolved
    },
    get state() {
      return state
    },
    get suspendReason() {
      return suspendReason
    },
    get currentBlock() {
      return currentBlock
    },
    get caretAnchor() {
      return caretAnchor
    },
    get focusState() {
      const projection = readProjection()
      return resolveFocusState({
        writingAids: resolved,
        source:
          typeof documentState.source === 'string' ? documentState.source : '',
        projection: projection as MarkdownEditorFocusInput['projection'],
        selection:
          documentState.selection as MarkdownEditorFocusInput['selection'],
        editorProfile:
          typeof documentState.editorProfile === 'string'
            ? documentState.editorProfile
            : 'markdown',
        readonly: documentState.readonly === true,
        disabled: documentState.disabled === true,
        mode:
          typeof documentState.mode === 'string'
            ? documentState.mode
            : undefined,
        exemptions: documentState.focusExemptions as
          | MarkdownEditorFocusExemptions
          | undefined,
      })
    },
    calculateScroll(scrollInput) {
      return calculateTypewriterScrollTarget({
        ...scrollInput,
        anchor: resolved.typewriterAnchor,
        reducedMotion: scrollInput.reducedMotion ?? reducedMotion(),
      })
    },
    input() {
      state = suspendReason ? 'restoring' : 'input-driven'
      suspendReason = undefined
      return state
    },
    navigate() {
      state = 'explicit-navigation'
      suspendReason = undefined
      return state
    },
    resume() {
      state = 'restoring'
      suspendReason = undefined
      return state
    },
    suspend(reason) {
      suspendReason = reason
      state = `${reason}-suspended` as MarkdownEditorWritingAidsState
      return state
    },
    handleUserScroll() {
      this.suspend('user-scroll')
      return response(false)
    },
    handleSelectionChange() {
      return response(false)
    },
    handleInput() {
      if (suspendReason) {
        state = 'restoring'
        suspendReason = undefined
        return response(false)
      }
      state = 'input-driven'
      return response(true)
    },
    handleExplicitNavigation() {
      state = 'explicit-navigation'
      suspendReason = undefined
      return response(true)
    },
    handleNavigation() {
      state = 'explicit-navigation'
      suspendReason = undefined
      return response(true)
    },
    handleCompositionStart() {
      this.suspend('composition')
      return response(false)
    },
    handleCompositionEnd() {
      if (suspendReason === 'composition') {
        state = 'idle'
        suspendReason = undefined
      }
      return response(false)
    },
    handleSelectionDragStart() {
      this.suspend('selection-drag')
      return response(false)
    },
    handleSelectionDragEnd() {
      if (suspendReason === 'selection-drag') {
        state = 'idle'
        suspendReason = undefined
      }
      return response(false)
    },
    handleProjectionChange() {
      return response(false)
    },
    handleAsyncLayoutChange() {
      const mayRestore =
        resolved.typewriter &&
        !suspendReason &&
        (state === 'input-driven' ||
          state === 'explicit-navigation')
      return response(mayRestore)
    },
    updateDocument(document = Object.freeze({})) {
      const previousIdentity = documentState.documentIdentity
      const previousEpoch = documentState.documentEpoch
      documentState = Object.freeze({ ...documentState, ...document })
      if (document.writingAids !== undefined) {
        resolved = resolveWritingAids({
          writingAids: document.writingAids,
        } as MarkdownEditorWritingAidsOptions &
          Readonly<Record<string, unknown>>)
      }
      const identityChanged =
        (document.documentIdentity !== undefined &&
          !sameDocumentValue(document.documentIdentity, previousIdentity)) ||
        (document.documentEpoch !== undefined &&
          document.documentEpoch !== previousEpoch)
      if (identityChanged) {
        state = 'idle'
        suspendReason = undefined
      }
      currentBlock = readCurrentBlock() ?? null
      caretAnchor =
        readCaretAnchor() ??
        (typeof currentBlock?.id === 'string'
          ? Object.freeze({ blockId: currentBlock.id })
          : null)
      if (identityChanged && !document.projection && !document.currentBlock) {
        currentBlock = null
        caretAnchor = null
      }
    },
  }

  return controller
}
