import { expect, type Page } from '@playwright/test';

export class ApplicationPage {
  constructor(readonly page: Page) {}

  async open(pathname: string) {
    const response = await this.page.goto(pathname, { waitUntil: 'domcontentloaded' });
    expect(response, `No navigation response for ${pathname}`).not.toBeNull();
    expect(response!.status(), `${pathname} returned an HTTP error`).toBeLessThan(500);
    await expect(this.page.locator('body')).toBeVisible();
    await expect(this.page.locator('body')).not.toContainText('Internal Server Error');
  }
}
