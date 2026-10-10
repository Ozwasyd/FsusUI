import { existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs'
import path from 'node:path'

const isInside = (root, file) => {
  const relative = path.relative(root, file)
  return (
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  )
}

const regularPackageFile = (packageRoot, target) => {
  const root = path.resolve(packageRoot)
  const file = path.resolve(root, target.slice(2))
  if (!target.startsWith('./') || !isInside(root, file)) {
    throw new Error(
      `Component export target escapes the package boundary: ${target}`,
    )
  }
  if (!existsSync(file)) return false
  if (!lstatSync(file).isFile()) {
    throw new Error(`Component export target must be a regular file: ${target}`)
  }
  if (!isInside(realpathSync(root), realpathSync(file))) {
    throw new Error(
      `Component export target escapes the package boundary: ${target}`,
    )
  }
  return true
}

// Node selects the longest static prefix, then the longest matching pattern.
const winningPattern = (exports, subpath) =>
  Object.keys(exports)
    .filter((key) => {
      const star = key.indexOf('*')
      return (
        star !== -1 &&
        key.lastIndexOf('*') === star &&
        subpath.length >= key.length &&
        subpath.startsWith(key.slice(0, star)) &&
        subpath.endsWith(key.slice(star + 1))
      )
    })
    .sort(
      (left, right) =>
        right.indexOf('*') - left.indexOf('*') || right.length - left.length,
    )[0]

// Pattern exports cannot fall back from a missing file to a directory at runtime.
// Materialize only directory aliases already covered by component patterns.
export function addComponentDirectoryExports(packageJson, packageRoot) {
  let added = 0
  for (const [format, condition, extension] of [
    ['es', 'import', 'mjs'],
    ['lib', 'require', 'js'],
  ]) {
    const prefix = `./${format}/components/`
    const pattern = packageJson.exports?.[`${prefix}*`]
    if (pattern === undefined || pattern === null) continue
    const branch = pattern[condition]
    const runtime = typeof branch === 'string' ? branch : branch?.default
    const declarations =
      typeof branch === 'string' ? pattern.types : branch?.types
    const declaration = Array.isArray(declarations)
      ? declarations.find(
          (target) =>
            target.startsWith(prefix) && target.includes('*/index.d.'),
        )
      : undefined
    if (runtime !== `${prefix}*.${extension}` || !declaration) {
      throw new Error(`Unsupported ${format} component export pattern`)
    }
    const directory = path.join(packageRoot, format, 'components')
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      if (!entry.isDirectory() || entry.name.includes('*')) continue
      const key = `${prefix}${entry.name}`
      if (Object.hasOwn(packageJson.exports, key)) continue
      if (winningPattern(packageJson.exports, key) !== `${prefix}*`) continue
      // Existing file facades already resolve through the pattern; changing to
      // an index alias would replace their runtime and declaration owners.
      if (regularPackageFile(packageRoot, runtime.replace('*', entry.name)))
        continue
      const target = `${key}/index.${extension}`
      if (!regularPackageFile(packageRoot, target)) continue
      const types = declarations
        .map((candidate) => candidate.replace('*', entry.name))
        .find((candidate) => regularPackageFile(packageRoot, candidate))
      if (!types) {
        throw new Error(
          `Missing component directory declaration ${declaration.replace('*', entry.name)}`,
        )
      }
      packageJson.exports[key] =
        typeof branch === 'string'
          ? { types, [condition]: target }
          : { [condition]: { types, default: target } }
      added += 1
    }
  }
  return added
}
