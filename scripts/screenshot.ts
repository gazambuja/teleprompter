import { app, BrowserWindow } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

const __dirname = new URL('.', import.meta.url).pathname;

async function main() {
  await app.whenReady();
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  });

  await win.loadFile(join(__dirname, '../renderer/index.html'));
  await new Promise((r) => setTimeout(r, 1500));

  const editorImg = await win.webContents.capturePage();
  await fs.writeFile(join(__dirname, '../../screenshot-editor.png'), editorImg.toPNG());

  // Switch to display mode by setting localStorage state and clicking AIR
  await win.webContents.executeJavaScript(`(async () => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim().toUpperCase().startsWith('AIR') || b.textContent.trim().toUpperCase() === 'AIR');
    if (btn) btn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 1200));

  // Press Space a few times to start the scroll
  await win.webContents.executeJavaScript(`(async () => {
    const evt = new KeyboardEvent('keydown', { key: ' ', code: 'Space' });
    window.dispatchEvent(evt);
    await new Promise(r => setTimeout(r, 500));
  })()`);

  // Now scroll a bit
  await win.webContents.executeJavaScript(`(async () => {
    const scrollers = document.querySelectorAll('.no-scrollbar');
    const sc = scrollers[0];
    if (sc) sc.scrollTop = 320;
    await new Promise(r => setTimeout(r, 300));
  })()`);

  const displayImg = await win.webContents.capturePage();
  await fs.writeFile(join(__dirname, '../../screenshot-display.png'), displayImg.toPNG());

  await app.quit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
