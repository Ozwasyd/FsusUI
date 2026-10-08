# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: demo-app-dev.spec.ts >> markdown stress preview scroll remains monotonic while renderer settles
- Location: vue/tests/demo-app-dev/demo-app-dev.spec.ts:814:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.evaluate: Test timeout of 60000ms exceeded.
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test'
  2   | import type { Page } from '@playwright/test'
  3   | import { attachPageDiagnostics } from '../support/page-diagnostics'
  4   | 
  5   | const diagnostics = new WeakMap<Page, string[]>()
  6   | 
  7   | const demoRoutes = [
  8   |   { name: 'home', path: '/?theme=light' },
  9   |   {
  10  |     name: 'basic',
  11  |     path: '/?visual=basic&theme=light',
  12  |     testId: 'section-basic',
  13  |   },
  14  |   { name: 'form', path: '/?visual=form&theme=light', testId: 'section-form' },
  15  |   { name: 'data', path: '/?visual=data&theme=light', testId: 'section-data' },
  16  |   {
  17  |     name: 'navigation',
  18  |     path: '/?visual=navigation&theme=light',
  19  |     testId: 'section-navigation',
  20  |     openDropdown: true,
  21  |   },
  22  |   {
  23  |     name: 'feedback',
  24  |     path: '/?visual=feedback&theme=light',
  25  |     testId: 'section-feedback',
  26  |   },
  27  |   {
  28  |     name: 'others',
  29  |     path: '/?visual=others&theme=light',
  30  |     testId: 'section-others',
  31  |   },
  32  |   {
  33  |     name: 'icons',
  34  |     path: '/?visual=icons&theme=light',
  35  |     testId: 'section-icons',
  36  |   },
  37  |   {
  38  |     name: 'markdown-stress',
  39  |     path: '/?visual=markdown-stress&theme=light',
  40  |     testId: 'section-markdown-stress',
  41  |   },
  42  | ] as const
  43  | 
  44  | test.beforeEach(async ({ page }) => {
  45  |   diagnostics.set(page, attachPageDiagnostics(page))
  46  |   await page.emulateMedia({ reducedMotion: 'reduce' })
  47  | })
  48  | 
  49  | test.afterEach(async ({ page }) => {
  50  |   expect(diagnostics.get(page) ?? []).toEqual([])
  51  | })
  52  | 
  53  | type MarkdownScrollSample = {
  54  |   scrollTop: number
  55  |   scrollHeight: number
  56  |   clientHeight: number
  57  |   section: number
  58  | }
  59  | 
  60  | const sampleMarkdownStressScroll = async (
  61  |   page: Page,
  62  |   options: { steps?: number; delta?: number; delayMs?: number } = {},
  63  | ) => {
  64  |   const { steps = 80, delta = 900, delayMs = 8 } = options
  65  | 
> 66  |   return page.evaluate(
      |               ^ Error: page.evaluate: Test timeout of 60000ms exceeded.
  67  |     async ({ delta, delayMs, steps }) => {
  68  |       const wrap = document.querySelector<HTMLElement>(
  69  |         '.markdown-stress-scrollbar .el-scrollbar__wrap',
  70  |       )
  71  |       const renderer = document.querySelector<HTMLElement>(
  72  |         '.markdown-stress-renderer',
  73  |       )
  74  | 
  75  |       if (!wrap || !renderer) {
  76  |         throw new Error('Markdown stress scroll internals are missing')
  77  |       }
  78  | 
  79  |       const sectionNumber = (heading: HTMLElement | undefined) =>
  80  |         Number.parseInt(
  81  |           /Stress Section\s+(\d+)/.exec(heading?.textContent || '')?.[1] || '0',
  82  |           10,
  83  |         ) || 0
  84  |       const sectionFromViewport = () => {
  85  |         const headings = Array.from(
  86  |           renderer.querySelectorAll<HTMLElement>('h1,h2,h3'),
  87  |         )
  88  |         const wrapRect = wrap.getBoundingClientRect()
  89  |         const anchorTop = wrapRect.top + 32
  90  |         let bestHeading: HTMLElement | undefined
  91  |         let bestTop = Number.NEGATIVE_INFINITY
  92  | 
  93  |         for (const heading of headings) {
  94  |           const top = heading.getBoundingClientRect().top
  95  |           if (top <= anchorTop && top > bestTop) {
  96  |             bestTop = top
  97  |             bestHeading = heading
  98  |           }
  99  |         }
  100 | 
  101 |         return sectionNumber(bestHeading ?? headings[0])
  102 |       }
  103 | 
  104 |       const waitForFrames = () =>
  105 |         new Promise<void>((resolve) => {
  106 |           requestAnimationFrame(() => resolve())
  107 |         })
  108 |       const wait = (ms: number) =>
  109 |         new Promise<void>((resolve) => setTimeout(resolve, ms))
  110 |       const samples: MarkdownScrollSample[] = []
  111 | 
  112 |       for (let index = 0; index < steps; index += 1) {
  113 |         const maxScrollTop = Math.max(0, wrap.scrollHeight - wrap.clientHeight)
  114 |         wrap.scrollTop = Math.min(maxScrollTop, wrap.scrollTop + delta)
  115 |         wrap.dispatchEvent(new Event('scroll', { bubbles: true }))
  116 |         await waitForFrames()
  117 |         if (delayMs > 0) await wait(delayMs)
  118 | 
  119 |         samples.push({
  120 |           clientHeight: wrap.clientHeight,
  121 |           scrollHeight: wrap.scrollHeight,
  122 |           scrollTop: wrap.scrollTop,
  123 |           section: sectionFromViewport(),
  124 |         })
  125 |       }
  126 | 
  127 |       return samples
  128 |     },
  129 |     { delta, delayMs, steps },
  130 |   )
  131 | }
  132 | 
  133 | const expectStableForwardMarkdownScroll = (samples: MarkdownScrollSample[]) => {
  134 |   expect(samples.length).toBeGreaterThan(4)
  135 | 
  136 |   const regressions = samples
  137 |     .slice(1)
  138 |     .map((sample, index) => ({
  139 |       previous: samples[index],
  140 |       sample,
  141 |     }))
  142 |     .filter(({ previous, sample }) => {
  143 |       const scrollRegressed = sample.scrollTop < previous.scrollTop - 160
  144 |       const sectionRegressed =
  145 |         sample.section > 0 &&
  146 |         previous.section > 0 &&
  147 |         sample.section < previous.section - 3
  148 | 
  149 |       return scrollRegressed || sectionRegressed
  150 |     })
  151 | 
  152 |   expect(regressions).toEqual([])
  153 |   expect(samples[samples.length - 1].scrollTop).toBeGreaterThan(
  154 |     samples[0].scrollTop,
  155 |   )
  156 | }
  157 | 
  158 | for (const route of demoRoutes) {
  159 |   test(`dev server ${route.name} route has no browser diagnostics`, async ({
  160 |     page,
  161 |   }) => {
  162 |     await page.goto(route.path, { waitUntil: 'domcontentloaded' })
  163 |     await expect(page.locator('#app')).toBeVisible()
  164 | 
  165 |     if ('testId' in route) {
  166 |       await expect(
```