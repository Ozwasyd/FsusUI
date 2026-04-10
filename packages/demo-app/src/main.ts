import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import App from './App.vue'
import './style.css'
import '@element-plus/theme-chalk/src/index.scss'

createApp(App).use(ElementPlus).mount('#app')