import fs from 'node:fs';
import path from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

export default class EvidenceReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult) {
    const id = test.title.match(/^([A-Z]+-\d{3})\b/)?.[1];
    if (!id) return;
    const root = path.resolve(__dirname, '..', '..', 'evidence');
    for (const attachment of result.attachments) {
      if (!attachment.path || !fs.existsSync(attachment.path)) continue;
      let destination;
      if (attachment.name === 'video') destination = path.join(root, 'videos', `${id}.webm`);
      if (attachment.name === 'trace') destination = path.join(root, 'traces', `${id}.zip`);
      if (!destination) continue;
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(attachment.path, destination);
    }
  }
}
