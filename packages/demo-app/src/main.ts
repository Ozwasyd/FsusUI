import '@fontsource/google-sans/400.css'
import '@fontsource/google-sans/500.css'
import '@fontsource/google-sans/700.css'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/500.css'
import { createApp } from 'vue'
import ElementPlus from '../../element-plus'
import App from './App.vue'
import VisualFixtures from './VisualFixtures.vue'
import './style.css'
import '@element-plus/theme-chalk/src/index.scss'

const searchParams = new URLSearchParams(window.location.search)
const visualMode = searchParams.get('visual')
const visualTheme = searchParams.get('theme') ?? 'light'
const visualCompact = searchParams.get('compact') === '1'

const rootComponent = visualMode ? VisualFixtures : App
const rootProps = visualMode
  ? {
      mode: visualMode,
      theme: visualTheme,
      compact: visualCompact,
    }
  : undefined

createApp(rootComponent, rootProps).use(ElementPlus).mount('#app')
