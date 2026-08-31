import { buildProps } from '@element-plus/utils'

export const fixtureTsxBaseProps = {
  label: String,
}

export const fixtureTsxWidgetProps = buildProps({
  ...fixtureTsxBaseProps,
  count: Number,
} as const)
