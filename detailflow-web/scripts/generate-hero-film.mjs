import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../public/detailflow-cinematic-hero.png', import.meta.url));
const outputPath = fileURLToPath(new URL('../public/detailflow-hero-film.webm', import.meta.url));
const source = `data:image/png;base64,${(await readFile(sourcePath)).toString('base64')}`;
const chunks = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.exposeFunction('pushVideoChunk', (bytes) => {
  chunks.push(Buffer.from(bytes));
});

await page.setContent('<canvas id="film" width="1280" height="720"></canvas>');
await page.evaluate(async ({ imageSource }) => {
  const canvas = document.querySelector('#film');
  const context = canvas.getContext('2d', { alpha: false });
  const image = new Image();
  image.src = imageSource;
  await image.decode();

  const stream = canvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm;codecs=vp8';
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3_200_000 });
  recorder.ondataavailable = async (event) => {
    if (event.data.size > 0) {
      const bytes = new Uint8Array(await event.data.arrayBuffer());
      await window.pushVideoChunk(Array.from(bytes));
    }
  };

  const duration = 4_500;
  const startedAt = performance.now();
  recorder.start(500);

  await new Promise((resolve) => {
    const draw = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const scale = 1.025 + eased * 0.035;
      const sourceAspect = image.width / image.height;
      const canvasAspect = canvas.width / canvas.height;
      const baseWidth = sourceAspect > canvasAspect ? canvas.height * sourceAspect : canvas.width;
      const baseHeight = sourceAspect > canvasAspect ? canvas.height : canvas.width / sourceAspect;
      const width = baseWidth * scale;
      const height = baseHeight * scale;
      const x = (canvas.width - width) / 2 - eased * 13;
      const y = (canvas.height - height) / 2 + eased * 3;

      context.globalCompositeOperation = 'source-over';
      context.drawImage(image, x, y, width, height);

      context.globalCompositeOperation = 'screen';
      const scanX = canvas.width * (0.48 + eased * 0.34);
      const scan = context.createLinearGradient(scanX - 46, 0, scanX + 46, 0);
      scan.addColorStop(0, 'rgba(59,130,246,0)');
      scan.addColorStop(0.48, 'rgba(59,130,246,0.07)');
      scan.addColorStop(0.5, 'rgba(56,189,248,0.44)');
      scan.addColorStop(0.52, 'rgba(59,130,246,0.07)');
      scan.addColorStop(1, 'rgba(59,130,246,0)');
      context.fillStyle = scan;
      context.fillRect(scanX - 46, 0, 92, canvas.height);

      const glow = context.createRadialGradient(
        canvas.width * 0.7,
        canvas.height * 0.56,
        10,
        canvas.width * 0.7,
        canvas.height * 0.56,
        canvas.width * 0.32,
      );
      glow.addColorStop(0, `rgba(14,165,233,${0.025 + Math.sin(progress * Math.PI) * 0.055})`);
      glow.addColorStop(1, 'rgba(14,165,233,0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.globalCompositeOperation = 'source-over';

      if (progress < 1) requestAnimationFrame(draw);
      else resolve();
    };
    requestAnimationFrame(draw);
  });

  await new Promise((resolve) => {
    recorder.onstop = resolve;
    recorder.stop();
  });
}, { imageSource: source });

await browser.close();
await writeFile(outputPath, Buffer.concat(chunks));
console.log(outputPath);
