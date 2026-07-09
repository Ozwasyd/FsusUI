import type CopyableDetail from './copyable-detail.vue'
import type DiagnosticsItem from './diagnostics-item.vue'
import type DiagnosticsList from './diagnostics-list.vue'
import type DistributionBarRow from './distribution-bar-row.vue'
import type DistributionList from './distribution-list.vue'
import type KeyValueGrid from './key-value-grid.vue'
import type KeyValueItem from './key-value-item.vue'
import type KpiGroup from './kpi-group.vue'
import type MetricItem from './metric-item.vue'
import type MetricList from './metric-list.vue'
import type StatusSummary from './status-summary.vue'

export type MetricListInstance = InstanceType<typeof MetricList>
export type MetricItemInstance = InstanceType<typeof MetricItem>
export type DistributionListInstance = InstanceType<typeof DistributionList>
export type DistributionBarRowInstance = InstanceType<typeof DistributionBarRow>
export type KpiGroupInstance = InstanceType<typeof KpiGroup>
export type KeyValueGridInstance = InstanceType<typeof KeyValueGrid>
export type KeyValueItemInstance = InstanceType<typeof KeyValueItem>
export type StatusSummaryInstance = InstanceType<typeof StatusSummary>
export type DiagnosticsListInstance = InstanceType<typeof DiagnosticsList>
export type DiagnosticsItemInstance = InstanceType<typeof DiagnosticsItem>
export type CopyableDetailInstance = InstanceType<typeof CopyableDetail>
