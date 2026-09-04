import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const productionExtensions = new Set(['.ts', '.tsx', '.vue'])

const listProductionFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return listProductionFiles(absolute)
    if (
      !entry.isFile() ||
      !productionExtensions.has(path.extname(entry.name))
    ) {
      return []
    }
    return [absolute]
  })

const milliseconds = (value) => {
  const numeric = Number.parseFloat(value)
  return value.endsWith('ms') ? numeric : numeric * 1000
}

const transitionNamesInFile = (text) => {
  const names = new Set()
  for (const match of text.matchAll(/zoom-in-(?:center|top|bottom|left)/gu)) {
    names.add(match[0])
  }
  if (
    /listTransitionName\s*=\s*computed\(\(\)\s*=>\s*nsUpload\.b\('list'\)\)/u.test(
      text,
    )
  ) {
    names.add('el-upload-list')
  }
  return names
}

const declarationsFor = (css, selector) => {
  const declarations = []
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
    const selectors = match[1].split(',').map((value) => value.trim())
    if (selectors.some((value) => value === selector))
      declarations.push(match[2])
  }
  return declarations
}

const requireText = (condition, message, failures) => {
  if (!condition) failures.push(message)
}

export const validateLegacyTransitionContract = ({
  root,
  registry,
  transitionCss,
  uploadCss,
  motionSource,
  aliasesSource,
}) => {
  const failures = []
  requireText(
    registry?.schemaVersion === 1,
    'registry schemaVersion must be 1',
    failures,
  )
  requireText(
    registry?.sourceIssue === 469,
    'registry must bind source issue #469',
    failures,
  )
  requireText(
    JSON.stringify(registry?.terminal) ===
      JSON.stringify({ duration: '1ms', delay: '0ms', transform: 'none' }),
    'terminal contract must be exactly 1ms/0ms/none',
    failures,
  )

  const recipes = registry?.recipes ?? []
  const ids = recipes.map((recipe) => recipe.id)
  requireText(
    new Set(ids).size === ids.length,
    'recipe ids must be unique',
    failures,
  )

  const names = recipes.flatMap((recipe) => recipe.names)
  requireText(
    new Set(names).size === names.length,
    'legacy names must have one recipe',
    failures,
  )

  const sourceOwners = new Map()
  for (const recipe of recipes) {
    for (const name of recipe.names) {
      sourceOwners.set(name, recipe.source)
      if (name.startsWith('el-')) continue
      const property = /^[a-zA-Z_$][\w$]*$/u.test(name)
        ? `(?:${name}|['"]${name}['"])`
        : `['"]${name}['"]`
      const aliasPattern = new RegExp(
        `${property}\\s*:\\s*['"]${recipe.preset}['"]`,
        'u',
      )
      requireText(
        aliasPattern.test(aliasesSource),
        `${name} alias does not resolve to ${recipe.preset}`,
        failures,
      )
    }
  }

  const motionImplementation = motionSource.replace(/\/\/.*$/gmu, '')
  requireText(
    !/(?:zoom-in-(?:center|top|bottom|left)|\.el-list-(?:enter|leave))/u.test(
      motionImplementation,
    ),
    'legacy transition selectors have a second implementation owner in motion.scss',
    failures,
  )

  const componentRoot = path.join(root, 'vue/packages/components')
  const discovered = new Map()
  for (const absolute of listProductionFiles(componentRoot)) {
    const relative = path.relative(root, absolute).split(path.sep).join('/')
    const text = readFileSync(absolute, 'utf8')
    for (const name of transitionNamesInFile(text)) {
      const consumers = discovered.get(name) ?? []
      consumers.push(relative)
      discovered.set(name, consumers)
    }
  }

  for (const recipe of recipes) {
    const primaryName =
      recipe.names.find((name) => !name.startsWith('el-')) ?? recipe.names[0]
    const actual = [...new Set(discovered.get(primaryName) ?? [])].sort()
    const expected = [...recipe.consumers].sort()
    requireText(
      JSON.stringify(actual) === JSON.stringify(expected),
      `${recipe.id} consumer inventory drift: expected ${expected.join(', ') || '(none)'}; found ${actual.join(', ') || '(none)'}`,
      failures,
    )
  }

  const forbidden =
    /scale[XY]\(0\)|scale\((?:0(?:\.0+)?|0\.9[0-7][0-9]*)\)|scale\s*:\s*(?:0(?:\.0+)?|0\.9[0-7][0-9]*)\s*;|translate(?:3d|Y|X)?\([^)]*(?:[1-9][0-9]|[9-9])px|translate\s*:\s*[^;]*(?:[1-9][0-9]|[9-9])px|transition\s*:\s*none|(?:transition|animation)-duration\s*:\s*(?:0ms|0\.01ms|500ms)|stagger/iu
  for (const [label, css] of [
    ['legacy', transitionCss],
    ['upload-list', uploadCss],
  ]) {
    requireText(
      !forbidden.test(css),
      `${label} transition CSS contains a forbidden motion value`,
      failures,
    )
  }

  const baseDeclarationsFor = (css, selector) =>
    declarationsFor(css, selector).filter(
      (value) => !value.includes('!important'),
    )
  const centerFrom = baseDeclarationsFor(
    transitionCss,
    '.el-zoom-in-center-enter-from',
  ).join('\n')
  const centerLeave = baseDeclarationsFor(
    transitionCss,
    '.el-zoom-in-center-leave-to',
  ).join('\n')
  requireText(
    centerFrom.includes('opacity: 0'),
    'inline enter state must fade',
    failures,
  )
  requireText(
    centerLeave.includes('opacity: 0'),
    'inline leave state must fade',
    failures,
  )
  requireText(
    !/transform|scale/iu.test(`${centerFrom}\n${centerLeave}`),
    'inline feedback must not scale',
    failures,
  )

  const placementVectors = {
    bottom: ['0 6px', '0 4px'],
    top: ['0 -6px', '0 -4px'],
    right: ['6px 0', '4px 0'],
    left: ['-6px 0', '-4px 0'],
  }
  for (const [placement, [enter, leave]] of Object.entries(placementVectors)) {
    const suffix =
      placement === 'bottom' ? '' : `[data-popper-placement^=${placement}]`
    const enterCss = baseDeclarationsFor(
      transitionCss,
      `.el-zoom-in-top-enter-from${suffix}`,
    ).join('\n')
    const leaveCss = baseDeclarationsFor(
      transitionCss,
      `.el-zoom-in-top-leave-to${suffix}`,
    ).join('\n')
    requireText(
      new RegExp(`translate:\\s*${enter};`, 'u').test(enterCss),
      `overlay ${placement} enter vector is wrong`,
      failures,
    )
    requireText(
      new RegExp(`translate:\\s*${leave};`, 'u').test(leaveCss),
      `overlay ${placement} leave vector is wrong`,
      failures,
    )
  }

  for (const selector of [
    '.el-zoom-in-top-enter-from',
    '.el-zoom-in-top-leave-to',
    '.el-zoom-in-bottom-enter-from',
    '.el-zoom-in-bottom-leave-to',
    '.el-zoom-in-left-enter-from',
    '.el-zoom-in-left-leave-to',
  ]) {
    const value = baseDeclarationsFor(transitionCss, selector).join('\n')
    for (const scale of value.matchAll(/(?:scale\(|scale:\s*)([\d.]+)/gu)) {
      requireText(
        Number(scale[1]) >= 0.98,
        `${selector} uses scale below 0.98`,
        failures,
      )
    }
  }

  for (const [css, selector] of [
    [transitionCss, '.el-list-enter-from'],
    [transitionCss, '.el-list-leave-to'],
    [uploadCss, '.el-upload-list-enter-from'],
    [uploadCss, '.el-upload-list-leave-to'],
  ]) {
    const value = baseDeclarationsFor(css, selector).join('\n')
    const displacement = value.match(/translateY\((-?[\d.]+)px\)/u)
    requireText(
      Boolean(displacement),
      `${selector} must declare list displacement`,
      failures,
    )
    if (displacement)
      requireText(
        Math.abs(Number(displacement[1])) <= 8,
        `${selector} exceeds 8px`,
        failures,
      )
  }

  const allowedDurationTokens = new Set(registry.durations)
  for (const css of [transitionCss, uploadCss]) {
    for (const match of css.matchAll(
      /transition(?:-duration)?\s*:\s*([^;]+)/gu,
    )) {
      const declaration = match[1]
      for (const token of declaration.matchAll(
        /var\((--fsus-motion-[\w-]+)/gu,
      )) {
        requireText(
          allowedDurationTokens.has(token[1]) ||
            ['--fsus-motion-standard', '--fsus-motion-emphasized'].includes(
              token[1],
            ),
          `unregistered motion token ${token[1]}`,
          failures,
        )
      }
      for (const raw of declaration.matchAll(/([\d.]+m?s)/gu)) {
        const duration = milliseconds(raw[1])
        requireText(
          [1, 140, 220, 300, 360].includes(duration),
          `unregistered duration ${raw[1]}`,
          failures,
        )
      }
    }
  }

  for (const mode of ['reduced', 'disabled']) {
    requireText(
      transitionCss.includes(
        `:root[data-fsus-motion=${mode}] .el-zoom-in-center-enter-active`,
      ),
      `${mode} root binding is missing`,
      failures,
    )
  }
  requireText(
    /transition-duration:\s*1ms\s*!important/u.test(transitionCss) &&
      /transition-delay:\s*0ms\s*!important/u.test(transitionCss),
    'terminal timing override must be exactly 1ms/0ms',
    failures,
  )
  requireText(
    /translate:\s*none\s*!important/u.test(transitionCss) &&
      /scale:\s*none\s*!important/u.test(transitionCss) &&
      /transform:\s*none\s*!important/u.test(transitionCss),
    'terminal motion transform override is missing',
    failures,
  )

  return failures
}

export const assertLegacyTransitionContract = (input) => {
  const failures = validateLegacyTransitionContract(input)
  if (failures.length > 0)
    throw new Error(failures.map((failure) => `- ${failure}`).join('\n'))
}
