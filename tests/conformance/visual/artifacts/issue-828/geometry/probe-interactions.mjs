import {chromium,expect} from '@playwright/test'
import {writeFile,readFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runtimeManifest=JSON.parse(await readFile('.tmp/visual-runtime/manifest.json','utf8'))
const browser=await chromium.launch(),rows=[]
for(const theme of ['light','dark'])for(const [width,height] of [[844,390],[667,375],[736,320],[932,430],[1024,520]])for(const zoom of [1,1.5,2]){
 const page=await browser.newPage({viewport:{width,height},hasTouch:true});await page.emulateMedia({reducedMotion:'reduce'});await page.goto(`http://127.0.0.1:5199/?visual=public-shell-nav-mode&theme=${theme}&contract=1&session=anonymous&navMode=menu`);await page.getByTestId('public-shell-nav-fixture').waitFor({state:'visible'});await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom)
 const checks=[],failed=[];try{
 await page.keyboard.press('Tab');await expect(page.locator('.el-public-shell__brand')).toBeFocused();checks.push('brand first Tab')
 await page.keyboard.press('Tab');await expect(page.locator('.el-public-shell__mobile-search-trigger')).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('.el-public-shell__mobile-search-row input[type=text]')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('.el-public-shell__mobile-search-trigger')).toBeFocused();checks.push('search Enter input focus Escape return')
 await page.keyboard.press('Tab');await expect(page.locator('.el-public-shell__mobile-nav-menu-trigger')).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('.el-public-shell__mobile-nav-menu-trigger')).toHaveAttribute('aria-expanded','true');checks.push('menu native Enter')
 const links=page.locator('.el-public-shell__mobile-nav-menu-panel a');const count=await links.count();const reach=[]
 for(let i=0;i<count;i++){const link=links.nth(i);await link.evaluate(el=>el.scrollIntoView({block:'center'}));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));reach.push(await link.evaluate(el=>{const r=el.getBoundingClientRect(),x=Math.max(0,Math.min(innerWidth-1,r.x+r.width/2)),y=Math.max(0,Math.min(innerHeight-1,r.y+r.height/2));return{label:el.textContent.trim(),rect:{x:r.x,y:r.y,width:r.width,height:r.height},centerInViewport:r.y+r.height/2>=0&&r.y+r.height/2<innerHeight,hit:el.contains(document.elementFromPoint(x,y)),scrollY}}))}
 if(reach.some(r=>!r.centerInViewport||!r.hit))failed.push('some menu actions not hit-testable after native scrollIntoView');checks.push({menuReachability:reach})
 await page.keyboard.press('Escape');await expect(page.locator('.el-public-shell__mobile-nav-menu-trigger')).toBeFocused();checks.push('menu Escape focus return')
 await page.locator('.el-public-shell__mobile-search-trigger').tap();await expect(page.locator('.el-public-shell__mobile-search-row input[type=text]')).toBeFocused();await page.keyboard.press('Escape');checks.push('touch search opens/focuses input')
 }catch(e){failed.push(e.message)}
 rows.push({theme,width,height,zoom,checks,failed});await page.close();console.log(theme,width,height,zoom,failed.length)
}
await browser.close();await writeFile('.tmp/issue-828-geometry/interactions-integrated.json',JSON.stringify({source,runtimeManifest,rows},null,2)+'\n');console.log(JSON.stringify({rows:rows.length,failed:rows.filter(r=>r.failed.length).length}));if(rows.some(r=>r.failed.length))process.exitCode=1
