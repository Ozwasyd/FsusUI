import { expect, test } from '@playwright/test';

test('audit component styles', async ({ page }) => {
  const components = [
    { name: 'Button', route: 'basic', selector: '.el-button' },
    { name: 'Input', route: 'form', selector: '.el-input__wrapper' },
    { name: 'Switch', route: 'form', selector: '.el-switch__core' },
    { name: 'Checkbox', route: 'form', selector: '.el-checkbox__inner' },
    { name: 'Radio', route: 'form', selector: '.el-radio__inner' },
    { name: 'Tag', route: 'data', selector: '.el-tag' },
    { name: 'Card', route: 'others', selector: '.el-card' },
    { name: 'Alert', route: 'feedback', selector: '.el-alert' },
    { name: 'Pagination', route: 'data', selector: '.el-pager li' },
    { name: 'Select-Input', route: 'form', selector: '.el-select .el-input__wrapper' }
  ];

  console.log('\n--- GLOBAL RADIUS AUDIT REPORT ---');
  for (const comp of components) {
    try {
      await page.goto(`/?visual=${comp.route}&theme=light`);
      await page.waitForSelector('.demo-app-container');
      const radius = await page.$eval(comp.selector, el => window.getComputedStyle(el).borderRadius);
      console.log(`[AUDIT] ${comp.name.padEnd(15)}: ${radius}`);
    } catch {
      console.log(`[AUDIT] ${comp.name.padEnd(15)}: NOT FOUND`);
    }
  }

  // 特殊审计：TreeSelect
  await page.goto('/?visual=form&theme=light');
  await page.waitForSelector('.demo-app-container');
  console.log('\n--- INTERACTION AUDIT: TREESELECT ---');
  const treeSelect = page.locator('[data-testid="unique-tree-select"]');
  await treeSelect.locator('.el-input__wrapper').click({ force: true });
  const treePopper = treeSelect.locator('.el-select__popper');
  await expect(treePopper).toBeVisible();

  const treeItem = treePopper.locator('.el-tree-node__content', {
    hasText: 'Level one 1',
  }).first();
  await treeItem.hover();
  await treeItem.evaluate(el => {
    el.closest<HTMLElement>('.el-tree-node')?.focus();
  });
  const treeItemStyle = await treeItem.evaluate(el => {
    const rowStyle = window.getComputedStyle(el);
    const rowRect = el.getBoundingClientRect();
    const option = el.querySelector<HTMLElement>('.el-select-dropdown__item');
    if (!option) {
      throw new Error('TreeSelect option item is missing');
    }
    const optionStyle = window.getComputedStyle(option);
    const optionRect = option.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(option);
    const textRect = range.getBoundingClientRect();
    range.detach();
    return {
      radius: optionStyle.borderRadius,
      padding: optionStyle.padding,
      height: rowStyle.height,
      optionLeftDelta: Math.abs(optionRect.left - rowRect.left),
      textLeft: textRect.left,
      itemLeft: optionRect.left,
      overlap: textRect.left - optionRect.left
    };
  });
  console.log(`[TREESELECT] Item Radius: ${treeItemStyle.radius}`);
  console.log(`[TREESELECT] Item Padding: ${treeItemStyle.padding}`);
  console.log(`[TREESELECT] Text-to-Box Gap: ${treeItemStyle.overlap}px (Should be > 12px)`);
  expect(treeItemStyle.radius).toBe('14px');
  expect(treeItemStyle.optionLeftDelta).toBeLessThanOrEqual(1);
  expect(treeItemStyle.overlap).toBeGreaterThan(12);
});
