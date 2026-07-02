import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dotnetRoot = path.join(root, 'dotnet')
const artifactRoot = path.join(dotnetRoot, 'artifacts/nuget')
const nugetOrg = 'https://api.nuget.org/v3/index.json'

const packageProjects = [
  {
    id: 'FsusUI.Avalonia',
    project: 'dotnet/FsusUI.Avalonia/FsusUI.Avalonia.csproj',
    sourceRoot: 'dotnet/FsusUI.Avalonia',
    baseline: 'spec/avalonia/public-api/FsusUI.Avalonia.json',
    maxNupkgBytes: 500_000,
    maxSnupkgBytes: 350_000,
    dependencies: ['Avalonia'],
  },
  {
    id: 'FsusUI.Avalonia.Themes',
    project: 'dotnet/FsusUI.Avalonia.Themes/FsusUI.Avalonia.Themes.csproj',
    sourceRoot: 'dotnet/FsusUI.Avalonia.Themes',
    baseline: 'spec/avalonia/public-api/FsusUI.Avalonia.Themes.json',
    maxNupkgBytes: 250_000,
    maxSnupkgBytes: 250_000,
    dependencies: ['Avalonia', 'FsusUI.Avalonia'],
  },
  {
    id: 'FsusUI.Avalonia.Icons',
    project: 'dotnet/FsusUI.Avalonia.Icons/FsusUI.Avalonia.Icons.csproj',
    sourceRoot: 'dotnet/FsusUI.Avalonia.Icons',
    baseline: 'spec/avalonia/public-api/FsusUI.Avalonia.Icons.json',
    maxNupkgBytes: 100_000,
    maxSnupkgBytes: 100_000,
    dependencies: ['Avalonia', 'FsusUI.Avalonia'],
  },
]

const requiredCommonMetadata = [
  'Version',
  'RepositoryUrl',
  'RepositoryType',
  'PackageLicenseExpression',
  'PackageTags',
  'PackageReleaseNotes',
  'Deterministic',
  'PublishRepositoryUrl',
  'IncludeSymbols',
  'SymbolPackageFormat',
  'DebugType',
]

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath))
const toPosix = (value) => value.split(path.sep).join('/')

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const xmlValue = (content, name) =>
  content.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'u'))?.[1].trim()

const hasXmlValue = (content, name) => Boolean(xmlValue(content, name))

const walk = (directory, predicate) => {
  const fullDirectory = path.join(root, directory)
  if (!fs.existsSync(fullDirectory)) return []

  const results = []
  for (const entry of fs.readdirSync(fullDirectory, { withFileTypes: true })) {
    if (['bin', 'obj', 'dist', 'node_modules'].includes(entry.name)) continue
    const relativePath = toPosix(path.join(directory, entry.name))
    if (entry.isDirectory()) {
      results.push(...walk(relativePath, predicate))
      continue
    }
    if (!predicate || predicate(relativePath)) results.push(relativePath)
  }
  return results.sort()
}

const stablePackageVersion = () => xmlValue(read('dotnet/Directory.Build.props'), 'Version')

const collectPublicSymbols = (sourceRoot) => {
  const files = walk(sourceRoot, (file) => file.endsWith('.cs'))
  const symbols = new Set()
  const publicType =
    /public\s+(?:sealed\s+|abstract\s+|static\s+|partial\s+)*?(?:class|record|enum|interface|struct)\s+([A-Za-z_][A-Za-z0-9_]*)/g

  for (const file of files) {
    for (const match of read(file).matchAll(publicType)) {
      symbols.add(match[1])
    }
  }

  return [...symbols].sort((a, b) => a.localeCompare(b))
}

const validateCommonMetadata = (content) => {
  for (const field of requiredCommonMetadata) {
    assert(hasXmlValue(content, field), `Directory.Build.props must define ${field}`)
  }
  assert(
    xmlValue(content, 'PublishRepositoryUrl') === 'true',
    'Directory.Build.props must enable PublishRepositoryUrl',
  )
  assert(
    xmlValue(content, 'IncludeSymbols') === 'true',
    'Directory.Build.props must enable IncludeSymbols',
  )
  assert(
    xmlValue(content, 'SymbolPackageFormat') === 'snupkg',
    'Directory.Build.props must use snupkg symbols',
  )
  assert(
    xmlValue(content, 'DebugType') === 'portable',
    'Directory.Build.props must use portable debug symbols',
  )
  assert(
    !xmlValue(content, 'PackageReleaseNotes')?.includes('Preview package candidate'),
    'Directory.Build.props release notes are stale',
  )
  assert(
    xmlValue(content, 'PackageReleaseNotes')?.includes('Stable Avalonia package candidate'),
    'Directory.Build.props release notes must describe stable Avalonia package validation',
  )
}

const validatePackableProjectMetadata = (project, content) => {
  assert(content.includes('<IsPackable>true</IsPackable>'), `${project} must be packable`)
  assert(hasXmlValue(content, 'PackageId'), `${project} must define PackageId`)
  assert(hasXmlValue(content, 'Description'), `${project} must define Description`)
  assert(!content.includes(' Version="'), `${project} must use central package versions`)
}

const validateUnpublishedProject = (project, content) => {
  const packageId = xmlValue(content, 'PackageId')
  assert(
    !content.includes('<IsPackable>true</IsPackable>') && !packageId,
    `${project} must remain unpublished`,
  )
}

const validatePublicApiBaseline = (baseline, currentSymbols, label) => {
  assert(baseline.packageId, `${label} missing packageId`)
  assert(baseline.baselineVersion, `${label} missing baselineVersion`)
  assert(
    Array.isArray(baseline.publicSymbols) && baseline.publicSymbols.length > 0,
    `${label} missing publicSymbols`,
  )

  const sorted = [...baseline.publicSymbols].sort((a, b) => a.localeCompare(b))
  assert(
    JSON.stringify(sorted) === JSON.stringify(baseline.publicSymbols),
    `${label} publicSymbols must be sorted`,
  )

  const current = new Set(currentSymbols)
  const required = new Set(baseline.publicSymbols)
  const missing = baseline.publicSymbols.filter((symbol) => !current.has(symbol))
  const added = currentSymbols.filter((symbol) => !required.has(symbol))

  assert(
    missing.length === 0,
    `${label} has breaking public API removals: ${missing.join(', ')}`,
  )
  assert(
    added.length === 0,
    `${label} public API baseline is stale: ${added.join(', ')}`,
  )
}

const validateBaselineFile = (packageInfo) => {
  assert(exists(packageInfo.baseline), `${packageInfo.baseline} public API baseline is missing`)
  const baseline = JSON.parse(read(packageInfo.baseline))
  assert(
    baseline.packageId === packageInfo.id,
    `${packageInfo.baseline} packageId must be ${packageInfo.id}`,
  )
  validatePublicApiBaseline(
    baseline,
    collectPublicSymbols(packageInfo.sourceRoot),
    packageInfo.baseline,
  )
}

const artifactName = (packageId, extension) =>
  `${packageId}.${stablePackageVersion()}.${extension}`

const unzipList = (file) =>
  execFileSync('unzip', ['-Z1', file], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort()

const unzipText = (file, entry) =>
  execFileSync('unzip', ['-p', file, entry], { encoding: 'utf8' })

const validatePackageContents = (packageInfo, packagePath, extension) => {
  const escapedId = packageInfo.id.replaceAll('.', '\\.')
  const allowed = [
    /^\[Content_Types\]\.xml$/u,
    /^_rels\/\.rels$/u,
    /^package\/services\/metadata\/core-properties\/[A-Za-z0-9]+\.psmdcp$/u,
    new RegExp(`^${escapedId}\\.nuspec$`, 'u'),
  ]

  if (extension === 'nupkg') {
    allowed.push(/^README\.md$/u)
    allowed.push(new RegExp(`^lib/net10\\.0/${escapedId}\\.dll$`, 'u'))
  } else {
    allowed.push(new RegExp(`^lib/net10\\.0/${escapedId}\\.pdb$`, 'u'))
  }

  const unexpected = unzipList(packagePath).filter(
    (entry) => !allowed.some((pattern) => pattern.test(entry)),
  )
  assert(
    unexpected.length === 0,
    `${path.basename(packagePath)} contains unexpected assets: ${unexpected.join(', ')}`,
  )
}

const validateNuspec = (packageInfo, packagePath) => {
  const nuspec = unzipText(packagePath, `${packageInfo.id}.nuspec`)
  for (const required of [
    `<id>${packageInfo.id}</id>`,
    `<version>${stablePackageVersion()}</version>`,
    '<license type="expression">MIT</license>',
    '<readme>README.md</readme>',
    '<repository type="git" url="https://github.com/Ozwasyd/FsusUI"',
    '<tags>fsusui avalonia components design-system cross-platform</tags>',
  ]) {
    assert(nuspec.includes(required), `${packageInfo.id} nuspec missing ${required}`)
  }
  assert(
    nuspec.includes('Stable Avalonia package candidate'),
    `${packageInfo.id} nuspec release notes are stale`,
  )

  const dependencies = [...nuspec.matchAll(/<dependency id="([^"]+)"/g)].map(
    ([, id]) => id,
  )
  const allowed = new Set(packageInfo.dependencies)
  for (const dependency of dependencies) {
    assert(
      allowed.has(dependency),
      `${packageInfo.id} has unreviewed dependency ${dependency}`,
    )
  }
}

const validatePackageArtifacts = () => {
  assert(fs.existsSync(artifactRoot), 'dotnet/artifacts/nuget must exist after dotnet pack')
  const artifactFiles = fs.readdirSync(artifactRoot)

  for (const file of artifactFiles) {
    assert(
      !/Demo|Tests|Smoke|ConsumerSample/u.test(file),
      `${file} must not be published as a package artifact`,
    )
  }

  for (const packageInfo of packageProjects) {
    const nupkg = path.join(artifactRoot, artifactName(packageInfo.id, 'nupkg'))
    const snupkg = path.join(artifactRoot, artifactName(packageInfo.id, 'snupkg'))

    assert(fs.existsSync(nupkg), `${packageInfo.id} nupkg is missing`)
    assert(fs.existsSync(snupkg), `${packageInfo.id} snupkg is missing`)
    assert(
      fs.statSync(nupkg).size <= packageInfo.maxNupkgBytes,
      `${path.basename(nupkg)} exceeds package size budget`,
    )
    assert(
      fs.statSync(snupkg).size <= packageInfo.maxSnupkgBytes,
      `${path.basename(snupkg)} exceeds symbol package size budget`,
    )

    validatePackageContents(packageInfo, nupkg, 'nupkg')
    validatePackageContents(packageInfo, snupkg, 'snupkg')
    validateNuspec(packageInfo, nupkg)
  }
}

const validatePackedConsumerSample = () => {
  const project =
    'tests/fixtures/avalonia-packed-consumer/FsusUI.Avalonia.PackedConsumerSample.csproj'
  const program = 'tests/fixtures/avalonia-packed-consumer/Program.cs'
  assert(exists(project), `${project} missing`)
  assert(exists(program), `${program} missing`)

  const projectXml = read(project)
  assert(!projectXml.includes('ProjectReference'), `${project} must not use ProjectReference`)
  for (const packageInfo of packageProjects) {
    assert(
      projectXml.includes(`Include="${packageInfo.id}" Version="${stablePackageVersion()}"`),
      `${project} must reference ${packageInfo.id} from local artifacts`,
    )
  }

  execFileSync(
    'dotnet',
    [
      'restore',
      path.join(root, project),
      '--source',
      artifactRoot,
      '--source',
      nugetOrg,
    ],
    { stdio: 'pipe' },
  )
  execFileSync('dotnet', ['build', path.join(root, project), '--no-restore'], {
    stdio: 'pipe',
  })
  execFileSync(
    'dotnet',
    ['run', '--project', path.join(root, project), '--no-build', '--', '--smoke'],
    { stdio: 'pipe' },
  )
}

const expectFailure = (label, fn, expected) => {
  try {
    fn()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    assert(
      message.includes(expected),
      `${label} failed with unexpected message: ${message}`,
    )
    return
  }
  throw new Error(`${label} did not fail`)
}

const runFixtureChecks = () => {
  expectFailure(
    'missing package metadata fixture',
    () =>
      validatePackableProjectMetadata(
        'tests/fixtures/avalonia-nuget-stable/missing-package-metadata.csproj',
        read('tests/fixtures/avalonia-nuget-stable/missing-package-metadata.csproj'),
      ),
    'PackageId',
  )
  expectFailure(
    'accidental demo package fixture',
    () =>
      validateUnpublishedProject(
        'dotnet/FsusUI.Avalonia.Demo/FsusUI.Avalonia.Demo.csproj',
        read('tests/fixtures/avalonia-nuget-stable/accidental-demo-publication.csproj'),
      ),
    'unpublished',
  )
  expectFailure(
    'stale release notes fixture',
    () =>
      validateCommonMetadata(
        read('tests/fixtures/avalonia-nuget-stable/stale-release-notes.props'),
      ),
    'stale',
  )
  expectFailure(
    'missing public API baseline fixture',
    () =>
      validatePublicApiBaseline(
        JSON.parse(read('tests/fixtures/avalonia-nuget-stable/missing-public-api-baseline.json')),
        ['FsusButton'],
        'missing public API baseline fixture',
      ),
    'publicSymbols',
  )
  expectFailure(
    'incompatible public API fixture',
    () =>
      validatePublicApiBaseline(
        JSON.parse(read('tests/fixtures/avalonia-nuget-stable/incompatible-public-api-change.json')),
        ['FsusButton'],
        'incompatible public API fixture',
      ),
    'breaking public API',
  )
}

const writeBaselines = () => {
  for (const packageInfo of packageProjects) {
    const baselinePath = path.join(root, packageInfo.baseline)
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true })
    fs.writeFileSync(
      baselinePath,
      `${JSON.stringify(
        {
          packageId: packageInfo.id,
          baselineVersion: '1.0.0',
          publicSymbols: collectPublicSymbols(packageInfo.sourceRoot),
        },
        null,
        2,
      )}\n`,
    )
  }
}

const check = () => {
  const failures = []
  const record = (label, fn) => {
    try {
      fn()
    } catch (error) {
      failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  record('fixtures', runFixtureChecks)
  record('common metadata', () =>
    validateCommonMetadata(read('dotnet/Directory.Build.props')),
  )

  const packablePaths = new Set(packageProjects.map((project) => project.project))
  for (const packageInfo of packageProjects) {
    record(`${packageInfo.id} metadata`, () =>
      validatePackableProjectMetadata(packageInfo.project, read(packageInfo.project)),
    )
    record(`${packageInfo.id} public API baseline`, () =>
      validateBaselineFile(packageInfo),
    )
  }

  for (const project of walk('dotnet', (file) => file.endsWith('.csproj'))) {
    if (packablePaths.has(project)) continue
    record(`${project} unpublished policy`, () =>
      validateUnpublishedProject(project, read(project)),
    )
  }

  record('package artifacts', validatePackageArtifacts)
  record('packed consumer sample', validatePackedConsumerSample)

  if (failures.length) {
    throw new Error(failures.map((failure) => `- ${failure}`).join('\n'))
  }

  console.log('Avalonia stable NuGet package gate passed.')
}

try {
  if (process.argv.includes('--write-baselines')) {
    writeBaselines()
  } else {
    check()
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
