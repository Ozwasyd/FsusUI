import {
  getMotionPreset,
  isMotionPresetAllowedOnSurface,
  motionPresets,
} from './presets'
import type { MotionPresetName, MotionSurfaceCategory } from './types'

export type MotionGovernanceSeverity = 'error' | 'warning'

export type MotionGovernanceFinding = {
  ruleId: string
  severity: MotionGovernanceSeverity
  message: string
  source?: string
}

export type MotionInteractionKind =
  | 'default'
  | 'hover'
  | 'focus'
  | 'route'
  | 'loading'

export type MotionEffectKind =
  | 'preset'
  | 'loading-sweep'
  | 'raw-keyframes'
  | 'raw-animation-engine'
  | 'local-wrapper'

export type MotionPresetUsage = {
  preset: MotionPresetName
  surface: MotionSurfaceCategory
  interaction?: MotionInteractionKind
  effect?: MotionEffectKind
  itemCount?: number
  callsFsusPreset?: boolean
  source?: string
}

export type MotionAdoptionEntry = MotionPresetUsage & {
  semantic: string
}

const transforms = (preset: MotionPresetName) => {
  const definition = getMotionPreset(preset)
  return [
    definition.from.transform,
    definition.to.transform,
    definition.leaveFrom?.transform,
    definition.leaveTo?.transform,
  ].filter(Boolean)
}

const usesScale = (preset: MotionPresetName) =>
  transforms(preset).some((value) => value?.includes('scale'))

const usesTranslate = (preset: MotionPresetName) =>
  transforms(preset).some((value) => value?.includes('translate'))

const hasStagger = (preset: MotionPresetName) =>
  getMotionPreset(preset).stagger !== undefined

const finding = (
  ruleId: string,
  message: string,
  source?: string,
  severity: MotionGovernanceSeverity = 'error',
): MotionGovernanceFinding => ({
  ruleId,
  severity,
  message,
  source,
})

export const validateMotionPresetUsage = (
  usage: MotionPresetUsage,
): MotionGovernanceFinding[] => {
  const findings: MotionGovernanceFinding[] = []

  if (!isMotionPresetAllowedOnSurface(usage.preset, usage.surface)) {
    findings.push(
      finding(
        'surface-disallowed',
        `${usage.preset} is not allowed on ${usage.surface}.`,
        usage.source,
      ),
    )
  }

  if (
    usage.surface === 'ordinary-content' &&
    usage.interaction !== 'hover' &&
    usesScale(usage.preset)
  ) {
    findings.push(
      finding(
        'ordinary-content-no-scale',
        'Ordinary content panels must not use scale-based presets by default.',
        usage.source,
      ),
    )
  }

  if (
    usage.surface === 'reading-surface' &&
    usage.interaction === 'default' &&
    usesTranslate(usage.preset)
  ) {
    findings.push(
      finding(
        'reading-body-no-translate',
        'Reading body content must not use translate reveal by default.',
        usage.source,
      ),
    )
  }

  if (
    usage.surface === 'list-table-surface' &&
    hasStagger(usage.preset) &&
    (usage.itemCount ?? 0) > 20
  ) {
    findings.push(
      finding(
        'ordinary-list-no-complex-stagger',
        'Large ordinary lists must use summary or container feedback instead of complex stagger.',
        usage.source,
      ),
    )
  }

  if (
    usage.interaction === 'hover' &&
    usesScale(usage.preset) &&
    usage.surface !== 'media-preview-surface'
  ) {
    findings.push(
      finding(
        'hover-scale-requires-media-preview',
        'Hover scale requires explicit media/preview surface metadata.',
        usage.source,
      ),
    )
  }

  if (usage.effect === 'loading-sweep' && usage.surface === 'reading-surface') {
    findings.push(
      finding(
        'reading-loading-no-sweep',
        'Loading sweep must not be the default reading-page loading pattern.',
        usage.source,
      ),
    )
  }

  return findings
}

export const validateMotionAdoptionMapping = (
  entries: readonly MotionAdoptionEntry[],
) =>
  entries.flatMap((entry) => {
    const findings: MotionGovernanceFinding[] = []

    if (entry.effect === 'raw-keyframes') {
      findings.push(
        finding(
          'app-local-keyframes',
          `${entry.semantic} uses app-local keyframes instead of FsusUI presets.`,
          entry.source,
        ),
      )
    }

    if (entry.effect === 'raw-animation-engine') {
      findings.push(
        finding(
          'app-local-raw-engine',
          `${entry.semantic} imports a raw animation engine locally.`,
          entry.source,
        ),
      )
    }

    if (entry.effect === 'local-wrapper' && !entry.callsFsusPreset) {
      findings.push(
        finding(
          'local-wrapper-must-call-fsus-preset',
          `${entry.semantic} wraps motion without calling a FsusUI preset.`,
          entry.source,
        ),
      )
    }

    return [...findings, ...validateMotionPresetUsage(entry)]
  })

export const assertEveryPresetHasGovernanceMetadata = () =>
  Object.values(motionPresets).every(
    (preset) => preset.surfaces.length > 0 && preset.reduced.opacity === '1',
  )
