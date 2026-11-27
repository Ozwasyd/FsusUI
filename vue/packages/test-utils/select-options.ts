const optionLabels = [
  ['黄金糕', 20],
  ['双皮奶', 13],
  ['蚵仔煎', 6],
  ['龙须面', 1],
  ['北京烤鸭', 1],
] as const

export const createSelectOptions = (
  mode: 'standard' | 'long-labels' = 'standard',
) =>
  optionLabels.map(([label, repeat], index) => ({
    value: `选项${index + 1}`,
    label: mode === 'long-labels' ? label.repeat(repeat) : label,
  }))
