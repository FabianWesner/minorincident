import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, readSpec, stopServer, writeJson } from './session';

/** Replay an explicit ordered batch in one browser, retaining console, pixels and resource state.
 * Run under tools/e2e-lock.sh. --revision reads historical specs without changing the checkout. */
const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(`--${name}`); return i < 0 ? undefined : args[i + 1]; };
const files = args.filter((arg, i) => arg.endsWith('.json') && !args[i - 1]?.startsWith('--'));
if (!files.length) throw new Error('Supply ordered scene JSON paths; optional --revision SHA --repeat 3 --out DIR');
const repeat = Number(flag('repeat') ?? 3), interval = Number(flag('interval') ?? 12);
if (!Number.isInteger(repeat) || repeat < 1 || !Number.isInteger(interval) || interval < 1) throw new Error('repeat and interval must be positive integers');
const revision = flag('revision');
const specs = files.map(file => revision ? JSON.parse(execFileSync('git', ['show', `${revision}:${file}`], { encoding: 'utf8' })) as SceneSpec : readSpec(resolve(file)));
const out = resolve(flag('out') ?? 'test-results/black-viewport');
mkdirSync(out, { recursive: true });
const session = new SceneSession();
const consoleLog: { type: string; text: string }[] = [];
const samples: unknown[] = [];
let blackFrames = 0;
let failure: string | null = null;
try {
  await session.open();
  session.page.on('console', message => consoleLog.push({ type: message.type(), text: message.text() }));
  session.page.on('pageerror', error => consoleLog.push({ type: 'pageerror', text: error.message }));
  for (let run = 1; run <= repeat; run++) {
    for (const [index, spec] of specs.entries()) {
      await session.load(spec);
      const cells: { frame: number; jpeg: Buffer }[] = [];
      const frames = spec.frames ?? 240;
      const stops = [...new Set([0, frames, ...Array.from({ length: Math.floor(frames / interval) }, (_, i) => (i + 1) * interval)])].sort((a, b) => a - b);
      let previous = 0;
      for (const frame of stops) {
        if (frame > previous) await session.step(frame - previous);
        previous = frame;
        await session.ready();
        // Canvas-only pixels exclude any menu/HUD; readiness presents the real pipeline.
        const png = await session.page.locator('canvas').first().screenshot({ type: 'png' });
        const image = PNG.sync.read(png);
        let lit = 0, total = 0, maximum = 0;
        for (let i = 0; i < image.data.length; i += 4) {
          const value = Math.max(image.data[i], image.data[i + 1], image.data[i + 2]);
          if (value > 8) lit++;
          total += value; maximum = Math.max(maximum, value);
        }
        const pixels = image.width * image.height, black = lit === 0;
        if (black) { blackFrames++; writeFileSync(`${out}/black-${run}-${index}-${frame}.png`, png); }
        const diagnostics = await session.page.evaluate(() => window.__SCENE__!.renderDiagnostics());
        samples.push({ run, file: files[index], frame, pixels: { maximum, meanMaxChannel: total / pixels, litFraction: lit / pixels, black }, diagnostics });
        cells.push({ frame, jpeg: await session.page.screenshot({ type: 'jpeg', quality: 72 }) });
      }
      await session.makeSheet(cells, `${out}/run-${run}-${index}-${spec.name ?? 'scene'}.jpg`);
      writeJson(`${out}/diagnostics.json`, { revision, files, repeat, interval, blackFrames, consoleLog, consoleErrors: session.errors, samples });
      console.log(JSON.stringify({ run, scene: spec.name, blackFrames, consoleErrors: session.errors.length }));
    }
  }
  if (blackFrames || session.errors.length) process.exitCode = 1;
} catch (error) {
  failure = String(error); process.exitCode = 1; console.error(error);
} finally {
  writeJson(`${out}/diagnostics.json`, { revision, files, repeat, interval, blackFrames, failure, consoleLog, consoleErrors: session.errors, samples });
  await session.close(); stopServer();
}
