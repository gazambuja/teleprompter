import { app, BrowserWindow, ipcMain, dialog, globalShortcut } from 'electron';
import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IPC } from '../shared/ipc';
import { DEFAULT_SETTINGS, type AppSettings } from '../shared/settings';
import { registerSttIpc, registerSttScheme } from './stt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Disable Chromium's SUID sandbox when the chrome-sandbox helper isn't root-owned
// (typical on Linux dev machines without root). Acceptable for a local-only app.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
}

registerSttScheme();

let mainWindow: BrowserWindow | null = null;
let currentSettings: AppSettings = DEFAULT_SETTINGS;

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json');

async function readSettings(): Promise<AppSettings> {
  try {
    const raw = await fs.readFile(settingsPath(), 'utf-8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function writeSettings(settings: AppSettings): Promise<void> {
  await fs.writeFile(settingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
}

// Persist current bounds back into settings (debounced from main thread).
let boundsTimer: NodeJS.Timeout | null = null;
function scheduleSaveBounds(): void {
  if (!mainWindow) return;
  if (boundsTimer) clearTimeout(boundsTimer);
  boundsTimer = setTimeout(() => {
    boundsTimer = null;
    if (!mainWindow) return;
    const b = mainWindow.getBounds();
    currentSettings = { ...currentSettings, x: b.x, y: b.y, width: b.width, height: b.height };
    writeSettings(currentSettings).catch(console.warn);
  }, 250);
}

async function flushBounds(): Promise<void> {
  if (boundsTimer) {
    clearTimeout(boundsTimer);
    boundsTimer = null;
  }
  if (!mainWindow) return;
  const b = mainWindow.getBounds();
  currentSettings = { ...currentSettings, x: b.x, y: b.y, width: b.width, height: b.height };
  await writeSettings(currentSettings);
}

function applyAlwaysOnTop(level: 'floating' | 'normal' | 'panel' | undefined): void {
  if (!mainWindow) return;
  // 'floating' is supported on all platforms and keeps the window above everything.
  // 'panel' is treated as floating for cross-platform parity; macOS also has
  // 'torn-off-menu' as a stronger level but it isn't supported on Win/Linux.
  // Undefined (unset) falls back to floating so the window is on top until the
  // user explicitly opts out via the first-launch prompt or Studio settings.
  const resolved: 'floating' | 'normal' | 'panel' = level ?? 'floating';
  mainWindow.setAlwaysOnTop(true, resolved === 'normal' ? 'normal' : 'floating');
}

async function promptForAlwaysOnTop(): Promise<'floating' | 'normal'> {
  // First-launch (or after reset-to-defaults) — ask whether to keep the window on top.
  // Native dialog so it's modal and survives even before the BrowserWindow is shown.
  const { response } = await dialog.showMessageBox({
    type: 'question',
    message: 'Enable Always on Top?',
    detail:
      'Keep the teleprompter above other windows while you present. ' +
      'You can change this later in Studio settings.',
    buttons: ['Stay on top', 'Normal window'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  });
  return response === 0 ? 'floating' : 'normal';
}

async function createWindow(): Promise<void> {
  currentSettings = await readSettings();

  // First-launch / post-reset: prompt for the always-on-top choice and persist it.
  if (currentSettings.alwaysOnTop === undefined) {
    currentSettings = {
      ...currentSettings,
      alwaysOnTop: await promptForAlwaysOnTop()
    };
    await writeSettings(currentSettings);
  }

  mainWindow = new BrowserWindow({
    x: currentSettings.x,
    y: currentSettings.y,
    width: currentSettings.width,
    height: currentSettings.height,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: true,
    minWidth: 320,
    minHeight: 80,
    fullscreenable: false,
    skipTaskbar: false,
    hasShadow: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    acceptFirstMouse: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Registered before loading: 'ready-to-show' can fire before loadURL() resolves, and a
  // listener attached afterwards never runs — the app then sits invisible. The timer is a
  // fallback for compositors (transparent frameless windows on Wayland) that never emit it.
  const showWindow = (why: string): void => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible()) return;
    mainWindow.show();
    applyAlwaysOnTop(currentSettings.alwaysOnTop);
    mainWindow.setOpacity(currentSettings.opacity);
    console.log(`[main] window shown (${why})`);
  };
  mainWindow.once('ready-to-show', () => showWindow('ready-to-show'));
  const showFallback = setTimeout(() => showWindow('fallback'), 3000);
  mainWindow.once('closed', () => clearTimeout(showFallback));
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[main] renderer failed to load ${url}: ${desc} (${code})`);
  });

  try {
    if (process.env['ELECTRON_RENDERER_URL']) {
      await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
      await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }
  } catch (e) {
    console.error('[main] renderer load failed', e);
  }

  mainWindow.on('move', scheduleSaveBounds);
  mainWindow.on('resize', scheduleSaveBounds);
  mainWindow.on('close', () => {
    flushBounds().catch(console.warn);
  });
}

function registerIpc(): void {
  ipcMain.handle(IPC.settingsGet, async () => currentSettings);

  ipcMain.handle(IPC.settingsSet, async (_e, settings: AppSettings) => {
    currentSettings = settings;
    await writeSettings(settings);
    if (mainWindow) {
      mainWindow.setOpacity(settings.opacity);
      applyAlwaysOnTop(settings.alwaysOnTop);
    }
    return settings;
  });

  ipcMain.handle(IPC.fileOpenText, async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Text', extensions: ['txt', 'md', 'markdown'] },
        { name: 'All files', extensions: ['*'] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const path = result.filePaths[0];
    const text = await fs.readFile(path, 'utf-8');
    return { path, text };
  });

  // With a path (the file that was opened or last saved) it writes in place; without one
  // (a new script, or Save As) it asks where. Returns the written path, or null if cancelled.
  ipcMain.handle(IPC.fileSaveText, async (_e, text: string, path?: string | null) => {
    if (!mainWindow) return null;
    let target = path ?? null;
    if (!target) {
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: 'script.txt',
        filters: [
          { name: 'Text', extensions: ['txt', 'md'] },
          { name: 'All files', extensions: ['*'] }
        ]
      });
      if (result.canceled || !result.filePath) return null;
      target = result.filePath;
    }
    await fs.writeFile(target, text, 'utf-8');
    return target;
  });

  ipcMain.handle(IPC.windowSetAlwaysOnTop, async (_e, level: 'floating' | 'normal' | 'panel') => {
    currentSettings.alwaysOnTop = level;
    applyAlwaysOnTop(level);
  });

  ipcMain.handle(IPC.windowSetOpacity, async (_e, opacity: number) => {
    currentSettings.opacity = opacity;
    mainWindow?.setOpacity(opacity);
  });

  ipcMain.handle(IPC.windowSetBounds, async (_e, opts: { x?: number; y?: number; width?: number; height?: number }) => {
    if (!mainWindow) return;
    const b = mainWindow.getBounds();
    mainWindow.setBounds({
      x: opts.x ?? b.x,
      y: opts.y ?? b.y,
      width: opts.width ?? b.width,
      height: opts.height ?? b.height
    });
  });

  ipcMain.handle(IPC.windowSetIgnoreMouse, async (_e, enabled: boolean) => {
    mainWindow?.setIgnoreMouseEvents(enabled, { forward: true });
  });

  ipcMain.handle(IPC.windowClose, async () => {
    mainWindow?.close();
  });

  ipcMain.handle(IPC.appGetVersion, async () => app.getVersion());
}

function registerGlobalShortcuts(): void {
  globalShortcut.register('CommandOrControl+Alt+Space', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) mainWindow.hide(); else mainWindow.show();
  });
  globalShortcut.register('CommandOrControl+Alt+P', () => {
    if (!mainWindow) return;
    mainWindow.setAlwaysOnTop(!mainWindow.isAlwaysOnTop());
  });
}

app.whenReady().then(async () => {
  await createWindow();
  registerIpc();
  registerSttIpc();
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
