import { buildProps, definePropType } from '@element-plus/utils'

import type { ExtractPropTypes, HTMLAttributes } from 'vue'

export const settingsPrimitiveDensities = ['default', 'compact'] as const
export const settingsPrimitiveTitleTags = [
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
] as const
export const riskNoticeTypes = ['neutral', 'warning', 'danger'] as const

export type SettingsPrimitiveDensity =
  (typeof settingsPrimitiveDensities)[number]
export type SettingsPrimitiveTitleTag =
  (typeof settingsPrimitiveTitleTags)[number]
export type RiskNoticeType = (typeof riskNoticeTypes)[number]
export type SectionNavItem = {
  key?: string | number
  label: string
  href: string
  current?: boolean
  disabled?: boolean
}

export const sectionNavProps = buildProps({
  items: {
    type: definePropType<SectionNavItem[]>(Array),
    default: () => [],
  },
  ariaLabel: {
    type: String,
    default: 'Section navigation',
  },
  ariaLabelledby: String,
  density: {
    type: String,
    values: settingsPrimitiveDensities,
    default: 'default',
  },
} as const)

export const sectionNavLinkProps = buildProps({
  to: {
    type: String,
    required: true,
  },
  active: Boolean,
  disabled: Boolean,
} as const)

export const settingsSectionProps = buildProps({
  id: String,
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  titleTag: {
    type: String,
    values: settingsPrimitiveTitleTags,
    default: 'h2',
  },
  density: {
    type: String,
    values: settingsPrimitiveDensities,
    default: 'default',
  },
  danger: Boolean,
  ariaLabelledby: String,
} as const)

export const sectionHeaderProps = buildProps({
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  titleTag: {
    type: String,
    values: settingsPrimitiveTitleTags,
    default: 'h2',
  },
  density: {
    type: String,
    values: settingsPrimitiveDensities,
    default: 'default',
  },
  danger: Boolean,
} as const)

export const resourceListProps = buildProps({
  density: {
    type: String,
    values: settingsPrimitiveDensities,
    default: 'default',
  },
  role: {
    type: definePropType<HTMLAttributes['role']>(String),
    default: 'list',
  },
  divided: {
    type: Boolean,
    default: true,
  },
} as const)

export const resourceListItemProps = buildProps({
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  density: {
    type: String,
    values: settingsPrimitiveDensities,
    default: 'default',
  },
} as const)

export const metadataRowProps = buildProps({
  density: {
    type: String,
    values: settingsPrimitiveDensities,
    default: 'default',
  },
} as const)

export const metadataItemProps = buildProps({
  label: {
    type: String,
    required: true,
  },
  value: {
    type: definePropType<string | number>([String, Number]),
    default: undefined,
  },
  fallback: {
    type: String,
    default: '-',
  },
  monospace: Boolean,
} as const)

export const inlineActionsProps = buildProps({
  ariaLabel: String,
  density: {
    type: String,
    values: settingsPrimitiveDensities,
    default: 'default',
  },
} as const)

export const dangerZoneProps = buildProps({
  id: String,
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  titleTag: {
    type: String,
    values: settingsPrimitiveTitleTags,
    default: 'h2',
  },
  density: {
    type: String,
    values: settingsPrimitiveDensities,
    default: 'default',
  },
} as const)

export const destructiveActionPanelProps = buildProps({
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  density: {
    type: String,
    values: settingsPrimitiveDensities,
    default: 'default',
  },
} as const)

export const riskNoticeProps = buildProps({
  title: {
    type: String,
    default: '',
  },
  type: {
    type: String,
    values: riskNoticeTypes,
    default: 'warning',
  },
  role: {
    type: definePropType<HTMLAttributes['role']>(String),
  },
} as const)

export const typedConfirmFieldProps = buildProps({
  modelValue: {
    type: String,
    default: '',
  },
  phrase: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    default: 'Confirmation phrase',
  },
  description: {
    type: String,
    default: '',
  },
  id: String,
  name: String,
  placeholder: String,
  disabled: Boolean,
  required: {
    type: Boolean,
    default: true,
  },
} as const)

export const typedConfirmFieldEmits = {
  'update:modelValue': (value: string) => typeof value === 'string',
  change: (value: string) => typeof value === 'string',
}

export type SectionNavProps = ExtractPropTypes<typeof sectionNavProps>
export type SectionNavLinkProps = ExtractPropTypes<typeof sectionNavLinkProps>
export type SettingsSectionProps = ExtractPropTypes<typeof settingsSectionProps>
export type SectionHeaderProps = ExtractPropTypes<typeof sectionHeaderProps>
export type ResourceListProps = ExtractPropTypes<typeof resourceListProps>
export type ResourceListItemProps = ExtractPropTypes<
  typeof resourceListItemProps
>
export type MetadataRowProps = ExtractPropTypes<typeof metadataRowProps>
export type MetadataItemProps = ExtractPropTypes<typeof metadataItemProps>
export type InlineActionsProps = ExtractPropTypes<typeof inlineActionsProps>
export type DangerZoneProps = ExtractPropTypes<typeof dangerZoneProps>
export type DestructiveActionPanelProps = ExtractPropTypes<
  typeof destructiveActionPanelProps
>
export type RiskNoticeProps = ExtractPropTypes<typeof riskNoticeProps>
export type TypedConfirmFieldProps = ExtractPropTypes<
  typeof typedConfirmFieldProps
>
