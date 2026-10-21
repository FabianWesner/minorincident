/** Profile the real device-input driver at the reported debug entry/zoom. */
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { runSession } from '../playtest/session';

const port = Number(process.env.SCENE_PORT ?? 4072), origin = `http://127.0.0.1:${port}`;
if (port === 3300) throw Error('Do not use the shared server');
let server: ChildProcess | undefined;
const up = async () => { try { return (await fetch(origin)).ok; } catch { return false; } };
try {
  if (!(await up())) {
    server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
    for (let i = 0; i < 120 && !(await up()); i++) await new Promise(r => setTimeout(r, 500));
    if (!(await up())) throw Error('Vite did not start');
  }
  const out = process.env.L10_OUT ?? 'test-results/fixes-13h-l10/playtest';
  await runSession({ origin, out, levels: ['L10'], entry: 'debug', quality: 'low', zoom: 1.5, heroine: 'female', profile: `${out}/profile`, levelMinutes: 20, sampleSeconds: Number(process.env.L10_SECONDS ?? 90), stopAfterLevel: false, tag: 'debug' });
} finally { server?.kill(); }
