import { createSSRApp, h } from 'vue'
import '@ozwasyd/fsusui/styles/fsus.css'
import './style.css'
import SsrContractApp from './SsrContractApp.vue'

const appEl = document.getElementById('app')
const initialOpen = appEl?.dataset.initialOpen === 'true'
const theme = appEl?.dataset.theme === 'dark' ? 'dark' : 'light'

const app = createSSRApp({
  render() {
    return h(SsrContractApp, { initialOpen, theme })
  },
})

app.mount('#app')
