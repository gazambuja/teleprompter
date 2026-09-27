// Baseline: attach to the live Electron renderer (scripts/dev-probe.sh) and exercise
// each STT stage in isolation — real IPC, real model file, fake mic.
const puppeteer = require('puppeteer');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().startsWith('http://localhost')) || pages[0];
  console.log('attached to', page.url());

  page.on('console', (m) => console.log('[renderer]', m.type(), m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('workercreated', (w) => {
    console.log('[worker created]', w.url().slice(0, 60));
    w.on('console', (m) => console.log('[worker]', m.type(), m.text()));
  });

  const result = await page.evaluate(async () => {
    const out = {};
    out.hasVosk = typeof window.Vosk !== 'undefined';
    out.status = await window.teleprompter.sttModelStatus();

    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      out.mic = s.getAudioTracks().map((t) => t.label);
      s.getTracks().forEach((t) => t.stop());
    } catch (e) {
      out.mic = 'ERR ' + e.name + ': ' + e.message;
    }

    const url = 'file://' + out.status.path;
    out.modelUrl = url;
    try {
      const m = await Promise.race([
        window.Vosk.createModel(url),
        new Promise((_, rej) => setTimeout(() => rej(new Error('createModel timeout 60s')), 60000))
      ]);
      out.model = 'loaded, ready=' + m.ready;
      m.terminate();
    } catch (e) {
      out.model = 'ERR ' + (e && e.message ? e.message : String(e));
    }
    return out;
  });
  console.log(JSON.stringify(result, null, 2));
  await delay(500);
  browser.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
