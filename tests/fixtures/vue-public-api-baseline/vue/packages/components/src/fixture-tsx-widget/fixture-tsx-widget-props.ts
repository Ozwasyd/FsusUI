export const fixtureTsxBaseProps = {
  label: String,
}

export const fixtureTsxWidgetProps = {
  ...fixtureTsxBaseProps,
  count: Number,
} as const
