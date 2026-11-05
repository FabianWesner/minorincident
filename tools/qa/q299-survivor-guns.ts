/** Q-299/Q-304: armed survivor bodies (L5 followers carried into L6-L10) holding a pistol / rifle / shotgun, standing and
 * walking behind the courier, plus seated and resting armed survivors (Q-304).
 * SCENE_PORT=4898 E2E_PORT=4897 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/q299-survivor-guns.ts <outDir> [high|low] [weapon,...] [phase,...]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';

const out = process.argv[2] ?? 'test-results/q299';
const tier = (process.argv[3] ?? 'high') as 'high' | 'low';
const weapons = (process.argv[4] ?? 'pistol,rifle,hunting-rifle').split(',');
const phases = (process.argv[5] ?? 'idle,walk,sit,rest').split(',');
mkdirSync(out, { recursive: true });
const models = ['npc.civilian-woman-a', 'npc.civilian-woman-b.aftermath', 'npc.civilian-man-a.aftermath', 'npc.civilian-man-b.aftermath', 'npc.civilian-elderly', 'npc.marcus.aftermath'];
const rows: unknown[] = [];
const s = new SceneSession({ tier, backend: 'webgpu', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
try {
  await s.open();
  await s.page.evaluate('globalThis.__name = (fn) => fn');
  for (const weapon of weapons) for (const phase of phases) {
    const walk = phase === 'walk';
    const spec = {
      name: `q299-${weapon}-${phase}`, seed: 3, ground: 'sidewalk', size: 40, time: 'L1',
      props: phase === 'sit' ? models.map((_, i) => ({ id: `bench${i}`, asset: 'prop.bench', at: [(i - 2.5) * 1.6, 1.8], yaw: 180 })) : [],
      actors: [
        { id: 'courier', kind: 'courier', at: walk ? [-8, -1] : [0, -1.2], yaw: 0, look: { model: 'female' }, state: walk ? { run: [[-8, -1], [12, -1]] } : 'idle' },
        ...models.map((model, i) => ({ id: `s${i}`, kind: 'pedestrian', at: walk ? [-9 - i * 1.2, 0.4 + (i % 2) * .8] : [(i - 2.5) * 1.6, 1.0], yaw: -90, look: { model }, state: 'idle' })),
      ],
      script: models.flatMap((_, i) => [
        ...(phase === 'sit' ? [{ frame: 1, actor: `s${i}`, do: { sit: `bench${i}`, seconds: 60 } }] : phase === 'rest' ? [{ frame: 1, actor: `s${i}`, do: { routine: 'rest' } }] : [{ frame: 1, actor: `s${i}`, do: { survivor: { slot: i % 5 } } }]),
        { frame: 2, actor: `s${i}`, do: { ally: { role: 'civilian', weapon } } },
      ]),
      camera: { mode: 'follow', actor: 'courier', zoom: 1 }, frames: 0,
    } as unknown as SceneSpec;
    await s.load(spec);
    await s.step(walk ? 150 : phase === 'sit' ? 300 : 90);
    for (const zoom of [1.5, 0.5]) {
      await s.page.evaluate(async z => {
        const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game, rig = game.view.view;
        rig.zoom(Math.log(z / rig.getState().targetZoom), true); await a.step(2);
      }, zoom);
      await s.ready();
      await s.page.screenshot({ path: `${out}/${tier}-${weapon}-${phase}-z${zoom}.jpg`, type: 'jpeg', quality: 82 });
    }
    rows.push({ tier, weapon, phase, errors: [...s.errors] });
    console.log(tier, weapon, phase, s.errors.length);
  }
} finally { writeFileSync(`${out}/rows-${tier}.json`, JSON.stringify(rows, null, 1)); await s.close(); stopServer(); }
