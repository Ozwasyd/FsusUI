export type VisualProjectName =
  | 'desktop-light'
  | 'mobile-light'
  | 'desktop-dark'
  | 'mobile-dark'

export type VisualVariant = Readonly<{
  theme: 'light' | 'dark'
  compact: boolean
  viewportClass: 'desktop' | 'mobile'
}>

export const VISUAL_PROJECT_NAMES: readonly VisualProjectName[]
export const VISUAL_SPEC_OWNERSHIP: Readonly<{
  desktop: readonly string[]
  mobile: readonly string[]
}>
export const CROSS_THEME_CONTRACTS: readonly Readonly<{
  file: string
  project: VisualProjectName
  owner: string
  reason: string
}>[]

export function resolveVisualVariant(projectName: string): VisualVariant
export function buildVisualUrl(
  visual: string,
  projectName: string,
  query?: Readonly<Record<string, string | number | boolean | undefined>>,
): string
export function visualProjectTestIgnore(projectName: string): string[]
