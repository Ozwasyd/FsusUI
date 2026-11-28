import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as sass from 'sass'
import fg from 'fast-glob'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../../..')
const themeSrc = path.join(repoRoot, 'vue/packages/theme/src')
const themeDist = path.join(repoRoot, 'vue/packages/theme/dist')

export async function buildTheme(outDir = themeDist) {
  fs.mkdirSync(outDir, { recursive: true })

  const entries = [
    { src: path.join(themeSrc, 'fsus.scss'), out: path.join(outDir, 'fsus.css') },
    { src: path.join(themeSrc, 'tokens.scss'), out: path.join(outDir, 'tokens.css') },
    { src: path.join(themeSrc, 'base.scss'), out: path.join(outDir, 'base.css') },
    { src: path.join(themeSrc, 'markdown.scss'), out: path.join(outDir, 'markdown.css') },
  ]

  const compFiles = await fg('components/*.scss', {
    cwd: themeSrc,
    ignore: ['components/_*.scss', 'components/index.scss'],
  })
  for (const rel of compFiles) {
    const name = path.basename(rel, '.scss')
    entries.push({
      src: path.join(themeSrc, rel),
      out: path.join(outDir, `${name}.css`),
    })
  }

  let totalBytes = 0
  for (const { src, out } of entries) {
    if (!fs.existsSync(src)) continue
    const compiled = sass.compile(src, {
      style: 'compressed',
      loadPaths: [themeSrc],
      silenceDeprecations: ['legacy-js-api'],
    })
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, `${compiled.css}\n`, 'utf8')
    totalBytes += Buffer.byteLength(compiled.css, 'utf8')
  }

  return { count: entries.length, totalBytes }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const res = await buildTheme()
  console.log(`[fsusui/theme] Built ${res.count} compressed CSS file(s) (${(res.totalBytes / 1024).toFixed(1)} KB total)`)
}
