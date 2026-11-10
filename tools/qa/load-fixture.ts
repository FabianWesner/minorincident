// Load QA checkpoint fixtures (tests/fixtures/saves/qa) in ONE headless browser and report where the player starts.
//   E2E_PORT=4885 sh tools/e2e-lock.sh npx tsx tools/qa/load-fixture.ts <origin> <fixture>... [--shot <dir>] [--quality low|high] [--keep]
// <origin> is a QA-hook build (npm run build:qa) served by `vite preview --port 4885`; <fixture> is a path or a label in tests/fixtures/saves/qa.
// Library use from a QA lane: import { loadFixtureInPage } and call it on a page that already opened `?testApi=1&scenelab=1`.
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { launchProfile } from '../browser-pool/client';
import { readFixture, type QaFixture } from './fixture-io';

/** Put the page into the fixture's state. campaign-save: restore + load the level (L9 crash record / L10 cureResume resume);
 * mission-resume: restore the campaign, load the level and resume the captured mission snapshot (L8 arenas). */
export async function loadFixtureInPage(page: import('playwright').Page, f: QaFixture): Promise<Record<string, unknown>> {
  return page.evaluate(async (fx: QaFixture) => {
    const a = window.__SS__!; await a.ready;
    a.campaign.restore(fx.campaign);
    await a.loadLevel(fx.level, fx.kind === 'mission-resume' ? { seed: 1, resume: fx.resume as never } : { seed: 1 });
    a.pause(); await a.step(60);
    const p = a.getEntity(1)!, m = a.missions.state()!;
    return { level: fx.level, player: { x: +p.transform.x.toFixed(1), z: +p.transform.z.toFixed(1), hp: Math.round(p.health.current) }, checkpoint: m.checkpoint, phase: m.phase, tick: a.tick() };
  }, f);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { shot: { type: 'string' }, quality: { type: 'string', default: 'low' }, keep: { type: 'boolean', default: false } } });
  const [origin, ...names] = positionals;
  const context = await launchProfile(mkdtempSync(`${tmpdir()}/fixture-profile-`), { headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], viewport: { width: 1280, height: 720 } });
  let failed = 0;
  try {
    for (const name of names) {
      const path = ['', '.json.gz', '.json.br'].map(ext => resolve(existsSync(name) ? name : `tests/fixtures/saves/qa/${name}${ext}`)).find(existsSync);
      if (!path) throw new Error(`fixture not found: ${name}`);
      const f = readFixture(path), page = await context.newPage();
      const errors: string[] = []; page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
      try {
        await page.goto(`${origin}/?testApi=1&scenelab=1&renderer=webgl&dpr=1&audio=muted&quality=${values.quality}`);
        await page.waitForFunction(() => !!window.__SS__, null, { timeout: 180000 });
        const state = await loadFixtureInPage(page, f);
        if (values.shot) { mkdirSync(values.shot, { recursive: true }); await page.screenshot({ path: `${values.shot}/${f.label}.jpg`, type: 'jpeg', quality: 70 }); }
        console.log(JSON.stringify({ fixture: f.label, ...state, pageErrors: errors, result: errors.length ? 'FAIL' : 'ok' }));
        if (errors.length) failed++;
      } catch (err) { failed++; console.log(JSON.stringify({ fixture: f.label, result: `FAIL ${String(err).slice(0, 300)}`, pageErrors: errors })); }
      finally { await page.close(); }
    }
  } finally { await context.close(); }
  process.exit(failed ? 1 : 0);
}
