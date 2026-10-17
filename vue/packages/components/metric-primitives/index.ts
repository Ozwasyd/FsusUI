import { withInstall } from '@element-plus/utils'

import CopyableDetail from './src/copyable-detail.vue'
import DiagnosticsItem from './src/diagnostics-item.vue'
import DiagnosticsList from './src/diagnostics-list.vue'
import DistributionBarRow from './src/distribution-bar-row.vue'
import DistributionList from './src/distribution-list.vue'
import KeyValueGrid from './src/key-value-grid.vue'
import KeyValueItem from './src/key-value-item.vue'
import KpiGroup from './src/kpi-group.vue'
import MetricItem from './src/metric-item.vue'
import MetricList from './src/metric-list.vue'
import StatusSummary from './src/status-summary.vue'

export type FsusMetricListComponent = typeof MetricList & { name: string }
export type FsusMetricItemComponent = typeof MetricItem & { name: string }
export type FsusDistributionListComponent = typeof DistributionList & {
  name: string
}
export type FsusDistributionBarRowComponent = typeof DistributionBarRow & {
  name: string
}
export type FsusKpiGroupComponent = typeof KpiGroup & { name: string }
export type FsusKeyValueGridComponent = typeof KeyValueGrid & { name: string }
export type FsusKeyValueItemComponent = typeof KeyValueItem & { name: string }
export type FsusStatusSummaryComponent = typeof StatusSummary & { name: string }
export type FsusDiagnosticsListComponent = typeof DiagnosticsList & {
  name: string
}
export type FsusDiagnosticsItemComponent = typeof DiagnosticsItem & {
  name: string
}
export type FsusCopyableDetailComponent = typeof CopyableDetail & {
  name: string
}

const withFsusAlias = <T extends { name?: string }>(
  component: T,
  name: string,
) => ({
  ...component,
  name,
})

export const ElMetricList = withInstall<
  typeof MetricList,
  { FsusMetricList: FsusMetricListComponent }
>(MetricList, {
  FsusMetricList: withFsusAlias(MetricList, 'FsusMetricList'),
})
export const FsusMetricList = ElMetricList.FsusMetricList

export const ElMetricItem = withInstall<
  typeof MetricItem,
  { FsusMetricItem: FsusMetricItemComponent }
>(MetricItem, {
  FsusMetricItem: withFsusAlias(MetricItem, 'FsusMetricItem'),
})
export const FsusMetricItem = ElMetricItem.FsusMetricItem

export const ElDistributionList = withInstall<
  typeof DistributionList,
  { FsusDistributionList: FsusDistributionListComponent }
>(DistributionList, {
  FsusDistributionList: withFsusAlias(DistributionList, 'FsusDistributionList'),
})
export const FsusDistributionList = ElDistributionList.FsusDistributionList

export const ElDistributionBarRow = withInstall<
  typeof DistributionBarRow,
  { FsusDistributionBarRow: FsusDistributionBarRowComponent }
>(DistributionBarRow, {
  FsusDistributionBarRow: withFsusAlias(
    DistributionBarRow,
    'FsusDistributionBarRow',
  ),
})
export const FsusDistributionBarRow =
  ElDistributionBarRow.FsusDistributionBarRow

export const ElKpiGroup = withInstall<
  typeof KpiGroup,
  { FsusKpiGroup: FsusKpiGroupComponent }
>(KpiGroup, {
  FsusKpiGroup: withFsusAlias(KpiGroup, 'FsusKpiGroup'),
})
export const FsusKpiGroup = ElKpiGroup.FsusKpiGroup

export const ElKeyValueGrid = withInstall<
  typeof KeyValueGrid,
  { FsusKeyValueGrid: FsusKeyValueGridComponent }
>(KeyValueGrid, {
  FsusKeyValueGrid: withFsusAlias(KeyValueGrid, 'FsusKeyValueGrid'),
})
export const FsusKeyValueGrid = ElKeyValueGrid.FsusKeyValueGrid

export const ElKeyValueItem = withInstall<
  typeof KeyValueItem,
  { FsusKeyValueItem: FsusKeyValueItemComponent }
>(KeyValueItem, {
  FsusKeyValueItem: withFsusAlias(KeyValueItem, 'FsusKeyValueItem'),
})
export const FsusKeyValueItem = ElKeyValueItem.FsusKeyValueItem

export const ElStatusSummary = withInstall<
  typeof StatusSummary,
  { FsusStatusSummary: FsusStatusSummaryComponent }
>(StatusSummary, {
  FsusStatusSummary: withFsusAlias(StatusSummary, 'FsusStatusSummary'),
})
export const FsusStatusSummary = ElStatusSummary.FsusStatusSummary

export const ElDiagnosticsList = withInstall<
  typeof DiagnosticsList,
  { FsusDiagnosticsList: FsusDiagnosticsListComponent }
>(DiagnosticsList, {
  FsusDiagnosticsList: withFsusAlias(DiagnosticsList, 'FsusDiagnosticsList'),
})
export const FsusDiagnosticsList = ElDiagnosticsList.FsusDiagnosticsList

export const ElDiagnosticsItem = withInstall<
  typeof DiagnosticsItem,
  { FsusDiagnosticsItem: FsusDiagnosticsItemComponent }
>(DiagnosticsItem, {
  FsusDiagnosticsItem: withFsusAlias(DiagnosticsItem, 'FsusDiagnosticsItem'),
})
export const FsusDiagnosticsItem = ElDiagnosticsItem.FsusDiagnosticsItem

export const ElCopyableDetail = withInstall<
  typeof CopyableDetail,
  { FsusCopyableDetail: FsusCopyableDetailComponent }
>(CopyableDetail, {
  FsusCopyableDetail: withFsusAlias(CopyableDetail, 'FsusCopyableDetail'),
})
export const FsusCopyableDetail = ElCopyableDetail.FsusCopyableDetail

export default ElMetricList

export * from './src/shared'
export type * from './src/instance'
