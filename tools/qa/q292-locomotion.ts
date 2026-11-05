/** Q-284/Q-292 locomotion sweep: each infected look chasing a running courier, judged in motion (frame strips).
 * Entries: `infected.<archetype>` (CrowdView archetype body) or a model id (`npc.*` / `inf.*`): a pedestrian with that
 * body who turns instantly (CivilianCrowd keeps the look, as the L7 survivors-turned and L1 pedestrians do).
 * SCENE_PORT=4894 E2E_PORT=4893 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/q292-locomotion.ts <outDir> <high|low|all> <entry,...> [zoom,...]
 * Writes <outDir>/<tag>-<tier>-z<zoom>-<k>.jpg (8 frames, 0.25 s apart, follow camera on the infected) and rows-<tier>.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

const out = process.argv[2] ?? 'test-results/q292';
const tiers = (process.argv[3] && process.argv[3] !== 'all' ? [process.argv[3]] : ['high', 'low']) as ('high' | 'low')[];
const entries = (process.argv[4] ?? 'npc.civilian-man-b.aftermath').split(',');
const zooms = (process.argv[5] ?? '1,1.5').split(',').map(Number);
const time = process.env.Q292_TIME ?? 'night';
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
try {
  for (const tier of tiers) {
    const s = new SceneSession({ tier, backend: 'webgpu', viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
    try {
      await s.open();
      for (const entry of entries) {
        const archetype = entry.startsWith('infected.'), tag = entry.replace(/^(infected|npc|inf)\./, '');
        for (const zoom of zooms) {
          const spec = {
            name: `q292-${tag}`, seed: 5, ground: 'asphalt', size: 70, time, trace: true,
            actors: [
              { id: 'courier', kind: 'courier', at: [-12, 0], yaw: 0, state: { run: [[-12, 0], [30, 0]] } },
              archetype ? { id: 'z', kind: 'infected', archetype: entry, at: [-19, 0], yaw: 0, state: { chase: 'courier' } }
                : { id: 'z', kind: 'pedestrian', look: { model: entry }, at: [-19, 0], yaw: 0, state: { infect: { instant: true } } },
            ],
            camera: { mode: 'follow', actor: 'z', zoom }, frames: 0,
          } as unknown as SceneSpec;
          await s.load(spec);
          await s.step(45);
          for (let k = 0; k < 8; k++) {
            await s.step(15); await s.ready();
            await s.page.screenshot({ path: `${out}/${tag}-${tier}-z${zoom}-${k}.jpg`, type: 'jpeg', quality: 80 });
          }
          const m = await s.metrics() as unknown as { actors?: Record<string, { lod?: unknown; travelM?: number; state?: string; motion?: Record<string, unknown>; track?: { frame: number; clip?: string; torsoPitchDeg?: number; speed?: number }[] }> };
          const z = m.actors?.z;
          rows.push({ tier, entry, zoom, lod: z?.lod, state: z?.state, travelM: z?.travelM, motion: z?.motion,
            track: z?.track?.filter(f => f.frame % 5 === 0).map(f => [f.frame, f.clip, f.torsoPitchDeg === undefined ? null : Math.round(f.torsoPitchDeg), f.speed === undefined ? null : +f.speed.toFixed(2)]), errors: [...s.errors] });
          console.log(tier, entry, zoom, JSON.stringify(z?.lod), z?.travelM?.toFixed(1));
        }
      }
    } finally { await s.close(); }
  }
} finally { writeFileSync(`${out}/rows-${tiers.join('-')}.json`, JSON.stringify(rows, null, 1)); stopServer(); }
