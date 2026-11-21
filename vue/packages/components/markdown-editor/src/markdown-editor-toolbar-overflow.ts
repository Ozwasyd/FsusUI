export interface MarkdownEditorToolbarOverflowInput {
  readonly availableWidth: number
  readonly commandWidths: readonly number[]
  readonly commandsGap: number
  readonly groupGap: number
  readonly hasBaseOverflow: boolean
  readonly overflowTriggerWidth: number
  readonly reservedEndWidth?: number
}

/**
 * Pure container-width calculation for responsive toolbar primary commands.
 *
 * Returns `null` when geometry is unavailable (SSR / jsdom zero-width layout)
 * so consumers retain configured primary commands untouched.
 */
export const resolveMarkdownEditorFittingCommandCount = (
  input: MarkdownEditorToolbarOverflowInput,
): number | null => {
  const {
    availableWidth,
    commandWidths,
    commandsGap,
    groupGap,
    hasBaseOverflow,
    overflowTriggerWidth,
    reservedEndWidth = 0,
  } = input

  if (
    !Number.isFinite(availableWidth) ||
    availableWidth <= 0 ||
    commandWidths.length === 0
  ) {
    return null
  }

  for (const width of commandWidths) {
    if (!Number.isFinite(width) || width <= 0) {
      return null
    }
  }

  const safeCommandsGap =
    Number.isFinite(commandsGap) && commandsGap > 0
      ? Math.ceil(commandsGap)
      : 0
  const safeGroupGap =
    Number.isFinite(groupGap) && groupGap > 0 ? Math.ceil(groupGap) : 0
  const safeReservedEnd =
    Number.isFinite(reservedEndWidth) && reservedEndWidth > 0
      ? Math.ceil(reservedEndWidth)
      : 0
  const budget = Math.floor(availableWidth)

  let allCommandsWidth = 0
  for (let index = 0; index < commandWidths.length; index += 1) {
    allCommandsWidth += Math.ceil(commandWidths[index]!)
    if (index > 0) allCommandsWidth += safeCommandsGap
  }
  if (safeReservedEnd > 0) {
    allCommandsWidth += safeCommandsGap + safeReservedEnd
  }

  if (!hasBaseOverflow && allCommandsWidth <= budget) {
    return commandWidths.length
  }

  if (!Number.isFinite(overflowTriggerWidth) || overflowTriggerWidth <= 0) {
    return null
  }

  const commandsBudget =
    budget - (Math.ceil(overflowTriggerWidth) + safeGroupGap)
  if (commandsBudget <= 0) {
    return 0
  }

  let fitCount = 0
  let usedWidth = safeReservedEnd
  for (let index = 0; index < commandWidths.length; index += 1) {
    const itemWidth = Math.ceil(commandWidths[index]!)
    const nextWidth =
      usedWidth > 0 ? usedWidth + safeCommandsGap + itemWidth : itemWidth
    if (nextWidth > commandsBudget) {
      break
    }
    usedWidth = nextWidth
    fitCount += 1
  }

  return fitCount
}
