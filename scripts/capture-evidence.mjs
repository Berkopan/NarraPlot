import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  output: { type: 'string' }, sha: { type: 'string' },
  'project-dir': { type: 'string', default: '.' },
} });
assert(values.output && /^[0-9a-f]{40}$/.test(values.sha ?? ''), 'Supply --output and a full --sha');
const cwd = path.resolve(values['project-dir']);
const output = path.resolve(values.output);
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim(), values.sha);
await mkdir(output, { recursive: true });
const port = 4174;
const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32',
});
let serverLog = '';
for (const stream of [server.stdout, server.stderr]) {
  stream.on('data', (data) => { serverLog = (serverLog + data.toString()).slice(-20000); });
}
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i += 1) {
    if (server.exitCode !== null) throw new Error(`Preview exited: ${serverLog}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch { /* bounded startup wait */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert(ready, `Preview did not start: ${serverLog}`);
  browser = await chromium.launch(process.env.NARRAPLOT_CHROMIUM_PATH
    ? { executablePath: process.env.NARRAPLOT_CHROMIUM_PATH } : {});
  const results = [];
  for (const viewport of [{ width: 1600, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}`);
    await page.getByTestId('story-canvas').waitFor({ state: 'visible' });
    await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Editor overflows');
    const prefix = viewport.width === 390 ? 'narrow' : 'desktop';
    await page.screenshot({ path: path.join(output, `${prefix}-editor.png`), fullPage: true });
    await page.getByRole('button', { name: 'Paste or import CSV' }).click();
    await page.getByRole('textbox', { name: 'Paste a table' }).fill('Note;Code;Amount\nalpha;001;12,5\nbeta;002;8%\ngamma;003;\ndelta;004;<img src=x onerror=alert(1)>\nepsilon;005;-2,25');
    await page.getByLabel('Separator', { exact: true }).selectOption(';');
    await page.getByLabel('Number format', { exact: true }).selectOption('decimal-comma');
    await page.getByLabel('Label column', { exact: true }).selectOption('1');
    await page.getByLabel('Value column', { exact: true }).selectOption('2');
    await page.getByRole('alert').waitFor({ state: 'visible' });
    assert(await page.getByRole('button', { name: 'Use this data' }).isDisabled());
    assert.equal(await page.getByRole('dialog').locator('img').count(), 0, 'Raw cells must not become markup');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Import overflows');
    await page.screenshot({ path: path.join(output, `${prefix}-import.png`), fullPage: false });
    const alert = page.getByRole('alert');
    await alert.scrollIntoViewIfNeeded();
    await expect(alert).toBeInViewport({ ratio: 1 });
    // Full-page capture can resize the viewport and re-center a fixed dialog.
    await page.screenshot({ path: path.join(output, `${prefix}-diagnostics.png`), fullPage: false });
    await page.keyboard.press('Escape');
    if (viewport.width === 1600) {
      await page.getByRole('button', { name: 'Export story' }).click();
      for (const [label, filename] of [[/PNG image/, 'scene.png'], [/HTML story/, 'story.html']]) {
        const pending = page.waitForEvent('download');
        await page.getByRole('button', { name: label }).click();
        await (await pending).saveAs(path.join(output, filename));
      }
      const png = await readFile(path.join(output, 'scene.png'));
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      assert.equal(png.readUInt32BE(16), 2400);
      assert.equal(png.readUInt32BE(20), 1520);
      const reader = await context.newPage();
      await reader.route('**/*', (route) => route.abort());
      await reader.setContent(await readFile(path.join(output, 'story.html'), 'utf8'));
      assert.equal(await reader.locator('.scene:visible').count(), 1);
      await reader.getByRole('button', { name: 'Next' }).click();
      assert.equal(await reader.locator('#position').textContent(), '2 / 3');
      await reader.getByRole('button', { name: 'Next' }).click();
      assert.equal(await reader.locator('#position').textContent(), '3 / 3');
    }
    assert.deepEqual(errors, [], 'Browser page errors');
    results.push({ viewport, scenarios: ['editor', 'invalid numeric import'], page_errors: errors });
    await context.close();
  }
  await writeFile(path.join(output, 'capture.json'), JSON.stringify({
    source_sha: values.sha, node: process.version,
    npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(),
    chromium: browser.version(), captures: results,
    export_checks: { png_width: 2400, png_height: 1520, html_scenes_navigated: 3 },
    status: 'passed',
  }, null, 2) + '\n');
} finally {
  await browser?.close();
  if (server.pid) {
    try { process.kill(process.platform === 'win32' ? server.pid : -server.pid, 'SIGTERM'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  await writeFile(path.join(output, 'preview.log'), serverLog);
}
