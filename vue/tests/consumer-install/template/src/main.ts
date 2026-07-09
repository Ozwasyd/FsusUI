import { createApp } from 'vue'
import ElementPlus, {
  ElEmptyState,
  installThemeModeTestHelper,
  type EmptyStateProps,
} from '__FSUS_PACKAGE_NAME__'
import '__FSUS_PACKAGE_NAME__/dist/index.css'
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

installThemeModeTestHelper({ mode: 'light' })

app.use(ElementPlus, {
  themeMode: 'light',
})

app.mount('#app')
