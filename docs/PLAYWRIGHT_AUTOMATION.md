# DetailFlow Playwright regression automation

The Playwright project is in `detailflow-web`. It generates one test for every row in `MANUAL_REGRESSION_TEST_SUITE.md`; every title starts with the original manual ID. The generated coverage matrix is `PLAYWRIGHT_COVERAGE.md`.

## Evidence produced

The configuration records screenshots, video, and traces for successful and failed tests. Checkpoint screenshots are attached to the HTML report and written to `evidence/screenshots/<MANUAL-ID>/`. The evidence reporter copies the complete browser video to `evidence/videos/<MANUAL-ID>.webm` and trace to `evidence/traces/<MANUAL-ID>.zip`. The HTML report is generated at `reports/playwright-report/index.html`.

Generated artifacts are intentionally git-ignored. Test code, the generator, documentation, and coverage matrix are source-controlled.

## Local execution

Prerequisites: Node.js/npm, .NET SDK, PostgreSQL, and an isolated database whose name contains `e2e` or `test`.

From the repository root:

```powershell
.\scripts\Run-E2E.ps1
```

To reuse installed dependencies:

```powershell
.\scripts\Run-E2E.ps1 -SkipInstall
```

To run only Playwright after the API database, API build, and Next.js production build already exist:

```powershell
Set-Location .\detailflow-web
npm run test:e2e
npm run test:e2e:report
```

On Windows machines that block unsigned PowerShell shims, use `npx.cmd` instead of `npx` for direct CLI commands.

Useful commands:

```powershell
npm run test:e2e:generate
npx.cmd playwright test --list
npx.cmd playwright test -g "AUTH-004"
npx.cmd playwright show-trace ..\evidence\traces\AUTH-004.zip
```

## Determinism and isolation

Every test resets the Development seed through `POST /api/dev/seed` before execution. Playwright uses one worker because the reset is suite-global. Tests authenticate in fresh browser contexts and do not depend on execution order.

The runner records the manual steps and expected outcome as an attachment in every HTML report entry. UI checks are paired with API checks for the reachable local scenario. External-provider, production-proxy, storage-outage, and multi-process fault-injection cases are marked `Environment-gated` in both the report annotations and coverage matrix; local runs still capture the reachable UI/API baseline and visual artifacts. Full certification of those rows requires disposable integration credentials or the deployment described in the manual preconditions.

## CI

CI should provision PostgreSQL, set `E2E_DB_CONNECTION_STRING` to a disposable database, then run `scripts/Run-E2E.ps1 -SkipInstall` after installing Node and Playwright Chromium. Always publish these paths, even when the test step fails:

- `reports/playwright-report/`
- `reports/test-results/`
- `evidence/screenshots/`
- `evidence/videos/`
- `evidence/traces/`

Optional environment overrides:

- `E2E_WEB_URL` (default `http://localhost:3000`)
- `E2E_API_URL` (default `http://localhost:5000/api`)
- `E2E_DB_CONNECTION_STRING`

Do not point the suite at production: the global seed reset is destructive by design and the PowerShell runner refuses database names without `e2e` or `test`.
