import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compileString } from 'sass'
import { chromium } from '@playwright/test'
const baseline='f2b3bb89ffe5f749da26c388f058efdbb6aee864'
const candidate=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
const files=['vue/packages/theme-chalk/src/public-shell.scss','vue/packages/theme-chalk/src/public-shell-critical.scss']
const css=files.map(file=>({file,before:compileString(execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8'}),{url:pathToFileURL(resolve(file))}).css,after:compileString(readFileSync(file,'utf8'),{url:pathToFileURL(resolve(file))}).css}))
const browser=await chromium.launch()
const page=await browser.newPage()
const changed=await page.evaluate(css=>css.map(({file,before,after})=>{
 const flatten=text=>{const sheet=new CSSStyleSheet();sheet.replaceSync(text);const out=[];const visit=(rules,path=[])=>{for(const rule of rules){if(rule.selectorText)out.push({selector:rule.selectorText,path,css:rule.style.cssText});else if(rule.cssRules)visit(rule.cssRules,[...path,rule.conditionText??rule.name??''])}};visit(sheet.cssRules);return out}
 const b=flatten(before),a=flatten(after);const key=r=>JSON.stringify([r.selector,r.path,r.css]);const bk=new Set(b.map(key)),ak=new Set(a.map(key));return {file,removed:b.filter(r=>!ak.has(key(r))),added:a.filter(r=>!bk.has(key(r)))}
}),css)
const selectors=[...new Set(changed.flatMap(f=>[...f.removed,...f.added]).map(r=>r.selector))]
const cases=[['home',1440,1600],['data',1440,1600],['data',412,1200],['form',320,720],['markdown-editor-chrome-visual',1440,1600],['markdown-editor-chrome-visual',412,1200],['markdown-stress',900,760],['markdown-stress',520,760]]
const observations=[]
for(const theme of ['light','dark'])for(const [route,width,height] of cases){await page.setViewportSize({width,height});await page.goto(`http://127.0.0.1:5190/?theme=${theme}${route==='home'?'':`&visual=${route}`}`,{waitUntil:'domcontentloaded'});await page.waitForSelector(route==='home'?'.demo-nav':route==='markdown-editor-chrome-visual'?'[data-testid=section-markdown-editor-chrome]':`[data-testid=section-${route}]`);observations.push(await page.evaluate(({route,theme,width,height,selectors})=>({route,theme,width,height,publicShellCount:document.querySelectorAll('.el-public-shell,[class*="el-public-shell__"],.el-site-header,.fsu-mobile-dock,.fsu-bottom-tab-bar').length,changedSelectorMatches:selectors.map(selector=>({selector,count:document.querySelectorAll(selector).length})).filter(r=>r.count)}),{route,theme,width,height,selectors}))}
await browser.close()
writeFileSync('.tmp/issue-828/diagnosis/selector-exposure.json',JSON.stringify({baseline,candidate,productionSourceCommit:'c325c600ea2760156d467bfaa375613879211cd9',baseURL:'http://127.0.0.1:5190',changed,observations},null,2)+'\n')
console.log(JSON.stringify({changedSelectors:selectors.length,observations:observations.length,totalPublicShellNodes:observations.reduce((n,o)=>n+o.publicShellCount,0),changedSelectorMatches:observations.reduce((n,o)=>n+o.changedSelectorMatches.length,0)}))
