# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: demo-app-dev.spec.ts >> markdown stress route renders long raw HTML without browser diagnostics
- Location: vue/tests/demo-app-dev/demo-app-dev.spec.ts:429:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: expect(locator).toHaveText(expected) failed

Locator:  locator('[data-testid="markdown-stress-status"]')
Expected: "complete"
Received: "rendering"
Timeout:  30000ms

Call log:
  - Expect "toHaveText" with timeout 30000ms
  - waiting for locator('[data-testid="markdown-stress-status"]')
    3 × locator resolved to <strong data-testid="markdown-stress-status">rendering</strong>
      - unexpected value "rendering"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - heading "Markdown Stress" [level=2] [ref=e5]
    - generic [ref=e6]:
      - heading "Raw HTML Renderer" [level=3] [ref=e7]
      - generic [ref=e8]:
        - generic [ref=e9]:
          - text: "status:"
          - strong [ref=e10]: rendering
        - generic [ref=e11]: "source: 500,232 chars"
        - generic [ref=e12]: "lines: 12,626"
        - generic [ref=e13]: "html: 1,326,878 chars"
        - generic [ref=e14]: "features: 7"
        - generic [ref=e15]: "placeholders: 0"
        - generic [ref=e16]: "engine: SIMD-128"
        - generic [ref=e17]: "version: markdown-wasm-contract@2026-07-29"
        - generic [ref=e18]: "elapsed: 349ms"
      - generic [ref=e19]:
        - generic [ref=e20]:
          - strong [ref=e21]: preheat
          - generic [ref=e22]: total 58.9ms
          - generic [ref=e23]: init 58.9ms
          - generic [ref=e24]: render 0ms
          - generic [ref=e25]: html 0ms
          - generic [ref=e26]: placeholders 0ms
        - generic [ref=e27]:
          - strong [ref=e28]: html-only
          - generic [ref=e29]: total 56.7ms
          - generic [ref=e30]: init 0.6ms
          - generic [ref=e31]: render 33.2ms
          - generic [ref=e32]: html 3.6ms
          - generic [ref=e33]: placeholders 0ms
        - generic [ref=e34]:
          - strong [ref=e35]: html-only-warm
          - generic [ref=e36]: total 19.4ms
          - generic [ref=e37]: init 1.2ms
          - generic [ref=e38]: render 12.4ms
          - generic [ref=e39]: html 2.5ms
          - generic [ref=e40]: placeholders 0ms
        - generic [ref=e41]:
          - strong [ref=e42]: summary
          - generic [ref=e43]: total 30.4ms
          - generic [ref=e44]: init 0.4ms
          - generic [ref=e45]: render 21.1ms
          - generic [ref=e46]: html 4.2ms
          - generic [ref=e47]: placeholders 0ms
        - generic [ref=e48]:
          - strong [ref=e49]: full-result
          - generic [ref=e50]: total 182.2ms
          - generic [ref=e51]: init 0.6ms
          - generic [ref=e52]: render 169.8ms
          - generic [ref=e53]: html 3.7ms
          - generic [ref=e54]: placeholders 3.7ms
        - generic [ref=e55]:
          - strong [ref=e56]: component-chunks
          - generic [ref=e57]: total 111.3ms
          - generic [ref=e58]: init 11ms
          - generic [ref=e59]: render 83.9ms
          - generic [ref=e60]: html 2.3ms
          - generic [ref=e61]: placeholders 0ms
      - article [ref=e66]:
        - heading "Markdown Stress Corpus" [level=1] [ref=e68]
        - paragraph [ref=e70]:
          - text: Intro paragraph with
          - strong [ref=e71]: strong
          - text: ","
          - emphasis [ref=e72]: emphasis
          - text: ","
          - code [ref=e73]: inline code
          - text: ","
          - link "link" [ref=e74] [cursor=pointer]:
            - /url: https://example.com/path?q=markdown&x=1
          - text: ", CJK text, and escaped HTML probes. <script>alert(\"xss\")</script><img src=x onerror=alert(1)> <details open>raw</details><svg onload=alert(1)>x</svg>"
        - table [ref=e76]:
          - rowgroup [ref=e77]:
            - row "Column A Column B Column C" [ref=e78]:
              - columnheader "Column A" [ref=e79]
              - columnheader "Column B" [ref=e80]
              - columnheader "Column C" [ref=e81]
          - rowgroup [ref=e82]:
            - row "short 42 text" [ref=e83]:
              - cell "short" [ref=e84]
              - cell "42" [ref=e85]
              - cell "text" [ref=e86]
            - row "very-long-cell cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value- end" [ref=e87]:
              - cell "very-long-cell" [ref=e88]
              - cell "cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-cell-value-" [ref=e89]
              - cell "end" [ref=e90]
        - code [ref=e93]: const value = "<unsafe>& markdown"; console.log(value.repeat(2));
        - figure [ref=e95]:
          - img "Mermaid diagram" [ref=e96]:
            - generic [ref=e98]: "\"Alpha Node\""
            - generic [ref=e100]: Beta Branch
            - generic [ref=e102]: Gamma End
        - paragraph [ref=e104]:
          - text: Inline math
          - math [ref=e106]:
            - generic [ref=e107]:
              - generic [ref=e108]:
                - generic [ref=e109]: x
                - generic [ref=e110]: "1"
                - generic [ref=e111]: "2"
              - generic [ref=e112]: +
              - generic [ref=e113]: α
              - generic [ref=e114]: +
              - generic [ref=e117]: b
          - text: "and display math:"
        - math [ref=e120]:
          - generic [ref=e121]:
            - generic [ref=e123]:
              - generic [ref=e124]:
                - generic [ref=e125]: a
                - generic [ref=e126]: "1"
                - generic [ref=e127]: "2"
              - generic [ref=e128]: +
              - generic [ref=e131]: b
            - generic [ref=e133]:
              - generic [ref=e134]: α
              - generic [ref=e135]: +
              - generic [ref=e136]: "2"
        - heading "Stress Section 1" [level=2] [ref=e138]
        - paragraph [ref=e140]:
          - text: Paragraph 1 with repeated words longwordlongword and inline math
          - math [ref=e142]:
            - generic [ref=e143]:
              - generic [ref=e144]:
                - generic [ref=e145]: "n"
                - generic [ref=e146]: "1"
                - generic [ref=e147]: "2"
              - generic [ref=e148]: +
              - generic [ref=e149]: β
          - text: .
        - list [ref=e151]:
          - listitem [ref=e152]: list item alpha
          - listitem [ref=e153]: list item beta
          - listitem [ref=e154]: list item gamma
        - table [ref=e156]:
          - rowgroup [ref=e157]:
            - row "a b" [ref=e158]:
              - columnheader "a" [ref=e159]
              - columnheader "b" [ref=e160]
          - rowgroup [ref=e161]:
            - row "1 2" [ref=e162]:
              - cell "1" [ref=e163]
              - cell "2" [ref=e164]
        - paragraph [ref=e166]: "Escaped html probe 1: <iframe src=\"javascript:alert(1)\"></iframe> Long url 1: https://example.com/segment/segment/segment/segment/segment/segment/segment/segment/segment/segment/segment/segment/?q=1&unsafe=%3Cscript%3E"
        - heading "Stress Section 2" [level=2] [ref=e168]
        - paragraph [ref=e170]:
          - text: Paragraph 2 with repeated words longwordlongwordlongword and inline math
          - math [ref=e172]:
            - generic [ref=e173]:
              - generic [ref=e174]:
                - generic [ref=e175]: "n"
                - generic [ref=e176]: "2"
                - generic [ref=e177]: "2"
              - generic [ref=e178]: +
              - generic [ref=e179]: β
          - text: .
        - list [ref=e181]:
          - listitem [ref=e182]: list item alpha
          - listitem [ref=e183]: list item beta
          - listitem [ref=e184]: list item gamma
        - table [ref=e186]:
          - rowgroup [ref=e187]:
            - row "a b" [ref=e188]:
              - columnheader "a" [ref=e189]
              - columnheader "b" [ref=e190]
          - rowgroup [ref=e191]:
            - row "1 2" [ref=e192]:
              - cell "1" [ref=e193]
              - cell "2" [ref=e194]
  - iframe [ref=e197]
```

# Test source

```ts
  347 |       Math.abs(
  348 |         titleRect.top +
  349 |           titleRect.height / 2 -
  350 |           (buttonRect.top + buttonRect.height / 2),
  351 |       ) <
  352 |       Math.max(titleRect.height, buttonRect.height) / 2
  353 | 
  354 |     return {
  355 |       buttonRightOverflow: buttonRect.right - cardRect.right,
  356 |       horizontalGap: buttonRect.left - titleRect.right,
  357 |       sameRow,
  358 |       titleLeftOverflow: cardRect.left - titleRect.left,
  359 |       verticalGap: buttonRect.top - titleRect.bottom,
  360 |     }
  361 |   })
  362 | 
  363 |   expect(metrics.titleLeftOverflow).toBeLessThanOrEqual(1)
  364 |   expect(metrics.buttonRightOverflow).toBeLessThanOrEqual(1)
  365 |   if (metrics.sameRow) {
  366 |     expect(metrics.horizontalGap).toBeGreaterThanOrEqual(8)
  367 |   } else {
  368 |     expect(metrics.verticalGap).toBeGreaterThanOrEqual(8)
  369 |   }
  370 | })
  371 | 
  372 | test('Calendar header controls use soft segmented styling', async ({
  373 |   page,
  374 | }) => {
  375 |   await page.goto('/?visual=data&theme=light', {
  376 |     waitUntil: 'domcontentloaded',
  377 |   })
  378 | 
  379 |   const buttonGroup = page.locator('.el-calendar__button-group').first()
  380 |   await expect(buttonGroup).toBeVisible()
  381 | 
  382 |   const metrics = await buttonGroup.evaluate((group) => {
  383 |     const shell = group.querySelector<HTMLElement>('.el-button-group')
  384 |     const buttons = Array.from(
  385 |       group.querySelectorAll<HTMLElement>('.el-button'),
  386 |     )
  387 | 
  388 |     if (!shell || buttons.length !== 3) {
  389 |       throw new Error('Calendar header button group is missing')
  390 |     }
  391 | 
  392 |     const shellStyle = getComputedStyle(shell)
  393 | 
  394 |     return {
  395 |       buttonBorders: buttons.map(
  396 |         (button) => getComputedStyle(button).borderLeftWidth,
  397 |       ),
  398 |       buttonMargins: buttons.map(
  399 |         (button) => getComputedStyle(button).marginLeft,
  400 |       ),
  401 |       buttonRadii: buttons.map(
  402 |         (button) => getComputedStyle(button).borderRadius,
  403 |       ),
  404 |       shellDisplay: shellStyle.display,
  405 |       shellGap: shellStyle.gap,
  406 |       shellRadius: shellStyle.borderRadius,
  407 |     }
  408 |   })
  409 | 
  410 |   expect(metrics.shellDisplay).toBe('inline-flex')
  411 |   expect(metrics.shellGap).toBe('8px')
  412 |   expect(metrics.shellRadius).toBe('6px')
  413 |   expect(metrics.buttonBorders).toEqual(['0px', '0px', '0px'])
  414 |   expect(metrics.buttonMargins).toEqual(['0px', '0px', '0px'])
  415 |   expect(metrics.buttonRadii).toEqual(['4px', '4px', '4px'])
  416 | })
  417 | 
  418 | test('Calendar title follows the browser locale in demo app', async ({
  419 |   page,
  420 | }) => {
  421 |   await page.goto('/?visual=data&theme=light', {
  422 |     waitUntil: 'domcontentloaded',
  423 |   })
  424 | 
  425 |   const title = await page.locator('.el-calendar__title').first().textContent()
  426 |   expect(title?.trim()).toMatch(/^\d{4}年\d{1,2}月$/)
  427 | })
  428 | 
  429 | test('markdown stress route renders long raw HTML without browser diagnostics', async ({
  430 |   page,
  431 | }) => {
  432 |   test.setTimeout(60_000)
  433 | 
  434 |   await page.emulateMedia({ reducedMotion: 'no-preference' })
  435 |   await page.goto('/?visual=markdown-stress&theme=light', {
  436 |     waitUntil: 'domcontentloaded',
  437 |   })
  438 | 
  439 |   await expect(
  440 |     page.locator('[data-testid="section-markdown-stress"]'),
  441 |   ).toBeVisible()
  442 |   await expect(
  443 |     page.locator('[data-testid="markdown-stress-renderer"]'),
  444 |   ).toBeVisible()
  445 |   await expect(
  446 |     page.locator('[data-testid="markdown-stress-status"]'),
> 447 |   ).toHaveText('complete', { timeout: 30_000 })
      |     ^ Error: expect(locator).toHaveText(expected) failed
  448 | 
  449 |   const metrics = await page
  450 |     .locator('[data-testid="markdown-stress-metrics"]')
  451 |     .textContent()
  452 |   expect(metrics).toContain('source: 500')
  453 |   expect(metrics).toContain('placeholders:')
  454 | 
  455 |   const timings = await page
  456 |     .locator('[data-testid="markdown-stress-timings"]')
  457 |     .textContent()
  458 |   expect(timings).toContain('html-only')
  459 |   expect(timings).toContain('summary')
  460 |   expect(timings).toContain('full-result')
  461 | 
  462 |   const renderer = page.locator('.markdown-stress-renderer')
  463 |   const stressScrollbar = page.locator('.markdown-stress-scrollbar')
  464 |   const stressScrollWrap = stressScrollbar
  465 |     .locator('.el-scrollbar__wrap')
  466 |     .first()
  467 |   const findRenderedMarkdownNode = async (selector: string) => {
  468 |     const maxScrollTop = await stressScrollWrap.evaluate((element) =>
  469 |       Math.max(0, element.scrollHeight - element.clientHeight),
  470 |     )
  471 |     const scrollPositions = [
  472 |       0,
  473 |       640,
  474 |       1_600,
  475 |       3_200,
  476 |       6_400,
  477 |       12_000,
  478 |       maxScrollTop * 0.25,
  479 |       maxScrollTop * 0.5,
  480 |       maxScrollTop * 0.75,
  481 |       maxScrollTop,
  482 |     ]
  483 | 
  484 |     for (const position of scrollPositions) {
  485 |       await stressScrollWrap.evaluate((element, top) => {
  486 |         element.scrollTop = Math.max(0, Math.min(element.scrollHeight, top))
  487 |         element.dispatchEvent(new Event('scroll'))
  488 |       }, position)
  489 |       await page.waitForTimeout(25)
  490 |       const locator = renderer.locator(selector)
  491 |       if ((await locator.count()) > 0) {
  492 |         return locator.first()
  493 |       }
  494 |     }
  495 | 
  496 |     throw new Error(`markdown_stress_selector_not_rendered:${selector}`)
  497 |   }
  498 | 
  499 |   await expect(renderer).toContainText('Escaped html probe 1:')
  500 |   await expect(renderer.locator('iframe')).toHaveCount(0)
  501 |   await expect(
  502 |     await findRenderedMarkdownNode('.markdown-renderer__text--inline-code'),
  503 |   ).toBeVisible()
  504 |   const liveRenderUnits = await renderer
  505 |     .locator('[data-fsus-render-unit]')
  506 |     .count()
  507 |   expect(liveRenderUnits).toBeGreaterThan(0)
  508 |   expect(liveRenderUnits).toBeLessThan(96)
  509 |   const hasWorkerRuntime = await page.evaluate(
  510 |     () => typeof Worker !== 'undefined',
  511 |   )
  512 |   const renderStrategy = await page
  513 |     .locator(
  514 |       '[data-testid="markdown-stress-renderer"] [data-markdown-renderer]',
  515 |     )
  516 |     .getAttribute('data-fsus-render-strategy')
  517 |   expect(renderStrategy).toBe(
  518 |     hasWorkerRuntime ? 'chunked-worker' : 'chunked-main',
  519 |   )
  520 | 
  521 |   await expect(stressScrollbar).toBeVisible()
  522 |   await stressScrollWrap.evaluate((element) => {
  523 |     element.scrollTop = 640
  524 |     element.dispatchEvent(new Event('scroll'))
  525 |   })
  526 |   await expect(stressScrollbar).toHaveClass(/is-scrolling/)
  527 |   await page.waitForTimeout(25)
  528 | 
  529 |   const stressScrollMotion = await stressScrollbar.evaluate((element) => {
  530 |     const content = element.querySelector<HTMLElement>(
  531 |       '.el-scrollbar__view > *',
  532 |     )
  533 |     const thumb = element.querySelector<HTMLElement>('.el-scrollbar__thumb')
  534 | 
  535 |     if (!content || !thumb) {
  536 |       return null
  537 |     }
  538 | 
  539 |     const contentStyle = window.getComputedStyle(content)
  540 |     const thumbStyle = window.getComputedStyle(thumb)
  541 | 
  542 |     return {
  543 |       contentFilter: contentStyle.filter,
  544 |       contentTransform: contentStyle.transform,
  545 |       thumbFilter: thumbStyle.filter,
  546 |       thumbShadow: thumbStyle.boxShadow,
  547 |     }
```