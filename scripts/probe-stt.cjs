const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 600, deviceScaleFactor: 1 });

  await page.evaluateOnNewDocument(() => {
    window.teleprompter = {
      getSettings: async () => ({
        speed: 60, width: 880, height: 280, fontSize: 48,
        fontFamily: 'newsreader', textColor: '#f5f1ea', highlightColor: '#e4b860',
        bgColor: '#0a0b0d', opacity: 1, alwaysOnTop: 'floating',
        showControls: false, scrollMode: 'pixel', mirror: false,
        fontWeight: 400, lineHeight: 1.5, letterSpacing: 0,
        countdown: 0, focusLineStyle: 'guide', clickThrough: false, bgOpacity: 65
      }),
      setSettings: async () => ({}),
      openTextFile: async () => null, saveTextFile: async () => true,
      setAlwaysOnTop: async () => {}, setOpacity: async () => {},
      setBounds: async () => {}, setIgnoreMouse: async () => {},
      getVersion: async () => '0.1.0',
      sttModelStatus: async () => ({ ready: false, path: null }),
      sttModelPrepare: async () => ({ ok: false, error: 'no internet in headless' }),
      sttModelCancel: async () => {}
    };
  });

  page.on('console', m => console.log('[console]', m.type(), m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: require('path').join(__dirname, '..', 'shot-stt-editor.png') });
  console.log('shot-stt-editor.png saved');

  await page.evaluate(() => window.__app.setMode('display'));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: require('path').join(__dirname, '..', 'shot-stt-display.png') });
  console.log('shot-stt-display.png saved');

  // Find the Listen button
  const listenBtn = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find(x => x.title && x.title.toLowerCase().includes('listen'));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2, title: b.title };
  });
  console.log('Listen button:', listenBtn);

  if (listenBtn) {
    await page.mouse.click(listenBtn.x, listenBtn.y);
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: require('path').join(__dirname, '..', 'shot-stt-listening.png') });
    console.log('shot-stt-listening.png saved');
  }

  // Verify __app exposes listen methods
  const appState = await page.evaluate(() => {
    const app = window.__app;
    return {
      mode: app && app.state && app.state.mode,
      listening: app && app.state && app.state.listening,
      hasUpdate: typeof (app && app.update) === 'function'
    };
  });
  console.log('app state:', appState);

  // Verify Vosk loaded
  const voskStatus = await page.evaluate(() => ({
    hasVosk: typeof window.Vosk !== 'undefined'
  }));
  console.log('Vosk status:', voskStatus);

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
