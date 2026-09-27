const puppeteer = require('puppeteer');

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

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
        speed: 80, width: 880, height: 280, fontSize: 48,
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

  page.on('console', m => {
    const t = m.text();
    if (t.includes('error') || t.includes('Vosk') || t.includes('fetch')) console.log('[browser]', t);
  });
  page.on('pageerror', e => console.log('[pageerror]', e.message));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 15000 });
  await delay(1500);

  console.log('=== STEP 1: Initial editor view ===');
  await page.screenshot({ path: require('path').join(__dirname, '..', 'stt-live-1-editor.png') });

  console.log('=== STEP 2: Switch to display ===');
  await page.evaluate(() => window.__app.setMode('display'));
  await delay(500);
  await page.screenshot({ path: require('path').join(__dirname, '..', 'stt-live-2-display-empty.png') });

  console.log('=== STEP 3: Simulate user has spoken the first 8 words ===');
  await page.evaluate(() => window.__app.setSpokenIndex(8));
  await delay(400);
  await page.screenshot({ path: require('path').join(__dirname, '..', 'stt-live-3-spoken-8.png') });

  console.log('=== STEP 4: User ahead (spoken=22, scroll=0) → speed up ===');
  await page.evaluate(() => window.__app.setSpokenIndex(22));
  await page.evaluate(() => {
    // advance scroll a bit so we can see adaptive speed effect
    const scrollers = document.querySelectorAll('div');
    for (const d of scrollers) {
      const cs = getComputedStyle(d);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && d.scrollHeight > d.clientHeight + 50) {
        d.scrollTop = 80;
        return;
      }
    }
  });
  await delay(600);
  const speedAhead = await page.evaluate(() => window.__app.state ? window.__app.state : null);
  console.log('  state with spoken=22, scroll~80:', JSON.stringify({ mode: speedAhead?.mode }));
  await page.screenshot({ path: require('path').join(__dirname, '..', 'stt-live-4-ahead.png') });

  console.log('=== STEP 5: Scroll advances to catch up ===');
  // manually push scroll to where user was, simulating adaptive speed catching up
  await page.evaluate(() => {
    const scrollers = document.querySelectorAll('div');
    for (const d of scrollers) {
      const cs = getComputedStyle(d);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && d.scrollHeight > d.clientHeight + 50) {
        d.scrollTop = 320;
        return;
      }
    }
  });
  await delay(400);
  await page.screenshot({ path: require('path').join(__dirname, '..', 'stt-live-5-caughtup.png') });

  console.log('=== STEP 6: Now user behind (spoken=22, scroll much further) ===');
  await page.evaluate(() => {
    const scrollers = document.querySelectorAll('div');
    for (const d of scrollers) {
      const cs = getComputedStyle(d);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && d.scrollHeight > d.clientHeight + 50) {
        d.scrollTop = 600;
        return;
      }
    }
  });
  await delay(500);
  await page.screenshot({ path: require('path').join(__dirname, '..', 'stt-live-6-behind.png') });

  console.log('=== STEP 7: Listen button enabled check ===');
  const listenBtn = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find(x => x.title && x.title.toLowerCase().includes('listen'));
    return b ? { title: b.title, disabled: b.disabled, classes: b.className.slice(0, 80) } : null;
  });
  console.log('  Listen button:', JSON.stringify(listenBtn));

  console.log('=== STEP 8: Click Listen (will try real Vosk init via fake stream) ===');
  // Listen is gated on mode === 'display' — already there
  // Clicking triggers model load (skipped — already ready), then getUserMedia (fake stream ok)
  if (listenBtn) {
    await page.mouse.click(1120, 23);
    await delay(2000);
  }

  const listeningAfter = await page.evaluate(() => {
    const leds = [...document.querySelectorAll('span')].filter(s => {
      const bg = getComputedStyle(s).backgroundColor;
      return bg.includes('125, 211, 192') || bg.includes('228, 184, 96');
    });
    return leds.map(l => ({ bg: getComputedStyle(l).backgroundColor, opacity: getComputedStyle(l).opacity }));
  });
  console.log('  LED indicators:', JSON.stringify(listeningAfter));
  await page.screenshot({ path: require('path').join(__dirname, '..', 'stt-live-7-listening-active.png') });

  console.log('=== STEP 9: Simulate Vosk recognition results while playing ===');
  // Inject recognition matches as if Vosk emitted them
  await page.evaluate(() => {
    const phrases = [
      'Welcome to your teleprompter',
      'This is a tool designed for',
      'presenters speakers and content creators who',
      'need to read a script while looking at the camera',
      'There are three lines visible at any moment'
    ];
    let i = 0;
    const emit = () => {
      const text = phrases[i];
      if (!text) return;
      window.__app.setSpokenIndex(window.__app.state ? (window.__app.state.text || '').toLowerCase().split(/\s+/).findIndex(w => w === '') + (text.split(' ').length - 1) : 0);
      // Easier: just increment spokenIndex by word count
      i++;
      setTimeout(emit, 1200);
    };
    emit();
  });

  await delay(7000);
  await page.screenshot({ path: require('path').join(__dirname, '..', 'stt-live-8-after-recognitions.png') });

  console.log('=== STEP 10: Inspect final state ===');
  const final = await page.evaluate(() => {
    const spokenP = [...document.querySelectorAll('p')].find(p =>
      getComputedStyle(p).color === 'rgb(125, 211, 192)'
    );
    return {
      spokenText: spokenP ? spokenP.textContent.slice(0, 80) + '...' : null,
      spokenRect: spokenP ? spokenP.getBoundingClientRect() : null
    };
  });
  console.log('  final:', JSON.stringify(final));

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
