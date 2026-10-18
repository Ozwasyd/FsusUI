import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { annotateInstallTypes } from './package-declaration-source.mjs'

for (const component of [
  'inbox-primitives',
  'collection-primitives',
  'button',
  'select',
]) {
  test(`compiler annotations keep ${component} runtime bytes and give extras independent owners`, () => {
    const file = `vue/packages/components/${component}/index.ts`
    const source = readFileSync(file, 'utf8')
    const annotated = annotateInstallTypes(source, file)
    const compile = (content) =>
      ts.transpileModule(content, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText
    assert.equal(compile(annotated), compile(source))
    assert.match(annotated, /export type El\w+ = ReturnType</u)
    assert.match(annotated, /export type El\w+ = ReturnType<[^\n]+> & \{\}/u)
    assert.match(annotated, /export const (El\w+): \1 = /u)
    if (component === 'inbox-primitives') {
      assert.match(annotated, /FsusSplitPane: typeof FsusSplitPane/u)
      assert.match(
        annotated,
        /export type FsusSplitPane = ReturnType<typeof withFsusAlias<typeof SplitPane>>/u,
      )
    } else if (component === 'collection-primitives') {
      assert.match(annotated, /FsusDataList: typeof FsusDataList/u)
      assert.match(
        annotated,
        /export type FsusDataList = ReturnType<typeof createAlias<typeof DataList>>/u,
      )
    }
  })
}
