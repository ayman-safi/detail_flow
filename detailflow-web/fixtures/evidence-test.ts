import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test as base, type TestInfo } from '@playwright/test';
import { apiBaseUrl } from '../helpers/environment';

export type Evidence = {
  id: string;
  checkpoint: (name: string, options?: { fullPage?: boolean }) => Promise<void>;
  note: (name: string, content: string) => Promise<void>;
};

function manualId(testInfo: TestInfo) {
  const match = testInfo.title.match(/^([A-Z]+-\d{3})\b/);
  if (!match) throw new Error(`Test title must begin with a manual test ID: ${testInfo.title}`);
  return match[1];
}

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const test = base.extend<{ evidence: Evidence }>({
  evidence: async ({ page }, provideEvidence, testInfo) => {
    const id = manualId(testInfo);
    let sequence = 0;
    const screenshotDir = path.resolve(__dirname, '..', '..', 'evidence', 'screenshots', id);
    await fs.mkdir(screenshotDir, { recursive: true });

    await provideEvidence({
      id,
      checkpoint: async (name, options) => {
        sequence += 1;
        const fileName = `${String(sequence).padStart(2, '0')}-${safeName(name)}.png`;
        const filePath = path.join(screenshotDir, fileName);
        await page.screenshot({ path: filePath, fullPage: options?.fullPage ?? true });
        await testInfo.attach(`${id}-${fileName}`, { path: filePath, contentType: 'image/png' });
      },
      note: async (name, content) => {
        await testInfo.attach(`${id}-${safeName(name)}.txt`, {
          body: Buffer.from(content, 'utf8'),
          contentType: 'text/plain',
        });
      },
    });

    if (!page.isClosed()) {
      await page.screenshot({
        path: path.join(screenshotDir, `${String(++sequence).padStart(2, '0')}-final-state.png`),
        fullPage: true,
      }).catch(() => undefined);
    }
  },
});

test.beforeEach(async ({ request }, testInfo) => {
  const response = await request.post(`${apiBaseUrl}/dev/seed`);
  expect(response.ok(), `${testInfo.title}: deterministic seed reset failed: ${await response.text()}`).toBeTruthy();
});

export { expect } from '@playwright/test';
