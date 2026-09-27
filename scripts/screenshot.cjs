const { app, BrowserWindow } = require('electron');
const { promises: fs } = require('node:fs');
const { join } = require('node:path');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu-compositing');

async function main() {
  await app.whenReady();
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '..', 'out', 'preload', 'index.mjs'),
      sandbox: false,
      contextIsolation: true,
      offscreen: false
    }
  });

  await win.loadFile(join(__dirname, '..', 'out', 'renderer', 'index.html'));
  await new Promise((r) => setTimeout(r, 1500));
  console.log('loaded');

  const editorImg = await win.webContents.capturePage();
  await fs.writeFile(join(__dirname, '..', 'screenshot-editor.png'), editorImg.toPNG());
  console.log('editor.png saved');

  // Use the debug hook to skip countdown entirely
  await win.webContents.executeJavaScript(`(() => {
    window.__app.setMode('display');
    window.__app.reset();
    window.__app.play();
  })()`);
  await new Promise((r) => setTimeout(r, 500));

  // Advance scroll for an interesting mid-read frame
  await win.webContents.executeJavaScript(`(() => {
    window.__app.reset();
    const scrollers = document.querySelectorAll('div');
    for (const d of scrollers) {
      const cs = getComputedStyle(d);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && d.scrollHeight > d.clientHeight + 100) {
        d.scrollTop = 360;
        return;
      }
    }
  })()`);
  await new Promise((r) => setTimeout(r, 400));

  const displayImg = await win.webContents.capturePage();
  await fs.writeFile(join(__dirname, '..', 'screenshot-display.png'), displayImg.toPNG());
  console.log('display.png saved');

  await app.quit();
  setTimeout(() => process.exit(0), 200);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
