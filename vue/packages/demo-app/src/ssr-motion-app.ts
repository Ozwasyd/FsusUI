import { createSSRApp } from 'vue'
import SsrMotionFixture from './SsrMotionFixture.vue'

export const createSsrMotionApp = () => createSSRApp(SsrMotionFixture)
