export const PACKAGE_CODE_EXTENSIONS: string[]
export const BUNDLED_WORKSPACE_RUNTIME_ENTRIES: Map<
  string,
  { es: string; lib: string; types: string }
>
export const BUNDLED_WORKSPACE_DEPENDENCY_NAMES: Set<string>
export const WORKER_NAMES: string[]
export const VITE_WORKER_RUNTIME_PATHS: Map<string, string>

export function toModuleSpecifier(relativePath: string): string
export function isDeclarationFile(filePath: string): boolean
export function isPackageCodeFile(filePath: string): boolean
export function collectDirectoryFiles(
  rootDir: string,
  currentDir?: string,
): string[]
export function collectPackageCodeFiles(rootDir: string): string[]
export function resolveBundledWorkspaceRuntimeSpecifier(
  rootDir: string,
  filePath: string,
  packageName: string,
  dependencyName: string,
  options?: { strict?: boolean },
): string | undefined
export function rewriteBundledWorkspaceReferences(
  rootDir: string,
  options?: {
    packageName?: string
    dependencyNames?: Iterable<string>
    strict?: boolean
  },
): { updatedFiles: number; replacementCount: number }
export function rewriteBuildStageWorkerReferences(rootDir: string): number
export function rewritePublishStageWorkerReferences(rootDir: string): number
export function rewritePublishedSelfReferences(
  rootDir: string,
  packageName: string,
): { updatedFiles: number; replacementCount: number }
export function rewriteEmscriptenWasmFallbackReferences(rootDir: string): number
export function stripSourceMappingUrlReferences(rootDir: string): void
export function pruneSourceMaps(rootDir: string): number
