declare module 'vue' {
  export interface ComponentCustomProperties {
    $refs: Record<string, any>
    [key: string]: any
  }
}

export {}
