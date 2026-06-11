import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registryUrl, resolvePackageContract } from './npm-package-contract.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const sourcePackagePath = path.join(
  repoRoot,
  'packages',
  'element-plus',
  'package.json',
)
const rootPackagePath = path.join(repoRoot, 'package.json')

const consumerDocs = [
  'README.md',
  'docs/index.md',
  'docs/guide/installation.md',
  'docs/guide/quickstart.md',
  'docs/guide/dark-mode.md',
  'docs/guide/i18n.md',
  'docs/guide/theming.md',
  'docs/guide/ssr.md',
  'docs/guide/custom-defaults.md',
  'docs/guide/namespace.md',
  'docs/element-plus-integration.md',
  'docs/components/layout.md',
  'docs/components/loading.md',
  'docs/components/message-box.md',
  'docs/components/config-provider.md',
  'docs/components/form.md',
]

const legacyRegistryHost = ['npm.pkg', 'github.com'].join('.')
const legacyScope = ['@', 'ozwasyd', ':registry='].join('')

const forbiddenSnippets = [
  "'element-plus'",
  '"element-plus"',
  "'element-plus/",
  '"element-plus/',
  legacyRegistryHost,
  legacyScope,
  `@element-plus:registry=https://${legacyRegistryHost}`,
  'GITHUB_TOKEN',
  'pnpm install element-plus',
]

const sourcePackage = JSON.parse(readFileSync(sourcePackagePath, 'utf8'))
const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf8'))
const { packageName, repositoryGitUrl, repositoryWebUrl } =
  resolvePackageContract({
    repoRoot,
    sourcePackageName: sourcePackage.name,
  })

const errors = []

function expectEqual(actual, expected, label) {
  if (actual !== expected) {
    errors.push(`${label}: expected "${expected}", got "${actual}"`)
  }
}

const requiredSnippets = new Map([
  ['README.md', [`\`${packageName}\``]],
  ['docs/index.md', [`\`${packageName}\``]],
  ['docs/guide/installation.md', [registryUrl, `pnpm install ${packageName}`]],
  [
    'docs/guide/quickstart.md',
    [
      `import ElementPlus from '${packageName}'`,
      `import '${packageName}/dist/index.css'`,
      `"types": ["${packageName}/global"]`,
    ],
  ],
  [
    'docs/guide/dark-mode.md',
    [
      `import ElementPlus from '${packageName}'`,
      `import { syncThemeMode } from '${packageName}/theme'`,
    ],
  ],
  [
    'docs/guide/i18n.md',
    [
      `import ElementPlus from '${packageName}'`,
      `import zhCn from '${packageName}/es/locale/lang/zh-cn'`,
    ],
  ],
  [
    'docs/element-plus-integration.md',
    [`\`${packageName}\``, `\`${packageName}/dist/index.css\``],
  ],
  [
    'docs/components/layout.md',
    [`import '${packageName}/theme-chalk/display.css'`],
  ],
])

expectEqual(
  sourcePackage.peerDependencies?.vue,
  rootPackage.peerDependencies?.vue,
  'packages/element-plus peerDependencies.vue',
)
expectEqual(
  sourcePackage.homepage,
  repositoryWebUrl,
  'packages/element-plus homepage',
)
expectEqual(
  sourcePackage.bugs?.url,
  `${repositoryWebUrl}/issues`,
  'packages/element-plus bugs.url',
)
expectEqual(
  sourcePackage.repository?.url,
  `git+${repositoryGitUrl}`,
  'packages/element-plus repository.url',
)

for (const relativePath of consumerDocs) {
  const filePath = path.join(repoRoot, relativePath)
  const content = readFileSync(filePath, 'utf8')

  for (const snippet of forbiddenSnippets) {
    if (content.includes(snippet)) {
      errors.push(
        `${relativePath} still contains stale consumer contract snippet: ${snippet}`,
      )
    }
  }

  for (const snippet of requiredSnippets.get(relativePath) || []) {
    if (!content.includes(snippet)) {
      errors.push(
        `${relativePath} is missing required contract snippet: ${snippet}`,
      )
    }
  }
}

const installationGuide = readFileSync(
  path.join(repoRoot, 'docs', 'guide', 'installation.md'),
  'utf8',
)

if (!installationGuide.includes(registryUrl)) {
  errors.push(
    'docs/guide/installation.md must mention the npm public registry URL.',
  )
}

if (errors.length > 0) {
  throw new Error(`Consumer contract drift detected:\n- ${errors.join('\n- ')}`)
}

console.log(`Consumer contract matches ${packageName} and npm public registry.`)
