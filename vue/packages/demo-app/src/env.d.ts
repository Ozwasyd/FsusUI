/// <reference types="vite/client" />

declare module '*.css' {}
declare module '*.scss' {}
declare module '@element-plus/theme-chalk/src/*.scss' {}
declare module '@element-plus/theme-chalk/src/**/*.scss' {}
declare module 'vue' {
  interface HTMLAttributes {
    'data-upload-variant'?: string
    'data-upload-fixture'?: string
    'data-upload-help'?: string
    'data-testid'?: string
  }
}
