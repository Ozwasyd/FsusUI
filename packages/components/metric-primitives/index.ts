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

const withFsusAlias = <T extends { name?: string }>(
  component: T,
  name: string,
) => ({
  ...component,
  name,
})

export const ElMetricList = withInstall(MetricList, {
  FsusMetricList: withFsusAlias(MetricList, 'FsusMetricList'),
})
export const FsusMetricList = ElMetricList.FsusMetricList

export const ElMetricItem = withInstall(MetricItem, {
  FsusMetricItem: withFsusAlias(MetricItem, 'FsusMetricItem'),
})
export const FsusMetricItem = ElMetricItem.FsusMetricItem

export const ElDistributionList = withInstall(DistributionList, {
  FsusDistributionList: withFsusAlias(DistributionList, 'FsusDistributionList'),
})
export const FsusDistributionList = ElDistributionList.FsusDistributionList

export const ElDistributionBarRow = withInstall(DistributionBarRow, {
  FsusDistributionBarRow: withFsusAlias(
    DistributionBarRow,
    'FsusDistributionBarRow',
  ),
})
export const FsusDistributionBarRow =
  ElDistributionBarRow.FsusDistributionBarRow

export const ElKpiGroup = withInstall(KpiGroup, {
  FsusKpiGroup: withFsusAlias(KpiGroup, 'FsusKpiGroup'),
})
export const FsusKpiGroup = ElKpiGroup.FsusKpiGroup

export const ElKeyValueGrid = withInstall(KeyValueGrid, {
  FsusKeyValueGrid: withFsusAlias(KeyValueGrid, 'FsusKeyValueGrid'),
})
export const FsusKeyValueGrid = ElKeyValueGrid.FsusKeyValueGrid

export const ElKeyValueItem = withInstall(KeyValueItem, {
  FsusKeyValueItem: withFsusAlias(KeyValueItem, 'FsusKeyValueItem'),
})
export const FsusKeyValueItem = ElKeyValueItem.FsusKeyValueItem

export const ElStatusSummary = withInstall(StatusSummary, {
  FsusStatusSummary: withFsusAlias(StatusSummary, 'FsusStatusSummary'),
})
export const FsusStatusSummary = ElStatusSummary.FsusStatusSummary

export const ElDiagnosticsList = withInstall(DiagnosticsList, {
  FsusDiagnosticsList: withFsusAlias(DiagnosticsList, 'FsusDiagnosticsList'),
})
export const FsusDiagnosticsList = ElDiagnosticsList.FsusDiagnosticsList

export const ElDiagnosticsItem = withInstall(DiagnosticsItem, {
  FsusDiagnosticsItem: withFsusAlias(DiagnosticsItem, 'FsusDiagnosticsItem'),
})
export const FsusDiagnosticsItem = ElDiagnosticsItem.FsusDiagnosticsItem

export const ElCopyableDetail = withInstall(CopyableDetail, {
  FsusCopyableDetail: withFsusAlias(CopyableDetail, 'FsusCopyableDetail'),
})
export const FsusCopyableDetail = ElCopyableDetail.FsusCopyableDetail

export default ElMetricList

export * from './src/shared'
export type * from './src/instance'
