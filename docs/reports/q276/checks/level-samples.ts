// runSession owns a shared launchProfile browser context.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runSession } from '../../../../tools/playtest/session';

const quality = process.argv[2] as 'high' | 'low';
assert.ok(['high', 'low'].includes(quality));
const origin = 'http://127.0.0.1:4861', root = resolve(`test-results/q276/level-samples-${quality}`);
mkdirSync(root, { recursive: true });
const server = await fetch(origin).then(r => r.ok).catch(() => false) ? null : spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4861', '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const levels = process.argv[3]?.split(',') ?? ['L1', 'L4', 'L10'];
const rows: any[] = process.argv[3] ? JSON.parse(readFileSync(`${root}/summary.json`, 'utf8')).filter((r: any) => !levels.includes(r.level)) : [];
try {
  for (let i = 0; i < 100; i++) { if (await fetch(origin).then(r => r.ok).catch(() => false)) break; await new Promise(r => setTimeout(r, 100)); }
  for (const level of levels) {
    const out = `${root}/${level}`, profile = `${out}/profile`, tag = `${level}-${quality}`;
    mkdirSync(out, { recursive: true });
    try {
      const result = await runSession({ origin, out, levels: [level], quality, zoom: 1.5, heroine: 'female', entry: level === 'L1' ? 'new' : 'debug', profile, levelMinutes: 4, stopAfterLevel: true, tag, noSkip: true, sampleSeconds: 132 });
      const audit = JSON.parse(readFileSync(`${out}/${tag}-audit.json`, 'utf8')) as { level: string; begin: boolean; loadToBeginMs: number | null; loadToFirstFrameMs: number | null }[];
      const frames = JSON.parse(readFileSync(`${out}/${tag}-frames.json`, 'utf8')) as { level: string; playMs: number }[];
      const run = result.runs.find(r => r.level === level)!;
      const begin = audit.find(r => r.level === level && r.begin && r.loadToBeginMs !== null);
      const ready = audit.find(r => r.level === level && r.loadToFirstFrameMs != null);
      const lateFrames = frames.filter(r => r.level === level && r.playMs > 200);
      const row = { level, quality, loadToBeginMs: begin?.loadToBeginMs ?? null, loadToFirstFrameMs: ready?.loadToFirstFrameMs ?? null, run, issues: result.issues, framesOver200: lateFrames };
      rows.push(row); writeFileSync(`${root}/summary.json`, JSON.stringify(rows, null, 2));
      console.log(JSON.stringify(row));
      assert.ok(level === 'L10' ? ready && ready.loadToFirstFrameMs! > 0 : begin && begin.loadToBeginMs! > 0, `${level}: measured load to Begin`);
      assert.ok(run.simSeconds >= 120, `${level}: two minutes of active play (${run.simSeconds})`);
      assert.deepEqual(lateFrames, []);
      assert.deepEqual(result.issues.filter(i => /console-error|page-error|hitch/.test(i.kind)), []);
    } finally { rmSync(profile, { recursive: true, force: true }); }
  }
} finally { server?.kill(); }
