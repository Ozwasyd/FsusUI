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
  options:
    | (MarkdownEditorWritingAidsOptions & Readonly<Record<string, unknown>>)
    | undefined = undefined,
): MarkdownEditorResolvedWritingAids =>
  Object.freeze({
    focus: (options?.writingAids as MarkdownEditorWritingAidsOptions | undefined)?.focus === true || options?.focus === true,
    typewriter:
      (options?.writingAids as MarkdownEditorWritingAidsOptions | undefined)
        ?.typewriter === true || options?.typewriter === true,
    typewriterAnchor:
      (options?.writingAids as MarkdownEditorWritingAidsOptions | undefined)
        ?.typewriterAnchor ??
      options?.typewriterAnchor ??
      defaults.typewriterAnchor,
  })

export interface MarkdownEditorWritingAidsController {
  readonly options: MarkdownEditorResolvedWritingAids
  readonly state: MarkdownEditorWritingAidsState
  readonly suspendReason?: MarkdownEditorWritingAidsSuspendReason
  input(): MarkdownEditorWritingAidsState
  navigate(): MarkdownEditorWritingAidsState
  resume(): MarkdownEditorWritingAidsState
  suspend(reason: MarkdownEditorWritingAidsSuspendReason): MarkdownEditorWritingAidsState
  readonly currentBlock?: Readonly<Record<string, unknown>>
  readonly caretAnchor?: Readonly<Record<string, unknown>>
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
  updateDocument(document: Readonly<Record<string, unknown>>): void
}

export const createWritingAidsController = (
  options?: MarkdownEditorWritingAidsOptions & Readonly<Record<string, unknown>>,
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
  let currentBlock = candidateBlock
  let caretAnchor =
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
      currentBlock = null as unknown as undefined
      caretAnchor = null as unknown as undefined
    },
  }

  return controller
}
