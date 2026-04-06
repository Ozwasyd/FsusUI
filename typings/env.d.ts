import type { vShow } from 'vue'
import type { INSTALLED_KEY } from '@element-plus/constants'

declare global {
  const process: {
    env: {
      NODE_ENV: string
    }
  }

  namespace JSX {
    interface IntrinsicAttributes {
      class?: any
      style?: any
    }
  }
}

declare module '@vue/runtime-core' {
  export interface App {
    [INSTALLED_KEY]?: boolean
  }

  export interface GlobalComponents {
    Component: (props: { is: Component | string }) => void
  }

  export interface ComponentCustomProperties {
    vShow: typeof vShow
  }
}

// .vue file shim for regular tsc (vitest type-check)
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>
  export default component
}

// theme-chalk side-effect style imports
declare module '@element-plus/theme-chalk/*.css' {}
declare module '@element-plus/theme-chalk/src/*.scss' {}
declare module '@element-plus/theme-chalk/src/**/*.scss' {}

export {}
