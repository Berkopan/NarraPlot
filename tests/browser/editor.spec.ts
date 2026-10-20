import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('edits a three-scene story and downloads actual SVG, PNG and portable HTML', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Project title' })).toHaveValue(
    'A city finding its stride',
  );
  await page.getByRole('textbox', { name: 'Scene headline' }).fill('A small table, a clear point.');
  await expect(page.getByTestId('story-canvas')).toContainText('A small table, a clear point.');
  await page.getByRole('button', { name: 'Line', exact: true }).click();
  await expect(page.getByTestId('story-canvas').locator('polyline')).toHaveCount(1);
  await page.getByRole('button', { name: /Find the focus/ }).click();
  await page.getByRole('combobox', { name: 'Highlighted point' }).selectOption('2023');
  await expect(page.getByRole('combobox', { name: 'Highlighted point' })).toHaveValue('2023');
  await page.getByRole('button', { name: 'Export story' }).click();

  const svgDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /SVG artwork/ }).click();
  const svgDownload = await svgDownloadPromise;
  const svg = await readFile((await svgDownload.path())!, 'utf8');
  expect(svg).toContain('<svg');
  expect(svg).toContain('One year brings it into focus.');

  const pngDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /PNG image/ }).click();
  const pngDownload = await pngDownloadPromise;
  const png = await readFile((await pngDownload.path())!);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.readUInt32BE(16)).toBe(2400);
  expect(png.readUInt32BE(20)).toBe(1520);

  const htmlDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /HTML story/ }).click();
  const htmlDownload = await htmlDownloadPromise;
  const html = await readFile((await htmlDownload.path())!, 'utf8');
  expect(html.match(/<section class="scene"/g)).toHaveLength(3);
  // Exercise the delivered document itself, without fetching a second application.
  const reader = await page.context().newPage();
  await reader.route('**/*', (route) => route.abort());
  await reader.setContent(html);
  await expect(reader.locator('.scene:visible')).toHaveCount(1);
  await expect(reader.locator('.scene:visible')).toContainText('A small table, a clear point.');
  await reader.getByRole('button', { name: 'Next' }).click();
  await expect(reader.locator('#position')).toHaveText('2 / 3');
  await expect(reader.locator('.scene:visible')).toContainText('One year brings it into focus.');
});

test('imports explicit decimal-comma data, preserves IDs and requires scene review', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Paste or import CSV' }).click();
  await page
    .getByRole('textbox', { name: 'Paste a table' })
    .fill('Code;Value\n00123;12,5\n00456;-2,5');
  await page.getByLabel('Separator', { exact: true }).selectOption(';');
  await page.getByLabel('Number format', { exact: true }).selectOption('decimal-comma');
  await page.getByLabel('Unit', { exact: true }).fill('points');
  await page.getByLabel('Source or context', { exact: true }).fill('My test data');
  await page.getByRole('button', { name: 'Use this data' }).click();
  await expect(page.getByTestId('story-canvas')).toContainText('00123');
  await expect(page.getByTestId('story-canvas')).toContainText('12.5');
  await expect(page.getByTestId('story-canvas')).toContainText('-2.5');
  await page.getByRole('button', { name: 'Export story' }).click();
  await expect(page.getByRole('button', { name: /PNG image/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /HTML story/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'I’ve reviewed this scene' }).click();
  await page.getByRole('button', { name: 'Export story' }).click();
  await expect(page.getByRole('button', { name: /PNG image/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /HTML story/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  for (const name of ['Find the focus', 'Leave a takeaway']) {
    await page.getByRole('button', { name: new RegExp(name) }).click();
    await page.getByRole('button', { name: 'I’ve reviewed this scene' }).click();
  }
  await page.getByRole('button', { name: 'Export story' }).click();
  await expect(page.getByRole('button', { name: /HTML story/ })).toBeEnabled();
});

test('rejects bad input without replacing the current story', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Paste or import CSV' }).click();
  await page.getByRole('textbox', { name: 'Paste a table' }).fill('Code,Value\n00123,\n00456,2');
  await expect(page.getByRole('alert')).toContainText('Missing values');
  await expect(page.getByRole('button', { name: 'Use this data' })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Paste a table' }).fill('Code,Value\n00123,2');
  await page.getByLabel('Unit', { exact: true }).fill('bad\u0000unit');
  await expect(page.getByRole('alert')).toContainText('control character');
  await expect(page.getByRole('button', { name: 'Use this data' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('story-canvas')).toContainText('2019');
  await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{ broken'),
  });
  await expect(page.getByRole('alert')).toContainText('not valid JSON');
  await expect(page.getByTestId('story-canvas')).toContainText('2019');
});

test('saved project files round-trip without opting into browser storage', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Scene headline' }).fill('A title worth keeping.');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save project' }).click();
  const download = await downloadPromise;
  const path = (await download.path())!;
  expect(JSON.parse(await readFile(path, 'utf8')).schemaVersion).toBe(1);
  await page.getByRole('textbox', { name: 'Scene headline' }).fill('Temporary edit');
  await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles(path);
  await expect(page.getByRole('textbox', { name: 'Scene headline' })).toHaveValue(
    'A title worth keeping.',
  );
  expect(await page.evaluate(() => localStorage.getItem('narraplot.draft.v1'))).toBeNull();
});

test('mobile editor and import dialog fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open project', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save project', exact: true })).toBeVisible();
  await expect(page.locator('.project-breadcrumb span')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Paste or import CSV' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Paste or import CSV' })).toBeFocused();
});

for (const width of [1600, 390]) {
  test(`numeric import guidance remains actionable at ${width}px, then confirms complete data`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Paste or import CSV' }).click();
    const input = page.getByRole('textbox', { name: 'Paste a table' });
    const invalid =
      'Note;Code;Amount\nalpha;001;12,5\nbeta;002;8%\ngamma;003;\ndelta;004;<img src=x onerror=alert(1)>\nepsilon;005;-2,25';
    await input.fill(invalid);
    await page.getByLabel('Separator', { exact: true }).selectOption(';');
    await page.getByLabel('Number format', { exact: true }).selectOption('decimal-comma');
    await page.getByLabel('Label column', { exact: true }).selectOption('1');
    await page.getByLabel('Value column', { exact: true }).selectOption('2');
    await page.getByLabel('Unit', { exact: true }).fill('points');
    await page.getByLabel('Source or context', { exact: true }).fill('Synthetic QA');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('3 invalid numeric cells');
    const rows = alert.locator('li');
    await expect(rows).toHaveCount(3);
    for (const [index, row, value] of [
      [0, 2, '8%'],
      [1, 3, '(empty cell)'],
      [2, 4, '<img src=x onerror=alert(1)>'],
    ] as const) {
      await expect(rows.nth(index)).toContainText(`Data row ${row} · Amount`);
      await expect(rows.nth(index).locator('code')).toHaveText(value);
    }
    await expect(alert).toContainText('Missing values');
    await expect(page.getByRole('dialog').locator('img')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Use this data' })).toBeDisabled();
    await expect(page.getByTestId('story-canvas')).toContainText('2019');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await alert.scrollIntoViewIfNeeded();
    await testInfo.attach(`invalid-import-${width}px`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await input.fill(
      'Note;Code;Amount\nalpha;001;12,5\nbeta;002;8\ngamma;003;0\ndelta;004;9\nepsilon;005;-2,25',
    );
    await expect(page.getByLabel('Separator', { exact: true })).toHaveValue(';');
    await expect(page.getByLabel('Number format', { exact: true })).toHaveValue('decimal-comma');
    await expect(page.getByLabel('Label column', { exact: true })).toHaveValue('1');
    await expect(page.getByLabel('Value column', { exact: true })).toHaveValue('2');
    await expect(page.getByLabel('Unit', { exact: true })).toHaveValue('points');
    await expect(page.getByLabel('Source or context', { exact: true })).toHaveValue('Synthetic QA');
    await expect(alert).toHaveCount(0);
    await expect(page.locator('.import-preview tbody tr')).toHaveCount(5);
    await expect(page.locator('.import-preview tbody tr').first()).toContainText('001');
    await expect(page.getByTestId('story-canvas')).toContainText('2019');
    await testInfo.attach(`corrected-before-confirm-${width}px`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await page.getByRole('button', { name: 'Use this data' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('story-canvas')).toContainText('001');
    await expect(page.getByTestId('story-canvas')).toContainText('005');
    await expect(page.getByRole('button', { name: 'I’ve reviewed this scene' })).toBeVisible();
    await page.getByRole('button', { name: 'Export story' }).click();
    await expect(page.getByRole('button', { name: /PNG image/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: /HTML story/ })).toBeDisabled();
  });
}

test('import guidance counts numeric failures beyond its three displayed rows', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Paste or import CSV' }).click();
  await page
    .getByRole('textbox', { name: 'Paste a table' })
    .fill('Code,Amount\nA,8%\nB,\nC,$3\nD,wrong\nE,5');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('4 invalid numeric cells');
  await expect(alert.locator('li')).toHaveCount(3);
  await expect(alert).toContainText('1 more numeric failure not shown');
  await expect(page.getByRole('button', { name: 'Use this data' })).toBeDisabled();
});
