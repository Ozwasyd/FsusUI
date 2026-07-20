import process from 'node:process'

const supported = new Map([
  ['linux', 'ubuntu-latest'],
  ['windows', 'windows-latest'],
  ['macos', 'macos-latest'],
])

const option = (name) => {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

const requested = (option('--os') ?? 'linux,windows,macos')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)

if (requested.length === 0 || new Set(requested).size !== requested.length) {
  throw new Error('The --os list must contain unique platform names.')
}

for (const os of requested) {
  if (!supported.has(os)) {
    throw new Error(
      `Unsupported platform "${os}". Expected linux, windows, or macos.`,
    )
  }
}

const plan = {
  schemaVersion: 1,
  execution: 'static-plan-only',
  platformMatrix: requested.map((os) => ({
    os,
    runner: supported.get(os),
    command: 'pnpm dotnet:platform:verify',
    owns: ['restore', 'build', 'test', 'smoke', 'platform-manifest'],
  })),
  canonicalPackage: {
    os: 'linux',
    runner: 'ubuntu-latest',
    command: 'pnpm dotnet:package:verify',
    owns: [
      'restore',
      'build',
      'pack',
      'metadata',
      'package-smoke',
      'stable-package',
      'candidate-digest',
    ],
  },
  staticQuality: {
    os: 'linux',
    runner: 'ubuntu-latest',
    owns: ['icons', 'tokens', 'conformance', 'governance', 'a11y-contract'],
  },
}

console.log(JSON.stringify(plan, null, 2))
