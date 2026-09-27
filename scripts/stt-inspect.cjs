// Dump renderer STT state from the live app (scripts/dev-probe.sh).
const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
  const p = (await b.pages()).find((x) => x.url().startsWith('http://localhost'));
  const r = await p.evaluate(async () => {
    const s = window.__app?.state || {};
    return {
      vosk: typeof window.Vosk,
      scripts: [...document.scripts].map((x) => x.src).filter(Boolean),
      status: await window.teleprompter.sttModelStatus().catch((e) => 'ERR ' + e.message),
      app: { mode: s.mode, listening: s.listening, stt: s.stt, spoken: s.spokenIndex, playing: s.playing }
    };
  });
  console.log(JSON.stringify(r, null, 2));
  b.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
