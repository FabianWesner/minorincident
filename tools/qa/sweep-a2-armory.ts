/** Ordinary L3 input to the sole authored armory grant; retain actual location and inventory transition. */
import assert from 'node:assert/strict';
import { loadLevel } from '../sim-runner/levels';
import { LevelThreeBot } from '../../src/debug/bot/LevelThreeBot';
import { atomicJson } from './accept/report';
import { provenance } from './accept/probe';

const runs = [];
for (const tier of ['low', 'high'] as const) {
  const world = await loadLevel('L3', 1, undefined, 0, { quality: tier });
  try {
    const bot = new LevelThreeBot(world), anchor = world.missions!.def.anchors['l3-armory'];
    const racks = () => {
      const s = world.combat!.runner.loadout.state;
      return [...s.LEFT.rack, ...s.RIGHT.rack].map(r => r.id);
    };
    const initialRacks = racks(), initialPickups = [...world.entities.iterate()].filter(e => e.pickup).map(e => ({ id: e.id, at: { ...e.transform }, pickup: structuredClone(e.pickup) }));
    assert(!initialRacks.includes('weapon.handgun'));
    assert(initialPickups.every(p => !JSON.stringify(p.pickup).includes('weapon.handgun')));
    const grants: unknown[] = [], samples = [];
    world.events.on('pickup.collected', e => {
      if (e.type === 'pickup.collected' && 'actionId' in e && e.actionId === 'weapon.handgun') grants.push({ ...e, player: { ...world.entities.get(1)!.transform } });
    });
    for (let i = 0; i <= 40 * 60; i++) {
      const p = world.entities.get(1)!.transform, hasHandgun = racks().includes('weapon.handgun'), at = world.missions!.state.l3!.handgunAt;
      samples.push({ tick: world.tick, player: { ...p }, distance: Math.hypot(p.x - anchor.x, p.z - anchor.z), hasHandgun, handgunAt: at, armoryStatus: world.missions!.state.steps.armory.status });
      if (at) break;
      world.applyInput(bot.sample(), 'keyboard'); world.update();
    }
    const last = samples.at(-1)!;
    assert(last.handgunAt > 0 && last.handgunAt <= 2400 && last.hasHandgun && last.distance <= anchor.radius! && last.armoryStatus === 'completed');
    assert(samples.slice(0, -1).every(s => !s.hasHandgun));
    assert.equal(grants.length, 1);
    runs.push({ tier, protected: false, initialRacks, initialPickups, anchor, grants, samples });
  } finally { world.dispose(); }
}
atomicJson('docs/reports/sweep-a2/L3-01-armory-location.json', { ...provenance(), runs,
  method: 'Fresh ordinary mortal complete-bot keyboard InputFrames, no injection, relocation, objective skip or protection. No initial handgun in carried racks or loose pickups; actual handgun grant coincides with completed armory interaction inside its1.2m radius. Source LevelThreeCollapse.completed only calls takeHandgun for the armory step, whose interact trigger is anchored at l3-armory.' });
console.log(runs.map(r => ({ tier: r.tier, acquiredAt: r.samples.at(-1)!.handgunAt, distance: r.samples.at(-1)!.distance })));
