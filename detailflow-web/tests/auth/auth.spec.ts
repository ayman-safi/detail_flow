import { manualCases } from '../generated/manual-cases';
import { test } from '../../fixtures/evidence-test';
import { runManualCase } from '../../helpers/manual-case-runner';

for (const manualCase of manualCases.filter(item => item.id.startsWith('AUTH-'))) {
  test(`${manualCase.id} - ${manualCase.title}`, async ({ page, request, evidence }) => {
    await runManualCase(manualCase, { page, request, evidence });
  });
}
