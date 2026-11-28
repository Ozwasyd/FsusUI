export const fixtureWidgetProps = {
  label: String,
  modelValue: String,
  /**
   * @deprecated use modelValue instead
   */
  legacyMode: Boolean,
} as const

export const fixtureWidgetEmits = {
  'update:modelValue': (value: string) => typeof value === 'string',
  submit: (value: string) => typeof value === 'string',
}
