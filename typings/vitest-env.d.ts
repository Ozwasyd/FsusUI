declare module '@vue/runtime-core' {
  export interface ComponentCustomProperties {
    $refs: Record<string, any>
    [key: string]: any
  }
}

export {}