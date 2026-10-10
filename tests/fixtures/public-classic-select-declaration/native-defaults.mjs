import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import EsDefault, { ElSelect as EsNamedSelect } from '@ozwasyd/element-plus/es/components/select'

const require = createRequire(import.meta.url)
const requireResult = require('@ozwasyd/element-plus/lib/components/select')
const { default: NativeDefault } = await import(pathToFileURL(require.resolve('@ozwasyd/element-plus/lib/components/select')))
const { ElSelect, ElOption, ElOptionGroup } = requireResult
let nativePackageImport
try {
  const direct = await import('@ozwasyd/element-plus/lib/components/select')
  assert.equal(direct.default, requireResult)
  nativePackageImport = { status: 'PASS' }
} catch (error) {
  assert.equal(error.code, 'ERR_PACKAGE_PATH_NOT_EXPORTED')
  nativePackageImport = { status: 'FAIL', code: error.code, reason: 'The actual lib directory export exposes require only.' }
}
assert.equal(NativeDefault, requireResult)
assert.equal(NativeDefault.default, requireResult.ElSelect)
assert.equal(ElSelect, requireResult.ElSelect)
assert.notEqual(NativeDefault, ElSelect)
assert.equal(NativeDefault.default.Option, ElOption)
assert.equal(NativeDefault.default.OptionGroup, ElOptionGroup)
assert.equal(typeof NativeDefault.default.install, 'function')
assert.equal('install' in NativeDefault, false)
assert.throws(() => NativeDefault.install(), TypeError)
assert.equal(EsDefault, EsNamedSelect)
process.stdout.write(`${JSON.stringify({ nativeDefaultIsRequireResult: true, nativeDefaultPropertyIsElSelect: true, namedExportIsRequireElSelect: true, moduleAsPluginRejected: true, installerExtras: true, esmDefaultIsNamed: true, nativeLoaderTarget: 'Actual require.resolve result loaded by native Node ESM', nativePackageImport })}\n`)
