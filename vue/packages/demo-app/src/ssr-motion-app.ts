import { createSSRApp } from 'vue'
import { ID_INJECTION_KEY } from '../../hooks'
import SsrMotionFixture from './SsrMotionFixture.vue'

export const createSsrMotionApp = () => {
  const app = createSSRApp(SsrMotionFixture)
  app.provide(ID_INJECTION_KEY, { prefix: 253, current: 0 })
  return app
}
