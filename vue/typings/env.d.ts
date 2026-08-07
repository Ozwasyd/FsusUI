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

interface FsusAuditAttributes {
  'data-audit-active'?: string | boolean
  'data-audit-component'?: string
  'data-audit-focus'?: string | boolean
  'data-audit-target'?: string | boolean
  'data-testid'?: string
  'data-markdown-editor-probe-id'?: string
  'data-upload-help'?: string | boolean
  'data-descriptions-spacing-fixtures'?: string | boolean
  'data-input-number-hit-fixtures'?: string | boolean
}

interface FsusInputModelAttributes {
  'true-value'?: boolean | number | string
  'false-value'?: boolean | number | string
}

declare module '@vue/runtime-dom' {
  export interface HTMLAttributes extends FsusAuditAttributes {
    'data-audit-active'?: string | boolean
    'data-audit-component'?: string
    'data-audit-focus'?: string | boolean
    'data-audit-target'?: string | boolean
    'data-testid'?: string
    'data-markdown-editor-probe-id'?: string
    'data-upload-help'?: string | boolean
    'data-descriptions-spacing-fixtures'?: string | boolean
    'data-input-number-hit-fixtures'?: string | boolean
  }

  export interface AnchorHTMLAttributes extends FsusAuditAttributes {}

  export interface InputHTMLAttributes extends FsusInputModelAttributes {
    'true-value'?: boolean | number | string
    'false-value'?: boolean | number | string
  }
}

declare module 'vue' {
  export interface App {
    [INSTALLED_KEY]?: boolean
  }

  export interface GlobalDirectives {
    vLoading: (typeof import('../packages/components/loading'))['vLoading']
    vInfiniteScroll: (typeof import('../packages/components/infinite-scroll'))['default']
  }

  export interface GlobalComponents {
    Component: (props: { is: Component | string }) => void
  }

  export interface ComponentCustomProperties {
    vShow: typeof vShow
  }

  export interface ComponentCustomProps {
    dataAuditActive?: string | boolean
    dataAuditComponent?: string
    dataAuditFocus?: string | boolean
    dataAuditTarget?: string | boolean
    dataDescriptionsCase?: string
    dataInputNumberCase?: string
  }

  export interface HTMLAttributes extends FsusAuditAttributes {}
  export interface AnchorHTMLAttributes extends FsusAuditAttributes {}
  export interface InputHTMLAttributes extends FsusInputModelAttributes {}
}

// .vue file shim for regular tsc (vitest type-check)
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<
    Record<string, unknown>,
    Record<string, unknown>,
    any
  >
  export default component
}

declare module '*.css' {}

// theme-chalk side-effect style imports
declare module '@element-plus/theme-chalk/*.css' {}
declare module '@element-plus/theme-chalk/src/*.scss' {}
declare module '@element-plus/theme-chalk/src/**/*.scss' {}

declare module '*.mjs' {
  const mod: any
  export default mod
}

declare module '*.wasm' {
  const src: string
  export default src
}

export {}
