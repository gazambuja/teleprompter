// End-to-end STT probe against the live Electron app started by scripts/dev-probe.sh
// (CDP :9333, fake mic playing scripts/fixtures/speech-es.wav: 1.5s silence, ~15.5s
// Spanish speech, 8s silence, looping). Clicks the real LISTEN button, then samples app
// state and screenshots each phase: loading → ahead → caught up → silence auto-pause.
const puppeteer = require('puppeteer');
const path = require('path');

const OUT = process.env.OUT || path.join(__dirname, '..', 'probe-out');
const BASE = Number(process.env.BASE || 60); // px/s, applied transiently (not persisted)
const LANG = process.env.LANG_SCRIPT || 'es'; // which script to load: 'es' fixture text or the app's English SAMPLE_TEXT
const TAG = process.env.TAG || `${LANG}-base${BASE}`;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// First paragraph is exactly what the fixture says; the rest gives the scroll room.
const SCRIPT = `Bienvenido a tu teleprompter. Esta es una herramienta pensada para presentadores y creadores de contenido que necesitan leer un guion mientras miran a la cámara. Hay tres líneas visibles en todo momento. La del medio está resaltada, esa es la línea que deberías estar leyendo ahora.

Presiona espacio para empezar a leer. Presiona otra vez para pausar. Usa las flechas para ajustar la velocidad con precisión.

La tipografía fue elegida a propósito. Es una serif editorial, diseñada para leer textos largos a distancia. Te empuja hacia adelante sin llamar la atención sobre sí misma.

Cuando llegues al final del guion, el desplazamiento se detendrá. Vuelve al inicio con la tecla R.

No hay apuro. Mirada firme, ritmo firme. Confía en el guion.`;

// English: the app's own default script (its first paragraphs are what speech-en.wav says).
const EN_SCRIPT = /SAMPLE_TEXT = `([\s\S]*?)`;/.exec(
  require('fs').readFileSync(path.join(__dirname, '..', 'src/renderer/src/constants.ts'), 'utf-8')
)[1];

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
  let page;
  for (let i = 0; i < 40 && !page; i++) {
    page = (await browser.pages()).find((p) => p.url().startsWith('http://localhost'));
    if (!page) await delay(500);
  }
  if (!page) throw new Error('renderer page not found');
  const logs = [];
  page.on('console', (m) => {
    const t = `[${m.type()}] ${m.text()}`;
    if (!t.includes('React DevTools')) {
      logs.push(t);
      if (/stt|error|Vosk|Security|worker/i.test(t)) console.log('  console', t.slice(0, 200));
    }
  });
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__app);
  await page.evaluate((t, base) => {
    window.__app.setText(t);
    window.__app.update({ speed: base }, { transient: true });
  }, LANG === 'en' ? EN_SCRIPT : SCRIPT, BASE);
  await delay(300);
  await page.evaluate(() => window.__app.setMode('display'));
  await delay(500);

  const state = () => page.evaluate(() => {
    const s = window.__app.state;
    return {
      stt: s.stt.kind === 'error'
        ? `error: ${s.stt.message}`
        : s.stt.kind + (s.stt.lang ? `:${s.stt.lang}` : '') + (s.stt.stage ? `/${s.stt.stage} ${Math.round(s.stt.pct * 100)}%` : ''),
      ui: document.querySelector('[data-testid=stt-status]')?.textContent || document.querySelector('[data-testid=stt-readout]')?.textContent || '',
      spoken: `${s.spokenIndex}/${s.tokens}`,
      spokenP: s.tokens ? +(s.spokenIndex / s.tokens).toFixed(3) : 0,
      scrollP: +s.progress.toFixed(3),
      speed: Math.round(s.adaptiveSpeed),
      base: s.settings.speed,
      playing: s.playing,
      matchRate: s.matchRate == null ? null : +s.matchRate.toFixed(2),
      vosk: window.__stt ? `${window.__stt.chunks}c/${window.__stt.partials}p/${window.__stt.results}r ${window.__stt.lastPartial.split(' ').slice(-3).join(' ')}` : '',
      cyanChars: (document.querySelector('[data-spoken]')?.textContent || '').length
    };
  });
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${TAG}-${name}`) });

  // Real click on the titlebar LISTEN button (hover first: titlebar hides in display mode).
  await page.mouse.move(400, 20);
  await delay(400);
  const listenBtn = await page.$('button[title^="Start listening"]');
  if (!listenBtn) throw new Error('LISTEN button not found');
  await listenBtn.click();
  await page.mouse.move(400, 300);
  const t0 = Date.now();
  console.log('clicked LISTEN');
  await delay(150);
  await shot('e2e-1-loading.png');

  const seen = {};
  let prev = '';
  while (Date.now() - t0 < 180000) {
    const s = await state();
    const line = JSON.stringify(s);
    if (line !== prev) console.log(`t=${((Date.now() - t0) / 1000).toFixed(1)}s`, line);
    prev = line;
    if (s.stt.startsWith('error')) {
      await shot('e2e-error.png');
      break;
    }
    const spokenStarted = s.spokenP > 0;
    const dl = /downloading (\d+)%/.exec(s.stt);
    if (dl && Number(dl[1]) >= 30 && !seen.downloading) {
      seen.downloading = true;
      await page.mouse.move(400, 20);
      await delay(300);
      await shot('e2e-0-downloading.png');
      await page.mouse.move(400, 300);
    }
    if (s.stt.startsWith('listening') && !seen.listening) {
      seen.listening = true;
      await shot('e2e-2-listening.png');
    }
    if (spokenStarted && s.playing && s.speed > s.base * 1.3 && !seen.ahead) {
      seen.ahead = { t: Date.now() - t0, ...s };
      await shot('e2e-3-ahead.png');
    }
    if (seen.ahead && s.playing && Math.abs(s.speed - s.base) < s.base * 0.2 && !seen.caught) {
      seen.caught = { t: Date.now() - t0, ...s };
      await shot('e2e-4-caughtup.png');
    }
    if (spokenStarted && s.playing && s.speed < s.base * 0.6 && !seen.behind) {
      seen.behind = { t: Date.now() - t0, ...s };
      await shot('e2e-5-behind.png');
    }
    if (seen.wasPlaying && !s.playing && !seen.paused) {
      seen.paused = { t: Date.now() - t0, ...s };
      await page.mouse.move(400, 500); // reveal status bar (On Air / Standby LED)
      await delay(350);
      await shot('e2e-6-autopaused.png');
    }
    if (s.playing) seen.wasPlaying = true;
    if (seen.paused && Date.now() - t0 > seen.paused.t + 2000) break;
    await delay(200);
  }
  await page.mouse.move(400, 500);
  await delay(350);
  await shot('e2e-7-final.png');

  console.log('\n=== SUMMARY ===');
  for (const k of ['downloading', 'listening', 'ahead', 'caught', 'behind', 'paused']) {
    console.log(k.padEnd(10), seen[k] ? (seen[k] === true ? 'yes' : JSON.stringify(seen[k])) : 'NOT OBSERVED');
  }
  const results = logs.filter((l) => l.includes('[stt] result'));
  console.log('vosk final results:', results.length);
  results.forEach((r) => console.log('  ', r));
  browser.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
