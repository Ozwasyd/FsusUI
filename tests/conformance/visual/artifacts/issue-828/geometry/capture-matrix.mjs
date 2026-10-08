import { chromium } from '@playwright/test'
import { readFile,writeFile,mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const phase=process.argv[2]??'before'
const sourceHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
const manifest=JSON.parse(await readFile('.tmp/visual-runtime/manifest.json','utf8'))
const critical=await readFile('vue/packages/theme-chalk/dist/el-public-shell-critical.css','utf8')
const hash=v=>createHash('sha256').update(v).digest('hex')
const out=`.tmp/issue-828-geometry/${phase}`;await mkdir(out,{recursive:true})
const browser=await chromium.launch();const rows=[]
const viewports=[[844,390],[667,375],[736,320],[932,430],[1024,520]]
try {
for(const theme of ['light','dark'])for(const [width,height] of viewports)for(const nav of ['menu','inline','bottom','none']){
 const page=await browser.newPage({viewport:{width,height},hasTouch:true,colorScheme:theme==='dark'?'dark':'light'})
 page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(30000);await page.emulateMedia({reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(`http://127.0.0.1:5197/?visual=public-shell-nav-mode&theme=${theme}&contract=1&session=anonymous&navMode=${nav}`,{waitUntil:'domcontentloaded'})
 await page.locator('[data-public-shell-header]').waitFor();await page.evaluate(()=>document.fonts.ready)
 for(const zoom of [1,1.5,2]){
  await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom)
  const states=['collapsed','search-expanded',...(nav==='menu'?['menu-expanded']:[])]
  for(const state of states){
   if(state==='search-expanded'){await page.locator('.el-public-shell__mobile-search-trigger').click();await page.waitForFunction(()=>document.querySelector('.el-public-shell__mobile-search-trigger').getAttribute('aria-expanded')==='true')}
   if(state==='menu-expanded'){await page.locator('.el-public-shell__mobile-nav-menu-trigger').click();await page.waitForFunction(()=>document.querySelector('.el-public-shell__mobile-nav-menu-trigger').getAttribute('aria-expanded')==='true')}
   for(const style of ['full','critical-only']){
    if(style==='critical-only')await page.evaluate(css=>{for(const sheet of document.styleSheets)sheet.disabled=true;const el=document.createElement('style');el.id='diagnostic-critical-only';el.textContent=css;document.head.append(el)},critical)
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
    const geometry=await page.evaluate(()=>{
     const rect=selector=>{const el=document.querySelector(selector);if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,display:getComputedStyle(el).display}}
     const header=rect('[data-public-shell-header]');const controls=[...document.querySelectorAll('[data-public-shell-header] a,[data-public-shell-header] button,[data-public-shell-header] summary,.fsu-bottom-tab-bar a,.fsu-bottom-tab-bar button')].filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName,classes:el.className,label:el.textContent.trim(),x:r.x,y:r.y,width:r.width,height:r.height}})
     const dock=rect('.el-public-shell__bottom-tab')
     return {actualState:{searchExpanded:document.querySelector('.el-public-shell__mobile-search-trigger')?.getAttribute('aria-expanded'),menuExpanded:document.querySelector('.el-public-shell__mobile-nav-menu-trigger')?.getAttribute('aria-expanded'),menuOpen:document.querySelector('.el-public-shell__mobile-nav-menu')?.open},header,inner:rect('.el-public-shell__inner'),primary:rect('.el-public-shell__primary-row'),toolbar:rect('.el-public-shell__mobile-toolbar'),dock,chromeHeight:header.height+(dock?.display!=='none'?(dock?.height??0):0),controls,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth,bodyFont:getComputedStyle(document.body).fontFamily,activeStyles:[...document.styleSheets].filter(s=>!s.disabled).length}
    })
    const name=`${theme}-${width}x${height}-z${zoom}-${nav}-${state}-${style}`;const path=`${out}/${name}.png`;await page.screenshot({path})
    rows.push({name,theme,width,height,zoom,nav,state,style,geometry,budget:height*.34,headerWithinBudget:geometry.header.height<=height*.34+.5,chromeWithinBudget:geometry.chromeHeight<=height*.34+.5,errors:[...errors],screenshot:path,screenshotSHA256:hash(await readFile(path))})
    if(style==='critical-only')await page.evaluate(()=>{document.querySelector('#diagnostic-critical-only').remove();for(const sheet of document.styleSheets)sheet.disabled=false})
   }
   if(state==='search-expanded'){await page.locator('.el-public-shell__mobile-search-trigger').click();await page.waitForFunction(()=>document.querySelector('.el-public-shell__mobile-search-trigger').getAttribute('aria-expanded')==='false')}
   if(state==='menu-expanded'){await page.locator('.el-public-shell__mobile-nav-menu-trigger').click();await page.waitForFunction(()=>document.querySelector('.el-public-shell__mobile-nav-menu-trigger').getAttribute('aria-expanded')==='false');await page.locator('.el-public-shell__mobile-nav-menu-panel').waitFor({state:'hidden'})}
  }
 }
 await page.close();await writeFile(`${out}/matrix.json`,JSON.stringify({sourceHead,runtimeManifest:manifest,criticalSHA256:hash(critical),isolation:'critical-only disables every production stylesheet and loads only the original built critical CSS; actual component DOM/JS unchanged; missing foundations/font/component styling explicitly not assumed equivalent',rows},null,2)+'\n');console.log(`${phase} ${theme} ${width}x${height} ${nav}: rows=${rows.length}`)
}
}finally{await browser.close();await writeFile(`${out}/matrix.json`,JSON.stringify({sourceHead,runtimeManifest:manifest,criticalSHA256:hash(critical),criticalIsolation:'All production styles disabled; only original critical CSS loaded; foundations/font/component styling absent, not full-theme or package parity',motion:'Canonical prefers-reduced-motion path; native menu/search state waited before capture',qualificationEligible:false,rows},null,2)+'\n')}
console.log(JSON.stringify({phase,rows:rows.length,headerFailed:rows.filter(r=>!r.headerWithinBudget).length,chromeFailed:rows.filter(r=>!r.chromeWithinBudget).length,pageErrors:rows.filter(r=>r.errors.length).length}))
