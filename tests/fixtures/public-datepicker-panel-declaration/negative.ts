import { getPanel } from '@ozwasyd/element-plus/es/components/date-picker/src/panel-utils'

getPanel(42)
getPanel('not-a-date-picker-type')
getPanel()
const invalidReturn: number = getPanel('date')
export { invalidReturn }
