import '@fontsource/google-sans/400.css'
import '@fontsource/noto-sans-sc/400.css'
import '@element-plus/theme-chalk/src/fsus.scss'
import './style.css'
import { createSsrMotionApp } from './ssr-motion-app'

createSsrMotionApp().mount('#app')
window.__FSUS_SSR_HYDRATED__ = true

declare global {
  interface Window {
    __FSUS_SSR_HYDRATED__?: boolean
  }
}
