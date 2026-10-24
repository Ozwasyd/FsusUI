import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import typescript from 'typescript'
import {
  annotateBareComponentExports,
  annotateInstallTypes,
} from './package-declaration-source.mjs'
import { withVueDeclarationDefaults } from './vue-declaration-compat.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vueRequire = createRequire(
  createRequire(import.meta.url).resolve('vue-tsc'),
)
const { runTsc } = vueRequire('@volar/typescript/lib/quickstart/runTsc')
const core = vueRequire('@vue/language-core')
const proxyApi = vueRequire('@volar/typescript/lib/node/proxyCreateProgram')
const originalProxy = proxyApi.proxyCreateProgram
proxyApi.proxyCreateProgram = (ts, createProgram, plugins) =>
  originalProxy(
    ts,
    function (...args) {
      return withVueDeclarationDefaults(
        typescript,
        Reflect.apply(createProgram, this, args),
      )
    },
    plugins,
  )
const ownedRoot = `${path.join(root, 'vue', 'packages')}${path.sep}`

// Keep the locked Vue CLI language plugin, diagnostics and complete program.
// Anchors are compiler inputs; redundant defaults are handled by declaration AST
// emit. Runtime sources and generated files are never rewritten in place.
runTsc(vueRequire.resolve('typescript/lib/tsc'), ['.vue'], (ts, options) => {
  const vueOptions = core.createParsedCommandLine(
    ts,
    ts.sys,
    options.options.configFilePath.replaceAll('\\', '/'),
  ).vueOptions
  const host = options.host
  const original = host.getSourceFile.bind(host)
  const cache = new WeakMap()
  host.getSourceFile = (fileName, ...args) => {
    const source = original(fileName, ...args)
    const ownedFile = path.resolve(fileName)
    if (
      !source ||
      !ownedFile.startsWith(ownedRoot) ||
      !fileName.endsWith('.ts') ||
      fileName.endsWith('.d.ts')
    )
      return source
    if (cache.has(source)) return cache.get(source)
    let text = ownedFile.endsWith(`${path.sep}index.ts`)
      ? annotateInstallTypes(
          annotateBareComponentExports(source.text, fileName),
          fileName,
        )
      : source.text
    if (
      ownedFile.includes(`${path.sep}motion${path.sep}`) &&
      /\b(?:gsap|ScrollTrigger)\b/u.test(text)
    ) {
      text = `/// <reference types="gsap" preserve="true" />\n${text}`
    }
    const annotated =
      text === source.text
        ? source
        : ts.createSourceFile(
            fileName,
            text,
            {
              languageVersion: source.languageVersion,
              impliedNodeFormat: source.impliedNodeFormat,
            },
            true,
            source.scriptKind,
          )
    cache.set(source, annotated)
    return annotated
  }
  return {
    languagePlugins: [
      core.createVueLanguagePlugin(ts, options.options, vueOptions, (id) => id),
    ],
  }
})
