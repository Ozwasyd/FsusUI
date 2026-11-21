import { createApp } from 'vue'
import '@ozwasyd/element-plus/dist/fsus.css'
import App from './App.vue'
import FocusCacheDrawer from './FocusCacheDrawer.vue'

const params = new URLSearchParams(window.location.search)
const focusCacheCase = params.get('case') === 'focus-cache'
if (focusCacheCase) {
  document.documentElement.classList.toggle(
    'dark',
    params.get('theme') === 'dark',
  )
}
createApp(focusCacheCase ? FocusCacheDrawer : App).mount('#app')
