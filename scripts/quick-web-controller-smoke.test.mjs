import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { runHistoricalStage, historicalStageOptions } from './run-historical-render-baseline.mjs'
import { materializeDriver } from './run-quick-web-60hz.mjs'
import { execFileSync } from 'node:child_process'

test('actual no-browser historical-node-controller subprocess keeps 15min stage and native-only inheritance safe',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'fsus-controller-smoke-'))
 try {
  const bin=path.join(root,'bin');await mkdir(bin)
  await writeFile(path.join(bin,'dotnet'),'#!/bin/sh\nprintf "%s\\n" "$PWD" "$@" > "$SMOKE_ARGV"\n',{mode:0o700})
  const controller=fileURLToPath(new URL('./run-render-performance.mjs',import.meta.url))
  const options={stage:'benchmark',cwd:root,env:{...process.env,PATH:bin+path.delimiter+process.env.PATH,DISPLAY:':synthetic-no-browser',SMOKE_ARGV:path.join(root,'argv.txt'),FSUSUI_WEB_MEASUREMENT_PROTOCOL:'quick-web-60hz.v1'}}
  assert.equal(historicalStageOptions(process.execPath,options).timeoutMs,900000)
  const result=await runHistoricalStage(process.execPath,[controller,'--product-root',root,'--avalonia-only','--output',path.join(root,'output')],options)
  assert.equal(result.code,0)
  const lines=(await readFile(path.join(root,'argv.txt'),'utf8')).trim().split('\n')
  assert.equal(lines[0],root)
  assert.deepEqual(lines.slice(1,4),['run','--project','dotnet/FsusUI.Avalonia.Demo/FsusUI.Avalonia.Demo.csproj'])
  assert.ok(lines.includes('--render-performance'))
 }finally{await rm(root,{recursive:true,force:true})}
})
test('both allowlisted source drivers explicitly enable the Chromium sandbox',()=>{
 for(const ref of ['f2d929a5d045439c35e93b4771f912ce50ec2337','292a6ca6d7659b18574ac1f3ae7a8f66494af7d4']) {
  const source=execFileSync('git',['show',`${ref}:scripts/web-render-performance.mjs`],{encoding:'utf8'})
  const result=materializeDriver(source,'/synthetic/root','/synthetic/deps.mjs')
  assert.ok(result.effectiveSource.includes('headless: true,\n    chromiumSandbox: true,'))
 }
})
