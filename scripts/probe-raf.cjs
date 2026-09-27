const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows'
    ]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });

  await page.evaluateOnNewDocument(() => {
    window.teleprompter = {
      getSettings: async () => ({
        speed: 60, width: 880, height: 280, fontSize: 48,
        fontFamily: 'newsreader', textColor: '#f5f1ea', highlightColor: '#e4b860',
        bgColor: '#0a0b0d', opacity: 1, alwaysOnTop: 'floating',
        showControls: false, scrollMode: 'pixel', mirror: false,
        fontWeight: 400, lineHeight: 1.5, letterSpacing: 0,
        countdown: 0, focusLineStyle: 'guide', clickThrough: false, bgOpacity: 100
      }),
      setSettings: async () => ({}),
      openTextFile: async () => null, saveTextFile: async () => true,
      setAlwaysOnTop: async () => {}, setOpacity: async () => {},
      setBounds: async () => {}, setIgnoreMouse: async () => {},
      getVersion: async () => '0.1.0'
    };
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));

  await page.evaluate(() => {
    window.__app.setMode('display');
  });
  await new Promise(r => setTimeout(r, 300));

  // Install a counter on the rAF
  await page.evaluate(() => {
    window.__raf_count = 0;
    window.__raf_times = [];
    const tick = (now) => {
      window.__raf_count += 1;
      window.__raf_times.push(now);
      if (window.__raf_times.length <= 200) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await new Promise(r => setTimeout(r, 2000));

  const result = await page.evaluate(() => {
    const times = window.__raf_times;
    const intervals = [];
    for (let i = 1; i < times.length; i++) {
      intervals.push(times[i] - times[i-1]);
    }
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const min = Math.min(...intervals);
    const max = Math.max(...intervals);
    return { count: window.__raf_count, avgMs: avg, minMs: min, maxMs: max, intervals: intervals.slice(0, 20) };
  });

  console.log('rAF count in 2s:', result.count);
  console.log('avg interval:', result.avgMs.toFixed(2), 'ms');
  console.log('min interval:', result.minMs.toFixed(2), 'ms');
  console.log('max interval:', result.maxMs.toFixed(2), 'ms');
  console.log('first 20 intervals:', result.intervals.map(n => n.toFixed(1)).join(', '));
  console.log('effective fps:', (1000 / result.avgMs).toFixed(1));

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
