/** Q-292: a pressing crowd of turned L7 survivors (man-b/woman-b aftermath bodies) around a standing courier at night,
 * game camera on the courier; 8 frames 0.25 s apart per zoom. Per-figure clip/torso pitch for the tracked ids.
 * SCENE_PORT=4894 E2E_PORT=4893 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/q292-crowd.ts <outDir> [low|high] [zoom,...]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

const out = process.argv[2] ?? 'test-results/q292-crowd';
const tier = (process.argv[3] ?? 'low') as 'low' | 'high';
const zooms = (process.argv[4] ?? '1,1.5').split(',').map(Number);
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
const s = new SceneSession({ tier, backend: 'webgpu', viewport: { width: 800, height: 600 }, deviceScaleFactor: 2 });
try {
  await s.open();
  for (const zoom of zooms) {
    const crowd = (id: string, model: string, at: [number, number]) => ({ id, kind: 'pedestrian', look: { model }, at, count: 10, spread: 2.5, state: { infect: { instant: true } } });
    const spec = {
      name: 'q292-crowd', seed: 6, ground: 'asphalt', size: 50, time: 'night', trace: true,
      actors: [
        { id: 'courier', kind: 'courier', at: [0, 0], yaw: 180, state: 'idle' },
        crowd('m', 'npc.civilian-man-b.aftermath', [-9, 2]), crowd('w', 'npc.civilian-woman-b.aftermath', [-9, -3]),
      ],
      camera: { mode: 'follow', actor: 'courier', zoom }, frames: 0,
    } as unknown as SceneSpec;
    await s.load(spec);
    await s.step(60);
    for (let k = 0; k < 12; k++) {
      await s.step(15); await s.ready();
      await s.page.screenshot({ path: `${out}/crowd-${tier}-z${zoom}-${k}.jpg`, type: 'jpeg', quality: 80 });
    }
    const m = await s.metrics() as { actors?: Record<string, { lod?: unknown; track?: { frame: number; clip?: string; torsoPitchDeg?: number; speed?: number }[] }> };
    for (const [id, a] of Object.entries(m.actors ?? {})) if (id !== 'courier') {
      const t = (a.track ?? []).filter(f => f.frame > 60 && f.torsoPitchDeg !== undefined);
      const worst = t.reduce((w, f) => (f.torsoPitchDeg! > (w?.torsoPitchDeg ?? -1e9) ? f : w), undefined as undefined | (typeof t)[number]);
      rows.push({ tier, zoom, id, lod: a.lod, maxPitch: worst ? Math.round(worst.torsoPitchDeg!) : null, at: worst ? [worst.frame, worst.clip, worst.speed] : null,
        over60: t.filter(f => f.torsoPitchDeg! > 60).length, frames: t.length });
    }
    console.log(tier, zoom);
  }
} finally { writeFileSync(`${out}/rows-${tier}.json`, JSON.stringify(rows, null, 1)); await s.close(); stopServer(); }
