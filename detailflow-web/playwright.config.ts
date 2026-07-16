import { defineConfig, devices } from '@playwright/test';

const webBaseUrl = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const apiBaseUrl = process.env.E2E_API_URL ?? 'http://localhost:5000/api';
const inheritedEnvironment = process.env as Record<string, string>;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: '../reports/test-results',
  reporter: [
    ['list'],
    ['./reporters/evidence-reporter.ts'],
    ['html', { outputFolder: '../reports/playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: webBaseUrl,
    ...devices['Desktop Chrome'],
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },
  webServer: [
    {
      command: 'dotnet run --no-build --no-launch-profile --project ../DetailFlow.Api/DetailFlow.Api.csproj --urls http://127.0.0.1:5000',
      cwd: __dirname,
      url: 'http://127.0.0.1:5000/',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        ...inheritedEnvironment,
        ASPNETCORE_ENVIRONMENT: 'Development',
        ASPNETCORE_URLS: 'http://127.0.0.1:5000',
        DB_CONNECTION_STRING: process.env.E2E_DB_CONNECTION_STRING
          ?? 'Host=127.0.0.1;Port=5432;Database=detailflow;Username=detailflow;Password=detailflow',
        FRONTEND_URL: webBaseUrl,
      },
    },
    {
      command: 'node e2e-manual/start-web.mjs',
      cwd: __dirname,
      url: `${webBaseUrl}/login`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        ...inheritedEnvironment,
        NEXT_PUBLIC_API_URL: apiBaseUrl,
      },
    },
  ],
});
