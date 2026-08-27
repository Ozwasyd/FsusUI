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
  const nested = (options as Readonly<Record<string, unknown>> | undefined)?.writingAids as
    | MarkdownEditorWritingAidsOptions
    | undefined
  return Object.freeze({
    focus: nested?.focus === true || options?.focus === true,
    typewriter: nested?.typewriter === true || options?.typewriter === true,
    typewriterAnchor:
      nested?.typewriterAnchor ?? options?.typewriterAnchor ?? defaults.typewriterAnchor,
  })
}

export interface MarkdownEditorFocusExemptions {
  readonly searchMatches?: readonly (number | readonly [number, number] | string)[]
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
  readonly readonly?: boolean
  readonly disabled?: boolean
  readonly source: string
  readonly projection?: {
    readonly nodes?: readonly {
      readonly id: string
      readonly kind: string
      readonly rawRange: { readonly start: number; readonly end: number }
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
  const isSameDoc =
    (!input.previousDocumentId ||
      !input.currentDocumentId ||
      input.previousDocumentId === input.currentDocumentId) &&
    (!input.previousEpoch ||
      !input.currentEpoch ||
      input.previousEpoch === input.currentEpoch)

  if (!isFocusOption || !isProse || !isEditable || !isSameDoc) {
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

  const rawNodes = input.projection?.nodes ?? []
  const nodes = rawNodes.length > 0
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
    if (ex.screenReaderBrowseTargetId) exemptNodeIds.push(ex.screenReaderBrowseTargetId)
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
      sourceRange: Object.freeze([node.rawRange.start, node.rawRange.end] as const),
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

export type MarkdownFocusMutationKind =
  | 'blur-hide'
  | 'dom-current-block'
  | 'selection-partial-dim'
  | 'ordinary-profile-observer'

export const evaluateMarkdownFocusMutations = (
  input: MarkdownEditorFocusInput,
) => {
  const authority = resolveFocusState(input)

  const presentation = authority.presentation as {
    blur?: boolean
    hidden?: boolean
    mask?: boolean
    dimmedOpacity: number
  }
  const blurHideEquivalent =
    presentation.blur === true ||
    presentation.hidden === true ||
    presentation.mask === true ||
    presentation.dimmedOpacity < 0.4

  const domCurrentBlockEquivalent = false

  let selectionPartialDimEquivalent = false
  if (input.selection && input.selection.start !== input.selection.end) {
    const selStart = Math.min(input.selection.start, input.selection.end)
    const selEnd = Math.max(input.selection.start, input.selection.end)
    for (const b of authority.blocks) {
      const intersects = !(b.sourceRange[1] < selStart || b.sourceRange[0] > selEnd)
      if (intersects && b.dimmed) {
        selectionPartialDimEquivalent = true
        break
      }
    }
  }

  const ordinaryProfileState = resolveFocusState({
    ...input,
    editorProfile: 'markdown',
  })
  const ordinaryProfileObserverEquivalent = ordinaryProfileState.enabled === true

  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'blur-hide' as const,
        equivalent: blurHideEquivalent,
        accepted: false,
      }),
      Object.freeze({
        kind: 'dom-current-block' as const,
        equivalent: domCurrentBlockEquivalent,
        accepted: false,
      }),
      Object.freeze({
        kind: 'selection-partial-dim' as const,
        equivalent: selectionPartialDimEquivalent,
        accepted: false,
      }),
      Object.freeze({
        kind: 'ordinary-profile-observer' as const,
        equivalent: ordinaryProfileObserverEquivalent,
        accepted: false,
      }),
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
  const caretY = caretLine * input.lineHeight

  const effectiveViewportHeight =
    input.visualViewportHeight && input.visualViewportHeight < input.viewportHeight
      ? input.visualViewportHeight
      : input.viewportHeight

  const toolbar = input.stickyToolbarHeight ?? 0
  const safeTop = input.safeAreaInsetTop ?? 0
  const safeBottom = input.safeAreaInsetBottom ?? 0
  const usableHeight = Math.max(100, effectiveViewportHeight - toolbar - safeTop - safeBottom)

  const anchorRatio = input.anchor === 'center' ? 0.5 : 1 / 3
  const targetOffsetInViewport = toolbar + safeTop + usableHeight * anchorRatio

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
  const selectionChangeRecenterEquivalent = (selResult as { scroll?: boolean }).scroll === true

  const domAnchorEquivalent = false

  controller.handleUserScroll()
  const suspendedState = controller.state
  const scrollStealingEquivalent = suspendedState !== 'user-scroll-suspended'

  const reducedController = createWritingAidsController({
    ...options,
    reducedMotion: true,
  } as MarkdownEditorWritingAidsOptions & Readonly<Record<string, unknown>>)
  const reducedResult = reducedController.handleInput()
  const reducedSmoothMotionEquivalent = (reducedResult as { smooth?: boolean }).smooth === true

  return Object.freeze({
    resolved,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'center-default' as const,
        equivalent: centerDefaultEquivalent,
        accepted: false,
      }),
      Object.freeze({
        kind: 'selection-change-recenter' as const,
        equivalent: selectionChangeRecenterEquivalent,
        accepted: false,
      }),
      Object.freeze({
        kind: 'dom-anchor' as const,
        equivalent: domAnchorEquivalent,
        accepted: false,
      }),
      Object.freeze({
        kind: 'scroll-stealing' as const,
        equivalent: scrollStealingEquivalent,
        accepted: false,
      }),
      Object.freeze({
        kind: 'reduced-smooth-motion' as const,
        equivalent: reducedSmoothMotionEquivalent,
        accepted: false,
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
  suspend(reason: MarkdownEditorWritingAidsSuspendReason): MarkdownEditorWritingAidsState
  readonly currentBlock?: Readonly<Record<string, unknown>> | null
  readonly caretAnchor?: Readonly<Record<string, unknown>> | null
  readonly focusState?: MarkdownEditorFocusState
  calculateScroll(input: MarkdownEditorTypewriterScrollInput): MarkdownEditorTypewriterScrollResult
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
  updateDocument(document?: Readonly<Record<string, unknown>>): void
}

export const createWritingAidsController = (
  options?:
    | MarkdownEditorWritingAidsOptions
    | (MarkdownEditorWritingAidsOptions & Readonly<Record<string, unknown>>),
): MarkdownEditorWritingAidsController => {
  const resolved = resolveWritingAids(options)
  let state: MarkdownEditorWritingAidsState = 'idle'
  let suspendReason: MarkdownEditorWritingAidsSuspendReason | undefined
  const source = options as Readonly<Record<string, unknown>> | undefined
  const projection = source?.projection as Readonly<Record<string, unknown>> | undefined
  const candidateBlock =
    (source?.currentBlock ?? projection?.currentBlock ?? projection?.block) as
      | Readonly<Record<string, unknown>>
      | undefined
  const candidateAnchor =
    (source?.caretAnchor ?? projection?.caretAnchor ?? projection?.viewportAnchor) as
      | Readonly<Record<string, unknown>>
      | undefined
  let currentBlock: Readonly<Record<string, unknown>> | null | undefined = candidateBlock
  let caretAnchor: Readonly<Record<string, unknown>> | null | undefined =
    candidateAnchor ??
    (typeof candidateBlock?.id === 'string'
      ? Object.freeze({ blockId: candidateBlock.id })
      : undefined)
  const reducedMotion = source?.reducedMotion === true
  const response = (scroll: boolean) =>
    Object.freeze({
      scroll,
      smooth: scroll && !reducedMotion,
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
      return resolveFocusState({
        writingAids: resolved,
        source: typeof source?.source === 'string' ? source.source : '',
        projection: projection as MarkdownEditorFocusInput['projection'],
        editorProfile: typeof source?.editorProfile === 'string' ? source.editorProfile : 'markdown',
        readonly: source?.readonly === true,
        disabled: source?.disabled === true,
      })
    },
    calculateScroll(scrollInput) {
      return calculateTypewriterScrollTarget({
        ...scrollInput,
        anchor: resolved.typewriterAnchor,
        reducedMotion,
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
      state = suspendReason ? 'restoring' : 'input-driven'
      suspendReason = undefined
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
    updateDocument() {
      state = 'idle'
      suspendReason = undefined
      currentBlock = null
      caretAnchor = null
    },
  }

  return controller
}
