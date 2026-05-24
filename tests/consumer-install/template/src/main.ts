import { createApp } from 'vue'
import ElementPlus from '__FSUS_PACKAGE_NAME__'
import '__FSUS_PACKAGE_NAME__/dist/index.css'
import App from './App.vue'

const app = createApp(App)

app.use(ElementPlus, {
  themeMode: 'light',
})

app.mount('#app')
