/** L5-01: real start approach and controlled production shotgun transactions.
 * Only the damage arena disables AI; it does not qualify difficulty. */
import { writeFileSync } from 'node:fs';
import { loadLevel } from '../../sim-runner/levels';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { emptyInput } from '../../../src/input/InputFrame';
import { provenance, type Tier } from './probe';

export async function shotgunStart(tier: Tier) {
  const world = await loadLevel('L5', 1, undefined, 0, { quality: tier });
  try {
    const player = world.entities.get(1)!;
    const item = [...world.entities.iterate()].find(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === 'weapon.shotgun');
    if (!item) throw new Error('Missing initial shotgun');
    const at = { ...item.transform }, initial = { ...player.transform };
    const shelf = 'actionId' in item.pickup! && item.pickup!.surfaceY !== undefined;
    const starts = Math.hypot(initial.x - at.x, initial.z - at.z);
    const collections: { tick: number; distance: number; motion: number; interact: boolean }[] = [];
    world.events.on('pickup.collected', event => {
      if (event.type === 'pickup.collected' && 'actionId' in event && event.actionId === 'weapon.shotgun') collections.push({ tick: world.tick,
        distance: Math.hypot(player.transform.x - at.x, player.transform.z - at.z), motion: player.motion?.speed ?? 0, interact: world.inputFrame.interact });
    });
    for (let tick = 0; tick < 180 && !collections.length; tick++) {
      const dx = at.x - player.transform.x, dz = at.z - player.transform.z, length = Math.hypot(dx, dz) || 1;
      world.applyInput({ ...emptyInput(), move: { x: dx / length, z: dz / length } }, 'keyboard'); world.update();
    }
    const owned = [...world.combat!.runner.loadout.state.LEFT.rack, ...world.combat!.runner.loadout.state.RIGHT.rack].some(slot => slot.id === 'weapon.shotgun');
    const movedMetres = Math.hypot(player.transform.x - initial.x, player.transform.z - initial.z);
    return { tier, initial, at, starts, shelf, collections, movedMetres, owned, pass: starts <= 3 && owned && movedMetres > 0 && collections.length === 1 && collections[0].distance <= (shelf ? 2.2 : 1.5) && !collections[0].interact };
  } finally { world.dispose(); }
}
export async function shotgunDamage(tier: Tier, archetype: 'infected.runner' | 'infected.alpha') {
  const world = new SimWorld(); await world.init();
  try {
    world.loadScenario('horde-arena', 1); world.scenario = 'L5'; world.infected!.director.setTier(tier);
    const player = world.entities.get(1)!;
    const id = world.infected!.spawn(archetype, { x: 2, z: 0 }, { state: 'idle', yaw: Math.PI });
    const target = world.entities.get(id)!;
    if (archetype === 'infected.runner') target.health.current = target.health.max = 60;
    const initialHp = target.health.current;
    world.infected!.update = () => {};
    world.combat!.setLoadout(['weapon.shotgun'], ['weapon.kick']);
    const shots: { tick: number; hp: number }[] = [], hits: { tick: number; amount: number; hp: number }[] = [];
    world.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1 && e.actionId === 'weapon.shotgun') shots.push({ tick: e.tick, hp: target.health.current }); });
    world.events.on('combat.hit', e => { if (e.type === 'combat.hit' && e.targetId === id && e.amount > 0) hits.push({ tick: e.tick, amount: e.amount, hp: target.health.current }); });
    let firstActionStarted: number | null = null;
    for (let tick = 0; tick < 90 && target.health.current > 0; tick++) {
      const dx = target.transform.x - player.transform.x, dz = target.transform.z - player.transform.z, length = Math.hypot(dx, dz) || 1;
      world.applyInput({ ...emptyInput(), aimSource: 'keyboard', aim: { x: dx / length, z: dz / length }, aimPoint: { x: target.transform.x, z: target.transform.z }, left: { down: tick === 0, held: true, up: false } }, 'keyboard'); world.update();
      firstActionStarted ??= player.survivor?.attack?.started ?? null;
    }
    const seconds = firstActionStarted === null ? Infinity : (world.tick - firstActionStarted) / 60;
    return { tier, archetype, initialHp, endHp: target.health.current, firstActionStarted, incapacitatedAt: world.tick, shots, hits, seconds, isolatedAI: true,
      pass: target.health.current <= 0 && shots.length === (archetype === 'infected.runner' ? 1 : 2) && (archetype === 'infected.runner' || seconds <= .6) };
  } finally { world.dispose(); }
}
if (process.argv[1]?.endsWith('fix53-shotgun.ts')) {
  const rows = [];
  for (const tier of ['low', 'high'] as const) rows.push({ tier, start: await shotgunStart(tier), regular: await shotgunDamage(tier, 'infected.runner'), alpha: await shotgunDamage(tier, 'infected.alpha') });
  const report = { ...provenance(), method: 'Unmodified L5 start, moving native input with E/mouse released; isolated production damage with native Alpha HP and ordinary held shotgun input at2m.', rows };
  writeFileSync('docs/reports/fix53-b/L5-01.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(rows));
}
