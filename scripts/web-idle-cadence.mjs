/* global requestAnimationFrame */
import { setTimeout, clearTimeout } from 'node:timers'
import { describeCadence } from './web-render-cadence.mjs'

// An idle rAF check, not a physical-display refresh-rate assertion.
export async function captureIdleCadence(browser, timeoutMs = 5000) {
  let context
  let timer
  const operation = (async () => {
    context = await browser.newContext()
    const page = await context.newPage()
    const intervals = await page.evaluate(() => new Promise((resolve) => {
      const timestamps = []
      const next = (timestamp) => {
        timestamps.push(timestamp)
        if (timestamps.length === 23) {
          resolve(timestamps.slice(3).map((value,index) => value-timestamps[index+2]))
        } else requestAnimationFrame(next)
      }
      requestAnimationFrame(next)
    }))
    if (intervals.length !== 20) throw new Error('incomplete idle cadence preflight')
    const cadence = describeCadence(60, intervals)
    if (cadence.status !== 'consistent-with-request') throw new Error('idle browser cadence is inconsistent with requested 60Hz')
    return {schema:'fsusui.idle-raf-preflight.v1',source:'same-browser-blank-context',browserVersion:browser.version(),intervals,cadence}
  })()
  try {
    return await Promise.race([operation,new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error('idle cadence preflight timed out')),timeoutMs)
    })])
  } finally {
    clearTimeout(timer)
    if (context) {
      let closeTimer
      try {
        await Promise.race([context.close(),new Promise((_,reject)=>{
          closeTimer=setTimeout(()=>reject(new Error('idle context close timed out')),2000)
        })])
      } finally {clearTimeout(closeTimer)}
    }
  }
}
