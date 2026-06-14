import type { MotionBudgetConfig, MotionStyleState } from './types'

export const defaultMotionBudget: MotionBudgetConfig = {
  maxStaggerItems: 20,
  maxAnimatedNodesPerViewport: 40,
  disableScrollEffectsBelowFps: 45,
  disableBlurOnLowPower: true,
  disableParallaxOnTouch: true,
  preferCssWhenPossible: true,
  allowedProperties: ['opacity', 'transform', 'filter'],
}

let configuredMotionBudget: Partial<MotionBudgetConfig> = {}
let activeMotionNodeCount = 0

const numberFromDataset = (name: string) => {
  if (typeof document === 'undefined') return undefined

  const value = document.documentElement.dataset[name]
  if (!value) return undefined

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const rootBudget = (): Partial<MotionBudgetConfig> => {
  const budget: Partial<MotionBudgetConfig> = {}
  const maxStaggerItems = numberFromDataset('fsusMotionMaxStaggerItems')
  const maxAnimatedNodesPerViewport = numberFromDataset(
    'fsusMotionMaxAnimatedNodesPerViewport',
  )

  if (maxStaggerItems !== undefined) budget.maxStaggerItems = maxStaggerItems
  if (maxAnimatedNodesPerViewport !== undefined) {
    budget.maxAnimatedNodesPerViewport = maxAnimatedNodesPerViewport
  }

  return budget
}

export const setMotionBudget = (budget: Partial<MotionBudgetConfig> = {}) => {
  configuredMotionBudget = { ...budget }
}

export const getMotionBudget = () => configuredMotionBudget

export const resolveMotionBudget = (
  overrides: Partial<MotionBudgetConfig> = {},
): MotionBudgetConfig => ({
  ...defaultMotionBudget,
  ...rootBudget(),
  ...configuredMotionBudget,
  ...overrides,
  allowedProperties:
    overrides.allowedProperties ??
    configuredMotionBudget.allowedProperties ??
    defaultMotionBudget.allowedProperties,
})

export const clampStaggerIndex = (
  index: number,
  budget: MotionBudgetConfig,
) => Math.min(Math.max(0, index), Math.max(0, budget.maxStaggerItems - 1))

export const claimMotionBudgetNode = (budget: MotionBudgetConfig) => {
  if (budget.maxAnimatedNodesPerViewport <= 0) return false
  if (activeMotionNodeCount >= budget.maxAnimatedNodesPerViewport) return false

  activeMotionNodeCount += 1
  return true
}

export const releaseMotionBudgetNode = () => {
  activeMotionNodeCount = Math.max(0, activeMotionNodeCount - 1)
}

export const isMotionPropertyAllowed = (
  property: keyof MotionStyleState,
  budget: MotionBudgetConfig,
) => budget.allowedProperties.includes(property)
