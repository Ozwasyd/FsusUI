<template>
  <main
    class="performance-fixture"
    :class="`motion-${motion}`"
    v-bind="{
      'data-performance-ready': ready,
      'data-performance-scenario': scenario,
    }"
  >
    <fixed-size-list
      v-if="scenario === 'virtual-list-fixed'"
      ref="virtualList"
      :data="items"
      :total="items.length"
      :height="640"
      :width="960"
      :item-size="32"
      class-name="performance-scroll-target"
    >
      <template #default="{ data, index, style }">
        <div :style="style" class="performance-row">
          {{ data[index].label }}
        </div>
      </template>
    </fixed-size-list>

    <dynamic-size-list
      v-else-if="scenario === 'virtual-list-variable'"
      ref="virtualList"
      :data="items"
      :total="items.length"
      :height="640"
      :width="960"
      :item-size="variableItemSize"
      :estimated-item-size="40"
      class-name="performance-scroll-target"
    >
      <template #default="{ data, index, style }">
        <div :style="style" class="performance-row">
          {{ data[index].label }}
        </div>
      </template>
    </dynamic-size-list>

    <el-table-v2
      v-else-if="scenario === 'virtual-grid'"
      ref="virtualGrid"
      :columns="gridColumns"
      :data="gridRows"
      :width="960"
      :height="640"
      fixed
      class="performance-scroll-target"
    />

    <el-markdown-renderer
      v-else-if="scenario.startsWith('markdown')"
      :content="markdown"
      :allow-html="false"
      :allow-latex="true"
      :allow-mermaid="true"
      mode="article"
      class="performance-scroll-target performance-markdown"
      @render-profile="captureWasmProfile"
      @render-complete="ready = 'true'"
      @render-error="ready = 'error'"
    />

    <el-select-v2
      v-else-if="scenario === 'select-v2'"
      v-model="selected"
      :options="options"
      filterable
      :teleported="false"
      class="performance-input-target"
    />

    <output
      v-else-if="scenario.startsWith('render-pipeline-')"
      class="performance-pipeline-result"
      v-bind="{ 'data-performance-pipeline': 'true' }"
      >{{ pipelineRevision }}</output
    >

    <el-table
      v-else
      ref="table"
      :data="displayedTableRows"
      height="640"
      class="performance-scroll-target"
      @selection-change="selection = $event"
    >
      <el-table-column type="selection" width="48" />
      <el-table-column prop="id" label="ID" sortable />
      <el-table-column prop="label" label="Label" sortable />
      <el-table-column prop="score" label="Score" sortable />
    </el-table>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  DynamicSizeList,
  FixedSizeList,
} from '@element-plus/components/virtual-list'
import { useFsusRenderScheduler } from '@element-plus/hooks'

import type { MarkdownRuntimeProfile } from '@element-plus/wasm'
import type { FsusScheduledWork } from '@element-plus/hooks'

const props = defineProps<{
  scenario: string
  size: number
  motion: string
}>()

const ready = ref('false')
const selected = ref('')
const selection = ref<unknown[]>([])
const tableFilter = ref('')
const tableRevision = ref(0)
const pipelineRevision = ref(0)
const renderScheduler = useFsusRenderScheduler()
const virtualList = ref<{ scrollTo: (offset: number) => void } | null>(null)
const virtualGrid = ref<{
  scrollTo: (position: { scrollLeft: number; scrollTop: number }) => void
} | null>(null)
const table = ref<{
  clearSort: () => void
  sort: (property: string, order: 'ascending' | 'descending') => void
  toggleRowSelection: (row: unknown) => void
} | null>(null)

const boundedSize = computed(() => Math.max(1, Math.min(props.size, 100_000)))
const items = computed(() =>
  Array.from({ length: boundedSize.value }, (_, index) => ({
    id: index,
    label: `Row ${index} ${'content '.repeat(1 + (index % 6))}`,
  })),
)
const variableItemSize = (index: number) => 28 + (index % 7) * 7
const gridColumns = computed(() =>
  Array.from(
    { length: Math.min(80, Math.max(8, Math.ceil(props.size / 1250))) },
    (_, index) => ({
      key: `column-${index}`,
      dataKey: `column-${index}`,
      title: `Column ${index}`,
      width: 128,
    }),
  ),
)
const gridRows = computed(() =>
  Array.from(
    { length: boundedSize.value },
    (_, row) =>
      new Proxy({ id: row } as Record<string, string | number>, {
        get(target, property) {
          if (property in target) return target[property as string]
          const column = String(property).replace('column-', '')
          return `R${row} C${column}`
        },
      }),
  ),
)
const options = computed(() =>
  Array.from({ length: boundedSize.value }, (_, index) => ({
    label: index % 997 === 0 ? `needle option ${index}` : `option ${index}`,
    value: `option-${index}`,
  })),
)
const tableRows = computed(() =>
  Array.from({ length: Math.min(boundedSize.value, 10_000) }, (_, index) => ({
    id: index,
    label: `Row ${index}`,
    score: (index * 48_271) % 104_729,
  })),
)
const displayedTableRows = computed(() => {
  const source = tableFilter.value
    ? tableRows.value.filter((row) => row.id % 7 === 0)
    : tableRows.value
  return source.map((row) => ({
    ...row,
    score: row.score + tableRevision.value,
  }))
})
const markdown = computed(() => {
  const target = Math.max(1024, props.size)
  const paragraph =
    '## Rendering fixture\n\nParagraph with **bold**, `code`, [link](https://example.com), and 中文文本.\n\n'
  return paragraph.repeat(Math.ceil(target / paragraph.length)).slice(0, target)
})

type PerformanceFixtureApi = {
  act: (iteration: number) => Promise<void>
  workerProbe: (iteration: number) => Promise<{
    queueWaitMs: number
    computeMs: number
    transferMs: number
  }>
  wasmProbe: () => Promise<{
    startupMs: number
    computeMs: number
    endToEndMs: number
    engine: string
    initial: {
      startupMs: number
      computeMs: number
      endToEndMs: number
      engine: string
    } | null
  }>
}

declare global {
  interface Window {
    __FSUSUI_PERFORMANCE_FIXTURE__?: PerformanceFixtureApi
  }
}

const act = async (iteration: number) => {
  const ratio = ((iteration % 5) + 1) / 6
  if (props.scenario.startsWith('virtual-list')) {
    virtualList.value?.scrollTo(Math.floor(items.value.length * 32 * ratio))
  } else if (props.scenario === 'virtual-grid') {
    virtualGrid.value?.scrollTo({
      scrollLeft: Math.floor(gridColumns.value.length * 128 * ratio),
      scrollTop: Math.floor(gridRows.value.length * 32 * ratio),
    })
  } else if (props.scenario === 'select-v2') {
    const input = document.querySelector<HTMLInputElement>(
      '.performance-input-target input',
    )
    input?.focus()
    if (input) {
      input.value = iteration % 2 ? 'needle' : 'option 99'
      input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    }
  } else if (props.scenario === 'table') {
    if (iteration % 4 === 0) table.value?.sort('score', 'ascending')
    else if (iteration % 4 === 1)
      table.value?.toggleRowSelection(displayedTableRows.value[iteration])
    else if (iteration % 4 === 2)
      tableFilter.value = tableFilter.value ? '' : 'filtered'
    else {
      tableRevision.value += 1
      table.value?.clearSort()
    }
  } else if (props.scenario === 'render-pipeline-monolithic') {
    const target = props.size
    let checksum = iteration
    for (let index = 0; index < target; index++) {
      checksum = (checksum * 33 + index) >>> 0
    }
    pipelineRevision.value = checksum
  } else if (props.scenario === 'render-pipeline-cooperative') {
    const chunkSize = 20_000
    const target = props.size
    let cursor = 0
    let checksum = iteration
    const chunk = (): FsusScheduledWork => {
      const limit = Math.min(target, cursor + chunkSize)
      while (cursor < limit) {
        checksum = (checksum * 33 + cursor) >>> 0
        cursor += 1
      }
      if (cursor >= target) {
        pipelineRevision.value = checksum
        return { done: true }
      }
      return { done: false, continuation: chunk }
    }
    renderScheduler.schedule(chunk, {
      key: 'performance-pipeline-background',
      priority: 'background',
    })
    await new Promise<void>((resolve) => {
      renderScheduler.schedule(
        () => {
          pipelineRevision.value = iteration
          resolve()
        },
        { priority: 'user-blocking' },
      )
    })
  } else {
    const target = document.querySelector<HTMLElement>(
      '.performance-scroll-target',
    )
    target?.scrollTo({
      top: Math.floor((target.scrollHeight - target.clientHeight) * ratio),
    })
  }
  await nextTick()
}

const workerProbe = async (iteration: number) => {
  const source = `
    self.onmessage = ({ data }) => {
      const received = performance.now()
      let checksum = 0
      for (let index = 0; index < data.length; index++) checksum = (checksum + data[index]) >>> 0
      const computed = performance.now()
      self.postMessage({ received, computed, checksum })
    }
  `
  const workerUrl = URL.createObjectURL(new Blob([source]))
  const worker = new Worker(workerUrl)
  URL.revokeObjectURL(workerUrl)
  const payload = new Uint32Array(16_384 + iteration * 17)
  const queued = performance.now()
  return await new Promise<{
    queueWaitMs: number
    computeMs: number
    transferMs: number
  }>((resolve) => {
    worker.onmessage = ({ data }) => {
      const completed = performance.now()
      worker.terminate()
      resolve({
        queueWaitMs: data.received - queued,
        computeMs: data.computed - data.received,
        transferMs: completed - data.computed,
      })
    }
    worker.postMessage(payload)
  })
}

let initialWasmProfile: {
  startupMs: number
  computeMs: number
  endToEndMs: number
  engine: string
} | null = null

const captureWasmProfile = (profile: MarkdownRuntimeProfile) => {
  if (initialWasmProfile) return
  initialWasmProfile = {
    startupMs: profile.timings.initMs,
    computeMs: Math.max(0, profile.timings.totalMs - profile.timings.initMs),
    endToEndMs: profile.timings.totalMs,
    engine: profile.engine,
  }
}

const wasmProbe = async () => {
  const started = performance.now()
  const runtime = await import('@element-plus/wasm')
  const readiness = await runtime.ensureWasmReady()
  if (!readiness.ok) throw new Error(readiness.error.message)
  const initialized = performance.now()
  const result = await runtime.renderMarkdownResultWithRuntime({
    source: markdown.value,
    allowHtml: false,
    allowLatex: true,
    allowMermaid: true,
    mode: 'article',
  })
  if (!result.ok) throw new Error(result.error.message)
  const completed = performance.now()
  return {
    startupMs: initialized - started,
    computeMs: completed - initialized,
    endToEndMs: completed - started,
    engine: result.value.engine,
    initial: initialWasmProfile,
  }
}

onMounted(async () => {
  window.__FSUSUI_PERFORMANCE_FIXTURE__ = { act, workerProbe, wasmProbe }
  await nextTick()
  if (!props.scenario.startsWith('markdown')) ready.value = 'true'
})

onBeforeUnmount(() => {
  delete window.__FSUSUI_PERFORMANCE_FIXTURE__
})
</script>

<style scoped>
.performance-fixture {
  box-sizing: border-box;
  min-height: 720px;
  padding: 24px;
  width: 1024px;
}

.performance-row {
  align-items: center;
  border-bottom: 1px solid var(--el-border-color-lighter);
  box-sizing: border-box;
  display: flex;
  padding-inline: 12px;
}

.performance-markdown {
  height: 640px;
  overflow: auto;
}

.motion-disabled *,
.motion-disabled *::before,
.motion-disabled *::after {
  animation: none !important;
  transition: none !important;
}

@media (prefers-reduced-motion: reduce) {
  .motion-reduced *,
  .motion-reduced *::before,
  .motion-reduced *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
  }
}
</style>
