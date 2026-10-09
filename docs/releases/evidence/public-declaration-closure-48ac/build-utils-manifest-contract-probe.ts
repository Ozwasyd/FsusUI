import { getPackageManifest, getWorkspacePackages } from './index'
import findWorkspacePackages from '@pnpm/find-workspace-packages'
import type { ProjectManifest } from '@pnpm/types'
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
type Assert<T extends true> = T
type ManifestContract = Assert<Equal<ReturnType<typeof getPackageManifest>, ProjectManifest>>
type WorkspaceContract = Assert<Equal<ReturnType<typeof getWorkspacePackages>, ReturnType<typeof findWorkspacePackages>>>
const manifest = getPackageManifest('package.json')
const dependencies: Record<string, string> | undefined = manifest.dependencies
const requiredScripts: string[] | undefined = manifest.pnpm?.requiredScripts
// @ts-expect-error package dependencies must remain strings
const invalid: number | undefined = manifest.dependencies?.vue
export type { ManifestContract, WorkspaceContract }
void dependencies
void requiredScripts
void invalid
