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
        <FsusMetricList>
          <FsusMetricItem label="Active Users" primary="12,847" />
          <FsusMetricItem label="Avg Session" primary="4m 32s" />
          <FsusMetricItem label="Bounce Rate" primary="23.4%" />
          <FsusMetricItem
            v-bind="cjkEvidenceAttrs"
            label="请求延迟"
            primary="22 毫秒"
            secondary="第 75 百分位"
            meta="58 个样本"
          />
          <FsusMetricItem
            v-bind="rtlEvidenceAttrs"
            label="زمن الاستجابة"
            primary="٢٢ مللي ثانية"
            secondary="المئين ٧٥"
            meta="٥٨ عينة"
          />
          <FsusMetricItem
            v-bind="longEvidenceAttrs"
            label="Service availability over the trailing thirty-day reporting window"
            primary="99.999%"
            secondary="Objective 99.95%"
            meta="43,200 samples"
          />
        </FsusMetricList>
      </div>
    </div>

    <!-- KpiGroup -->
    <div class="demo-block" data-metric-fixture="kpi-group">
      <h3>KpiGroup</h3>
      <div class="metric-fixture-row" data-metric-variant="kpi-default">
        <FsusKpiGroup>
          <FsusMetricList>
            <FsusMetricItem label="Total Revenue" primary="$847,230" />
            <FsusMetricItem label="Conversion" primary="3.2%" />
          </FsusMetricList>
        </FsusKpiGroup>
      </div>
    </div>

    <!-- DistributionList -->
    <div class="demo-block" data-metric-fixture="distribution">
      <h3>DistributionList</h3>
      <div
        class="metric-fixture-row"
        data-metric-variant="distribution-default"
      >
        <FsusDistributionList>
          <FsusDistributionBarRow
            rank="1"
            label="Direct"
            value="245"
            :ratio="1"
          />
          <FsusDistributionBarRow
            rank="2"
            label="Referral"
            value="106"
            :ratio="0.43"
          />
        </FsusDistributionList>
      </div>
    </div>

    <!-- KeyValueGrid -->
    <div class="demo-block" data-metric-fixture="key-value">
      <h3>KeyValueGrid</h3>
      <div class="metric-fixture-row" data-metric-variant="kv-default">
        <FsusKeyValueGrid>
          <FsusKeyValueItem label="State" value="Ready" tone="success" />
          <FsusKeyValueItem label="Queue" value="0 / 0" monospace />
          <FsusKeyValueItem label="Region" value="us-east-1" />
          <FsusKeyValueItem label="Authority" value="Runtime">
            <template #badge>
              <span aria-label="Highlighted metric">·</span>
            </template>
          </FsusKeyValueItem>
        </FsusKeyValueGrid>
      </div>
    </div>

    <div class="demo-block" data-metric-variant="kv-narrow-desktop">
      <FsusKeyValueGrid density="compact">
        <FsusKeyValueItem label="Mode" value="Single instance" />
        <FsusKeyValueItem
          label="Scheduling"
          value="Unavailable in single-instance mode"
        />
        <FsusKeyValueItem label="Instance ID" monospace>
          <FsusCopyableDetail
            value="983732b7-a65e-4110-812e-8ecdcfad15f5"
            label="Copy detail"
          />
        </FsusKeyValueItem>
        <FsusKeyValueItem
          label="Build version"
          value="1.0.0+eea3af55c2494ac18eb9d8a44d4eaf464e788f79"
        />
        <FsusKeyValueItem label="Started" value="2026/11/20 20:49:32" />
        <FsusKeyValueItem label="Observed" value="2026/11/20 20:49:37" />
        <FsusKeyValueItem
          label="Lease"
          value="Confirmed on primary (174 ms ago)"
        />
        <FsusKeyValueItem label="Snapshot" value="Ready" />
      </FsusKeyValueGrid>
    </div>

    <!-- StatusSummary -->
    <div class="demo-block" data-metric-fixture="status">
      <h3>StatusSummary</h3>
      <div class="metric-fixture-row" data-metric-variant="status-default">
        <FsusStatusSummary
          label="Deployment"
          status="Stable"
          updated-at="2026-08-27 10:30"
          tone="success"
        >
          <template #detail>Production checks completed successfully.</template>
        </FsusStatusSummary>
      </div>
      <div class="metric-fixture-row" data-metric-variant="summary-success">
        <FsusStatusSummary
          label="Deployment sync"
          status="Healthy"
          updated-at="2026-06-14 20:30"
          tone="success"
        >
          <template #actions>
            <fsus-button text size="small">Inspect</fsus-button>
            <a href="#deployment-history" role="button">History</a>
            <button type="button" aria-pressed="true">Pinned</button>
          </template>
        </FsusStatusSummary>
      </div>
      <div class="metric-fixture-row" data-metric-variant="summary-danger">
        <FsusStatusSummary
          label="Quota watchdog"
          status="Over limit"
          updated-at="2026-06-15 02:12"
          tone="danger"
        />
      </div>
      <div class="metric-fixture-row" data-metric-variant="summary-info">
        <FsusStatusSummary
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
        <FsusDiagnosticsList>
          <FsusDiagnosticsItem
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
          </FsusDiagnosticsItem>
          <FsusDiagnosticsItem
            title="Disk space"
            message="98% full — immediate action required."
            meta="danger - 17:49:03 - current"
            tone="danger"
            default-open
          >
            <template #detail>
              <div data-testid="nested-diagnostics">
                <FsusDiagnosticsList density="compact">
                  <FsusDiagnosticsItem
                    title="Primary volume"
                    message="Cleanup queued."
                    tone="info"
                  />
                  <FsusDiagnosticsItem
                    title="Archive volume"
                    message="Capacity remains available."
                    tone="success"
                  />
                </FsusDiagnosticsList>
              </div>
            </template>
          </FsusDiagnosticsItem>
          <FsusDiagnosticsItem
            title="Index refresh"
            message="Background refresh is still running."
            meta="info - 17:49:30"
            tone="info"
          />
          <FsusDiagnosticsItem
            title="Replica status"
            message="All replicas are synchronized."
            meta="success - 17:50:00"
            tone="success"
          />
        </FsusDiagnosticsList>
      </div>
      <div class="metric-fixture-row" data-metric-variant="diag-empty">
        <FsusEmptyState
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
        <FsusDiagnosticsList>
          <FsusDiagnosticsItem
            title="Loading diagnostics"
            message="Recent diagnostic events are being loaded."
            tone="info"
          />
        </FsusDiagnosticsList>
      </div>
    </div>

    <!-- RTL diagnostics with long detail and an inline action -->
    <div class="demo-block" data-metric-fixture="diagnostics-rtl">
      <h3>DiagnosticsList (RTL)</h3>
      <div class="metric-fixture-row" data-metric-variant="diag-rtl">
        <div dir="rtl">
          <FsusDiagnosticsList>
            <FsusDiagnosticsItem
              title="diagnostic.event"
              message="Recent event summary supplied by the product."
              meta="warning - 17:48:11 - 3 times"
              detail="diagnostic-node:runCheck:sample-0001 diagnostic-node:runCheck:sample-0002 diagnostic-node:runCheck:sample-0003 diagnostic-node:runCheck:sample-0004 diagnostic-node:runCheck:sample-0005 diagnostic-node:runCheck:sample-0006"
              tone="warning"
            >
              <template #actions>
                <FsusCopyableDetail
                  value="diagnostic-node:runCheck:sample-0001"
                  label="Copy detail"
                  inline
                />
              </template>
            </FsusDiagnosticsItem>
          </FsusDiagnosticsList>
        </div>
      </div>
    </div>

    <!-- CopyableDetail -->
    <div class="demo-block" data-metric-fixture="copyable">
      <h3>CopyableDetail</h3>
      <div class="metric-fixture-row" data-metric-variant="copy-default">
        <FsusCopyableDetail value="sk-proj-abc123def456" />
      </div>
      <div
        data-metric-variant="copy-wide"
        style="width: 425px; max-width: 100%"
      >
        <FsusCopyableDetail value="diagnostic-node:runCheck:sample-0001" />
      </div>
      <div class="metric-fixture-row" data-metric-variant="copy-disabled">
        <FsusCopyableDetail
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
  FsusCopyableDetail,
  FsusDiagnosticsItem,
  FsusDiagnosticsList,
  FsusDistributionBarRow,
  FsusDistributionList,
  FsusEmptyState,
  FsusKeyValueGrid,
  FsusKeyValueItem,
  FsusKpiGroup,
  FsusMetricItem,
  FsusMetricList,
  FsusStatusSummary,
} from '@ozwasyd/fsusui'

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

<style scoped>
#metric-visual :is(h2, h3) {
  overflow-wrap: anywhere;
}
</style>
