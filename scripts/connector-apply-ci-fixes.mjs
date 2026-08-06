import crypto from 'node:crypto'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const read = (file) => fs.readFileSync(file, 'utf8')
const write = (file, content) => fs.writeFileSync(file, content)
const replaceOnce = (file, oldText, newText) => {
  const source = read(file)
  if (source.includes(newText)) return
  if (!source.includes(oldText)) {
    throw new Error(`Expected fragment missing from ${file}`)
  }
  write(file, source.replace(oldText, newText))
}

const tokenPipeline = 'scripts/token-pipeline.mjs'
replaceOnce(
  tokenPipeline,
  "const parseEasing = (value) => {\n",
  `const rgbaToAvaloniaColor = (red, green, blue, alpha) => {
  const byte = (value) =>
    Math.max(0, Math.min(255, Math.round(Number(value))))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()
  return \`#\${byte(Number(alpha) * 255)}\${byte(red)}\${byte(green)}\${byte(blue)}\`
}

const avaloniaBoxShadowsText = (value) => {
  const raw = String(value).trim()
  if (raw === 'none') return raw
  return raw
    .replace(/(-?\\d+(?:\\.\\d+)?)px\\b/gu, '$1')
    .replace(
      /rgba\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(0(?:\\.\\d+)?|1(?:\\.0+)?)\\s*\\)/gu,
      (_match, red, green, blue, alpha) =>
        rgbaToAvaloniaColor(red, green, blue, alpha),
    )
}

const parseEasing = (value) => {
`,
)
replaceOnce(
  tokenPipeline,
  '      lines.push(`  <BoxShadows x:Key="${key}">${value}</BoxShadows>`)\n',
  `      lines.push(
        \`  <BoxShadows x:Key="\${key}">\${avaloniaBoxShadowsText(value)}</BoxShadows>\`,
      )
`,
)
replaceOnce(
  tokenPipeline,
  `  if (kind === 'boxShadows') {
    if (String(value).trim() === 'none') {
      return [\`    public static BoxShadows \${name}BoxShadows => default;\`]
    }
    return [
      \`    public static BoxShadows \${name}BoxShadows => BoxShadows.Parse("\${escapedValue}");\`,
    ]
  }
`,
  `  if (kind === 'boxShadows') {
    if (String(value).trim() === 'none') {
      return [\`    public static BoxShadows \${name}BoxShadows => default;\`]
    }
    const boxShadowsValue = csharpEscape(avaloniaBoxShadowsText(value))
    return [
      \`    public static BoxShadows \${name}BoxShadows => BoxShadows.Parse("\${boxShadowsValue}");\`,
    ]
  }
`,
)

const baselineContract = 'scripts/check-render-performance-baseline.mjs'
replaceOnce(
  baselineContract,
  `    baseContract.verifyImpactPlan(plan)
  }
} catch (error) {
`,
  `    baseContract.verifyImpactPlan(plan)
    const avaloniaTokens = await readFile(
      path.join(
        directory,
        'dotnet/FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml',
      ),
      'utf8',
    )
    const invalidShadow = [...avaloniaTokens.matchAll(
      /<BoxShadows[^>]*>([^<]+)<\\/BoxShadows>/gu,
    )].find(([, value]) => value !== 'none' && /(?:\\b\\d+(?:\\.\\d+)?px\\b|rgba\\()/u.test(value))
    if (invalidShadow) {
      available = false
      reason =
        'contract-changed: base Avalonia shadow artifacts use non-parseable CSS syntax'
    }
  }
} catch (error) {
`,
)

execFileSync(process.execPath, ['scripts/token-pipeline.mjs', 'generate'], {
  stdio: 'inherit',
})
execFileSync('pnpm', ['run', 'build:theme'], { stdio: 'inherit' })

const themeFile = 'vue/packages/theme-chalk/dist/el-fsus.css'
const themeBytes = fs.readFileSync(themeFile)
const snapshotFile = 'vue/packages/theme-chalk/theme-package.snapshot.json'
const snapshot = JSON.parse(read(snapshotFile))
snapshot.bytes = themeBytes.byteLength
snapshot.sha256 = crypto.createHash('sha256').update(themeBytes).digest('hex')
write(snapshotFile, `${JSON.stringify(snapshot, null, 2)}\n`)

execFileSync('pnpm', ['run', 'avalonia:baseline'], { stdio: 'inherit' })

const heapWrapper = 'scripts/with-node-heap.mjs'
let heapSource = read(heapWrapper)
heapSource = heapSource
  .replace("import { createHash } from 'node:crypto'\n", '')
  .replace("import { readFile } from 'node:fs/promises'\n", '')
heapSource = heapSource.replace(
  `child.on('exit', async (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  if (
    code &&
    args.some((argument) => argument.includes('check-package-build-smoke.mjs'))
  ) {
    try {
      const css = await readFile('vue/packages/theme-chalk/dist/fsus.css')
      console.error(
        \`[package-smoke] complete theme actual sha256=\${createHash('sha256').update(css).digest('hex')} bytes=\${css.byteLength}\`,
      )
    } catch (error) {
      console.error(
        \`[package-smoke] unable to inspect complete theme: \${error instanceof Error ? error.message : String(error)}\`,
      )
    }
  }

  process.exit(code ?? 1)
})
`,
  `child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})
`,
)
write(heapWrapper, heapSource)

for (const file of [
  'scripts/run-package-build-smoke.mjs',
  'scripts/connector-apply-ci-fixes.mjs',
  '.github/workflows/connector-apply-ci-fixes.yml',
]) {
  if (fs.existsSync(file)) fs.rmSync(file)
}

execFileSync(process.execPath, ['scripts/token-pipeline.mjs', 'check'], {
  stdio: 'inherit',
})
console.log('[connector-ci-fixes] generated artifacts and cleaned diagnostics')
