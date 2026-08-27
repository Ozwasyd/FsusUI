<template>
  <div
    id="metric-visual"
    class="demo-section"
    data-testid="metric-visual-fixtures"
  >
    <h2>Metric Composition Acceptance</h2>

    <!-- MetricList -->
    <div class="demo-block" data-metric-fixture="metric-list">
      <h3>MetricList</h3>
      <div class="metric-fixture-row" data-metric-variant="metric-default">
        <ElMetricList>
          <ElMetricItem label="Active Users" primary="12,847" />
          <ElMetricItem label="Avg Session" primary="4m 32s" />
          <ElMetricItem label="Bounce Rate" primary="23.4%" />
          <ElMetricItem
            v-bind="cjkEvidenceAttrs"
            label="请求延迟"
            primary="22 毫秒"
            secondary="第 75 百分位"
            meta="58 个样本"
          />
          <ElMetricItem
            v-bind="rtlEvidenceAttrs"
            label="زمن الاستجابة"
            primary="٢٢ مللي ثانية"
            secondary="المئين ٧٥"
            meta="٥٨ عينة"
          />
          <ElMetricItem
            v-bind="longEvidenceAttrs"
            label="Service availability over the trailing thirty-day reporting window"
            primary="99.999%"
            secondary="Objective 99.95%"
            meta="43,200 samples"
          />
        </ElMetricList>
      </div>
    </div>

    <!-- KpiGroup -->
    <div class="demo-block" data-metric-fixture="kpi-group">
      <h3>KpiGroup</h3>
      <div class="metric-fixture-row" data-metric-variant="kpi-default">
        <ElKpiGroup>
          <ElMetricList>
            <ElMetricItem label="Total Revenue" primary="$847,230" />
            <ElMetricItem label="Conversion" primary="3.2%" />
          </ElMetricList>
        </ElKpiGroup>
      </div>
    </div>

    <!-- DistributionList -->
    <div class="demo-block" data-metric-fixture="distribution">
      <h3>DistributionList</h3>
      <div
        class="metric-fixture-row"
        data-metric-variant="distribution-default"
      >
        <ElDistributionList>
          <ElDistributionBarRow
            rank="1"
            label="Direct"
            value="245"
            :ratio="1"
          />
          <ElDistributionBarRow
            rank="2"
            label="Referral"
            value="106"
            :ratio="0.43"
          />
        </ElDistributionList>
      </div>
    </div>

    <!-- KeyValueGrid -->
    <div class="demo-block" data-metric-fixture="key-value">
      <h3>KeyValueGrid</h3>
      <div class="metric-fixture-row" data-metric-variant="kv-default">
        <ElKeyValueGrid>
          <ElKeyValueItem label="State" value="Ready" tone="success" />
          <ElKeyValueItem label="Queue" value="0 / 0" monospace />
          <ElKeyValueItem label="Region" value="us-east-1" />
          <ElKeyValueItem label="Authority" value="Runtime">
            <template #badge>
              <span aria-label="Highlighted metric">·</span>
            </template>
          </ElKeyValueItem>
        </ElKeyValueGrid>
      </div>
    </div>

    <!-- StatusSummary -->
    <div class="demo-block" data-metric-fixture="status">
      <h3>StatusSummary</h3>
      <div class="metric-fixture-row" data-metric-variant="status-default">
        <ElStatusSummary
          label="Deployment"
          status="Stable"
          updated-at="2026-08-27 10:30"
          tone="success"
        >
          <template #detail>Production checks completed successfully.</template>
        </ElStatusSummary>
      </div>
    </div>

    <!-- DiagnosticsList -->
    <div class="demo-block" data-metric-fixture="diagnostics">
      <h3>DiagnosticsList</h3>
      <div class="metric-fixture-row" data-metric-variant="diag-default">
        <ElDiagnosticsList>
          <ElDiagnosticsItem title="Memory Usage" tone="warning">
            <template #detail>75% of allocated memory consumed</template>
          </ElDiagnosticsItem>
        </ElDiagnosticsList>
      </div>
      <div class="metric-fixture-row" data-metric-variant="diag-danger">
        <ElDiagnosticsList>
          <ElDiagnosticsItem title="Disk Space" tone="danger">
            <template #detail>98% full — immediate action required</template>
          </ElDiagnosticsItem>
        </ElDiagnosticsList>
      </div>
    </div>

    <!-- CopyableDetail -->
    <div class="demo-block" data-metric-fixture="copyable">
      <h3>CopyableDetail</h3>
      <div class="metric-fixture-row" data-metric-variant="copy-default">
        <ElCopyableDetail value="sk-proj-abc123def456" />
      </div>
    </div>

    <div
      data-testid="metric-gate-css"
      style="display: none"
      aria-hidden="true"
    />
  </div>
</template>

<script setup lang="ts">
import {
  ElCopyableDetail,
  ElDiagnosticsItem,
  ElDiagnosticsList,
  ElDistributionBarRow,
  ElDistributionList,
  ElKeyValueGrid,
  ElKeyValueItem,
  ElKpiGroup,
  ElMetricItem,
  ElMetricList,
  ElStatusSummary,
} from '@element-plus/components'

const cjkEvidenceAttrs = {
  'data-metric-typography': 'cjk',
}

const rtlEvidenceAttrs = {
  ...cjkEvidenceAttrs,
  dir: 'rtl',
  'data-metric-typography': 'rtl',
}

const longEvidenceAttrs = {
  'data-metric-typography': 'long',
}
</script>
