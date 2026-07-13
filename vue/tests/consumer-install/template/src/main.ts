import { createApp } from 'vue'
import ElementPlus, {
  ElEmptyState,
  FsusDataList,
  installThemeModeTestHelper,
  type DataListColumn,
  type DataListRow,
  type DataListRowKey,
  type EmptyStateProps,
} from '__FSUS_PACKAGE_NAME__'
import {
  FsuTransition,
  type MotionPresetName,
} from '__FSUS_PACKAGE_NAME__/motion'
import {
  FsusPerceptionChallenge,
  type PerceptionChallengeKind,
} from '__FSUS_PACKAGE_NAME__/perception-challenge'
import '__FSUS_PACKAGE_NAME__/dist/fsus.css'
import App from './App.vue'

const app = createApp(App)
const emptyStateContract = {
  componentName: ElEmptyState.name,
  props: {
    description: 'The packed package exposes EmptyState types.',
    size: 'compact',
    title: 'EmptyState package export',
  },
} satisfies {
  componentName: string | undefined
  props: Partial<EmptyStateProps>
}

if (emptyStateContract.componentName !== 'ElEmptyState') {
  throw new Error('Packed package EmptyState export drifted.')
}

const fsusBlogPackageContract = {
  collectionComponentName: FsusDataList.name,
  columns: [{ key: 'title', label: 'Title' }] satisfies DataListColumn[],
  motionComponentName: FsuTransition.name,
  motionPreset: 'surface-settle' satisfies MotionPresetName,
  perceptionComponentName: FsusPerceptionChallenge.name,
  perceptionKind: 'text-task' satisfies PerceptionChallengeKind,
  row: { title: 'Packed collection row' } satisfies DataListRow,
  rowKey: 'packed-row' satisfies DataListRowKey,
}

if (
  fsusBlogPackageContract.collectionComponentName !== 'FsusDataList' ||
  fsusBlogPackageContract.perceptionComponentName !== 'FsusPerceptionChallenge'
) {
  throw new Error('Packed package FsusBlog export surface drifted.')
}

installThemeModeTestHelper({ mode: 'light' })

app.use(ElementPlus, {
  themeMode: 'light',
})

app.mount('#app')
