const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'out', 'renderer');
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2'
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let url = req.url.split('?')[0];
      if (url === '/') url = '/index.html';
      const file = path.join(ROOT, url);
      if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        const ext = path.extname(file);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      console.log(`server on http://127.0.0.1:${port}`);
      resolve({ server, port });
    });
  });
}

(async () => {
  const { server, port } = await startServer();

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=none',
      '--allow-file-access-from-files'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });

  // Inject colorful background on body so transparency is visible
  await page.evaluateOnNewDocument(() => {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.style.background = 'linear-gradient(135deg, #5b21b6 0%, #0891b2 50%, #0f766e 100%)';
      document.body.style.backgroundAttachment = 'fixed';
    });
    window.teleprompter = {
      getSettings: async () => ({
        speed: 60, width: 880, height: 280, fontSize: 48,
        fontFamily: 'newsreader', textColor: '#f5f1ea', highlightColor: '#e4b860',
        bgColor: '#0a0b0d', opacity: 1, alwaysOnTop: 'floating',
        showControls: true, scrollMode: 'pixel', mirror: false,
        fontWeight: 400, lineHeight: 1.5, letterSpacing: 0,
        countdown: 3, focusLineStyle: 'guide', clickThrough: false,
        bgOpacity: 65
      }),
      setSettings: async () => ({}),
      openTextFile: async () => null,
      saveTextFile: async () => true,
      setAlwaysOnTop: async () => {},
      setOpacity: async () => {},
      setBounds: async () => {},
      setIgnoreMouse: async () => {},
      getVersion: async () => '0.1.0'
    };
  });

  page.on('console', m => console.log('[console]', m.type(), m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: require('path').join(__dirname, '..', 'shot-editor.png') });
  console.log('shot-editor.png saved');

  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const close = btns.find(b => b.getAttribute('aria-label') === 'Close settings');
    if (close) close.click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: require('path').join(__dirname, '..', 'shot-editor-clean.png') });
  console.log('shot-editor-clean.png saved');

  await page.evaluate(() => window.__app.setMode('display'));
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => window.__app.play());
  await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => {
    const all = document.querySelectorAll('div');
    for (const d of all) {
      const cs = getComputedStyle(d);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && d.scrollHeight > d.clientHeight + 100) {
        d.scrollTop = 360;
        return;
      }
    }
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: require('path').join(__dirname, '..', 'shot-display.png') });
  console.log('shot-display.png saved');

  // Capture with NO backdrop to show screen-share friendly mode
  await page.evaluate(() => {
    window.__app.state.settings.bgOpacity = 0;
    // Force a re-render of styles via a small hack — set state via the public API
  });
  // Use the React update path: dispatch a custom event so the component re-applies opacity
  await page.evaluate(() => {
    // The component holds bgOpacity in state. We can mutate by setting through the hook
    // by clicking the backdrop slider to 0. Easier path: directly set CSS.
    document.documentElement.style.setProperty('--bg-opacity', '0');
    // Hack: find all elements with inline style background and replace
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const bg = el.style.background;
      if (bg && bg.includes('rgba(10, 11, 13')) {
        el.style.background = bg.replace(/rgba\(10, 11, 13, [\d.]+\)/, 'rgba(10, 11, 13, 0)');
      }
    }
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: require('path').join(__dirname, '..', 'shot-display-transparent.png') });
  console.log('shot-display-transparent.png saved');

  // Restore opacity to 65 for the panel screenshot
  await page.evaluate(() => {
    document.documentElement.style.removeProperty('--bg-opacity');
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const bg = el.style.background;
      if (bg && bg.includes('rgba(10, 11, 13')) {
        el.style.background = bg.replace(/rgba\(10, 11, 13, 0\)/, 'rgba(10, 11, 13, 0.65)');
      }
    }
  });
  await page.evaluate(() => window.__app.pause());
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const settings = btns.find(b => b.getAttribute('title') === 'Settings' || b.textContent.trim().toLowerCase() === 'settings');
    if (settings) settings.click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: require('path').join(__dirname, '..', 'shot-display-panel.png') });
  console.log('shot-display-panel.png saved');

  await browser.close();
  server.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
