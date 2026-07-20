import { chromium } from '@playwright/test';

const baseUrl = process.env.LANDING_QA_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true });
const failures = [];

async function check(condition, message) {
  if (!condition) failures.push(message);
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  desktop.on('pageerror', (error) => failures.push(`Desktop page error: ${error.message}`));
  await desktop.goto(`${baseUrl}/en`, { waitUntil: 'networkidle' });
  await desktop.waitForTimeout(900);
  await check(await desktop.locator('h1').isVisible(), 'English hero heading is not visible');
  await check((await desktop.locator('h1').innerText()).includes('Every car'), 'English hero copy is missing');
  await check(await desktop.getByRole('dialog', { name: /Useful analytics/i }).isVisible(), 'Consent control did not appear');
  await desktop.getByRole('button', { name: 'Only necessary' }).click();
  await desktop.getByRole('tab', { name: 'Booking' }).click();
  await check(await desktop.getByText('Confirm booking').isVisible(), 'Booking product preview did not switch');
  await desktop.getByRole('tab', { name: 'Analytics' }).click();
  const analyticsShowcase = desktop.getByAltText('Today at a glance');
  await analyticsShowcase.scrollIntoViewIfNeeded();
  await desktop.waitForFunction(() => {
    const image = document.querySelector('img[alt="Today at a glance"]');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
  });
  const analyticsSource = await analyticsShowcase.evaluate((image) => image.currentSrc);
  await check(decodeURIComponent(analyticsSource).includes('/_next/static/media/analytics-dashboard-showcase.'), 'Analytics showcase is not using a cache-safe hashed asset');
  await desktop.locator('#product').screenshot({ path: 'output/analytics-showcase-en.png' });
  await desktop.getByRole('button', { name: /45-second tour/i }).click();
  await check(await desktop.getByRole('dialog', { name: /One shop day/i }).isVisible(), 'Product tour did not open');
  await desktop.getByRole('button', { name: 'Close tour' }).click();
  await check(await desktop.getByText('New booking', { exact: true }).isVisible(), 'Connected workflow map is missing');
  const traveler = desktop.locator('[data-flow-traveler="0"]');
  const travelerStart = await traveler.evaluate((element) => getComputedStyle(element).offsetDistance);
  await desktop.waitForTimeout(650);
  const travelerEnd = await traveler.evaluate((element) => getComputedStyle(element).offsetDistance);
  await check(travelerStart !== travelerEnd, 'Workflow dots are not moving along their paths');
  const englishTracker = desktop.getByLabel('Private customer tracking');
  await check(await englishTracker.isVisible(), 'Real customer tracking preview is missing');
  await check(await englishTracker.getByText('DF-3003', { exact: true }).isVisible(), 'Tracking preview work-order code is missing');
  await check(await englishTracker.getByText('Porsche 911', { exact: true }).isVisible(), 'Tracking preview vehicle is missing');
  await check(await englishTracker.getByText('Washing', { exact: true }).isVisible(), 'Tracking preview current stage is missing');
  await desktop.locator('#experience').screenshot({ path: 'output/experience-en.png' });
  const comparison = desktop.getByRole('slider', { name: /Drag to compare/i });
  await comparison.fill('72');
  await check(await comparison.inputValue() === '72', 'Before/after comparison is not interactive');
  await desktop.screenshot({ path: 'output/landing-en.png', fullPage: true });

  const arabic = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  arabic.on('pageerror', (error) => failures.push(`Arabic page error: ${error.message}`));
  await arabic.goto(`${baseUrl}/ar`, { waitUntil: 'networkidle' });
  await arabic.waitForTimeout(700);
  await check(await arabic.locator('[dir="rtl"]').first().isVisible(), 'Arabic RTL container is missing');
  await arabic.getByRole('button', { name: 'الضروري فقط' }).click();
  await check((await arabic.locator('h1').innerText()).includes('كل سيارة'), 'Arabic hero copy is missing');
  await check(await arabic.getByText('حجز جديد', { exact: true }).isVisible(), 'Arabic workflow labels are missing');
  const arabicNodesFit = await arabic.locator('#workflow ol').evaluate((list) => {
    const frame = list.parentElement?.getBoundingClientRect();
    if (!frame) return false;
    return [...list.querySelectorAll('li')].every((node) => {
      const box = node.getBoundingClientRect();
      return box.left >= frame.left && box.right <= frame.right && box.top >= frame.top && box.bottom <= frame.bottom;
    });
  });
  await check(arabicNodesFit, 'An Arabic workflow node is clipped by the frame');
  const arabicTracker = arabic.getByLabel('تتبع خاص للعميل');
  await check(await arabicTracker.isVisible(), 'Arabic customer tracking preview is missing');
  const arabicTrackerFits = await arabicTracker.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return box.left >= 0 && box.right <= window.innerWidth;
  });
  await check(arabicTrackerFits, 'Arabic customer tracking phone is clipped');
  await arabic.locator('#experience').screenshot({ path: 'output/experience-ar.png' });
  await arabic.screenshot({ path: 'output/landing-ar.png', fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  mobile.on('pageerror', (error) => failures.push(`Mobile page error: ${error.message}`));
  await mobile.goto(`${baseUrl}/en`, { waitUntil: 'networkidle' });
  await mobile.waitForTimeout(700);
  await mobile.getByRole('button', { name: 'Only necessary' }).click();
  await check(await mobile.getByRole('button', { name: 'Open navigation' }).isVisible(), 'Mobile menu button is missing');
  await mobile.getByRole('button', { name: 'Open navigation' }).click();
  await check(await mobile.getByRole('banner').getByRole('link', { name: 'How it flows' }).isVisible(), 'Mobile navigation did not open');
  await mobile.getByRole('button', { name: 'Close navigation' }).click();
  await mobile.getByRole('tab', { name: 'Analytics' }).click();
  const mobileAnalyticsShowcase = mobile.getByAltText('Today at a glance');
  await mobileAnalyticsShowcase.scrollIntoViewIfNeeded();
  const mobileAnalyticsScale = await mobileAnalyticsShowcase.evaluate((image) => {
    const screen = image.parentElement?.getBoundingClientRect();
    const stage = image.parentElement?.parentElement?.getBoundingClientRect();
    return screen && stage ? screen.width / stage.width : 1;
  });
  await check(mobileAnalyticsScale <= .84, 'Mobile analytics screenshot is too large for its preview stage');
  await mobile.locator('#product').screenshot({ path: 'output/analytics-showcase-mobile.png' });
  const mobileTracker = mobile.getByLabel('Private customer tracking');
  await check(await mobileTracker.isVisible(), 'Mobile customer tracking preview is missing');
  const mobileTrackerFits = await mobileTracker.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return box.left >= 0 && box.right <= window.innerWidth;
  });
  await check(mobileTrackerFits, 'Mobile customer tracking phone is clipped');
  await mobile.locator('#experience').screenshot({ path: 'output/experience-mobile.png' });
  await mobile.screenshot({ path: 'output/landing-mobile.png', fullPage: true });
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Landing QA passed: desktop, mobile, product preview, tour, consent, and Arabic RTL.');
