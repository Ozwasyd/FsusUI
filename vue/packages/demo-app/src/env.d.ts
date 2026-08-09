/// <reference types="vite/client" />

import 'vue'

declare module '*.css' {}
declare module '*.scss' {}
declare module '@element-plus/theme-chalk/src/*.scss' {}
declare module '@element-plus/theme-chalk/src/**/*.scss' {}
declare module '@vue/runtime-dom' {
  export interface HTMLAttributes {
    'data-upload-variant'?: string
    'data-upload-fixture'?: string
    'data-metric-fixture'?: string
    'data-metric-variant'?: string
    'data-segmented-fixture'?: string
    'data-segmented-variant'?: string
    'data-settings-fixture'?: string
    'data-settings-variant'?: string
  }
}
