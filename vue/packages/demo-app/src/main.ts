import '@fontsource/google-sans/400.css'
import '@fontsource/google-sans/500.css'
import '@fontsource/google-sans/700.css'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/500.css'
import '@fontsource/noto-sans-sc/700.css'
import { createApp } from 'vue'
import { createDemoContract, resolveDemoRoot } from './demo-contract'
import './style.css'
import '@element-plus/theme-chalk/src/fsus.scss'

const searchParams = new URLSearchParams(window.location.search)
const { component, props, themeMode } = await resolveDemoRoot(searchParams)

createApp(component, props).use(createDemoContract(themeMode)).mount('#app')
