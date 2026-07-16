import { epPackage, getPackageDependencies } from '@element-plus/build-utils'

import type { OutputOptions, RollupBuild } from 'rollup'

type RollupWarning = {
  code?: string
  exporter?: string
  id?: string
  ids?: string[]
  message?: string
}

const knownCircularDependencyPackages = new Set([
  'd3-interpolate',
  'd3-selection',
  'd3-transition',
  'mlly',
  'semver',
])

const nodeModulePackagePattern =
  /(?:^|\/)node_modules\/(?!\.pnpm\/)((?:@[^/\s]+\/)?[^/\s:]+)/gu

function packageNameFromModulePath(modulePath: string) {
  const normalizedPath = modulePath.replaceAll('\\', '/')
  const matches = [...normalizedPath.matchAll(nodeModulePackagePattern)]
  return matches.at(-1)?.[1]
}

function circularDependencyParticipants(warning: RollupWarning) {
  if (warning.ids?.length) return warning.ids
  if (warning.id) return [warning.id]

  const message = warning.message?.replace(/^Circular dependency:\s*/u, '')
  return message ? message.split(/\s+->\s+/u) : []
}

function isKnownOptionalImport(warning: RollupWarning) {
  const sources = [warning.exporter, warning.id, warning.message].filter(
    (source): source is string => Boolean(source),
  )

  return sources.some((source) => {
    const normalizedSource = source.replaceAll('\\', '/')
    return (
      normalizedSource === 'fsevents' ||
      normalizedSource.includes('"fsevents"') ||
      normalizedSource.endsWith('/vue-sfc-transformer/mkdist') ||
      normalizedSource.includes('"vue-sfc-transformer/mkdist"')
    )
  })
}

export function shouldIgnoreRollupWarning(warning: RollupWarning) {
  if (warning.code === 'UNRESOLVED_IMPORT') {
    return isKnownOptionalImport(warning)
  }

  if (warning.code !== 'CIRCULAR_DEPENDENCY') return false

  const participants = circularDependencyParticipants(warning)
  return (
    participants.length > 0 &&
    participants.every((participant) => {
      const packageName = packageNameFromModulePath(participant)
      return (
        packageName !== undefined &&
        knownCircularDependencyPackages.has(packageName)
      )
    })
  )
}

export const generateExternal = async (options: { full: boolean }) => {
  const { dependencies, peerDependencies } = getPackageDependencies(epPackage)

  return (id: string) => {
    const packages: string[] = [...peerDependencies]
    if (!options.full) {
      packages.push('@vue', ...dependencies)
    }

    return [...new Set(packages)].some(
      (pkg) => id === pkg || id.startsWith(`${pkg}/`),
    )
  }
}

export function writeBundles(bundle: RollupBuild, options: OutputOptions[]) {
  return Promise.all(options.map((option) => bundle.write(option)))
}

export function formatBundleFilename(
  name: string,
  minify: boolean,
  ext: string,
) {
  return `${name}${minify ? '.min' : ''}.${ext}`
}
