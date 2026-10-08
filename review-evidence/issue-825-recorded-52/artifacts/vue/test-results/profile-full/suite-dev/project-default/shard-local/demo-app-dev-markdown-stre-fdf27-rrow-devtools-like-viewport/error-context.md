# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: demo-app-dev.spec.ts >> markdown stress preview keeps position in narrow devtools-like viewport
- Location: vue/tests/demo-app-dev/demo-app-dev.spec.ts:839:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: expect(locator).toHaveText(expected) failed

Locator:  locator('[data-testid="markdown-stress-status"]')
Expected: "complete"
Received: "rendering"
Timeout:  20000ms

Call log:
  - Expect "toHaveText" with timeout 20000ms
  - waiting for locator('[data-testid="markdown-stress-status"]')
    3 × locator resolved to <strong data-testid="markdown-stress-status">rendering</strong>
      - unexpected value "rendering"

```

# Test source

```ts
  750 |     )
  751 |   }
  752 | 
  753 |   const dragMetrics = await scrollbar.evaluate((element) => {
  754 |     const wrap = element.querySelector<HTMLElement>('.el-scrollbar__wrap')
  755 |     const content = element.querySelector<HTMLElement>(
  756 |       '.el-scrollbar__view > *',
  757 |     )
  758 |     const thumb = element.querySelector<HTMLElement>(
  759 |       '.el-scrollbar__bar.is-vertical .el-scrollbar__thumb',
  760 |     )
  761 | 
  762 |     if (!wrap || !content || !thumb) {
  763 |       throw new Error('Markdown stress scrollbar drag internals are missing')
  764 |     }
  765 | 
  766 |     const readBlur = (filter: string) => {
  767 |       const match = /blur\(([\d.]+)px\)/.exec(filter)
  768 |       return match ? Number.parseFloat(match[1]) : 0
  769 |     }
  770 |     const contentStyle = getComputedStyle(content)
  771 |     const thumbStyle = getComputedStyle(thumb)
  772 |     const thumbAfterStyle = getComputedStyle(thumb, '::after')
  773 | 
  774 |     return {
  775 |       contentBlur: readBlur(contentStyle.filter),
  776 |       contentTransform: contentStyle.transform,
  777 |       scrollTop: wrap.scrollTop,
  778 |       thumbAfterOpacity: Number.parseFloat(thumbAfterStyle.opacity),
  779 |       thumbShadow: thumbStyle.boxShadow,
  780 |     }
  781 |   })
  782 | 
  783 |   expect(dragMetrics.scrollTop).toBeGreaterThan(0)
  784 |   expect(dragMetrics.contentTransform).not.toBe('none')
  785 |   expect(dragMetrics.contentBlur).toBeLessThanOrEqual(0.05)
  786 |   expect(dragMetrics.thumbAfterOpacity).toBeGreaterThan(0)
  787 |   expect(dragMetrics.thumbShadow).not.toBe('none')
  788 | 
  789 |   await page.mouse.up()
  790 |   await expect(scrollbar).not.toHaveClass(/is-scrolling/, { timeout: 2500 })
  791 | 
  792 |   await wrap.evaluate((element) => {
  793 |     element.scrollTop = 0
  794 |     element.dispatchEvent(new Event('scroll'))
  795 |   })
  796 |   await expect(scrollbar).not.toHaveClass(/is-scrolling/, { timeout: 2500 })
  797 | 
  798 |   const bar = scrollbar.locator('.el-scrollbar__bar.is-vertical').first()
  799 |   const barBox = await bar.boundingBox()
  800 |   expect(barBox).not.toBeNull()
  801 |   if (!barBox) return
  802 | 
  803 |   await page.mouse.click(
  804 |     barBox.x + barBox.width / 2,
  805 |     barBox.y + barBox.height / 2,
  806 |   )
  807 |   await page.waitForTimeout(50)
  808 |   const trackClickPosition = await readDragPosition()
  809 |   expect(trackClickPosition.scrollTop).toBeLessThanOrEqual(
  810 |     trackClickPosition.clientHeight * 1.2,
  811 |   )
  812 | })
  813 | 
  814 | test('markdown stress preview scroll remains monotonic while renderer settles', async ({
  815 |   page,
  816 | }) => {
  817 |   test.setTimeout(60_000)
  818 |   await page.setViewportSize({ width: 900, height: 760 })
  819 |   await page.goto('/?visual=markdown-stress&theme=light&debugScroll=1', {
  820 |     waitUntil: 'domcontentloaded',
  821 |   })
  822 | 
  823 |   const renderer = page.locator('.markdown-stress-renderer')
  824 |   await expect(renderer).toContainText('Stress Section 1', {
  825 |     timeout: 20_000,
  826 |   })
  827 | 
  828 |   const samples = await sampleMarkdownStressScroll(page, {
  829 |     delayMs: 8,
  830 |     steps: 80,
  831 |   })
  832 |   expectStableForwardMarkdownScroll(samples)
  833 | 
  834 |   await expect(
  835 |     page.locator('[data-testid="markdown-stress-status"]'),
  836 |   ).toHaveText('complete', { timeout: 20_000 })
  837 | })
  838 | 
  839 | test('markdown stress preview keeps position in narrow devtools-like viewport', async ({
  840 |   page,
  841 | }) => {
  842 |   test.setTimeout(60_000)
  843 |   await page.setViewportSize({ width: 520, height: 760 })
  844 |   await page.goto('/?visual=markdown-stress&theme=light', {
  845 |     waitUntil: 'domcontentloaded',
  846 |   })
  847 | 
  848 |   await expect(
  849 |     page.locator('[data-testid="markdown-stress-status"]'),
> 850 |   ).toHaveText('complete', { timeout: 20_000 })
      |     ^ Error: expect(locator).toHaveText(expected) failed
  851 | 
  852 |   const samples = await sampleMarkdownStressScroll(page, {
  853 |     delayMs: 8,
  854 |     steps: 80,
  855 |   })
  856 |   expectStableForwardMarkdownScroll(samples)
  857 | 
  858 |   const last = samples[samples.length - 1]
  859 |   expect(last.scrollHeight).toBeGreaterThan(last.clientHeight)
  860 |   expect(last.section).toBeGreaterThan(20)
  861 | })
  862 | 
```