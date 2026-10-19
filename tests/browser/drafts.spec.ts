import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createExampleProject } from '../../src/story/model';

const draftKey = 'narraplot.draft.v1';
const rememberKey = 'narraplot.remember-draft.v1';
const unrelatedKey = 'another-app.setting';
const savedDraft = JSON.stringify(
  { ...createExampleProject(), title: 'A saved story', extra: 'preserve pending bytes' },
  null,
  2,
);

async function storedDraft(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), draftKey);
}

async function seedDraft(page: Page, raw: string, remember = true) {
  await page.goto('/');
  await page.evaluate(
    ({ draftKey, rememberKey, unrelatedKey, raw, remember }) => {
      localStorage.setItem(draftKey, raw);
      localStorage.setItem(unrelatedKey, 'keep me');
      if (remember) localStorage.setItem(rememberKey, 'true');
    },
    { draftKey, rememberKey, unrelatedKey, raw, remember },
  );
  await page.reload();
}

async function expectSVGExport(page: Page, headline: string) {
  await page.getByRole('textbox', { name: 'Scene headline' }).fill(headline);
  await expect(page.getByTestId('story-canvas')).toContainText(headline);
  await page.getByRole('button', { name: 'Export story' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /SVG artwork/ }).click();
  const file = await download;
  expect(await readFile((await file.path())!, 'utf8')).toContain(headline);
  await page.getByRole('button', { name: 'Close dialog' }).click();
}

test('remembering needs opt-in, persists the choice, and forget keeps the open work', async ({
  page,
}) => {
  await page.goto('/');
  const remember = page.getByRole('checkbox', { name: 'Remember draft in this browser' });
  const title = page.getByRole('textbox', { name: 'Project title' });
  await expect(remember).not.toBeChecked();
  expect(await storedDraft(page)).toBeNull();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await title.fill('A session-only edit');
  expect(await storedDraft(page)).toBeNull();
  await remember.check();
  await expect.poll(() => storedDraft(page)).toContain('A session-only edit');
  await page.evaluate((key) => localStorage.setItem(key, 'keep me'), unrelatedKey);
  await page.reload();
  await expect(remember).toBeChecked();
  await expect(remember).toBeDisabled();
  await expect(title).toHaveValue('A city finding its stride');
  await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  await expect(title).toHaveValue('A session-only edit');
  await expect(remember).toBeEnabled();

  await remember.uncheck();
  const priorCopy = await storedDraft(page);
  await title.fill('Keep this open work');
  expect(await storedDraft(page)).toBe(priorCopy);
  await page.getByRole('button', { name: 'Forget draft', exact: true }).click();
  await expect(title).toHaveValue('Keep this open work');
  await expect(remember).not.toBeChecked();
  expect(await storedDraft(page)).toBeNull();
  await expectSVGExport(page, 'Editable after forgetting.');
  expect(await storedDraft(page)).toBeNull();
  expect(await page.evaluate((key) => localStorage.getItem(key), unrelatedKey)).toBe('keep me');
  await page.reload();
  await expect(remember).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Restore draft', exact: true })).toHaveCount(0);
  expect(await storedDraft(page)).toBeNull();
});

for (const remembered of [false, true]) {
  test(`${remembered ? 'opted-in' : 'legacy'} pending draft stays byte-for-byte intact through editing and export`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedDraft(page, savedDraft, remembered);
    const remember = page.getByRole('checkbox', { name: 'Remember draft in this browser' });
    await expect(remember).toBeDisabled();
    await expect(remember).toBeChecked({ checked: remembered });
    await expect(page.getByRole('heading', { name: 'A saved draft is waiting.' })).toBeVisible();
    expect(await storedDraft(page)).toBe(savedDraft);
    await expectSVGExport(page, 'Separate work while deciding.');
    await page.keyboard.press('Escape');
    expect(await storedDraft(page)).toBe(savedDraft);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    // Cancelling restoration must preserve edits and keep the decision pending.
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Scene headline' })).toHaveValue(
      'Separate work while deciding.',
    );
    expect(await storedDraft(page)).toBe(savedDraft);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Project title' })).toHaveValue('A saved story');
    await expect(remember).toBeEnabled();
    await expect(remember).toBeChecked({ checked: remembered });
    if (!remembered) {
      expect(await storedDraft(page)).toBe(savedDraft);
      expect(await page.evaluate((key) => localStorage.getItem(key), rememberKey)).toBeNull();
    }
    expect(await page.evaluate((key) => localStorage.getItem(key), unrelatedKey)).toBe('keep me');
  });
}

for (const [name, raw] of [
  ['malformed', '{broken'],
  ['unsupported', '{"schemaVersion":999}'],
  ['empty', ''],
]) {
  test(`${name} drafts remain untouched until explicit discard`, async ({ page }) => {
    await seedDraft(page, raw!);
    await expect(
      page.getByRole('heading', { name: 'This saved draft could not be opened.' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore draft', exact: true })).toHaveCount(0);
    await expectSVGExport(page, 'Keep my current story.');
    expect(await storedDraft(page)).toBe(raw);
    await page.getByRole('button', { name: 'Discard draft', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Scene headline' })).toHaveValue(
      'Keep my current story.',
    );
    await expect(
      page.getByRole('checkbox', { name: 'Remember draft in this browser' }),
    ).not.toBeChecked();
    expect(await storedDraft(page)).toBeNull();
    expect(await page.evaluate((key) => localStorage.getItem(key), rememberKey)).toBeNull();
    expect(await page.evaluate((key) => localStorage.getItem(key), unrelatedKey)).toBe('keep me');
    await page.reload();
    expect(await storedDraft(page)).toBeNull();
  });
}

test('unavailable storage keeps editing/export usable and can be retried', async ({ page }) => {
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')!;
    Object.defineProperty(window, 'restoreStorageAccess', {
      value: () => Object.defineProperty(window, 'localStorage', descriptor),
    });
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage disabled', 'SecurityError');
      },
    });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Browser storage is unavailable');
  await expect(
    page.getByRole('checkbox', { name: 'Remember draft in this browser' }),
  ).toBeDisabled();
  await expectSVGExport(page, 'Still usable without storage.');
  await page.evaluate(() =>
    (window as unknown as { restoreStorageAccess: () => void }).restoreStorageAccess(),
  );
  await page.getByRole('button', { name: 'Retry storage access' }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Remember draft in this browser' }),
  ).toBeEnabled();
  await expect(page.getByRole('textbox', { name: 'Scene headline' })).toHaveValue(
    'Still usable without storage.',
  );
  expect(await storedDraft(page)).toBeNull();
});

test('a failed opt-in never starts draft writes', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Preference blocked', 'QuotaExceededError');
      original.call(this, name, value);
    };
  }, rememberKey);
  // The failed choice intentionally leaves the control unchecked.
  await page.getByRole('checkbox', { name: 'Remember draft in this browser' }).click();
  await expect(page.getByRole('alert')).toContainText('Your remembering choice could not be saved');
  await expect(
    page.getByRole('checkbox', { name: 'Remember draft in this browser' }),
  ).not.toBeChecked();
  await expectSVGExport(page, 'No saved preference, no draft.');
  expect(await storedDraft(page)).toBeNull();
  expect(await page.evaluate((key) => localStorage.getItem(key), rememberKey)).toBeNull();
});

test('real browser quota exhaustion preserves the last saved copy and recovers', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('checkbox', { name: 'Remember draft in this browser' }).check();
  await expect.poll(() => storedDraft(page)).not.toBeNull();
  const priorCopy = await storedDraft(page);
  const failureName = await page.evaluate(() => {
    let low = 0;
    let high = 20_000_000;
    let failure = '';
    // Fill a separate key to the browser's actual quota, without mocking setItem.
    while (low < high) {
      const size = Math.ceil((low + high) / 2);
      try {
        localStorage.setItem('quota-test-filler', 'x'.repeat(size));
        low = size;
      } catch (error) {
        failure = error instanceof DOMException ? error.name : 'unexpected';
        high = size - 1;
      }
    }
    localStorage.setItem('quota-test-filler', 'x'.repeat(low));
    return failure;
  });
  expect(failureName).toBe('QuotaExceededError');
  await expectSVGExport(
    page,
    'A much longer edited headline that no longer fits in the remaining browser storage.',
  );
  await expect(page.getByRole('alert')).toContainText('Your latest edits could not be saved');
  expect(await storedDraft(page)).toBe(priorCopy);
  await page.evaluate(() => localStorage.removeItem('quota-test-filler'));
  await page.getByRole('textbox', { name: 'Scene headline' }).fill('Storage has room again.');
  await expect.poll(() => storedDraft(page)).toContain('Storage has room again.');
  await expect(page.locator('.draft-error')).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const blockedKey of [draftKey, rememberKey]) {
  test(`failed ${blockedKey === draftKey ? 'draft' : 'preference'} removal reports partial results and keeps writes stopped`, async ({
    page,
  }) => {
    await seedDraft(page, savedDraft);
    await page.evaluate((blockedKey) => {
      const original = Storage.prototype.removeItem;
      Object.defineProperty(window, 'restoreStorageRemovals', {
        value: () => {
          Storage.prototype.removeItem = original;
        },
      });
      Storage.prototype.removeItem = function (key) {
        if (key === blockedKey) throw new DOMException('Removal blocked', 'SecurityError');
        original.call(this, key);
      };
    }, blockedKey);
    await page.getByRole('button', { name: 'Discard draft', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(
      blockedKey === draftKey ? 'could not be removed' : 'could not save your off preference',
    );
    await expect(
      page.getByRole('checkbox', { name: 'Remember draft in this browser' }),
    ).not.toBeChecked();
    await expectSVGExport(page, 'Keep editing after a failed removal.');
    expect(await storedDraft(page)).toBe(blockedKey === draftKey ? savedDraft : null);
    expect(await page.evaluate((key) => localStorage.getItem(key), rememberKey)).toBe(
      blockedKey === rememberKey ? 'true' : null,
    );
    expect(await page.evaluate((key) => localStorage.getItem(key), unrelatedKey)).toBe('keep me');
    await page.evaluate(() =>
      (window as unknown as { restoreStorageRemovals: () => void }).restoreStorageRemovals(),
    );
    await page
      .getByRole('button', {
        name: blockedKey === draftKey ? 'Discard draft' : 'Forget draft',
        exact: true,
      })
      .click();
    expect(await storedDraft(page)).toBeNull();
    expect(await page.evaluate((key) => localStorage.getItem(key), rememberKey)).toBeNull();
    await page.getByRole('textbox', { name: 'Project title' }).fill('Still no automatic rewrite');
    expect(await storedDraft(page)).toBeNull();
    await expect(page.locator('.draft-error')).toHaveCount(0);
  });
}

test('restoring after both removal failures keeps the unresolved warning and saving stopped', async ({
  page,
}) => {
  await seedDraft(page, savedDraft);
  await page.evaluate(
    (ownedKeys) => {
      const original = Storage.prototype.removeItem;
      Object.defineProperty(window, 'restoreStorageRemovals', {
        value: () => {
          Storage.prototype.removeItem = original;
        },
      });
      Storage.prototype.removeItem = function (key) {
        if (ownedKeys.includes(key)) throw new DOMException('Removal blocked', 'SecurityError');
        original.call(this, key);
      };
    },
    [draftKey, rememberKey],
  );
  await page.getByRole('button', { name: 'Discard draft', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('that choice could not be saved either');
  await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Project title' })).toHaveValue('A saved story');
  await expect(page.getByRole('alert')).toContainText('that choice could not be saved either');
  await expect(
    page.getByRole('checkbox', { name: 'Remember draft in this browser' }),
  ).not.toBeChecked();
  await expectSVGExport(page, 'Restored work remains editable.');
  expect(await storedDraft(page)).toBe(savedDraft);
  expect(await page.evaluate((key) => localStorage.getItem(key), rememberKey)).toBe('true');
  await expect(page.getByRole('alert')).toContainText('that choice could not be saved either');

  await page.evaluate(() =>
    (window as unknown as { restoreStorageRemovals: () => void }).restoreStorageRemovals(),
  );
  await page.getByRole('button', { name: 'Forget draft', exact: true }).click();
  await expect(page.locator('.draft-error')).toHaveCount(0);
  expect(await storedDraft(page)).toBeNull();
  expect(await page.evaluate((key) => localStorage.getItem(key), rememberKey)).toBeNull();
  expect(await page.evaluate((key) => localStorage.getItem(key), unrelatedKey)).toBe('keep me');
  await page
    .getByRole('textbox', { name: 'Project title' })
    .fill('Keep the open story after removal');
  expect(await storedDraft(page)).toBeNull();
});
