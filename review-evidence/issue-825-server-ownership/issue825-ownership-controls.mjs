import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { once } from 'node:events'
const root = '/workspace/FsusUI'
const out = '/workspace/shared/issue825-server-ownership'
mkdirSync(out,{recursive:true})
const run = async (name,args,env=process.env) => {
 const child=spawn(process.execPath,args,{cwd:root,env,stdio:['ignore','pipe','pipe']})
 let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b)
 const [code,signal]=await once(child,'exit')
 writeFileSync(`${out}/${name}.log`,stdout+'\n'+stderr)
 return {code,signal,stdout,stderr}
}
const existing=spawn(process.execPath,['scripts/serve-visual-runtime.mjs','--suite=preview','--host=127.0.0.1','--port=5252','--runtime-dir=.tmp/issue825-ownership-runtime'],{cwd:root,stdio:['ignore','pipe','pipe','ipc']})
let existingOutput='';existing.stdout.on('data',b=>existingOutput+=b);existing.stderr.on('data',b=>existingOutput+=b)
try {
 const [ready]=await once(existing,'message');assert.equal(ready.type,'visual-runtime-ready')
 assert.equal((await fetch('http://127.0.0.1:5252')).status,200)
 const ownerArgs=['scripts/boundary-playwright-owner-run.mjs','--owner=playwright-boundary','--group=main','--cell=visual-boundary-audit/safe-area-chromium','--runtime-dir=.tmp/issue825-ownership-runtime','--skip-prepare','--server-port=5252']
 const negative=await run('occupied-port-owner', [...ownerArgs,'--evidence-dir=.tmp/issue825-ownership-occupied'])
 assert.equal(negative.code,1);assert.match(negative.stdout+negative.stderr,/EADDRINUSE/);assert.match(negative.stderr,/exited before binding/)
 assert.equal(existsSync(`${root}/.tmp/issue825-ownership-occupied/reports`),false)
 assert.equal((await fetch('http://127.0.0.1:5252')).status,200)
 const standaloneEnv={...process.env,CI:'true',FSUS_BOUNDARY_AUDIT_PORT:'5252'};delete standaloneEnv.FSUS_PLAYWRIGHT_EXTERNAL_SERVER
 const standalone=await run('occupied-port-standalone',['node_modules/@playwright/test/cli.js','test','--config=vue/playwright.boundary-audit.config.ts','--project=safe-area-chromium','--reporter=json','--output=.tmp/issue825-ownership-standalone-output'],standaloneEnv)
 assert.equal(standalone.code,1);assert.match(standalone.stdout+standalone.stderr,/already used/)
 const report=JSON.parse(standalone.stdout);assert.equal(report.stats.expected,0);assert.equal(report.stats.unexpected,0)
 writeFileSync(`${out}/occupied-port-results.json`,JSON.stringify({port:5252,existingPreviewHttp:200,ownerExit:negative.code,ownerReportsCreated:false,standaloneExit:standalone.code,standaloneStats:report.stats,existingServerSurvived:true},null,2)+'\n')
 console.log('PASS occupied owner refuses EADDRINUSE before browser cells; unchanged standalone CI refuses occupied5252; unrelated server remains alive')
} finally {
 existing.kill('SIGTERM');await once(existing,'exit');writeFileSync(`${out}/unrelated-preview.log`,existingOutput)
}
const positive=await run('valid-single-server-owner',['scripts/boundary-playwright-owner-run.mjs','--owner=playwright-boundary','--group=main','--cell=visual-boundary-audit/safe-area-chromium','--runtime-dir=.tmp/issue825-ownership-runtime','--skip-prepare','--server-port=5252','--evidence-dir=.tmp/issue825-ownership-positive'])
assert.equal((positive.stdout.match(/Preview ready/g)||[]).length,1)
assert.doesNotMatch(positive.stdout+positive.stderr,/EADDRINUSE|already used|exited before binding/)
assert.equal(existsSync(`${root}/.tmp/issue825-ownership-positive/reports/visual-boundary-audit/safe-area-chromium/report.json`),true)
console.log('PASS valid managed server binds once and actual original browser cell executes; product/whole-owner status is recorded without waiver:',positive.code)
