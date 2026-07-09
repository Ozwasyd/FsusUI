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

const xamlMotionDuration =
  /Duration\s*="\{DynamicResource FsusMotionDurationEffective\}"/u
const xamlMotionEasing =
  /Easing\s*="\{DynamicResource FsusMotionEasingEffective\}"/u

const checkLine = (relativePath, content, line) => {
  const usesMotionTransitionResources =
    xamlMotionDuration.test(content) && xamlMotionEasing.test(content)

  if (/Duration\s*="/u.test(line) && !xamlMotionDuration.test(line)) {
    return `${relativePath}: XAML duration must use FsusMotionService`
  }
  if (/\bDoubleTransition\b/u.test(line) && !usesMotionTransitionResources) {
    return `${relativePath}: local transition must use FsusMotionService`
  }
  if (/\bTransitions\b/u.test(line) && !usesMotionTransitionResources) {
    return `${relativePath}: local transition collection must use FsusMotionService`
  }
  if (/\b(?:SplineEasing|CubicEase|QuadraticEase)\b/u.test(line)) {
    return `${relativePath}: local easing must use FsusMotionService`
  }
  if (/\b(?:RenderTransform|TranslateTransform|ScaleTransform)\b/u.test(line)) {
    return `${relativePath}: local transform animation must use FsusMotionService`
  }
  if (
    /TimeSpan\.FromMilliseconds\(/u.test(line) &&
    !/\bPreviewDebounce\b/u.test(line)
  ) {
    return `${relativePath}: local duration must use FsusMotionService`
  }

  return null
}

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
    for (const line of content.split(/\r?\n/u)) {
      const failure = checkLine(relativePath, content, line)
      if (failure) failures.push(failure)
    }
  }
}

if (failures.length > 0) {
  console.error(`Avalonia motion contract violations:\n${failures.join('\n')}`)
  process.exitCode = 1
} else {
  console.log('Avalonia motion contract passed.')
}
