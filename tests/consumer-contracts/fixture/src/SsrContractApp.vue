<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  FsusAlert,
  FsusButton,
  FsusButtonGroup,
  FsusCard,
  FsusCheckTag,
  FsusConfigProvider,
  FsusDataList,
  FsusFormItem,
  FsusIcon,
  FsusInput,
  FsusSegmentedControl,
  FsusSelect,
  FsusTag,
} from '@ozwasyd/fsusui'
import { FsusIconArrowLeft, FsusIconArrowRight } from '@ozwasyd/fsusui/icons'

const props = defineProps<{
  initialOpen: boolean
  theme: 'light' | 'dark'
}>()

const clickCount = ref(0)
const filterChecked = ref(props.initialOpen)
const activeSegment = ref('overview')
const ssrLanguage = ref('en')
const ssrEmail = ref('')
const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
]
const segmentOptions = [
  { value: 'overview', label: 'Overview' },
  { value: 'changelog', label: 'Changelog' },
]

onMounted(() => {
  document.documentElement.dataset.fsusTheme = props.theme
  document.documentElement.classList.toggle('dark', props.theme === 'dark')
  document.documentElement.classList.toggle('light', props.theme === 'light')
})
</script>

<template>
  <FsusConfigProvider :theme-mode="theme">
    <main class="contract-ssr-root" data-testid="ssr-main" data-ssr-hydrated="true">
      <h1>FsusUI 2.0 SSR + Strict CSP Contract</h1>

      <div class="contract-toolbar">
        <FsusButton variant="primary" data-testid="ssr-action-btn" @click="clickCount += 1">
          Increment ({{ clickCount }})
        </FsusButton>

        <FsusButtonGroup>
          <FsusButton variant="primary" :icon="FsusIconArrowLeft">Prev</FsusButton>
          <FsusButton variant="primary">
            Next<FsusIcon class="fsus-icon--right"><FsusIconArrowRight /></FsusIcon>
          </FsusButton>
        </FsusButtonGroup>

        <FsusCheckTag v-model:checked="filterChecked" data-testid="ssr-check-tag">
          Strict CSP Safe
        </FsusCheckTag>
      </div>

      <FsusSegmentedControl
        v-model="activeSegment"
        :options="segmentOptions"
        data-testid="ssr-segmented"
      />

      <FsusDataList>
        <FsusCard header="SSR Output">
          <FsusTag tone="info">Pure ESM</FsusTag>
          <FsusAlert title="Hydrated under strict CSP" tone="success" />
          <FsusFormItem label="SSR Language">
            <FsusSelect v-model="ssrLanguage" :options="languageOptions" data-testid="ssr-select" />
          </FsusFormItem>
          <FsusInput id="ssr-email" v-model="ssrEmail" inputmode="email" aria-label="SSR Email" />
        </FsusCard>
      </FsusDataList>

      <div class="contract-status" data-testid="ssr-status">
        <span data-testid="ssr-click-count">{{ clickCount }}</span>
        <span data-testid="ssr-filter-checked">{{ String(filterChecked) }}</span>
        <span data-testid="ssr-active-segment">{{ activeSegment }}</span>
      </div>
    </main>
  </FsusConfigProvider>
</template>
