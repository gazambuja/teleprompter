import { app, net, protocol } from 'electron';
import { promises as fs, createWriteStream, createReadStream } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pipeline } from 'node:stream/promises';
import * as tar from 'tar';
import unzipper from 'unzipper';
import { IPC } from '../shared/ipc';
import type { SttLang } from '../shared/stt';
import { ipcMain } from 'electron';

interface ModelSpec {
  zipUrl: string;
  dirName: string; // top-level dir inside the zip
  tarName: string; // cached re-pack in userData/stt-model
}

const MODELS: Record<SttLang, ModelSpec> = {
  es: {
    zipUrl: 'https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip',
    dirName: 'vosk-model-small-es-0.42',
    tarName: 'model-es.tar.gz'
  },
  en: {
    zipUrl: 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip',
    dirName: 'vosk-model-small-en-us-0.15',
    tarName: 'model-en.tar.gz'
  }
};

function specFor(lang: unknown): SttLang {
  if (lang === 'es' || lang === 'en') return lang;
  throw new Error(`Unsupported STT language: ${String(lang)}`);
}

// The Vosk worker is a blob: worker that fetch()es the model; it can't read file://,
// so the model is served over a privileged custom scheme. The URL is also the key of
// Vosk's IndexedDB extraction cache — bump it when the model changes.
export const MODEL_SCHEME = 'tpmodel';
const servedUrl = (lang: SttLang): string => `${MODEL_SCHEME}://models/${MODELS[lang].dirName}.tar.gz`;

/** Must run before app 'ready'. */
export function registerSttScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MODEL_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
    }
  ]);
}

function registerSttProtocol(): void {
  protocol.handle(MODEL_SCHEME, async (req) => {
    const name = new URL(req.url).pathname.replace(/^\//, '');
    const lang = (Object.keys(MODELS) as SttLang[]).find((l) => `${MODELS[l].dirName}.tar.gz` === name);
    if (!lang || !(await modelReady(lang))) return new Response('model not downloaded', { status: 404 });
    const { size } = await fs.stat(modelTarPath(lang));
    const file = await net.fetch(pathToFileURL(modelTarPath(lang)).toString());
    return new Response(file.body, {
      headers: {
        'content-type': 'application/gzip',
        'content-length': String(size),
        'access-control-allow-origin': '*'
      }
    });
  });
}

const downloads = new Map<SttLang, AbortController>();

function modelDir(): string {
  return join(app.getPath('userData'), 'stt-model');
}

function modelTarPath(lang: SttLang): string {
  return join(modelDir(), MODELS[lang].tarName);
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

async function modelReady(lang: SttLang): Promise<boolean> {
  return exists(modelTarPath(lang));
}

async function downloadFile(
  url: string,
  dest: string,
  signal: AbortSignal,
  onProgress?: (bytes: number, total: number) => void
): Promise<void> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const total = parseInt(res.headers.get('content-length') || '0', 10);
  const body = res.body;
  if (!body) throw new Error('no body');

  const ws = createWriteStream(dest);
  let downloaded = 0;
  const reader = body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      downloaded += value.byteLength;
      ws.write(Buffer.from(value));
      if (onProgress && total) onProgress(downloaded, total);
    }
  } finally {
    reader.releaseLock();
    ws.end();
  }
  await new Promise<void>((resolve) => ws.on('finish', () => resolve()));
  ws.on('error', () => {});
}

async function prepareModel(lang: SttLang, onProgress: (stage: string, pct: number) => void): Promise<void> {
  if (await modelReady(lang)) {
    onProgress('cached', 1);
    return;
  }
  const spec = MODELS[lang];
  await ensureDir(modelDir());
  const zipPath = join(modelDir(), `model-${lang}.zip`);
  const extractDir = join(modelDir(), `_extract-${lang}`);

  onProgress('downloading', 0);
  const controller = new AbortController();
  downloads.set(lang, controller);
  try {
    await downloadFile(spec.zipUrl, zipPath, controller.signal, (bytes, total) => {
      onProgress('downloading', total ? bytes / total : 0);
    });
  } finally {
    downloads.delete(lang);
  }

  onProgress('extracting', 0.05);
  await fs.mkdir(extractDir, { recursive: true });
  await pipeline(createReadStream(zipPath), unzipper.Extract({ path: extractDir }));
  await fs.unlink(zipPath);

  onProgress('packaging', 0.7);
  await tar.create({ gzip: true, file: modelTarPath(lang), cwd: extractDir, portable: true }, [spec.dirName]);
  await fs.rm(extractDir, { recursive: true, force: true });

  onProgress('ready', 1);
}

export function registerSttIpc(): void {
  registerSttProtocol();

  ipcMain.handle(IPC.sttModelStatus, async (_e, rawLang: unknown) => {
    const lang = specFor(rawLang);
    const ready = await modelReady(lang);
    return { ready, url: ready ? servedUrl(lang) : null };
  });

  ipcMain.handle(IPC.sttModelPrepare, async (event, rawLang: unknown) => {
    try {
      const lang = specFor(rawLang);
      const send = (stage: string, pct: number) => {
        event.sender.send(IPC.sttModelPrepare + ':progress', { lang, stage, pct });
      };
      await prepareModel(lang, send);
      return { ok: true, url: servedUrl(lang) };
    } catch (e: any) {
      return { ok: false, error: e.message ?? String(e) };
    }
  });

  ipcMain.handle(IPC.sttModelCancel, async () => {
    for (const c of downloads.values()) c.abort();
    return true;
  });
}
