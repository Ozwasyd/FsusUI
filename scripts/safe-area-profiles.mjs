/**
 * Canonical SafeAreaProfile definitions for viewport-safe overlay geometry.
 *
 * Single source for #262 matrix tests, unit probes, and contract gates.
 * Profiles only declare viewport size + four-direction inset overrides for the
 * #260 CSS variables. They must never carry component-selector patches.
 */

/** @typedef {'no-inset' | 'portrait-notch' | 'landscape-notch' | 'short-visual'} SafeAreaProfileId */

/**
 * @typedef {object} SafeAreaInsets
 * @property {number} top
 * @property {number} right
 * @property {number} bottom
 * @property {number} left
 */

/**
 * @typedef {object} SafeAreaProfile
 * @property {SafeAreaProfileId} id
 * @property {{ width: number, height: number }} viewport
 * @property {SafeAreaInsets} insets
 */

export const SAFE_AREA_CSS_VARS = Object.freeze([
  '--fsus-safe-area-inset-top',
  '--fsus-safe-area-inset-right',
  '--fsus-safe-area-inset-bottom',
  '--fsus-safe-area-inset-left',
  '--fsus-viewport-block-size',
])

/** @type {Readonly<Record<SafeAreaProfileId, SafeAreaProfile>>} */
export const SAFE_AREA_PROFILES = Object.freeze({
  'no-inset': Object.freeze({
    id: 'no-inset',
    viewport: Object.freeze({ width: 390, height: 844 }),
    insets: Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 }),
  }),
  'portrait-notch': Object.freeze({
    id: 'portrait-notch',
    viewport: Object.freeze({ width: 390, height: 844 }),
    insets: Object.freeze({ top: 47, right: 0, bottom: 34, left: 0 }),
  }),
  'landscape-notch': Object.freeze({
    id: 'landscape-notch',
    viewport: Object.freeze({ width: 844, height: 390 }),
    insets: Object.freeze({ top: 0, right: 59, bottom: 21, left: 59 }),
  }),
  'short-visual': Object.freeze({
    id: 'short-visual',
    viewport: Object.freeze({ width: 390, height: 430 }),
    insets: Object.freeze({ top: 47, right: 0, bottom: 34, left: 0 }),
  }),
})

/** @type {readonly SafeAreaProfileId[]} */
export const SAFE_AREA_PROFILE_IDS = Object.freeze(
  /** @type {SafeAreaProfileId[]} */ (Object.keys(SAFE_AREA_PROFILES)),
)

/**
 * Surfaces that the audit safe-area lab must expose via public component APIs.
 * @type {readonly string[]}
 */
export const SAFE_AREA_LAB_SURFACES = Object.freeze([
  'overlay',
  'dialog',
  'dialog-fullscreen',
  'message-box',
  'drawer-ltr',
  'drawer-rtl',
  'drawer-ttb',
  'drawer-btt',
  'image-viewer',
])

/**
 * Acceptance matrix from issue #262.
 * required=true means the combination must run in the full boundary lane.
 * @type {readonly { component: string, profileId: SafeAreaProfileId, required: boolean }[]}
 */
export const SAFE_AREA_ACCEPTANCE_MATRIX = Object.freeze(
  [
    // Overlay
    ...SAFE_AREA_PROFILE_IDS.map((profileId) => ({
      component: 'overlay',
      profileId,
      required: true,
    })),
    // Dialog normal
    ...SAFE_AREA_PROFILE_IDS.map((profileId) => ({
      component: 'dialog',
      profileId,
      required: true,
    })),
    // Dialog fullscreen
    ...SAFE_AREA_PROFILE_IDS.map((profileId) => ({
      component: 'dialog-fullscreen',
      profileId,
      required: true,
    })),
    // MessageBox
    ...SAFE_AREA_PROFILE_IDS.map((profileId) => ({
      component: 'message-box',
      profileId,
      required: true,
    })),
    // Drawer ltr/rtl — portrait-notch optional
    ...['drawer-ltr', 'drawer-rtl'].flatMap((component) =>
      SAFE_AREA_PROFILE_IDS.map((profileId) => ({
        component,
        profileId,
        required: profileId !== 'portrait-notch',
      })),
    ),
    // Drawer ttb/btt — all required
    ...['drawer-ttb', 'drawer-btt'].flatMap((component) =>
      SAFE_AREA_PROFILE_IDS.map((profileId) => ({
        component,
        profileId,
        required: true,
      })),
    ),
    // ImageViewer
    ...SAFE_AREA_PROFILE_IDS.map((profileId) => ({
      component: 'image-viewer',
      profileId,
      required: true,
    })),
  ].map((entry) => Object.freeze(entry)),
)

/**
 * Representative PR-smoke slice — not a second profile system.
 * Full Cartesian product stays in the visual-boundary lane.
 * @type {readonly { component: string, profileId: SafeAreaProfileId }[]}
 */
export const SAFE_AREA_SMOKE_MATRIX = Object.freeze(
  [
    { component: 'dialog', profileId: 'portrait-notch' },
    { component: 'message-box', profileId: 'short-visual' },
    { component: 'drawer-ltr', profileId: 'landscape-notch' },
    { component: 'image-viewer', profileId: 'portrait-notch' },
    { component: 'overlay', profileId: 'no-inset' },
  ].map((entry) => Object.freeze(entry)),
)

/**
 * Shared assertion symbols that geometry tests must call (not screenshot-only).
 * @type {readonly string[]}
 */
export const SAFE_AREA_ASSERTION_NAMES = Object.freeze([
  'assertScrimCoversViewport',
  'assertControlsInsideSafeRect',
  'assertOverlayActionsReachable',
  'assertNoBodyOverflowLeak',
  'assertDirectionalDrawerSafeInsets',
])

/**
 * @param {SafeAreaProfile} profile
 * @returns {Record<string, string>}
 */
export function profileCssVariableOverrides(profile) {
  return {
    '--fsus-safe-area-inset-top': `${profile.insets.top}px`,
    '--fsus-safe-area-inset-right': `${profile.insets.right}px`,
    '--fsus-safe-area-inset-bottom': `${profile.insets.bottom}px`,
    '--fsus-safe-area-inset-left': `${profile.insets.left}px`,
    '--fsus-viewport-block-size': `${profile.viewport.height}px`,
  }
}

/**
 * Interactive content safe rectangle inside the drawable viewport.
 * @param {SafeAreaProfile} profile
 */
export function safeRectFromProfile(profile) {
  return {
    left: profile.insets.left,
    top: profile.insets.top,
    right: profile.viewport.width - profile.insets.right,
    bottom: profile.viewport.height - profile.insets.bottom,
    width:
      profile.viewport.width - profile.insets.left - profile.insets.right,
    height:
      profile.viewport.height - profile.insets.top - profile.insets.bottom,
  }
}

/**
 * @param {SafeAreaProfileId} id
 * @returns {SafeAreaProfile}
 */
export function getSafeAreaProfile(id) {
  const profile = SAFE_AREA_PROFILES[id]
  if (!profile) {
    throw new Error(`Unknown SafeAreaProfile id: ${id}`)
  }
  return profile
}

/**
 * Select matrix entries for a lane.
 * @param {'full' | 'smoke'} mode
 */
export function selectSafeAreaMatrix(mode = 'full') {
  if (mode === 'smoke') {
    return SAFE_AREA_SMOKE_MATRIX.map((entry) => ({
      ...entry,
      required: true,
    }))
  }
  return SAFE_AREA_ACCEPTANCE_MATRIX.filter((entry) => entry.required)
}
