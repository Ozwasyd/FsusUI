declare module '*?worker' {
  const WorkerFactory: {
    new (options?: WorkerOptions): Worker
  }
  export default WorkerFactory
}

declare module '*.ts?worker' {
  const WorkerFactory: {
    new (options?: WorkerOptions): Worker
  }
  export default WorkerFactory
}

declare module '*.worker.ts?worker' {
  const WorkerFactory: {
    new (options?: WorkerOptions): Worker
  }
  export default WorkerFactory
}

declare module '*?worker&url' {
  const url: string
  export default url
}
