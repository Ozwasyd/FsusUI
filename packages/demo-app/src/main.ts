import '@fontsource/google-sans/400.css'
import '@fontsource/google-sans/500.css'
import '@fontsource/google-sans/700.css'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/500.css'
import { createApp } from 'vue'
import ElementPlus from '../../element-plus'
import App from './App.vue'
import './style.css'
import '@element-plus/theme-chalk/src/index.scss'

createApp(App).use(ElementPlus).mount('#app')