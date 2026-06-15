import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8')

const lineNumberAt = (source, index) =>
  source.slice(0, index).split(/\r?\n/u).length

const withoutLineComments = (source) =>
  source
    .split(/\r?\n/u)
    .map((line) => line.replace(/\/\/.*$/u, ''))
    .join('\n')

const topLevelBlocks = (source) => {
  const normalizedSource = withoutLineComments(source)
  const blocks = []
  let depth = 0
  let selectorStart = 0

  for (let index = 0; index < normalizedSource.length; index += 1) {
    const char = normalizedSource[index]

    if (char === '{') {
      if (depth === 0) {
        blocks.push({
          selector: normalizedSource.slice(selectorStart, index).trim(),
          bodyStart: index + 1,
          startLine: lineNumberAt(normalizedSource, selectorStart),
        })
      }
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        const block = blocks[blocks.length - 1]
        block.body = normalizedSource.slice(block.bodyStart, index)
        selectorStart = index + 1
      }
    }
  }

  return blocks.filter((block) => typeof block.body === 'string')
}

const failures = []
const popoverFile = 'packages/theme-chalk/src/popover.scss'
const popoverSource = read(popoverFile)

for (const match of popoverSource.matchAll(
  /(?:^|\s)(?:-webkit-)?backdrop-filter\s*:/gu,
)) {
  failures.push(
    `${popoverFile}:${lineNumberAt(
      popoverSource,
      match.index ?? 0,
    )} Popover must not apply backdrop-filter by default`,
  )
}

if (!popoverSource.includes('box-shadow: var(--fsus-shadow-panel, none);')) {
  failures.push(
    `${popoverFile}: Popover surface must use the border-first panel shadow token`,
  )
}

if (
  !popoverSource.includes(
    "@include a11y-focus-ring(2px, getCssVar('popover-border-radius'));",
  )
) {
  failures.push(
    `${popoverFile}: Popover surface must expose a 2px focus-visible ring`,
  )
}

const referenceBlock = popoverSource.match(
  /@include e\(reference\)\s*\{(?<body>[\s\S]*?)\n {4}\}/u,
)

if (!referenceBlock?.groups?.body) {
  failures.push(`${popoverFile}: Missing popover reference focus block`)
} else {
  const body = referenceBlock.groups.body

  if (!body.includes(':focus-visible')) {
    failures.push(
      `${popoverFile}: Popover reference must keep a visible keyboard focus path`,
    )
  }

  if (
    !body.includes(
      "@include a11y-focus-ring(2px, getCssVar('border-radius-base'));",
    )
  ) {
    failures.push(
      `${popoverFile}: Popover reference focus ring must use the shared 2px ring`,
    )
  }
}

const themeFile = 'packages/theme-chalk/src/fsus-theme.scss'
const themeSource = read(themeFile)

for (const block of topLevelBlocks(themeSource)) {
  if (
    block.selector.includes('.#{$namespace}-popover.#{$namespace}-popper') &&
    block.body.includes('backdrop-filter')
  ) {
    failures.push(
      `${themeFile}:${block.startLine} Popover theme overrides must not restore default backdrop blur`,
    )
  }
}

if (failures.length > 0) {
  console.error(
    ['popover surface contract check failed.', ...failures].join('\n'),
  )
  process.exitCode = 1
} else {
  console.log('popover-surface-contract check passed')
}
