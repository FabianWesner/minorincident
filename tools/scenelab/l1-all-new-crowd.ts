/** A fixed 30-figure L1 street: every migrated model and dog coat in one production renderer. */
import { resolve } from 'node:path';
import { SceneSession, stopServer, writeJson } from './session';
import type { SceneSpec, ActorSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';

export const pedestrians = ['npc.civilian-man-a', 'npc.civilian-man-b', 'npc.civilian-woman-a', 'npc.civilian-woman-b', 'npc.civilian-elderly'];
export const named = ['npc.depot-clerk', 'npc.lab-tech-a', 'npc.lab-tech-b', 'npc.lab-guard', 'npc.firefighter-alive'];
export const crowd30: SceneSpec = {
  name: 'l1-all-new-crowd30', ground: 'district', time: 'L1', size: 100,
  layout: { district: 'D-GROVE', bbox: [[-61, -13], [-30, 13]] },
  actors: Array.from({ length: 30 }, (_, i): ActorSpec => {
    const at: [number, number] = [-55 + i % 10 * 2, -3 + Math.floor(i / 10) * 3];
    if (i === 0) return { id: 'courier', kind: 'courier', at, yaw: -45 };
    if (i === 1) return { id: 'corgi', kind: 'corgi', at, yaw: -45 };
    if (i < 5) return { id: `pet-${i - 2}`, kind: 'animal', pet: 'dog', at, yaw: -45 };
    if (i < 8) return { id: `infected-dog-${i - 5}`, kind: 'infected', archetype: 'infected.dog', look: { model: ['inf.dog', 'inf.dog.black', 'inf.dog.cream'][i - 5] }, at, yaw: -45, state: 'idle' };
    const model = i < 13 ? named[i - 8] : pedestrians[(i - 13) % 5];
    return { id: `ped-${i}`, kind: 'pedestrian', at, yaw: -45, look: { model, accessories: i >= 13 && i % 4 === 1 ? ['acc.hat-bucket-hat'] : [], handProp: model === 'npc.civilian-elderly' ? 'cane' : null }, state: 'idle' };
  }),
  camera: { mode: 'game', target: [-46, 0], zoom: 1.5 },
};
export async function loadCrowd(session: SceneSession) {
  await session.load(crowd30);
  const metrics = await session.metrics();
  await session.page.evaluate(actors => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    for (let i = 0; i < 3; i++) {
      const e = game.world.entities.get(actors[`pet-${i}`].entity)!;
      e.civilian!.model = ['amb.dog', 'amb.dog.black', 'amb.dog.cream'][i];
      e.civilian!.variant = ['inf.dog', 'inf.dog.black', 'inf.dog.cream'][i];
    }
  }, metrics.actors);
  await session.step(1); await session.ready(); await session.step(1); await session.ready();
}
if (process.argv[1]?.endsWith('l1-all-new-crowd.ts')) {
  const out = resolve(process.env.CROWD_OUT ?? 'test-results/l1-all-new/crowd');
  const session = new SceneSession({ backend: 'webgl2', tier: 'low', viewport: { width: 1600, height: 900 }, query: { crowdProbe: 'full' } });
  try {
    await session.open();
    await session.page.addInitScript("window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
    await session.page.evaluate("window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
    await loadCrowd(session);
    await session.screenshot(resolve(out, 'crowd30.png'));
    writeJson(resolve(out, 'receipt.json'), { metrics: await session.metrics(), render: await session.page.evaluate(() => window.__SS__!.getState().render), errors: session.errors });
    if (session.errors.length) throw Error(session.errors.join('\n'));
  } finally { await session.close(); stopServer(); }
}
