import type { Page } from '@playwright/test'
import {
  SAFE_AREA_ASSERTION_NAMES,
  SAFE_AREA_CSS_VARS,
  SAFE_AREA_LAB_SURFACES,
  SAFE_AREA_PROFILES,
  SAFE_AREA_PROFILE_IDS,
  SAFE_AREA_ACCEPTANCE_MATRIX,
  SAFE_AREA_SMOKE_MATRIX,
  getSafeAreaProfile,
  profileCssVariableOverrides,
  safeRectFromProfile,
  selectSafeAreaMatrix,
} from '../../../scripts/safe-area-profiles.mjs'

export type SafeAreaProfileId =
  | 'no-inset'
  | 'portrait-notch'
  | 'landscape-notch'
  | 'short-visual'

export type SafeAreaInsets = {
  top: number
  right: number
  bottom: number
  left: number
}

export type SafeAreaProfile = {
  id: SafeAreaProfileId
  viewport: { width: number; height: number }
  insets: SafeAreaInsets
}

export {
  SAFE_AREA_ASSERTION_NAMES,
  SAFE_AREA_CSS_VARS,
  SAFE_AREA_LAB_SURFACES,
  SAFE_AREA_PROFILES,
  SAFE_AREA_PROFILE_IDS,
  SAFE_AREA_ACCEPTANCE_MATRIX,
  SAFE_AREA_SMOKE_MATRIX,
  getSafeAreaProfile,
  profileCssVariableOverrides,
  safeRectFromProfile,
  selectSafeAreaMatrix,
}

/**
 * Apply a SafeAreaProfile by overriding only #260 canonical CSS variables.
 * Never patches component selectors or mocks geometry APIs.
 */
export const applySafeAreaProfile = async (
  page: Page,
  profile: SafeAreaProfile,
) => {
  await page.setViewportSize(profile.viewport)
  const overrides = profileCssVariableOverrides(profile)
  await page.evaluate((cssVars) => {
    const root = document.documentElement
    for (const [name, value] of Object.entries(cssVars)) {
      root.style.setProperty(name, value)
    }
  }, overrides)
}

export const clearSafeAreaProfileOverrides = async (page: Page) => {
  await page.evaluate((names: string[]) => {
    const root = document.documentElement
    for (const name of names) {
      root.style.removeProperty(name)
    }
  }, [...SAFE_AREA_CSS_VARS])
}

export const resolveSafeAreaMatrixMode = (): 'full' | 'smoke' => {
  const raw = (process.env.FSUS_SAFE_AREA_MATRIX_MODE ?? 'full').trim()
  return raw === 'smoke' ? 'smoke' : 'full'
}
