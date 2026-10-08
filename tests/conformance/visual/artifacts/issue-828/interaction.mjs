import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
const browser=await chromium.launch({headless:true}), rows=[]
try {
for(const theme of ['light','dark']) for(const locale of ['en','zh','long']) for(const session of ['anonymous','authenticated']) for(const zoom of [1,1.5,2]){
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true})
 await page.goto(`http://127.0.0.1:5190/?visual=public-shell-nav-mode&theme=${theme}&contract=1&fixtureLocale=${locale}&longBrand=1&session=${session}`)
 await page.locator('[data-public-shell-header]').waitFor();await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom);await page.evaluate(()=>document.fonts.ready)
 const measurements=await page.evaluate(()=>{
  const rect=s=>{const el=document.querySelector(s),r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,display:getComputedStyle(el).display}}
  return {header:rect('[data-public-shell-header]'),brand:rect('.el-public-shell__brand'),search:rect('.el-public-shell__mobile-search-trigger'),menu:rect('.el-public-shell__mobile-nav-menu-trigger'),desktopNav:rect('.el-public-shell__desktop-nav'),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}
 })
 assert(measurements.header.height<=390*.34,JSON.stringify(measurements));assert.equal(measurements.overflow,0);assert.equal(measurements.desktopNav.display,'none')
 assert(measurements.search.height/zoom>=43.9);assert(measurements.menu.height/zoom>=43.9)
 assert(measurements.brand.x+measurements.brand.width<=measurements.search.x+.5)
 const menu=page.locator('.el-public-shell__mobile-nav-menu-trigger').first();await menu.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.el-public-shell__mobile-nav-menu-trigger').getAttribute('aria-expanded')==='true')
 assert(await page.getByTestId('public-shell-theme-action').isVisible());assert(await page.getByTestId('public-shell-locale-action').isVisible())
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('.el-public-shell__mobile-nav-menu-trigger').getAttribute('aria-expanded')==='false');assert(await menu.evaluate(el=>el===document.activeElement))
 const search=page.locator('.el-public-shell__mobile-search-trigger');await search.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.el-public-shell__mobile-search-trigger').getAttribute('aria-expanded')==='true')
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('.el-public-shell__mobile-search-trigger').getAttribute('aria-expanded')==='false');assert(await search.evaluate(el=>el===document.activeElement))
 rows.push({theme,locale,session,zoom,measurements,keyboardMenuSearch:'open/escape/focus-return passed',touchContext:true});await page.close()
}
await writeFile('.tmp/issue-828/interaction-c325c600.json',JSON.stringify(rows,null,2)+'\n');console.log(`${rows.length} production fixture variants passed: header budget, targets, no overlap, keyboard disclosure/focus return`)
}finally{await browser.close();await writeFile('.tmp/issue-828/interaction-c325c600-partial.json',JSON.stringify(rows,null,2)+'\n')}
