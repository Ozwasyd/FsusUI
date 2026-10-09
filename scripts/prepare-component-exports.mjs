import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

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
    const branch = pattern?.[condition]
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
      if (!entry.isDirectory()) continue
      const key = `${prefix}${entry.name}`
      if (Object.hasOwn(packageJson.exports, key)) continue
      const target = `${key}/index.${extension}`
      if (!existsSync(path.join(packageRoot, target.slice(2)))) continue
      const types = declaration.replace('*', entry.name)
      if (!existsSync(path.join(packageRoot, types.slice(2)))) {
        throw new Error(`Missing component directory declaration ${types}`)
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
