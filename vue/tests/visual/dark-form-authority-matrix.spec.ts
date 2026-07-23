import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'
import { attachPageDiagnostics } from '../support/page-diagnostics'

const CONTROL_TYPES = [
  'input',
  'textarea',
  'select',
  'select-v2',
  'date-picker',
  'time-picker',
  'time-select',
  'input-number',
  'cascader',
  'upload',
] as const

const STATES = [
  'default',
  'hover',
  'focus',
  'filled',
  'placeholder',
  'disabled',
  'invalid',
] as const

const VISUAL_SELECTOR: Record<(typeof CONTROL_TYPES)[number], string> = {
  input: '.el-input__wrapper',
  textarea: '.el-textarea__inner',
  select: '.el-select__wrapper, .el-input__wrapper',
  'select-v2': '.el-select-v2__wrapper, .el-select__wrapper',
  'date-picker': '.el-input__wrapper',
  'time-picker': '.el-input__wrapper',
  'time-select': '.el-select__wrapper, .el-input__wrapper',
  'input-number': '.el-input-number',
  cascader: '.el-input__wrapper',
  upload: '.el-upload-dragger',
}

const diagnostics = new WeakMap<object, string[]>()

test.setTimeout(120_000)
test.use({ screenshot: 'off', trace: 'off' })

const parseColor = (value: string) => {
  if (/^#[\da-f]{6}$/i.test(value)) {
    return {
      red: Number.parseInt(value.slice(1, 3), 16),
      green: Number.parseInt(value.slice(3, 5), 16),
      blue: Number.parseInt(value.slice(5, 7), 16),
    }
  }
  const channels = value.match(/[\d.]+/g)?.map(Number) ?? []
  if (channels.length < 3) throw new Error(`Unsupported color: ${value}`)
  const alpha = channels[3] ?? 1
  return {
    red: channels[0] * alpha,
    green: channels[1] * alpha,
    blue: channels[2] * alpha,
  }
}

const luminance = (value: string) => {
  const { red, green, blue } = parseColor(value)
  const linear = [red, green, blue].map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

const contrast = (foreground: string, background: string) => {
  const values = [luminance(foreground), luminance(background)].sort(
    (left, right) => right - left,
  )
  return (values[0] + 0.05) / (values[1] + 0.05)
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('dark'))
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.goto(buildVisualUrl('form', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await expect(page.getByTestId('dark-form-authority-matrix')).toBeVisible()
})

test.afterEach(({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

test('covers ten controls across the seven authoritative dark states', async ({
  page,
}) => {
  const matrix = page.getByTestId('dark-form-authority-matrix')
  const coverage = await matrix.evaluate(
    (element, contract) => {
      const missing: string[] = []
      for (const control of contract.controls) {
        for (const state of contract.states) {
          const cells = element.querySelectorAll(
            `[data-control="${control}"][data-state="${state}"]`,
          )
          const surface = cells[0]?.querySelector(contract.selectors[control])
          if (
            cells.length !== 1 ||
            !(surface instanceof HTMLElement) ||
            surface.getBoundingClientRect().width === 0 ||
            surface.getBoundingClientRect().height === 0
          ) {
            missing.push(`${control}/${state}`)
          }
        }
      }
      return {
        cellCount: element.querySelectorAll('[data-dark-form-cell]').length,
        missing,
      }
    },
    {
      controls: CONTROL_TYPES,
      states: STATES,
      selectors: VISUAL_SELECTOR,
    },
  )
  expect(coverage.cellCount).toBe(CONTROL_TYPES.length * STATES.length)
  expect(coverage.missing).toEqual([])
})

test('enforces contrast, grayscale separation, stable geometry, and no glow', async ({
  page,
}, testInfo) => {
  const matrix = page.getByTestId('dark-form-authority-matrix')
  const evidence: Array<Record<string, string | number>> = []
  const measurements = await matrix.evaluate(
    (element, contract) =>
      contract.controls.flatMap((control) =>
        contract.states.map((state) => {
          const cell = element.querySelector(
            `[data-control="${control}"][data-state="${state}"]`,
          )
          const surfaceElement = cell?.querySelector(
            contract.selectors[control],
          )
          const label = cell?.querySelector('[data-dark-form-label]')
          const helper = cell?.querySelector('[data-dark-form-helper]')
          if (
            !(cell instanceof HTMLElement) ||
            !(surfaceElement instanceof HTMLElement) ||
            !(label instanceof HTMLElement) ||
            !(helper instanceof HTMLElement)
          ) {
            throw new Error(`Incomplete matrix cell ${control}/${state}`)
          }
          const surfaceStyle = getComputedStyle(surfaceElement)
          const cellStyle = getComputedStyle(cell)
          const stateTextElement =
            control === 'upload'
              ? cell.querySelector('.el-upload-dragger p')
              : (cell.querySelector(
                  '.el-select-v2__placeholder, .el-select__placeholder',
                ) ?? cell.querySelector('input, textarea'))
          let stateText = ''
          if (
            (state === 'placeholder' || state === 'disabled') &&
            stateTextElement instanceof HTMLElement
          ) {
            const stateTextStyle =
              state === 'placeholder' &&
              /^(INPUT|TEXTAREA)$/u.test(stateTextElement.tagName)
                ? getComputedStyle(stateTextElement, '::placeholder')
                : getComputedStyle(stateTextElement)
            stateText =
              state === 'disabled' &&
              stateTextStyle.getPropertyValue('-webkit-text-fill-color') &&
              stateTextStyle.getPropertyValue('-webkit-text-fill-color') !==
                'rgba(0, 0, 0, 0)'
                ? stateTextStyle.getPropertyValue('-webkit-text-fill-color')
                : stateTextStyle.color
          }
          const root =
            surfaceElement.closest(
              '.el-input, .el-textarea, .el-select, .el-select-v2, .el-date-editor, .el-input-number, .el-cascader, .el-upload-field',
            ) ?? surfaceElement
          const box = surfaceElement.getBoundingClientRect()
          return {
            control,
            state,
            width: box.width,
            height: box.height,
            controlBackground:
              surfaceStyle.backgroundColor === 'rgba(0, 0, 0, 0)'
                ? cellStyle.backgroundColor
                : surfaceStyle.backgroundColor,
            textBackground: cellStyle.backgroundColor,
            border: surfaceStyle.borderColor,
            boxShadow: surfaceStyle.boxShadow,
            helper: getComputedStyle(helper).color,
            label: getComputedStyle(label).color,
            stateText,
            opacity: surfaceStyle.opacity,
            rootOpacity: getComputedStyle(root).opacity,
          }
        }),
      ),
    {
      controls: CONTROL_TYPES,
      states: STATES,
      selectors: VISUAL_SELECTOR,
    },
  )

  for (const control of CONTROL_TYPES) {
    const boxes = new Map<string, { width: number; height: number }>()
    for (const state of STATES) {
      const metrics = measurements.find(
        (entry) => entry.control === control && entry.state === state,
      )!
      boxes.set(state, { width: metrics.width, height: metrics.height })

      expect(Number(metrics.opacity), `${control}/${state} opacity`).toBe(1)
      expect(
        Number(metrics.rootOpacity),
        `${control}/${state} root opacity`,
      ).toBe(1)
      if (metrics.boxShadow !== 'none') {
        expect(metrics.boxShadow, `${control}/${state} glow`).toContain('inset')
      }
      expect(
        contrast(metrics.label, metrics.textBackground),
        `${control}/${state} label contrast`,
      ).toBeGreaterThanOrEqual(4.5)
      expect(
        contrast(metrics.helper, metrics.textBackground),
        `${control}/${state} helper contrast`,
      ).toBeGreaterThanOrEqual(4.5)
      if (state === 'placeholder' || state === 'disabled') {
        expect(metrics.stateText, `${control}/${state} state text`).not.toBe('')
        expect(
          contrast(metrics.stateText, metrics.controlBackground),
          `${control}/${state} state text contrast`,
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          luminance(metrics.stateText),
          `${control}/${state} below readable label`,
        ).toBeLessThan(luminance(metrics.label))
        expect(
          luminance(metrics.stateText),
          `${control}/${state} above structural border`,
        ).toBeGreaterThan(luminance(metrics.border))
      }

      evidence.push({
        control,
        state,
        labelContrast: Number(
          contrast(metrics.label, metrics.textBackground).toFixed(2),
        ),
        helperContrast: Number(
          contrast(metrics.helper, metrics.textBackground).toFixed(2),
        ),
        background: metrics.controlBackground,
        border: metrics.border,
      })
    }

    const baseline = boxes.get('default')!
    for (const [state, box] of boxes) {
      expect(box.width, `${control}/${state} width`).toBeCloseTo(
        baseline.width,
        1,
      )
      expect(box.height, `${control}/${state} height`).toBeCloseTo(
        baseline.height,
        1,
      )
    }

    const defaultBackground = measurements.find(
      (entry) => entry.control === control && entry.state === 'default',
    )!.controlBackground
    const disabledBackground = measurements.find(
      (entry) => entry.control === control && entry.state === 'disabled',
    )!.controlBackground
    expect(disabledBackground, `${control} disabled fill`).not.toBe(
      defaultBackground,
    )
  }

  const roles = await matrix.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      readable: style.getPropertyValue('--fsus-form-readable-text').trim(),
      state: style.getPropertyValue('--fsus-form-state-text').trim(),
      decorative: style.getPropertyValue('--fsus-form-decorative').trim(),
      border: style.getPropertyValue('--fsus-border').trim(),
    }
  })
  expect(luminance(roles.readable)).toBeGreaterThan(luminance(roles.state))
  expect(luminance(roles.state)).toBeGreaterThan(luminance(roles.decorative))
  expect(luminance(roles.decorative)).toBeGreaterThan(luminance(roles.border))

  const contrastEvidencePath = testInfo.outputPath(
    'dark-form-automatic-contrast.json',
  )
  await writeFile(
    contrastEvidencePath,
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  )
  await testInfo.attach('dark-form-automatic-contrast.json', {
    path: contrastEvidencePath,
    contentType: 'application/json',
  })
  await matrix.screenshot({
    path: testInfo.outputPath('dark-form-matrix-original.png'),
  })
  await matrix.evaluate((element) => {
    ;(element as HTMLElement).style.filter = 'grayscale(1)'
  })
  await matrix.screenshot({
    path: testInfo.outputPath('dark-form-matrix-grayscale.png'),
  })
})
