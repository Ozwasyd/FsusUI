import { useLocale } from '@element-plus/hooks'
import English from '@element-plus/locale/lang/en'

type MetricPrimitiveLocaleKey = keyof typeof English.el.metricPrimitives

export const useMetricPrimitiveLocale = () => {
  const { locale } = useLocale()
  return (key: MetricPrimitiveLocaleKey) => {
    const labels = locale.value.el.metricPrimitives
    const value =
      labels && typeof labels === 'object' && !Array.isArray(labels)
        ? labels[key]
        : undefined
    return typeof value === 'string' ? value : English.el.metricPrimitives[key]
  }
}
