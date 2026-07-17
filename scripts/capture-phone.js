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
const ACTION_TIMEOUT = 8000;

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name) });
  console.log('capturado:', name);
}

async function safeStep(label, fn) {
  try {
    await fn();
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
  const page = await context.newPage();
  page.setDefaultTimeout(ACTION_TIMEOUT);

  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page
    .getByText('Empezar entrenamiento', { exact: false })
    .first()
    .waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);

  await shot(page, '01-home.png');

  await safeStep('abrir registro', async () => {
    await page.getByText('Torso mixto', { exact: false }).first().click();
    await page.waitForTimeout(800);
    await shot(page, '02-registro.png');
    await page.goBack();
    await page
      .getByText('Empezar entrenamiento', { exact: false })
      .first()
      .waitFor();
  });

  await safeStep('calendario', async () => {
    await page.getByText('Calendario', { exact: true }).first().click();
    await page.waitForTimeout(800);
    await shot(page, '03-calendario.png');
  });

  await safeStep('cardio', async () => {
    await page.getByText('Cardio', { exact: true }).first().click();
    await page.waitForTimeout(800);
    await shot(page, '04-cardio.png');
  });

  await safeStep('logros semanales', async () => {
    await page.getByText('Fuerza', { exact: true }).first().click();
    await page.waitForTimeout(500);
    await page.getByText('Semana 7', { exact: false }).first().click();
    await page.waitForTimeout(800);
    await shot(page, '05-logros-semanales.png');
  });

  await browser.close();
  console.log('=== captura de movil terminada ===');
})().catch((e) => {
  console.error('ERROR FATAL:', e);
  process.exit(1);
});
