const { chromium } = require('playwright');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'store-assets', 'screenshots', 'phone');
const URL = 'http://localhost:8081';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);

  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.getByText('Empezar entrenamiento', { exact: false }).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);

  // "Semana 6" es una semana pasada ya completada (5 dias). Long-press en su
  // cabecera abre la pantalla de logros (ver HomeScreen.tsx handleShowWeekAchievementForBlock).
  const target = page.getByText('Semana 6', { exact: false }).first();
  await target.waitFor();
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600); // deja asentar la LayoutAnimation antes de medir posicion
  const box = await target.boundingBox();
  if (!box) throw new Error('No se encontro el bounding box de "Semana 6"');
  console.log('bounding box Semana 6:', box);

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(3500); // delayLongPress={3000} en HomeScreen.tsx
  await page.mouse.up();
  await page.waitForTimeout(800);

  await page.screenshot({ path: path.join(OUT_DIR, '05-logros-semanales.png') });
  console.log('capturado: 05-logros-semanales.png');

  await browser.close();
})().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
