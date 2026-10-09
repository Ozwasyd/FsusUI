import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import Vue from '@vitejs/plugin-vue'
import { chromium } from '@playwright/test'

const names = [
  'baseline',
  'default',
  'layout',
  'text',
  'semantics',
  'keyboard',
  'locale',
]
const args = process.argv.slice(2)
if (args.length === 1 && args[0] === '--list') {
  console.log(JSON.stringify(names))
  process.exit(0)
}
assert.equal(
  args[0],
  '--case',
  'Use --list or --case with explicit positive selection',
)
const selected = args.slice(1)
assert.ok(
  selected.length > 0 && selected.every((name) => names.includes(name)),
  'Unknown or empty selection',
)
assert.equal(new Set(selected).size, selected.length, 'Duplicate selection')
const directory = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(directory, '../../../../../..')
const evidence = process.env.TAG_EVIDENCE_ROOT
if (evidence) fs.mkdirSync(evidence, { recursive: true })
let server
let browser
let checks = 0
const errors = []
try {
  server = await createServer({
    configFile: false,
    root,
    plugins: [Vue()],
    resolve: {
      alias: [
        {
          find: '@ozwasyd/element-plus',
          replacement: path.join(root, 'vue/packages/element-plus/index.ts'),
        },
      ],
    },
    server: { host: '127.0.0.1', port: 0 },
  })
  await server.listen()
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
    headless: true,
  })
  const page = await browser.newPage({
    viewport: { width: 160, height: 1200 },
    reducedMotion: 'reduce',
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(
    server.resolvedUrls.local[0] +
      path.relative(root, path.join(directory, 'fixture.html')),
  )
  await page.waitForFunction(() => Boolean(window.tagFixture))
  assert.equal(
    await page.locator('[data-tag]').count(),
    5,
    'Nonempty real Tag hook/count preflight',
  )
  assert.equal(
    await page.locator('[data-tag].el-tag').count(),
    5,
    'Real production public Tag roots',
  )
  assert.equal(await page.evaluate(() => window.tagFixture.labels.length), 5)
  console.log(
    'PASS hook/count preflight: 5 real public Tags and fixture state hook',
  )
  const set = (patch) =>
    page.evaluate((patch) => window.tagFixture.set(patch), patch)
  for (const name of selected) {
    if (name === 'baseline') {
      const measured = await page
        .locator('[data-baseline-boundary]')
        .evaluate((boundary) => {
          const tag = boundary.firstElementChild
          const label = tag.firstElementChild
          const a = tag.getBoundingClientRect(),
            b = label.getBoundingClientRect()
          return {
            tagHeight: a.height,
            labelHeight: b.height,
            contained: b.top >= a.top - 1 && b.bottom <= a.bottom + 1,
          }
        })
      assert.equal(measured.tagHeight, 20)
      assert.equal(
        measured.contained,
        false,
        'Retain the baseline failure instead of silently accepting it',
      )
      console.log(
        'RETAINED FAIL default owned-width slot containment: ' +
          JSON.stringify(measured),
      )
      if (evidence) {
        fs.writeFileSync(
          path.join(evidence, 'baseline.json'),
          JSON.stringify(measured, null, 2),
        )
        await page.screenshot({
          path: path.join(evidence, 'baseline.png'),
          fullPage: true,
        })
      }
      checks++
    }
    if (name === 'default') {
      for (const size of ['small', '', 'large']) {
        await set({ multiline: false, size })
        const state = await page.locator('[data-tag="0"]').evaluate((tag) => ({
          height: tag.getBoundingClientRect().height,
          nowrap: getComputedStyle(tag).whiteSpace,
          wrapped: !!tag.querySelector('.el-tag__content'),
          text: tag.textContent,
        }))
        assert.equal(state.height, { small: 20, '': 24, large: 32 }[size])
        assert.equal(state.nowrap, 'nowrap')
        assert.equal(state.wrapped, false)
        assert.equal(state.text, '状态 APIv2')
        checks++
      }
    }
    if (name === 'layout') {
      for (const theme of ['light', 'dark'])
        for (const width of [160, 320, 768])
          for (const size of ['small', '', 'large'])
            for (const disableTransitions of [true, false]) {
              await page.setViewportSize({ width, height: 1200 })
              await page.evaluate(
                (theme) =>
                  document.documentElement.classList.toggle(
                    'dark',
                    theme === 'dark',
                  ),
                theme,
              )
              await set({
                multiline: true,
                size,
                disableTransitions,
                closable: true,
                dir: 'rtl',
                icon: true,
              })
              const measurements = await page
                .locator('[data-tag]')
                .evaluateAll((tags) =>
                  tags.map((tag) => {
                    const bounds = tag.getBoundingClientRect(),
                      boundary = tag.parentElement.getBoundingClientRect()
                    const content = tag.querySelector('.el-tag__content')
                    const range = document.createRange()
                    range.selectNodeContents(content)
                    const rects = [...range.getClientRects()]
                    const button = tag
                      .querySelector('button')
                      .getBoundingClientRect()
                    const icon = tag
                      .querySelector('[data-slot-icon]')
                      .getBoundingClientRect()
                    // SVG viewports clip their own drawing by browser default; check label/control boxes.
                    const clip = [tag, ...tag.querySelectorAll('*')]
                      .filter((el) => el instanceof HTMLElement)
                      .some(
                        (el) =>
                          ['hidden', 'clip'].includes(
                            getComputedStyle(el).overflowX,
                          ) ||
                          ['hidden', 'clip'].includes(
                            getComputedStyle(el).overflowY,
                          ),
                      )
                    return {
                      text: content.textContent,
                      bounded:
                        bounds.left >= boundary.left - 1 &&
                        bounds.right <= boundary.right + 1,
                      readable: rects.every(
                        (rect) =>
                          rect.left >= bounds.left - 1 &&
                          rect.right <= bounds.right + 1 &&
                          rect.top >= bounds.top - 1 &&
                          rect.bottom <= bounds.bottom + 1,
                      ),
                      clip,
                      buttonContained:
                        button.left >= bounds.left &&
                        button.right <= bounds.right &&
                        button.top >= bounds.top &&
                        button.bottom <= bounds.bottom,
                      iconWidth: icon.width,
                      textWidth: content.getBoundingClientRect().width,
                      closeWidth: button.width,
                      height: bounds.height,
                      overlap:
                        content.getBoundingClientRect().left < button.right - 1,
                    }
                  }),
                )
              assert.equal(measurements.length, 5)
              const labels = await page.evaluate(() => window.tagFixture.labels)
              assert.deepEqual(
                measurements.map((x) => x.text),
                labels,
              )
              assert.ok(
                measurements.every(
                  (x) =>
                    x.bounded &&
                    x.readable &&
                    !x.clip &&
                    x.buttonContained &&
                    x.iconWidth === { small: 12, '': 14, large: 16 }[size] &&
                    x.closeWidth >= 32 &&
                    !x.overlap,
                ),
                `${theme}/${width}/${size}/${disableTransitions}: ${JSON.stringify(measurements)}`,
              )
              assert.ok(measurements[1].height > measurements[0].height)
              checks += measurements.length
              if (
                evidence &&
                width === 160 &&
                size === 'small' &&
                disableTransitions
              ) {
                fs.writeFileSync(
                  path.join(evidence, `${theme}-layout.json`),
                  JSON.stringify(measurements, null, 2),
                )
                await page.screenshot({
                  path: path.join(evidence, `${theme}-multiline.png`),
                  fullPage: true,
                })
              }
            }
    }
    if (name === 'text') {
      for (const theme of ['light', 'dark'])
        for (const width of [160, 320, 768])
          for (const dir of ['ltr', 'rtl']) {
            await page.setViewportSize({ width, height: 1200 })
            await page.evaluate(
              (theme) =>
                document.documentElement.classList.toggle(
                  'dark',
                  theme === 'dark',
                ),
              theme,
            )
            await set({
              multiline: true,
              closable: false,
              icon: false,
              size: 'small',
              disableTransitions: true,
              dir,
            })
            const measured = await page
              .locator('[data-tag]')
              .evaluateAll((tags) =>
                tags.map((tag) => {
                  const a = tag.getBoundingClientRect(),
                    b = tag.parentElement.getBoundingClientRect()
                  const range = document.createRange()
                  range.selectNodeContents(tag)
                  return {
                    text: tag.textContent,
                    bounded: a.left >= b.left - 1 && a.right <= b.right + 1,
                    readable: [...range.getClientRects()].every(
                      (r) =>
                        r.left >= a.left - 1 &&
                        r.right <= a.right + 1 &&
                        r.top >= a.top - 1 &&
                        r.bottom <= a.bottom + 1,
                    ),
                    clip: [tag, ...tag.querySelectorAll('*')].some(
                      (el) =>
                        ['hidden', 'clip'].includes(
                          getComputedStyle(el).overflowX,
                        ) ||
                        ['hidden', 'clip'].includes(
                          getComputedStyle(el).overflowY,
                        ),
                    ),
                    height: a.height,
                  }
                }),
              )
            assert.equal(measured.length, 5)
            assert.deepEqual(
              measured.map((x) => x.text),
              await page.evaluate(() => window.tagFixture.labels),
            )
            assert.ok(
              measured.every((x) => x.bounded && x.readable && !x.clip),
              JSON.stringify(measured),
            )
            assert.ok(measured[1].height > 20)
            assert.ok(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
              ),
              'No page overflow',
            )
            checks += measured.length
            if (evidence && width === 160 && dir === 'ltr') {
              fs.writeFileSync(
                path.join(evidence, `${theme}-text-layout.json`),
                JSON.stringify(measured, null, 2),
              )
              await page
                .locator('[data-case="1"]')
                .screenshot({ path: path.join(evidence, `${theme}-text.png`) })
            }
          }
    }
    if (name === 'semantics') {
      for (const theme of ['light', 'dark'])
        for (const effect of ['light', 'plain', 'dark'])
          for (const type of ['', 'success', 'warning', 'danger', 'info']) {
            await page.evaluate(
              (theme) =>
                document.documentElement.classList.toggle(
                  'dark',
                  theme === 'dark',
                ),
              theme,
            )
            const styles = []
            for (const multiline of [false, true]) {
              await set({
                multiline,
                effect,
                type,
                closable: false,
                icon: false,
                dir: 'ltr',
              })
              await page.evaluate(async () => {
                await new Promise(requestAnimationFrame)
                await Promise.all(
                  document
                    .getAnimations()
                    .map((animation) => animation.finished.catch(() => {})),
                )
              })
              styles.push(
                await page.locator('[data-tag="0"]').evaluate((tag) => {
                  const s = getComputedStyle(tag)
                  return {
                    color: s.color,
                    background: s.backgroundColor,
                    border: s.borderColor,
                    text: tag.textContent,
                    transform: s.textTransform,
                    spacing: s.letterSpacing,
                    motion: tag.getAttribute('data-fsus-motion-disabled'),
                  }
                }),
              )
            }
            assert.deepEqual(styles[0], styles[1], `${theme}/${effect}/${type}`)
            checks++
          }
    }
    if (name === 'keyboard') {
      for (const disableTransitions of [true, false]) {
        await set({
          multiline: true,
          closable: true,
          disableTransitions,
          dir: 'ltr',
        })
        const button = page.locator('[data-tag="0"] button')
        assert.equal(await button.count(), 1)
        assert.equal(await button.getAttribute('aria-label'), 'Delete')
        const description = await button.getAttribute('aria-describedby')
        assert.equal(
          await page.locator(`[id="${description}"]`).textContent(),
          '状态 APIv2',
        )
        await button.focus()
        await page.keyboard.press('Enter')
        await page.keyboard.press('Space')
        await button.click()
        assert.deepEqual(await page.evaluate(() => window.tagFixture.events), [
          'close',
          'close',
          'close',
        ])
        await page.locator('[data-tag="0"] .el-tag__content').click()
        assert.deepEqual(await page.evaluate(() => window.tagFixture.events), [
          'close',
          'close',
          'close',
          'click',
        ])
        checks++
      }
    }
    if (name === 'locale') {
      const observations = []
      for (const locale of ['en', 'zh-cn'])
        for (const disableTransitions of [true, false]) {
          await set({
            multiline: true,
            closable: true,
            icon: false,
            dir: 'ltr',
            locale,
            disableTransitions,
          })
          const labels = await page
            .locator('[data-tag] button')
            .evaluateAll((buttons) =>
              buttons.map((button) => button.getAttribute('aria-label')),
            )
          observations.push({ locale, disableTransitions, labels })
        }
      if (evidence)
        fs.writeFileSync(
          path.join(evidence, 'locale-observations.json'),
          JSON.stringify(observations, null, 2),
        )
      console.log('Locale observations: ' + JSON.stringify(observations))
      for (const observation of observations) {
        const expectedName = observation.locale === 'zh-cn' ? '删除' : 'Delete'
        assert.deepEqual(
          observation.labels,
          Array(5).fill(expectedName),
          'Exact localized removal names in both transition branches',
        )
        await set({
          multiline: true,
          closable: true,
          icon: false,
          dir: 'ltr',
          locale: observation.locale,
          disableTransitions: observation.disableTransitions,
        })
        const buttons = page.getByRole('button', {
          name: expectedName,
          exact: true,
        })
        assert.equal(
          await buttons.count(),
          5,
          'Exact accessible role/name selection must be nonempty',
        )
        const button = buttons.first()
        const description = await button.getAttribute('aria-describedby')
        assert.equal(
          await page.locator(`[id="${description}"]`).textContent(),
          '状态 APIv2',
        )
        await button.focus()
        await page.keyboard.press('Enter')
        await page.keyboard.press('Space')
        await button.click()
        assert.deepEqual(await page.evaluate(() => window.tagFixture.events), [
          'close',
          'close',
          'close',
        ])
        await page.locator('[data-tag="0"] .el-tag__content').click()
        assert.deepEqual(await page.evaluate(() => window.tagFixture.events), [
          'close',
          'close',
          'close',
          'click',
        ])
        checks += observation.labels.length
      }
    }
    console.log('PASS selected case: ' + name)
  }
  assert.ok(checks > 0, 'Positive executed assertion count')
  assert.deepEqual(errors, [], 'No browser runtime errors')
  console.log(
    `PASS ${checks} measured controls across ${selected.length} explicit cases`,
  )
} finally {
  await browser?.close()
  await server?.close()
}
