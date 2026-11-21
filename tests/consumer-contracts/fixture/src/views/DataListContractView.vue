<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ElAlert,
  ElButton,
  FsusDataList,
  FsusEmptyState,
} from '@ozwasyd/element-plus'

const props = defineProps<{
  neg?: string
}>()

interface PackageRecord {
  id: string
  name: string
  version: string
  status: string
  runtime: string
}

const columns = [
  { key: 'id', label: 'ID', grid: 'minmax(88px, 0.8fr)' },
  { key: 'name', label: 'Name', grid: 'minmax(140px, 1.4fr)' },
  { key: 'version', label: 'Version', grid: 'minmax(80px, 0.7fr)' },
  { key: 'status', label: 'Status', grid: 'minmax(90px, 0.8fr)' },
  { key: 'runtime', label: 'Runtime', grid: 'minmax(90px, 0.8fr)', align: 'end' as const },
]

const makeRecords = (count: number): PackageRecord[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `svc-${index + 1}`,
    name: `artifact-worker-${index + 1}`,
    version: `2.${index % 12}.${index % 5}`,
    status: index % 4 === 0 ? 'degraded' : 'healthy',
    runtime: index % 2 === 0 ? 'node-22' : 'wasm-edge',
  }))

const params = new URLSearchParams(window.location.search)
const initialCount = Number(params.get('count') ?? '5')
const rows = ref<PackageRecord[]>(makeRecords(Number.isFinite(initialCount) ? initialCount : 5))
const activeKey = ref<string | null>(rows.value[0]?.id ?? null)
const disabledAll = ref(params.get('disabled') === '1')
const disabledKeys = ref<string[]>(rows.value.length >= 2 ? [rows.value[1].id] : [])
const loadingAll = ref(params.get('loading') === '1')
const loadingKey = ref<string | null>(
  params.get('loadingKey') || (rows.value.length >= 3 ? rows.value[2].id : null),
)
const errorState = ref(params.get('error') === '1')
const rejectActivation = ref(params.get('reject') === '1')
const mounted = ref(true)
const activationLog = ref<string[]>([])

const setRowCount = (count: number) => {
  rows.value = makeRecords(count)
  activeKey.value = rows.value[0]?.id ?? null
  disabledKeys.value = rows.value.length >= 2 ? [rows.value[1].id] : []
  loadingKey.value = rows.value.length >= 3 ? rows.value[2].id : null
}

const reorderRows = () => {
  if (rows.value.length < 4) return
  const [first, second, third, fourth, ...rest] = rows.value
  rows.value = [fourth, first, third, second, ...rest]
}

const removeFocusedOrFirstEnabled = () => {
  const target = rows.value.find(
    (row) =>
      row.id !== loadingKey.value && !disabledKeys.value.includes(row.id),
  )
  if (!target) return
  rows.value = rows.value.filter((row) => row.id !== target.id)
}

const handleChange = (_row: Record<string, unknown>, key: string | number) => {
  const stringKey = String(key)
  activationLog.value.push(stringKey)
  if (props.neg === 'identity-drift') {
    activeKey.value = stringKey
    return
  }
  if (!rejectActivation.value) {
    activeKey.value = stringKey
  }
}

const handleNegLoadingKeydown = (row: PackageRecord, event: KeyboardEvent) => {
  if (props.neg !== 'loading-keyboard') return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    activationLog.value.push(row.id)
    activeKey.value = row.id
  }
}

const rootClasses = computed(() => [
  'contract-data-region',
  props.neg === 'missing-forced-outline' ? 'contract-forced-neg-active' : '',
])
</script>

<template>
  <section :class="rootClasses" data-testid="data-list-contract-section">
    <h1>DataList Accessible Activation Contract (#831)</h1>

    <div class="contract-toolbar">
      <button type="button" data-testid="before-list-focus">
        Before list
      </button>
      <ElButton data-testid="count-0-btn" @click="setRowCount(0)">
        0 rows
      </ElButton>
      <ElButton data-testid="count-1-btn" @click="setRowCount(1)">
        1 row
      </ElButton>
      <ElButton data-testid="count-5-btn" @click="setRowCount(5)">
        5 rows
      </ElButton>
      <ElButton data-testid="count-1000-btn" @click="setRowCount(1000)">
        1000 rows
      </ElButton>
      <ElButton data-testid="toggle-disabled-btn" @click="disabledAll = !disabledAll">
        Disabled: {{ disabledAll ? 'on' : 'off' }}
      </ElButton>
      <ElButton data-testid="toggle-loading-btn" @click="loadingAll = !loadingAll">
        Loading: {{ loadingAll ? 'on' : 'off' }}
      </ElButton>
      <ElButton data-testid="toggle-error-btn" @click="errorState = !errorState">
        Error: {{ errorState ? 'on' : 'off' }}
      </ElButton>
      <ElButton data-testid="toggle-reject-btn" @click="rejectActivation = !rejectActivation">
        Reject: {{ rejectActivation ? 'on' : 'off' }}
      </ElButton>
      <ElButton data-testid="reorder-btn" @click="reorderRows">
        Reorder
      </ElButton>
      <ElButton data-testid="remove-row-btn" @click="removeFocusedOrFirstEnabled">
        Remove enabled row
      </ElButton>
      <ElButton data-testid="toggle-mount-btn" @click="mounted = !mounted">
        {{ mounted ? 'Unmount list' : 'Remount list' }}
      </ElButton>
    </div>

    <ElAlert
      v-if="errorState"
      class="contract-alert-box"
      type="error"
      title="Service inventory failed to synchronize"
      :closable="false"
      data-testid="consumer-error-alert"
    />

    <div
      v-if="loadingAll"
      role="status"
      aria-live="polite"
      data-testid="consumer-loading-status"
    >
      Refreshing records…
    </div>

    <!-- Negative controls for invalid semantics or loading activation -->
    <div v-if="neg === 'invalid-role'" role="list" aria-label="Service records">
      <button
        v-for="row in rows"
        :key="row.id"
        type="button"
        role="listitem"
        @click="handleChange(row, row.id)"
      >
        {{ row.name }}
      </button>
    </div>

    <div
      v-else-if="neg === 'loading-keyboard'"
      role="list"
      aria-label="Service records"
      aria-busy="true"
    >
      <div v-for="row in rows" :key="row.id" role="listitem">
        <button
          type="button"
          aria-disabled="true"
          aria-busy="true"
          @keydown="handleNegLoadingKeydown(row, $event)"
        >
          {{ row.name }}
        </button>
      </div>
    </div>

    <FsusDataList
      v-else-if="mounted"
      :rows="rows"
      :columns="columns"
      row-key="id"
      :active-key="activeKey"
      :disabled="disabledAll"
      :disabled-keys="disabledKeys"
      :loading="loadingAll"
      :loading-key="loadingKey"
      aria-label="Service records"
      variant="navigation"
      responsive
      data-testid="service-data-list"
      @change="handleChange"
    >
      <template #cell="{ column, value, loading }">
        <span v-if="column.key === 'status' && loading">Syncing…</span>
        <span v-else>{{ value }}</span>
      </template>
      <template #empty>
        <FsusEmptyState
          size="inline"
          title="No service records"
          description="Adjust filters or refresh the service inventory."
          data-testid="consumer-empty-state"
        />
      </template>
    </FsusDataList>

    <div class="contract-status" data-testid="data-list-status">
      <div data-testid="active-key-value">{{ activeKey ?? 'none' }}</div>
      <div data-testid="activation-log">{{ activationLog.join(',') }}</div>
      <div data-testid="row-count-value">{{ rows.length }}</div>
    </div>
  </section>
</template>
