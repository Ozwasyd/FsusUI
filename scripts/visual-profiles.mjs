import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

export const VISUAL_PROFILES = ['smoke', 'affected', 'full', 'evidence']
export const DEFAULT_VISUAL_PROFILE_REGISTRY = 'spec/ci/visual-profiles.json'

const unique = (values) => [...new Set(values)].sort()
const normalizePath = (value) =>
  value.replaceAll('\\', '/').replace(/^\.\//u, '')
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')

export const createVisualCaptureTestTitle = (section) => `capture ${section}`

export function loadVisualProfileRegistry(
  repositoryRoot = process.cwd(),
  registryPath = DEFAULT_VISUAL_PROFILE_REGISTRY,
) {
  const registry = JSON.parse(
    readFileSync(resolve(repositoryRoot, registryPath), 'utf8'),
  )
  validateVisualProfileRegistry(registry, repositoryRoot)
  return registry
}

const packageNameToAuditName = (packageName) =>
  `El${packageName
    .split('-')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join('')}`

const registeredComponentPackages = (registry) =>
  registry.componentGroups.flatMap((group) => group.packages)

export function validateVisualProfileRegistry(registry, repositoryRoot) {
  if (registry?.schemaVersion !== 1) {
    throw new Error('visual profile registry schemaVersion must be 1')
  }
  for (const field of [
    'commonContractSpecs',
    'fullRequiredGlobs',
    'componentGroups',
  ]) {
    if (!Array.isArray(registry[field]) || registry[field].length === 0) {
      throw new Error(`visual profile registry ${field} must be non-empty`)
    }
  }
  let smokePattern
  try {
    smokePattern = new RegExp(registry.smoke?.grep, 'u')
  } catch (error) {
    throw new Error('visual profile registry smoke grep is invalid', {
      cause: error,
    })
  }
  if (!smokePattern.test(createVisualCaptureTestTitle('basic'))) {
    throw new Error(
      `visual profile registry smoke grep does not select ${JSON.stringify(createVisualCaptureTestTitle('basic'))}`,
    )
  }

  const registered = registeredComponentPackages(registry)
  const duplicates = registered.filter(
    (name, index) => registered.indexOf(name) !== index,
  )
  if (duplicates.length > 0) {
    throw new Error(
      `visual profile registry has duplicate component owners: ${unique(duplicates).join(', ')}`,
    )
  }
  for (const packageName of registry.nonAuditPackages ?? []) {
    if (!registered.includes(packageName)) {
      throw new Error(`non-audit package has no visual owner: ${packageName}`)
    }
    if (registry.auditComponentOverrides[packageName]) {
      throw new Error(
        `component cannot be both audit and non-audit: ${packageName}`,
      )
    }
  }

  const componentRoot = resolve(repositoryRoot, 'vue/packages/components')
  if (existsSync(componentRoot)) {
    const actual = readdirSync(componentRoot, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() && !['dist', 'node_modules'].includes(entry.name),
      )
      .map((entry) => entry.name)
      .sort()
    const missing = actual.filter((name) => !registered.includes(name))
    const dangling = registered.filter((name) => !actual.includes(name))
    if (missing.length > 0 || dangling.length > 0) {
      throw new Error(
        [
          missing.length > 0
            ? `public component packages without a visual owner: ${missing.join(', ')}`
            : '',
          dangling.length > 0
            ? `dangling component visual owners: ${dangling.join(', ')}`
            : '',
        ]
          .filter(Boolean)
          .join('; '),
      )
    }
  }

  const auditManifestPath = resolve(
    repositoryRoot,
    'vue/packages/demo-app/src/ui-audit-manifest.ts',
  )
  if (existsSync(auditManifestPath)) {
    const source = readFileSync(auditManifestPath, 'utf8')
    const componentBlock = source.match(
      /auditComponentNames\s*=\s*\[([\s\S]*?)\]\s*as const/u,
    )?.[1]
    if (!componentBlock) {
      throw new Error('cannot read audit component names for visual ownership')
    }
    const availableAuditComponents = new Set(
      [...componentBlock.matchAll(/'([^']+)'/gu)].map((match) => match[1]),
    )
    const nonAudit = new Set(registry.nonAuditPackages ?? [])
    const danglingAuditOwners = registered.flatMap((packageName) => {
      if (nonAudit.has(packageName)) return []
      const names = registry.auditComponentOverrides[packageName] ?? [
        packageNameToAuditName(packageName),
      ]
      return names.filter((name) => !availableAuditComponents.has(name))
    })
    if (danglingAuditOwners.length > 0) {
      throw new Error(
        `dangling UI audit component owners: ${unique(danglingAuditOwners).join(', ')}`,
      )
    }
  }
  return registry
}

export function globMatches(path, glob) {
  const pattern = normalizePath(glob)
    .split('**')
    .map((part) => escapeRegex(part).replaceAll('\\*', '[^/]*'))
    .join('.*')
  return new RegExp(`^${pattern}$`, 'u').test(normalizePath(path))
}

const parseChangedFiles = (value) =>
  unique(
    String(value ?? '')
      .split(/[\n,]/u)
      .map((file) => normalizePath(file.trim()))
      .filter(Boolean),
  )

const defaultGit = (args, cwd) =>
  spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const gitOutput = (git, args, cwd) => {
  const result = git(args, cwd)
  return result.status === 0 ? result.stdout.trim() : undefined
}

export function resolveAffectedFiles({
  base,
  cwd = process.cwd(),
  env = process.env,
  git = defaultGit,
} = {}) {
  const explicitFiles = parseChangedFiles(env.FSUS_VISUAL_AFFECTED_FILES)
  if (explicitFiles.length > 0) {
    return {
      base: 'explicit-files',
      files: explicitFiles,
      fallbackReason: undefined,
    }
  }

  if (gitOutput(git, ['rev-parse', '--is-inside-work-tree'], cwd) !== 'true') {
    return { files: [], fallbackReason: 'not a Git worktree' }
  }
  if (
    gitOutput(git, ['rev-parse', '--is-shallow-repository'], cwd) === 'true'
  ) {
    return { files: [], fallbackReason: 'shallow Git checkout' }
  }

  let selectedBase = base || env.FSUS_VISUAL_BASE || env.FSUSUI_VISUAL_BASE
  if (!selectedBase && env.GITHUB_BASE_REF) {
    selectedBase = `origin/${env.GITHUB_BASE_REF}`
  }
  if (!selectedBase) {
    selectedBase = gitOutput(
      git,
      ['rev-parse', '--abbrev-ref', '@{upstream}'],
      cwd,
    )
  }
  if (!selectedBase) {
    return {
      files: [],
      fallbackReason: 'no local comparison base is available',
    }
  }
  if (
    !gitOutput(git, ['rev-parse', '--verify', `${selectedBase}^{commit}`], cwd)
  ) {
    return {
      base: selectedBase,
      files: [],
      fallbackReason: `comparison base ${selectedBase} is unavailable locally`,
    }
  }

  const mergeBase = gitOutput(git, ['merge-base', 'HEAD', selectedBase], cwd)
  if (!mergeBase) {
    return {
      base: selectedBase,
      files: [],
      fallbackReason: `comparison base ${selectedBase} has no merge base`,
    }
  }
  const committed = gitOutput(
    git,
    ['diff', '--name-only', `${mergeBase}...HEAD`],
    cwd,
  )
  const working = gitOutput(git, ['diff', '--name-only', 'HEAD'], cwd)
  const staged = gitOutput(git, ['diff', '--cached', '--name-only'], cwd)
  const untracked = gitOutput(
    git,
    ['ls-files', '--others', '--exclude-standard'],
    cwd,
  )
  const files = parseChangedFiles(
    [committed, working, staged, untracked].join('\n'),
  )
  return files.length > 0
    ? { base: selectedBase, files, fallbackReason: undefined }
    : {
        base: selectedBase,
        files: [],
        fallbackReason: 'comparison produced no changed files',
      }
}

const componentOwnerByPackage = (registry) =>
  new Map(
    registry.componentGroups.flatMap((group) =>
      group.packages.map((packageName) => [packageName, group]),
    ),
  )

const sectionFromDemoPath = (path) => {
  const match = path.match(
    /^vue\/packages\/demo-app\/src\/sections\/([A-Za-z0-9]+)Section\.vue$/u,
  )
  if (!match) return undefined
  return match[1]
    .replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
    .toLowerCase()
    .replace('public-shell-nav-mode', 'public-shell-nav-mode')
    .replace('public-shell-search-mode', 'public-shell-search-mode')
}

const componentPackageFromPath = (path) => {
  const sourceMatch = path.match(/^vue\/packages\/components\/([^/]+)\//u)
  if (sourceMatch) return sourceMatch[1]
  const themeMatch = path.match(
    /^vue\/packages\/theme-chalk\/src\/([^/_][^/]*)\.scss$/u,
  )
  return themeMatch?.[1]
}

export function selectAffectedVisualTargets(files, registry) {
  const owners = componentOwnerByPackage(registry)
  const specs = new Set()
  const sections = new Set()
  const auditComponents = new Set()
  const unmappedVisualFiles = new Set()
  const fullRequiredFiles = new Set()

  for (const rawFile of files) {
    const file = normalizePath(rawFile)
    if (registry.fullRequiredGlobs.some((glob) => globMatches(file, glob))) {
      fullRequiredFiles.add(file)
      registry.commonContractSpecs.forEach((spec) => specs.add(spec))
      continue
    }

    const packageName = componentPackageFromPath(file)
    if (packageName) {
      const owner = owners.get(packageName)
      if (!owner) {
        unmappedVisualFiles.add(file)
        fullRequiredFiles.add(file)
        continue
      }
      sections.add(owner.section)
      if (!(registry.nonAuditPackages ?? []).includes(packageName)) {
        const overrides = registry.auditComponentOverrides[packageName]
        for (const name of overrides ?? [packageNameToAuditName(packageName)]) {
          auditComponents.add(name)
        }
      }
      if (auditComponents.size > 0) {
        specs.add('vue/tests/visual/ui-audit-all.spec.ts')
      }
      continue
    }

    const section = sectionFromDemoPath(file)
    if (section) {
      sections.add(section)
      for (const spec of registry.demoSectionSpecs[section] ?? [])
        specs.add(spec)
      if (!registry.demoSectionSpecs[section]) {
        unmappedVisualFiles.add(file)
        fullRequiredFiles.add(file)
      }
      continue
    }

    if (
      /^vue\/packages\/(theme-chalk|demo-app)\//u.test(file) ||
      /^vue\/tests\/(visual|support)\//u.test(file)
    ) {
      unmappedVisualFiles.add(file)
      fullRequiredFiles.add(file)
      registry.commonContractSpecs.forEach((spec) => specs.add(spec))
    }
  }

  for (const section of sections) {
    for (const spec of registry.demoSectionSpecs[section] ?? []) specs.add(spec)
  }
  return {
    auditComponents: unique(auditComponents),
    fullRequired: fullRequiredFiles.size > 0,
    fullRequiredFiles: unique(fullRequiredFiles),
    sections: unique(sections),
    specs: unique(specs),
    unmappedVisualFiles: unique(unmappedVisualFiles),
  }
}

export function createSmokeSelection(registry) {
  return {
    auditComponents: [],
    fullRequired: false,
    fullRequiredFiles: [],
    grep: registry.smoke.grep,
    profile: 'smoke',
    projects: [...registry.smoke.projects],
    sections: ['basic'],
    specs: [...registry.smoke.specs],
  }
}

export function createAffectedSelection({
  base,
  cwd = process.cwd(),
  env = process.env,
  git,
  registry = loadVisualProfileRegistry(cwd),
} = {}) {
  const changes = resolveAffectedFiles({ base, cwd, env, git })
  if (changes.fallbackReason) {
    return {
      ...createSmokeSelection(registry),
      base: changes.base,
      fallbackReason: changes.fallbackReason,
      requestedProfile: 'affected',
    }
  }
  const targets = selectAffectedVisualTargets(changes.files, registry)
  if (targets.specs.length === 0) {
    return {
      ...createSmokeSelection(registry),
      base: changes.base,
      changedFiles: changes.files,
      fallbackReason: 'changed files have no visual owner',
      requestedProfile: 'affected',
    }
  }
  const filterableSpecs = new Set([
    'vue/tests/visual/capture-all.spec.ts',
    'vue/tests/visual/ui-audit-all.spec.ts',
  ])
  const sectionPattern = targets.sections
    .filter((section) =>
      [
        'basic',
        'data',
        'feedback',
        'form',
        'icons',
        'navigation',
        'others',
      ].includes(section),
    )
    .map(escapeRegex)
    .join('|')
  const grepParts = []
  if (sectionPattern) {
    grepParts.push(`capture (${sectionPattern})$`)
  }
  if (targets.specs.includes('vue/tests/visual/ui-audit-all.spec.ts')) {
    grepParts.push('ui audit')
  }
  return {
    ...targets,
    base: changes.base,
    changedFiles: changes.files,
    grep:
      targets.specs.every((spec) => filterableSpecs.has(spec)) &&
      grepParts.length > 0
        ? grepParts.join('|')
        : undefined,
    profile: 'affected',
    projects: targets.fullRequired
      ? ['desktop-light', 'mobile-light', 'desktop-dark', 'mobile-dark']
      : ['desktop-light', 'mobile-dark'],
  }
}
