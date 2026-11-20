import { useLocale } from '@element-plus/hooks'
import English from '@element-plus/locale/lang/en'

type MetricPrimitiveLocaleKey = keyof typeof English.el.metricPrimitives

export const useMetricPrimitiveLocale = () => {
  const { t } = useLocale()
  return (key: MetricPrimitiveLocaleKey) => {
    const path = `el.metricPrimitives.${key}`
    const value = t(path)
    return value === path ? English.el.metricPrimitives[key] : value
  }
}
