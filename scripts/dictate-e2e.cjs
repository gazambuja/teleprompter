// Dictation probe against the live app from scripts/dev-probe.sh (CDP :9333, fake mic
// playing $WAV). Clicks New, then the empty-state Dictate choice, and samples the editor
// text as the fixture speech is transcribed into it.
const puppeteer = require('puppeteer');
const path = require('path');

const OUT = process.env.OUT || path.join(__dirname, '..', 'probe-out');
const SECONDS = Number(process.env.SECONDS || 40);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
  let page;
  for (let i = 0; i < 40 && !page; i++) {
    page = (await browser.pages()).find((p) => p.url().startsWith('http://localhost'));
    if (!page) await delay(500);
  }
  if (!page) throw new Error('renderer page not found');
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  page.on('console', (m) => /stt|error/i.test(m.text()) && console.log('  console', m.text().slice(0, 200)));

  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__app);

  const click = async (label) => {
    const ok = await page.evaluate((l) => {
      const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(l));
      b?.click();
      return !!b;
    }, label);
    if (!ok) throw new Error(`button ${label} not found`);
  };

  await click('New');
  await delay(300);
  await page.screenshot({ path: path.join(OUT, 'dictate-1-empty.png') });
  await click('Dictate'); // the empty-state choice comes first in the DOM
  const t0 = Date.now();
  let shot = 2;
  while (Date.now() - t0 < SECONDS * 1000) {
    await delay(2000);
    const s = await page.evaluate(() => {
      const a = window.__app.state;
      return { stt: a.stt.kind, partial: a.dictationPartial, text: a.text, dirty: a.dirty };
    });
    console.log(`t=${((Date.now() - t0) / 1000).toFixed(0)}s stt=${s.stt} partial="${s.partial}" text="${s.text}"`);
    if (s.partial && shot === 2) await page.screenshot({ path: path.join(OUT, `dictate-${shot++}-partial.png`) });
  }
  await page.screenshot({ path: path.join(OUT, 'dictate-3-final.png') });
  await click('Stop');
  await delay(300);
  console.log('after stop:', await page.evaluate(() => ({ d: window.__app.state.dictating, stt: window.__app.state.stt.kind })));
  browser.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
