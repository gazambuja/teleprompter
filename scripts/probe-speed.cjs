const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--no-default-browser-check'
    ]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 320, deviceScaleFactor: 1 });

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
      openTextFile: async () => null,
      saveTextFile: async () => true,
      setAlwaysOnTop: async () => {},
      setOpacity: async () => {},
      setBounds: async () => {},
      setIgnoreMouse: async () => {},
      getVersion: async () => '0.1.0'
    };
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));

  await page.evaluate(() => {
    window.__app.setMode('display');
  });
  await new Promise(r => setTimeout(r, 300));

  const setSpeedDirect = async (speedPx) => {
    const result = await page.evaluate((s) => {
      window.__app.update({ speed: s });
      const speedSlider = document.querySelector('input[type="range"]');
      return {
        stateSpeed: window.__app.state.settings.speed,
        sliderValue: speedSlider ? speedSlider.value : 'no-slider'
      };
    }, speedPx);
    console.log(`  → set ${speedPx}, state=${result.stateSpeed}, slider=${result.sliderValue}`);
    await new Promise(r => setTimeout(r, 150));
  };

  const probe = async (label) => {
    const samples = [];
    for (let i = 0; i < 8; i++) {
      const t = await page.evaluate(() => {
        const all = [...document.querySelectorAll('div')];
        const scrollables = all.filter(d => {
          const cs = getComputedStyle(d);
          return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && d.scrollHeight > d.clientHeight + 50;
        });
        if (!scrollables.length) return { scrollTop: 0, max: 0 };
        const sc = scrollables[0];
        return { scrollTop: sc.scrollTop, max: sc.scrollHeight - sc.clientHeight };
      });
      samples.push(t.scrollTop);
      await new Promise(r => setTimeout(r, 250));
    }
    const delta = samples[samples.length - 1] - samples[0];
    const totalSec = (samples.length - 1) * 0.25;
    const pxPerSec = delta / totalSec;
    console.log(`${label}: [${samples.join(',')}], delta=${delta}px, ${pxPerSec.toFixed(1)} px/s`);
  };

  await page.evaluate(() => window.__app.reset());
  await page.evaluate(() => window.__app.play());
  await new Promise(r => setTimeout(r, 200));
  await probe('default (60 px/s)');
  await page.evaluate(() => window.__app.pause());

  for (const s of [10, 20, 30, 40, 50, 60, 80, 100, 150, 200, 300]) {
    await setSpeedDirect(s);
    await page.evaluate(() => window.__app.reset());
    await page.evaluate(() => window.__app.play());
    await new Promise(r => setTimeout(r, 200));
    await probe(`speed=${s} px/s`);
    await page.evaluate(() => window.__app.pause());
    await new Promise(r => setTimeout(r, 100));
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
