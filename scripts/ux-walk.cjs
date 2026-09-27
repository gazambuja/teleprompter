// UX walkthrough of the live app (HEADLESS=1 scripts/dev-probe.sh): drives it like a user
// — keyboard + mouse only, no __app shortcuts except to read state — and screenshots each
// step at a given window size. Usage: W=760 H=260 node scripts/ux-walk.cjs
const puppeteer = require('puppeteer');
const path = require('path');

const W = Number(process.env.W || 1059);
const H = Number(process.env.H || 1064);
const OUT = path.join(__dirname, '..', 'probe-out', `ux-${W}x${H}`);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
  const page = (await browser.pages()).find((p) => p.url().startsWith('http://localhost'));
  await page.setViewport({ width: W, height: H });
  await page.reload({ waitUntil: 'networkidle0' });
  await delay(800);
  let n = 0;
  const step = async (name, note) => {
    const s = await page.evaluate(() => {
      const st = window.__app.state;
      const vis = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return 'absent';
        const cs = getComputedStyle(el);
        return cs.opacity === '0' || el.getAttribute('aria-hidden') === 'true' ? 'hidden' : 'visible';
      };
      const panel = document.querySelector('aside');
      return {
        mode: st.mode,
        playing: st.playing,
        focus: document.activeElement?.tagName,
        titlebar: vis('header'),
        panel: panel && panel.getAttribute('aria-hidden') === 'false' ? `open(${panel.offsetWidth}px)` : 'closed'
      };
    });
    const file = `${String(++n).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: path.join(OUT, file) });
    console.log(file.padEnd(28), JSON.stringify(s), note ? `  // ${note}` : '');
  };

  await step('launch', 'panel should start closed');
  await page.keyboard.down('Control');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Control');
  await delay(400);
  await step('ctrl-enter-in-editor', 'starts countdown while typing');
  await delay(3500);
  await page.mouse.move(W / 3, H / 2);
  await delay(200);
  await step('display-mouse-moving', 'chrome revealed');
  await page.keyboard.press('Space');
  await delay(3200);
  await step('playing-mouse-idle-3s', 'chrome + cursor hidden, prompt hidden');
  await page.mouse.move(W / 3 + 30, H / 2 + 30);
  await delay(200);
  await step('playing-mouse-moved', 'chrome back');
  await page.keyboard.press('Space');
  await delay(3200);
  await step('paused-idle', 'Resume prompt below the focus band');
  // Open the panel from the gear while reading, then Escape.
  await page.mouse.move(W - 120, 22);
  await delay(200);
  await page.click('button[title="Settings"]');
  await delay(500);
  await page.mouse.move(W - 120, 30);
  await delay(3000);
  await step('panel-open-idle', 'panel + titlebar stay while panel open');
  await page.keyboard.press('Escape');
  await delay(500);
  await step('escape-closes-panel', 'still in display mode');
  await page.keyboard.press('h');
  await delay(400);
  await page.mouse.click(W / 4, H / 2);
  await delay(500);
  await step('click-text-closes-panel');
  await page.keyboard.press('Escape');
  await delay(500);
  await step('escape-to-editor');
  browser.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
