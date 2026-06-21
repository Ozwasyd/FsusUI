import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const scanRoots = ['dotnet/FsusUI.Avalonia', 'dotnet/FsusUI.Avalonia.Themes']

const allowedFiles = new Set([
  'dotnet/FsusUI.Avalonia.Themes/FsusMotionService.cs',
  'dotnet/FsusUI.Avalonia.Themes/FsusThemeManager.cs',
  'dotnet/FsusUI.Avalonia.Themes/Themes/FsusMotionDisabled.axaml',
  'dotnet/FsusUI.Avalonia.Themes/Themes/FsusMotionEnabled.axaml',
  'dotnet/FsusUI.Avalonia.Themes/Themes/FsusMotionReduced.axaml',
  'dotnet/FsusUI.Avalonia.Themes/Themes/FsusMotionSystem.axaml',
])

const forbiddenPatterns = [
  { pattern: /Duration\s*="/u, message: 'XAML duration' },
  { pattern: /\bDoubleTransition\b/u, message: 'local transition' },
  { pattern: /\bTransitions\b/u, message: 'local transition collection' },
  { pattern: /\bSplineEasing\b/u, message: 'local easing' },
  { pattern: /\bCubicEase\b/u, message: 'local easing' },
  { pattern: /\bQuadraticEase\b/u, message: 'local easing' },
  { pattern: /\bRenderTransform\b/u, message: 'local transform animation' },
  { pattern: /\bTranslateTransform\b/u, message: 'local transform animation' },
  { pattern: /\bScaleTransform\b/u, message: 'local transform animation' },
  { pattern: /TimeSpan\.FromMilliseconds\(/u, message: 'local duration' },
]

const toPosix = (value) => value.split(path.sep).join('/')

const walk = (directory) => {
  const results = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['bin', 'obj', 'Generated'].includes(entry.name)) continue
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      results.push(...walk(fullPath))
    } else if (/\.(?:cs|axaml)$/u.test(entry.name)) {
      results.push(fullPath)
    }
  }
  return results
}

const failures = []
for (const scanRoot of scanRoots) {
  for (const file of walk(path.join(root, scanRoot))) {
    const relativePath = toPosix(path.relative(root, file))
    if (allowedFiles.has(relativePath)) continue
    const content = fs.readFileSync(file, 'utf8')
    for (const rule of forbiddenPatterns) {
      if (rule.pattern.test(content)) {
        failures.push(
          `${relativePath}: ${rule.message} must use FsusMotionService`,
        )
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`Avalonia motion contract violations:\n${failures.join('\n')}`)
  process.exitCode = 1
} else {
  console.log('Avalonia motion contract passed.')
}
