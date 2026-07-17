const { chromium } = require('playwright');
const path = require('path');

const OUT_DIR = path.join(
  __dirname,
  '..',
  'store-assets',
  'screenshots',
  'phone'
);
const URL = 'http://localhost:8081';
const ACTION_TIMEOUT = 10000;

async function freshHome(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(ACTION_TIMEOUT);
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page
    .getByText('Empezar entrenamiento', { exact: false })
    .first()
    .waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);
  return page;
}

async function safeStep(label, fn) {
  try {
    await fn();
    console.log('OK:', label);
  } catch (e) {
    console.log(
      'AVISO: fallo en paso "' + label + '":',
      e.message.split('\n')[0]
    );
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
  });

  await safeStep('calendario', async () => {
    const page = await freshHome(context);
    await page.getByText('Calendario', { exact: true }).first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, '03-calendario.png') });
    await page.close();
  });

  await safeStep('cardio', async () => {
    const page = await freshHome(context);
    await page.getByText('Cardio', { exact: true }).first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, '04-cardio.png') });
    await page.close();
  });

  await safeStep('logros semanales', async () => {
    const page = await freshHome(context);
    await page.getByText('Semana 7', { exact: false }).first().click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(OUT_DIR, '05-logros-semanales.png'),
    });
    await page.close();
  });

  await browser.close();
  console.log('=== capturas restantes terminadas ===');
})().catch((e) => {
  console.error('ERROR FATAL:', e);
  process.exit(1);
});
