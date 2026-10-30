import { expect, test, type Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/studio$/);
}

/** Minimal valid 1x1 PNG, built in-test so no binary fixture is committed. */
function tinyPng(): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  const raw = Buffer.from([0, 0x63, 0x5b, 0xff]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test.describe('marketing screenshots', () => {
  for (const path of ['/', '/pricing', '/legal/terms', '/login']) {
    test(`renders ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`${path === '/' ? 'home' : path.slice(1).replace(/\//g, '-')}.png`, { fullPage: true });
    });
  }
});

test('creator goes from topic to voiced storyboard', async ({ page }) => {
  await signIn(page, 'creator@e2e.test');
  await expect(page.getByText('60', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Start a video' }).click();
  await page.getByLabel('What should the video explain?').fill('How compound interest works');
  await page.getByRole('button', { name: 'Write my script' }).click();
  await expect(page.getByRole('heading', { name: 'Review your script' })).toBeVisible({ timeout: 60_000 });

  await page.getByRole('button', { name: 'Approve script' }).click();
  await page.getByRole('button', { name: /Build storyboard/ }).click();
  const scenes = page.getByRole('list', { name: 'Scenes' });
  await expect(scenes.locator('.scene-item')).toHaveCount(5, { timeout: 60_000 });
  await expect(page.getByText('All changes saved')).toBeVisible();

  // Edit narration -> autosave; only that scene loses its (future) voice; undo restores it.
  await scenes.locator('.scene-select').nth(1).click();
  const narration = page.getByRole('textbox', { name: 'Narration', exact: true });
  const original = await narration.inputValue();
  await narration.fill('Compound interest means you earn interest on your interest.');
  await expect(page.getByText('All changes saved')).toBeVisible();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(narration).toHaveValue(original);
  await expect(page.getByText('All changes saved')).toBeVisible();

  // Template switch produces a valid default visual.
  await page.getByLabel('Template').selectOption('bar_chart');
  await expect(scenes.locator('.scene-item').nth(1)).toContainText('Bar chart');
  await expect(page.getByText('All changes saved')).toBeVisible();

  await page.getByRole('button', { name: /Generate voice/ }).click();
  await expect(page.getByRole('region', { name: 'Storyboard editor' }).locator('.badge', { hasText: 'Voice ready' })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole('button', { name: /Render final 1080p MP4/ })).toBeEnabled();

  // Brand kit: logo upload is validated server-side and stored as an asset.
  await page.locator('input[type=file]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: tinyPng() });
  await expect(page.getByText('Shown in the top-right corner of every scene.')).toBeVisible();

  await expect(page.locator('.editor')).toHaveScreenshot('editor.png', { mask: [page.locator('.editor video, .editor canvas, .editor [class*="player"], .editor .inspector')], maxDiffPixelRatio: 0.03 });
});

test('users cannot see each other’s projects', async ({ browser }) => {
  const a = await browser.newPage();
  await signIn(a, 'owner@e2e.test');
  const created = await a.evaluate(async () => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ title: 'Private', input: { mode: 'topic', topic: 'Private topic', audience: 'general', tone: 'friendly', targetSeconds: 60, language: 'en', aspectRatio: '16:9', voiceId: 'mock-ava' }, themePreset: 'minkflow_dark', captionsEnabled: true }),
    });
    return (await res.json()).project.id as string;
  });

  const b = await browser.newPage();
  await signIn(b, 'intruder@e2e.test');
  const status = await b.evaluate(async (id) => (await fetch(`/api/projects/${id}`)).status, created);
  expect(status).toBe(404);
  await b.goto(`/studio/projects/${created}`);
  await expect(b.getByText(/not found|404/i).first()).toBeVisible();
  const admin = await b.evaluate(async () => (await fetch('/api/admin/overview')).status);
  expect(admin).toBe(404);
});

test('admin grants beta credits (audited, idempotent)', async ({ browser }) => {
  const user = await browser.newPage();
  await signIn(user, 'beta@e2e.test');

  const admin = await browser.newPage();
  await signIn(admin, 'admin@e2e.test');
  await admin.getByRole('link', { name: 'Admin' }).click();
  await admin.getByLabel('User email').fill('beta@e2e.test');
  await admin.getByLabel('Credits', { exact: true }).fill('25');
  await admin.getByLabel('Reason (audited)').fill('E2E beta grant');
  await admin.getByRole('button', { name: 'Grant credits' }).click();
  await expect(admin.getByText('Granted 25 credits to beta@e2e.test.')).toBeVisible();

  await user.goto('/studio/billing');
  await expect(user.getByText('Balance: 85 credits')).toBeVisible();
});
