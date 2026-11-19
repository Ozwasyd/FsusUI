import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm, mkdir, access } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { URL, fileURLToPath, pathToFileURL } from 'node:url'
import { adaptQuickWebDriver } from './quick-web-60hz-adapter.mjs'
import { runHistoricalProcess } from './historical-bounded-process.mjs'
const hash = (text) => createHash('sha256').update(text).digest('hex')
const idleModule = fileURLToPath(new URL('./web-idle-cadence.mjs', import.meta.url))
const cadenceModule = fileURLToPath(new URL('./web-render-cadence.mjs', import.meta.url))

export function materializeDriver(source, productRoot, playwrightEntry, cadenceFile = cadenceModule, idleFile = idleModule) {
  const adapted = adaptQuickWebDriver(source)
  let effective = adapted.effectiveSource
  const replaceOne = (before, after) => {
    assert.equal(effective.split(before).length, 2, `unsupported driver anchor: ${before}`)
    effective = effective.replace(before, after)
  }
  replaceOne("const root = path.resolve(import.meta.dirname, '..')", `const root = ${JSON.stringify(productRoot)}`)
  replaceOne("import { chromium } from '@playwright/test'", `import * as playwrightModule from ${JSON.stringify(pathToFileURL(playwrightEntry).href)}
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium
if (typeof chromium?.launch !== 'function') throw new Error('Resolved Playwright entry does not expose Chromium')`)
  effective = effective.replace(/from '(\.\/[^']+)'/gu, (_, relative) => `from ${JSON.stringify(pathToFileURL(path.resolve(productRoot, 'scripts', relative)).href)}`)
  replaceOne('  const results = []', '  const idleCadence = await captureIdleCadence(browser)\n  const results = []')
  replaceOne('    const raw = {', '    const cadence = describeCadence(refreshHz, pageMetrics.frameIntervals)\n    const raw = {\n      measurementProtocol,\n      idleCadence,\n      cadence,')
  replaceOne('    results.push({', '    results.push({\n      measurementProtocol,\n      idleCadence,\n      cadence,')
  replaceOne('    gitSha:\n', '    measurementProtocol,\n    idleCadence,\n    gitSha:\n')
  effective = `import { captureIdleCadence } from ${JSON.stringify(pathToFileURL(idleFile).href)}\nimport { describeCadence } from ${JSON.stringify(pathToFileURL(cadenceFile).href)}\nconst measurementProtocol = JSON.parse(process.env.FSUSUI_WEB_PROTOCOL_BINDING)\n${effective}`
  return {effectiveSource:effective, evidence:{...adapted.evidence, adaptedSha256:adapted.evidence.effectiveSha256, effectiveSha256:hash(effective)}}
}

export async function launchQuickWeb({productRoot, dependenciesRoot, expectedSha, output, port = '5188'}, injected = {}) {
  const git = (...args) => execFileSync('git', args, {cwd:productRoot,encoding:'utf8'}).trim()
  assert.equal(git('rev-parse','HEAD'), expectedSha, 'product checkout mismatch')
  assert.equal(git('diff','HEAD','--'), '', 'tracked product source dirty')
  const source = await readFile(path.join(productRoot,'scripts/web-render-performance.mjs'),'utf8')
  const playwrightEntry = injected.playwrightEntry ?? createRequire(path.join(dependenciesRoot,'package.json')).resolve('@playwright/test')
  const generated = materializeDriver(source, productRoot, playwrightEntry)
  const binding = {...generated.evidence, productSha:expectedSha, productRoot, playwrightEntry, cadenceModule, idleModule, idleHelperSha256:hash(await readFile(idleModule)), cadenceHelperSha256:hash(await readFile(cadenceModule))}
  if (!injected.run) {
    await assert.rejects(access(output), {code:'ENOENT'})
    await mkdir(output,{recursive:true})
    await writeFile(path.join(output,'measurement-source.mjs'),source)
    await writeFile(path.join(output,'measurement-effective.mjs'),generated.effectiveSource)
    await writeFile(path.join(output,'measurement-binding.json'),`${JSON.stringify(binding,null,2)}\n`)
  }
  const temp = await mkdtemp(path.join(os.tmpdir(),'fsus-quick60-driver-'))
  const sidecar = path.join(temp,'driver.mjs')
  await writeFile(sidecar,generated.effectiveSource)
  const run = injected.run ?? runHistoricalProcess
  try {
    const result = await run(process.execPath,[sidecar,'--profile','quick','--warmups','1','--samples','21','--output',path.resolve(output),'--port',String(port)],{
      cwd:productRoot, env:{...process.env,GITHUB_SHA:expectedSha,FSUSUI_WEB_FAILURE_DIAGNOSTICS:'0',FSUSUI_WEB_PROTOCOL_BINDING:JSON.stringify(binding)},
      timeoutMs:900000, stage:'quick-web-60hz', stream:true, maxOutputBytes:4 * 1024 * 1024,
    })
    if (!injected.run) await writeFile(path.join(output,'measurement-process.log'),`${result.stdout ?? ''}\n${result.stderr ?? ''}`)
    assert.equal(result.code,0, `measurement failed (${result.code}); never classify as accepted: ${(result.stderr ?? '').slice(-4096)}`)
    assert.ok(!result.signal, 'measurement signalled')
    assert.equal(git('rev-parse','HEAD'),expectedSha)
    assert.equal(git('diff','HEAD','--'),'','tracked product source changed during measurement')
    return {binding,result}
  } catch (error) {
    if (!injected.run) await writeFile(path.join(output,'measurement-failure.log'),String(error?.stack ?? error).slice(-16384))
    throw error
  } finally {
    await rm(temp,{recursive:true,force:true})
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [productRoot,dependenciesRoot,expectedSha,output,port] = process.argv.slice(2)
  assert.ok(productRoot && dependenciesRoot && expectedSha && output,'Usage: node run-quick-web-60hz.mjs PRODUCT_ROOT DEPS_ROOT EXACT_SHA NEW_OUTPUT [PORT]')
  await launchQuickWeb({productRoot:path.resolve(productRoot),dependenciesRoot:path.resolve(dependenciesRoot),expectedSha,output,port})
}
