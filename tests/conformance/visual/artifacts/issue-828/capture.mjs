import {chromium, webkit} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
const phase=process.argv[2]??'before'; const results=[]
for (const [name,engine] of (process.env.FSUS_828_ENGINE === 'chromium' ? [['chromium',chromium]] : [['chromium',chromium],['webkit',webkit]])) {
 const browser=await engine.launch({headless:true})
 for (const theme of ['light','dark']) for (const zoom of [1,1.5,2]) {
  const page=await browser.newPage({viewport:{width:844,height:390}})
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto(`${process.env.FSUS_828_URL??'http://localhost:5188'}/?visual=public-shell-nav-mode&theme=${theme}&contract=1&session=anonymous`)
  await page.locator('[data-public-shell-header]').waitFor()
  await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom)
  await page.evaluate(()=>document.fonts.ready)
  const geometry=await page.evaluate(()=>{
   const result={};for(const part of ['header','inner','primary-row','brand-nav','actions','mobile-primary-actions']){const el=document.querySelector(`.el-public-shell__${part}`);const r=el.getBoundingClientRect();result[part]={x:r.x,y:r.y,width:r.width,height:r.height,display:getComputedStyle(el).display,padding:getComputedStyle(el).padding}}
   return {...result, viewport:{width:innerWidth,height:innerHeight},overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}
  })
  const path=`.tmp/issue-828/${phase}-${name}-${theme}-${zoom}.png`;await page.screenshot({path})
  results.push({name,theme,zoom,geometry,errors,path});await page.close()
 }
 await browser.close()
}
await writeFile(`.tmp/issue-828/${phase}.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(({name,theme,zoom,geometry,errors})=>({name,theme,zoom,height:geometry.header.height,overflow:geometry.overflow,errors})),null,2))
