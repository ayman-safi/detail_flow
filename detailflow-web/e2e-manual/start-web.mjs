import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const standalone = path.join(webRoot, '.next', 'standalone');
const staticSource = path.join(webRoot, '.next', 'static');
const staticTarget = path.join(standalone, '.next', 'static');
const publicSource = path.join(webRoot, 'public');
const publicTarget = path.join(standalone, 'public');

if (!fs.existsSync(path.join(standalone, 'server.js'))) {
  throw new Error('Missing .next/standalone/server.js. Run npm run build before Playwright.');
}
if (fs.existsSync(staticSource)) fs.cpSync(staticSource, staticTarget, { recursive: true, force: true });
if (fs.existsSync(publicSource)) fs.cpSync(publicSource, publicTarget, { recursive: true, force: true });

const server = spawn(process.execPath, [path.join(standalone, 'server.js')], {
  cwd: standalone,
  stdio: 'inherit',
  env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: '3000' },
});
server.on('exit', code => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}
