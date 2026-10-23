// Run under BROWSER_POOL=off sh tools/e2e-lock.sh node --import tsx <this file> <origin> <out> <baseline|fixed>.
// Fixture setup restores the reported approach before the ordinary driver takes control.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import { launchProfile } from '../../../../tools/browser-pool/client.ts';
import { preset } from '../../../../src/sim/progression/Campaign.ts';

const [origin, destination, variant] = process.argv.slice(2);
assert.ok(origin && destination && ['baseline', 'fixed'].includes(variant));
assert.equal(new URL(origin).port, '4441');
assert.equal(process.env.MI_E2E_LOCK_HELD, '1', 'Use tools/e2e-lock.sh');
assert.equal(process.env.BROWSER_POOL, 'off', 'This diagnostic intercepts its owned persistent context');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const out = resolve(destination), profile = join(out, 'profile');
mkdirSync(out, { recursive: true });
const resume = JSON.parse(gunzipSync(readFileSync(new URL('./resume.json.gz', import.meta.url))));

// Seed the actual Continue menu with a normal L5 campaign save.
const context = await launchProfile(profile, { headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'], viewport: { width: 1280, height: 720 } });
try {
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto(`${origin}/?testApi=1&scenelab=1&quality=low&audio=muted`);
  await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
  await page.evaluate(async save => { await window.__SS__.ready; window.__SS__.campaign.restore(save); window.__SS__.campaign.save(); }, preset('L5-default'));
} finally { await context.close(); }

let driver = join(root, 'tools/playtest/session.ts');
if (variant === 'baseline') {
  const snapshot = mkdtempSync(join(tmpdir(), 'l5-baseline-'));
  mkdirSync(join(snapshot, 'tools'));
  cpSync(join(root, 'tools/playtest'), join(snapshot, 'tools/playtest'), { recursive: true });
  for (const name of ['session', 'eyes']) writeFileSync(join(snapshot, `tools/playtest/${name}.ts`), execFileSync('git', ['show', `2a65f61a4:tools/playtest/${name}.ts`], { cwd: root }));
  for (const name of ['src', 'node_modules']) symlinkSync(join(root, name), join(snapshot, name));
  symlinkSync(join(root, 'tools/browser-pool'), join(snapshot, 'tools/browser-pool'));
  writeFileSync(join(snapshot, 'package.json'), '{"type":"module"}');
  driver = join(snapshot, 'tools/playtest/session.ts');
}
const launch = chromium.launchPersistentContext.bind(chromium);
chromium.launchPersistentContext = async (...args) => {
  const context = await launch(...args);
  await context.addInitScript(saved => {
    window.__name = f => f;
    let applied = false;
    const restore = () => {
      const game = window.__SCENE__?.game;
      if (!applied && game?.world.scenario === 'L5' && game.world.missions?.state.phase === 'playing' && !game.loading && !game.clock.paused && game.world.tick >= 10) {
        applied = true;
        game.world.tick = saved.current.tick;
        game.world.missions.loadResume(saved);
        game.world.clearInput();
        game.view.update(1);
      }
      if (!applied) requestAnimationFrame(restore);
    };
    requestAnimationFrame(restore);
  }, resume);
  return context;
};
process.env.PLAYTEST_BACKEND = 'webgpu';
const { runSession } = await import(pathToFileURL(driver).href);
const result = await runSession({ origin, out, levels: ['L5'], quality: 'low', zoom: 1.5, heroine: 'female', entry: 'continue', profile, levelMinutes: 10, stopAfterLevel: true, tag: 'position-L5', noSkip: true });
assert.equal(result.runs[0]?.steps[0]?.id, 'look', 'The saved search approach must be restored before driver input');
console.log(JSON.stringify({ variant, runs: result.runs, issues: result.issues }));
process.exitCode = result.runs.every(run => run.finished && !run.skipped.length) && !result.issues.some(issue => issue.severity === 'P0' || issue.severity === 'P1') ? 0 : 1;
