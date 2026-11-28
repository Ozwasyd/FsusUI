import type { vShow } from 'vue'

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
  'data-markdown-instance'?: string
  'data-markdown-scroll-container'?: string
  'data-markdown-reveal-state'?: string | boolean
  'data-markdown-surface-owner'?: string | boolean
  'data-markdown-atomic-kind'?: string | boolean
  'data-markdown-atomic-status'?: string | boolean
  'data-markdown-layout-action'?: string | boolean
  'data-markdown-layout-smooth'?: string | boolean
  'data-markdown-live-decorations'?: string | boolean
  'data-markdown-live-visual'?: string | boolean
  'data-markdown-input-authority'?: string | boolean
  'data-markdown-anchor-id'?: string
  'data-markdown-anchor-epoch'?: string | number
  'data-markdown-anchor-projection'?: string
  'data-kind'?: string | boolean
  'data-live-kind'?: string | boolean
  'data-measure-role'?: string | boolean
  'data-node-id'?: string | boolean
  'data-role'?: string | boolean
  'data-upload-help'?: string | boolean
  'data-descriptions-spacing-fixtures'?: string | boolean
  'data-input-number-hit-fixtures'?: string | boolean
}

interface FsusInputModelAttributes {
  'true-value'?: boolean | number | string
  'false-value'?: boolean | number | string
}

declare module '@vue/runtime-dom' {
  export interface HTMLAttributes extends FsusAuditAttributes {}
  export interface AnchorHTMLAttributes extends FsusAuditAttributes {}
  export interface InputHTMLAttributes extends FsusInputModelAttributes {}
}

declare module 'vue' {
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
    dataMarkdownInputAuthority?: string
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

// FsusUI theme style side-effect imports
declare module '@fsusui/theme/*.css' {}
declare module '@fsusui/theme/src/*.scss' {}
declare module '@fsusui/theme/src/**/*.scss' {}

declare module '*.mjs' {
  const mod: any
  export default mod
}

declare module '*.wasm' {
  const src: string
  export default src
}

export {}
