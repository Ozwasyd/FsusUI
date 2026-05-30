export type FsusViteManualChunkResolver = (moduleId: string) => string | undefined

export declare const resolveFsusViteManualChunk: FsusViteManualChunkResolver

export declare const createFsusViteManualChunks: () => FsusViteManualChunkResolver
