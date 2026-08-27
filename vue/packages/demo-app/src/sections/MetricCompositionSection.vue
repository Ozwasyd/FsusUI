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
      <div class="metric-fixture-row" data-metric-variant="summary-success">
        <ElStatusSummary
          label="Deployment sync"
          status="Healthy"
          updated-at="2026-06-14 20:30"
          tone="success"
        >
          <template #actions>
            <el-button text size="small">Inspect</el-button>
            <a href="#deployment-history" role="button">History</a>
          </template>
        </ElStatusSummary>
      </div>
      <div class="metric-fixture-row" data-metric-variant="summary-danger">
        <ElStatusSummary
          label="Quota watchdog"
          status="Over limit"
          updated-at="2026-06-15 02:12"
          tone="danger"
        />
      </div>
      <div class="metric-fixture-row" data-metric-variant="summary-info">
        <ElStatusSummary
          label="Index refresh"
          status="In progress"
          updated-at="2026-06-15 02:14"
          tone="info"
        />
      </div>
    </div>

    <!-- DiagnosticsList -->
    <div class="demo-block" data-metric-fixture="diagnostics">
      <h3>DiagnosticsList</h3>
      <div class="metric-fixture-row" data-metric-variant="diag-mixed">
        <ElDiagnosticsList>
          <ElDiagnosticsItem
            title="Memory usage"
            message="75% of allocated memory consumed."
            meta="warning - 17:48:11 - 3 times"
            detail="memory-node:sample-0001"
            tone="warning"
          >
            <template #actions>
              <button type="button">Retry</button>
              <a href="#diagnostic-memory-log">Open log</a>
            </template>
          </ElDiagnosticsItem>
          <ElDiagnosticsItem
            title="Disk space"
            message="98% full — immediate action required."
            meta="danger - 17:49:03 - current"
            tone="danger"
            default-open
          >
            <template #detail>
              <div data-testid="nested-diagnostics">
                <ElDiagnosticsList density="compact">
                  <ElDiagnosticsItem
                    title="Primary volume"
                    message="Cleanup queued."
                    tone="info"
                  />
                  <ElDiagnosticsItem
                    title="Archive volume"
                    message="Capacity remains available."
                    tone="success"
                  />
                </ElDiagnosticsList>
              </div>
            </template>
          </ElDiagnosticsItem>
          <ElDiagnosticsItem
            title="Index refresh"
            message="Background refresh is still running."
            meta="info - 17:49:30"
            tone="info"
          />
          <ElDiagnosticsItem
            title="Replica status"
            message="All replicas are synchronized."
            meta="success - 17:50:00"
            tone="success"
          />
        </ElDiagnosticsList>
      </div>
      <div class="metric-fixture-row" data-metric-variant="diag-empty">
        <ElEmptyState
          size="inline"
          title="No diagnostics"
          description="No diagnostic events are available."
        />
      </div>
      <div
        class="metric-fixture-row"
        data-metric-variant="diag-loading"
        aria-busy="true"
      >
        <ElDiagnosticsList>
          <ElDiagnosticsItem
            title="Loading diagnostics"
            message="Recent diagnostic events are being loaded."
            tone="info"
          />
        </ElDiagnosticsList>
      </div>
    </div>

    <!-- RTL diagnostics with long detail and an inline action -->
    <div class="demo-block" data-metric-fixture="diagnostics-rtl">
      <h3>DiagnosticsList (RTL)</h3>
      <div class="metric-fixture-row" data-metric-variant="diag-rtl">
        <div dir="rtl">
          <ElDiagnosticsList>
            <ElDiagnosticsItem
              title="diagnostic.event"
              message="Recent event summary supplied by the product."
              meta="warning - 17:48:11 - 3 times"
              detail="diagnostic-node:runCheck:sample-0001 diagnostic-node:runCheck:sample-0002 diagnostic-node:runCheck:sample-0003 diagnostic-node:runCheck:sample-0004 diagnostic-node:runCheck:sample-0005 diagnostic-node:runCheck:sample-0006"
              tone="warning"
            >
              <template #actions>
                <ElCopyableDetail
                  value="diagnostic-node:runCheck:sample-0001"
                  label="Copy detail"
                  inline
                />
              </template>
            </ElDiagnosticsItem>
          </ElDiagnosticsList>
        </div>
      </div>
    </div>

    <!-- CopyableDetail -->
    <div class="demo-block" data-metric-fixture="copyable">
      <h3>CopyableDetail</h3>
      <div class="metric-fixture-row" data-metric-variant="copy-default">
        <ElCopyableDetail value="sk-proj-abc123def456" />
      </div>
      <div class="metric-fixture-row" data-metric-variant="copy-disabled">
        <ElCopyableDetail
          value="sk-proj-disabled"
          label="Copy unavailable detail"
          disabled
        />
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
  ElEmptyState,
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
