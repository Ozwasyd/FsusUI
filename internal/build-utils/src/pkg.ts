import findWorkspacePackages from '@pnpm/find-workspace-packages'
import path from 'node:path'
import { projRoot } from './paths'

import type { ProjectManifest } from '@pnpm/types'

export const getWorkspacePackages = () => findWorkspacePackages(projRoot)
export const getWorkspaceNames = async (dir = projRoot) => {
  const pkgs = await findWorkspacePackages(projRoot)
  return pkgs
    .filter((pkg) => pkg.dir.startsWith(dir))
    .map((pkg) => pkg.manifest.name)
    .filter((name): name is string => !!name)
}

export const getPackageManifest = (pkgPath: string) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(pkgPath) as ProjectManifest
}

export const getPackageDependencies = (
  pkgPath: string
): Record<'dependencies' | 'peerDependencies', string[]> => {
  const manifest = getPackageManifest(pkgPath)
  const { dependencies = {}, peerDependencies = {} } = manifest

  return {
    dependencies: Object.keys(dependencies),
    peerDependencies: Object.keys(peerDependencies),
  }
}

const excludedDirs = new Set(['node_modules', 'dist', 'demo-app', 'build'])
const excludedSegmentFragments = ['test', 'mock']
const excludedBasenames = new Set(['gulpfile.ts', 'gulpfile.js', 'gulpfile.mjs', 'gulpfile.cjs'])
const excludedFilenamePatterns = [
  /^build\.config\.[^.]+$/u,
  /^vite\.config\.[^.]+$/u,
  /^[^.]+\.config\.[^.]+$/u,
]

function shouldExcludeFile(filePath: string) {
  const normalizedPath = filePath.split(path.sep)
  const basename = path.basename(filePath)

  if (
    normalizedPath.some((segment) => {
      return (
        excludedDirs.has(segment) ||
        excludedSegmentFragments.some((fragment) => segment.includes(fragment))
      )
    })
  ) {
    return true
  }

  if (excludedBasenames.has(basename)) {
    return true
  }

  return excludedFilenamePatterns.some((pattern) => pattern.test(basename))
}

export const excludeFiles = (files: string[]) => {
  return files.filter((filePath) => !shouldExcludeFile(filePath))
}
