import { access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageRoot = path.resolve(__dirname, '..')
const componentsIndex = path.join(packageRoot, 'src/components/index.ts')

await access(componentsIndex)

console.log('icons-vue sources already present, skipping generation.')
