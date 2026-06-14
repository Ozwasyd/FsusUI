import { motionCssVars } from '../tokens'
import { motionRecipeNames } from '../types'
import { runMotion } from '../runtime'
import type {
  MotionBudgetConfig,
  MotionOptions,
  MotionPresetName,
  MotionRecipeDefinition,
  MotionRecipeName,
  MotionRunOptions,
  MotionRuntimeControls,
} from '../types'

export type MotionRecipeOptions = Omit<MotionOptions, 'name'> & {
  name?: MotionRecipeName
  recipe?: MotionRecipeName
  preset?: MotionPresetName
}

export type MotionRecipeValue =
  | MotionRecipeName
  | MotionRecipeOptions
  | false
  | null
  | undefined

const terminalFallback = 'terminal' as const

export const motionRecipes: Record<MotionRecipeName, MotionRecipeDefinition> = {
  'content-enter': {
    name: 'content-enter',
    intent: 'Introduce ordinary content without making the page feel staged.',
    preset: 'surface-settle',
    durationClass: 'base',
    allowedTargets: ['section', 'article-list', 'comment-list'],
    reducedFallback: terminalFallback,
    disabledFallback: terminalFallback,
  },
  'article-list-enter': {
    name: 'article-list-enter',
    intent: 'Reveal a short article list while preserving reading flow.',
    preset: 'index-list-settle',
    durationClass: 'base',
    allowedTargets: ['article-list'],
    reducedFallback: terminalFallback,
    disabledFallback: terminalFallback,
    maxItemCount: 20,
    budget: { maxStaggerItems: 20 },
  },
  'island-enter': {
    name: 'island-enter',
    intent: 'Mount dynamic or async islands with a small, delayed entrance.',
    preset: 'paper-settle',
    durationClass: 'base',
    allowedTargets: ['dynamic-island', 'async-region'],
    reducedFallback: terminalFallback,
    disabledFallback: terminalFallback,
  },
  'state-pending': {
    name: 'state-pending',
    intent: 'Show an operation is in progress without moving layout.',
    preset: 'banner-receipt',
    durationClass: 'fast',
    allowedTargets: ['task-region', 'button', 'row'],
    reducedFallback: 'opacity-only',
    disabledFallback: terminalFallback,
  },
  'state-settled': {
    name: 'state-settled',
    intent: 'Acknowledge a completed state change with a brief highlight.',
    preset: 'toast-receipt',
    durationClass: 'fast',
    allowedTargets: ['task-region', 'row', 'message'],
    reducedFallback: 'opacity-only',
    disabledFallback: terminalFallback,
  },
  'state-error': {
    name: 'state-error',
    intent: 'Expose an error state with color and opacity, not shake motion.',
    preset: 'banner-receipt',
    durationClass: 'fast',
    allowedTargets: ['task-region', 'row', 'form-field'],
    reducedFallback: 'opacity-only',
    disabledFallback: terminalFallback,
  },
  'route-crossfade': {
    name: 'route-crossfade',
    intent: 'Transition the main route body without directional travel.',
    preset: 'route-settle',
    durationClass: 'route',
    allowedTargets: ['route-view', 'page-main'],
    reducedFallback: terminalFallback,
    disabledFallback: terminalFallback,
  },
  'reading-anchor-highlight': {
    name: 'reading-anchor-highlight',
    intent: 'Mark the target of a reading anchor jump once.',
    preset: 'surface-settle',
    durationClass: 'fast',
    allowedTargets: ['heading', 'toc-target', 'comment'],
    reducedFallback: 'opacity-only',
    disabledFallback: terminalFallback,
  },
  'panel-enter': {
    name: 'panel-enter',
    intent: 'Open an overlay, drawer, or dialog panel.',
    preset: 'dialog-settle',
    durationClass: 'panel',
    allowedTargets: ['dialog', 'drawer', 'popover', 'menu'],
    reducedFallback: terminalFallback,
    disabledFallback: terminalFallback,
  },
  'list-enter-small': {
    name: 'list-enter-small',
    intent: 'Stagger a small bounded list.',
    preset: 'index-list-settle',
    durationClass: 'base',
    allowedTargets: ['menu', 'short-list', 'navigation'],
    reducedFallback: terminalFallback,
    disabledFallback: terminalFallback,
    maxItemCount: 20,
    budget: { maxStaggerItems: 20 },
  },
  'card-interactive': {
    name: 'card-interactive',
    intent: 'Give a clickable card subtle hover or press feedback.',
    preset: 'card-hover',
    durationClass: 'fast',
    allowedTargets: ['card', 'media-card', 'dashboard-entry'],
    reducedFallback: terminalFallback,
    disabledFallback: terminalFallback,
  },
  'page-enter': {
    name: 'page-enter',
    intent: 'Introduce a page body after navigation.',
    preset: 'route-settle',
    durationClass: 'route',
    allowedTargets: ['page-main', 'route-view'],
    reducedFallback: terminalFallback,
    disabledFallback: terminalFallback,
  },
  'media-hover-subtle': {
    name: 'media-hover-subtle',
    intent: 'Provide a bounded media hover state without gloss.',
    preset: 'card-hover',
    durationClass: 'fast',
    allowedTargets: ['image', 'media', 'thumbnail'],
    reducedFallback: terminalFallback,
    disabledFallback: terminalFallback,
  },
}

const durationForRecipe = (recipe: MotionRecipeDefinition) =>
  motionCssVars.duration[recipe.durationClass] ?? motionCssVars.duration.base

const budgetForRecipe = (
  recipe: MotionRecipeDefinition,
  budget?: Partial<MotionBudgetConfig>,
) => ({
  ...recipe.budget,
  ...(recipe.maxItemCount ? { maxStaggerItems: recipe.maxItemCount } : {}),
  ...budget,
})

export const isMotionRecipeName = (value: unknown): value is MotionRecipeName =>
  motionRecipeNames.includes(value as MotionRecipeName)

export const resolveMotionRecipeName = (
  value: unknown,
  fallback: MotionRecipeName = 'content-enter',
): MotionRecipeName => (isMotionRecipeName(value) ? value : fallback)

export const getMotionRecipe = (name: unknown): MotionRecipeDefinition =>
  motionRecipes[resolveMotionRecipeName(name)]

export const normalizeMotionRecipeOptions = (
  value: MotionRecipeValue,
  fallback: MotionRecipeName = 'content-enter',
): MotionRunOptions & { recipe: MotionRecipeName } => {
  if (typeof value === 'string') {
    const recipe = getMotionRecipe(value)
    return {
      name: recipe.preset,
      recipe: recipe.name,
      duration: durationForRecipe(recipe),
      budget: budgetForRecipe(recipe),
    }
  }

  if (value === false || value == null) {
    const recipe = getMotionRecipe(fallback)
    return {
      name: recipe.preset,
      recipe: recipe.name,
      duration: durationForRecipe(recipe),
      disabled: value === false,
      budget: budgetForRecipe(recipe),
    }
  }

  const recipe = getMotionRecipe(value.recipe ?? value.name ?? fallback)
  return {
    ...value,
    name: value.preset ?? recipe.preset,
    recipe: recipe.name,
    duration: value.duration ?? durationForRecipe(recipe),
    budget: budgetForRecipe(recipe, value.budget),
  }
}

export const runMotionRecipe = (
  el: HTMLElement,
  value: MotionRecipeValue,
): MotionRuntimeControls => runMotion(el, normalizeMotionRecipeOptions(value))

export const motion = {
  recipe: getMotionRecipe,
  recipes: motionRecipes,
}
