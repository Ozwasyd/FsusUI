import { buildProps, definePropType } from '@element-plus/utils'

import type { ExtractPropTypes, HTMLAttributes } from 'vue'

export const metricPrimitiveDensities = ['default', 'compact'] as const
export const metricPrimitiveTones = [
  'neutral',
  'info',
  'success',
  'warning',
  'danger',
] as const

export type MetricPrimitiveDensity = (typeof metricPrimitiveDensities)[number]
export type MetricPrimitiveTone = (typeof metricPrimitiveTones)[number]
export type MetricPrimitiveValue = string | number

export const metricListProps = buildProps({
  density: {
    type: String,
    values: metricPrimitiveDensities,
    default: 'default',
  },
  role: {
    type: definePropType<HTMLAttributes['role']>(String),
    default: 'list',
  },
} as const)

export const metricItemProps = buildProps({
  label: {
    type: String,
    default: '',
  },
  primary: {
    type: definePropType<MetricPrimitiveValue>([String, Number]),
    default: '',
  },
  secondary: {
    type: definePropType<MetricPrimitiveValue | MetricPrimitiveValue[]>([
      String,
      Number,
      Array,
    ]),
    default: () => [],
  },
  meta: {
    type: String,
    default: '',
  },
  density: {
    type: String,
    values: metricPrimitiveDensities,
    default: 'default',
  },
} as const)

export const distributionListProps = buildProps({
  density: {
    type: String,
    values: metricPrimitiveDensities,
    default: 'default',
  },
  role: {
    type: definePropType<HTMLAttributes['role']>(String),
    default: 'list',
  },
} as const)

export const distributionBarRowProps = buildProps({
  label: {
    type: String,
    default: '',
  },
  value: {
    type: definePropType<MetricPrimitiveValue>([String, Number]),
    default: '',
  },
  ratio: {
    type: Number,
    default: 0,
  },
  rank: {
    type: definePropType<MetricPrimitiveValue>([String, Number]),
    default: '',
  },
  density: {
    type: String,
    values: metricPrimitiveDensities,
    default: 'default',
  },
} as const)

export const kpiGroupProps = buildProps({
  density: {
    type: String,
    values: metricPrimitiveDensities,
    default: 'default',
  },
} as const)

export const keyValueGridProps = buildProps({
  density: {
    type: String,
    values: metricPrimitiveDensities,
    default: 'default',
  },
} as const)

export const keyValueItemProps = buildProps({
  label: {
    type: String,
    required: true,
  },
  value: {
    type: definePropType<MetricPrimitiveValue | null | undefined>([
      String,
      Number,
    ]),
    default: undefined,
  },
  fallback: {
    type: String,
    default: '-',
  },
  tone: {
    type: String,
    values: metricPrimitiveTones,
    default: 'neutral',
  },
  monospace: Boolean,
} as const)

export const statusSummaryProps = buildProps({
  label: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    default: '',
  },
  updatedAt: {
    type: String,
    default: '',
  },
  tone: {
    type: String,
    values: metricPrimitiveTones,
    default: 'neutral',
  },
  density: {
    type: String,
    values: metricPrimitiveDensities,
    default: 'default',
  },
} as const)

export const diagnosticsListProps = buildProps({
  density: {
    type: String,
    values: metricPrimitiveDensities,
    default: 'default',
  },
  role: {
    type: definePropType<HTMLAttributes['role']>(String),
    default: 'list',
  },
} as const)

export const diagnosticsItemProps = buildProps({
  title: {
    type: String,
    default: '',
  },
  message: {
    type: String,
    default: '',
  },
  meta: {
    type: String,
    default: '',
  },
  detail: {
    type: String,
    default: '',
  },
  detailLabel: {
    type: String,
    default: 'Details',
  },
  defaultOpen: Boolean,
  tone: {
    type: String,
    values: metricPrimitiveTones,
    default: 'neutral',
  },
  density: {
    type: String,
    values: metricPrimitiveDensities,
    default: 'default',
  },
} as const)

export const copyableDetailProps = buildProps({
  value: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    default: 'Copy detail',
  },
  copiedLabel: {
    type: String,
    default: 'Copied',
  },
  errorLabel: {
    type: String,
    default: 'Copy failed',
  },
  monospace: {
    type: Boolean,
    default: true,
  },
  inline: Boolean,
} as const)

export const copyableDetailEmits = {
  copy: (value: string) => typeof value === 'string',
  'copy-error': (error: unknown) => error instanceof Error || Boolean(error),
}

export type MetricListProps = ExtractPropTypes<typeof metricListProps>
export type MetricItemProps = ExtractPropTypes<typeof metricItemProps>
export type DistributionListProps = ExtractPropTypes<
  typeof distributionListProps
>
export type DistributionBarRowProps = ExtractPropTypes<
  typeof distributionBarRowProps
>
export type KpiGroupProps = ExtractPropTypes<typeof kpiGroupProps>
export type KeyValueGridProps = ExtractPropTypes<typeof keyValueGridProps>
export type KeyValueItemProps = ExtractPropTypes<typeof keyValueItemProps>
export type StatusSummaryProps = ExtractPropTypes<typeof statusSummaryProps>
export type DiagnosticsListProps = ExtractPropTypes<typeof diagnosticsListProps>
export type DiagnosticsItemProps = ExtractPropTypes<typeof diagnosticsItemProps>
export type CopyableDetailProps = ExtractPropTypes<typeof copyableDetailProps>
