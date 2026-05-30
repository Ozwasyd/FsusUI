import { createApp } from 'vue'
import ElementPlus, { installThemeModeTestHelper } from '__FSUS_PACKAGE_NAME__'
import '__FSUS_PACKAGE_NAME__/dist/index.css'
import App from './App.vue'

const app = createApp(App)
installThemeModeTestHelper({ mode: 'light' })

app.use(ElementPlus, {
  themeMode: 'light',
})

app.mount('#app')
