/** vqa59: L7 reference run with the native `complete` bot (perfect launcher aim) on the batch-59 source, to separate game from driver.
 * Reports the follower roster (following/dead/turned/boarded) every 10 s of sim time.
 *   SCENE_PORT=3359 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/qa/vqa59-l7-bot.ts [low|high] [seed] */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const tier = (process.argv[2] ?? 'low') as 'low' | 'high', seed = Number(process.argv[3] ?? 1);
const out = 'test-results/vqa59/l7-bot'; mkdirSync(out, { recursive: true });
const s = new SceneSession({ tier, backend: 'webgpu', viewport: { width: 1280, height: 720 } });
try {
  await s.open(); await s.page.evaluate('window.__name = f => f');
  const rows = await s.page.evaluate(async ({ tier, seed }) => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game; a.settings.set({ quality: tier });
    await a.loadLevel('L7', { seed, progression: 'L7-default' } as never); a.missions.begin(); a.pause(); a.bot.start('complete');
    const rows: unknown[] = [];
    for (let i = 0; i < 360; i++) {
      await a.step(60);
      const w = g.world as unknown as { tick: number; l7Encounters?: { state: { roster: { status: string }[] } }; l7Departure?: { state: { boarded: number[] } } };
      const roster = w.l7Encounters?.state.roster ?? [];
      const count = (k: string) => roster.filter(r => r.status === k).length;
      const row = { t: Math.round(w.tick / 60), states: Object.fromEntries([...new Set(roster.map(r => r.status))].map(k => [k, count(k)])), boarded: w.l7Departure?.state.boarded.length ?? 0 };
      if (i % 10 === 0) rows.push(row);
      if ((a.missions.state() as { complete?: boolean } | undefined)?.complete || (row.boarded > 0 && i % 10 === 0 && rows.length > 2 && JSON.stringify(rows.at(-1)) === JSON.stringify(rows.at(-2)))) { rows.push(row); break; }
    }
    return rows;
  }, { tier, seed });
  writeFileSync(`${out}/${tier}-s${seed}.json`, JSON.stringify(rows, null, 1)); console.log(JSON.stringify(rows));
  await s.page.screenshot({ path: `${out}/${tier}-s${seed}-end.jpg`, type: 'jpeg', quality: 85 });
} finally { await s.close(); stopServer(); }
