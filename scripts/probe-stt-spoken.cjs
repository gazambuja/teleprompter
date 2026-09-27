const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 600, deviceScaleFactor: 1 });

  await page.evaluateOnNewDocument(() => {
    window.teleprompter = {
      getSettings: async () => ({
        speed: 60, width: 880, height: 280, fontSize: 48,
        fontFamily: 'newsreader', textColor: '#f5f1ea', highlightColor: '#e4b860',
        bgColor: '#0a0b0d', opacity: 1, alwaysOnTop: 'floating',
        showControls: true, scrollMode: 'pixel', mirror: false,
        fontWeight: 400, lineHeight: 1.5, letterSpacing: 0,
        countdown: 0, focusLineStyle: 'guide', clickThrough: false, bgOpacity: 100
      }),
      setSettings: async () => ({}),
      openTextFile: async () => null, saveTextFile: async () => true,
      setAlwaysOnTop: async () => {}, setOpacity: async () => {},
      setBounds: async () => {}, setIgnoreMouse: async () => {},
      getVersion: async () => '0.1.0',
      sttModelStatus: async () => ({ ready: true, path: '/dev/null' }),
      sttModelPrepare: async () => ({ ok: true, path: '/dev/null' }),
      sttModelCancel: async () => {}
    };
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));

  // Switch to display
  await page.evaluate(() => window.__app.setMode('display'));
  await new Promise(r => setTimeout(r, 400));

  // Simulate spokenIndex by directly manipulating the renderer state
  // Easiest: dispatch recognition events that match
  // For visual test, we just trigger the spoken overlay by setting state through the public path
  // We can set the script via __app.setText and inject matches by faking recognition

  // Inject a fake recognition by calling the recognizer event handler directly
  // We'll instead use a hack: scroll the teletprompter, then dispatch a partial recognition match
  // Since we can't simulate Vosk output easily, just take a screenshot showing the spoken layer is empty

  await page.screenshot({ path: require('path').join(__dirname, '..', 'shot-stt-display-fresh.png') });
  console.log('shot-stt-display-fresh.png saved (no spoken yet)');

  // Now simulate spokenIndex by triggering recognition events
  await page.evaluate(() => window.__app.setSpokenIndex(15));
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({ path: require('path').join(__dirname, '..', 'shot-stt-display-spoken.png') });
  console.log('shot-stt-display-spoken.png saved (spokenIndex=15)');

  // Debug: inspect the spoken layer DOM
  const spokenDebug = await page.evaluate(() => {
    const all = [...document.querySelectorAll('p')];
    const cyanP = all.find(p => {
      const cs = getComputedStyle(p);
      return cs.color.includes('125, 211, 192');
    });
    const mutedP = all.find(p => {
      const cs = getComputedStyle(p);
      return cs.color.includes('245, 241, 234');
    });
    const amberP = all.find(p => {
      const cs = getComputedStyle(p);
      return cs.color === 'rgb(228, 184, 96)';
    });
    const rect = (el) => el ? { x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height), z: getComputedStyle(el.parentElement.parentElement).zIndex } : null;
    return {
      found: !!cyanP,
      text: cyanP ? cyanP.textContent.slice(0, 100) : null,
      color: cyanP ? getComputedStyle(cyanP).color : null,
      rects: { cyan: rect(cyanP), muted: rect(mutedP), amber: rect(amberP) }
    };
  });
  console.log('Spoken layer debug:', JSON.stringify(spokenDebug, null, 2));

  // Also test with scroll position offset — spoken words should align with muted
  await page.evaluate(() => window.__app.reset());
  await page.evaluate(() => {
    const scrollers = document.querySelectorAll('div');
    for (const d of scrollers) {
      const cs = getComputedStyle(d);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && d.scrollHeight > d.clientHeight + 50) {
        d.scrollTop = 180;
        return;
      }
    }
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: require('path').join(__dirname, '..', 'shot-stt-spoken-scrolled.png') });
  console.log('shot-stt-spoken-scrolled.png saved (scrolled + spokenIndex=15)');

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
