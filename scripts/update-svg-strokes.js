import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packagesDir = path.resolve(__dirname, '../packages')
const iconsSvgDir = path.join(packagesDir, 'icons-svg')
const iconsVueDir = path.join(packagesDir, 'icons-vue/src/components')

function replaceStr(content) {
  let res = content
  if (!res.includes('stroke-linejoin="round"')) {
    res = res.replace(/<svg([^>]*)>/, '<svg$1 stroke-linejoin="round">')
  }
  if (!res.includes('stroke-linecap="round"')) {
    res = res.replace(/<svg([^>]*)>/, '<svg$1 stroke-linecap="round">')
  }
  if (!res.includes('stroke-width="32"')) {
    res = res.replace(/<svg([^>]*)>/, '<svg$1 stroke-width="32">')
  }
  return res
}

function processDir(dir) {
  if (!fs.existsSync(dir)) return
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      processDir(fullPath)
    } else if (file.endsWith('.svg') || file.endsWith('.vue')) {
      const content = fs.readFileSync(fullPath, 'utf-8')
      const newContent = replaceStr(content)
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent, 'utf-8')
      }
    }
  }
}

processDir(iconsSvgDir)
processDir(iconsVueDir)
