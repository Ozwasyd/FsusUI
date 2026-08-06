export type SafeAreaProfileId =
  | 'no-inset'
  | 'portrait-notch'
  | 'landscape-notch'
  | 'short-visual'

export interface SafeAreaInsets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface SafeAreaProfile {
  id: SafeAreaProfileId
  viewport: {
    width: number
    height: number
  }
  insets: SafeAreaInsets
}

export const SAFE_AREA_CSS_VARS: readonly string[]
export const SAFE_AREA_PROFILES: Readonly<
  Record<SafeAreaProfileId, SafeAreaProfile>
>
export const SAFE_AREA_PROFILE_IDS: readonly SafeAreaProfileId[]
export const SAFE_AREA_LAB_SURFACES: readonly string[]
export const SAFE_AREA_ACCEPTANCE_MATRIX: readonly {
  component: string
  profileId: SafeAreaProfileId
  required: boolean
}[]
export const SAFE_AREA_SMOKE_MATRIX: readonly {
  component: string
  profileId: SafeAreaProfileId
}[]
export const SAFE_AREA_ASSERTION_NAMES: readonly string[]

export function profileCssVariableOverrides(
  profile: SafeAreaProfile,
): Record<string, string>
export function safeRectFromProfile(profile: SafeAreaProfile): {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}
export function getSafeAreaProfile(id: SafeAreaProfileId): SafeAreaProfile
export function selectSafeAreaMatrix(mode?: 'full' | 'smoke'): Array<{
  component: string
  profileId: SafeAreaProfileId
  required: boolean
}>
