import { SimWorld } from '../../../src/sim/world/SimWorld';
import { emptyInput } from '../../../src/input/InputFrame';
import { loadLevel } from '../../sim-runner/levels';
import type { Tier } from './probe';

async function approach(world: SimWorld, id: number) {
  const item = world.entities.get(id)!;
  const at = { ...item.transform }, player = world.entities.get(1)!;
  let distance: number | null = null, movingMetres = 0, collected = 0;
  const off = world.events.on('pickup.collected', event => {
    if (event.type !== 'pickup.collected' || ('pickupId' in event ? event.pickupId : event.id) !== id) return;
    collected++;
    distance ??= Math.hypot(player.transform.x - at.x, player.transform.z - at.z);
  });
  try {
    for (let tick = 0; tick < 120 && distance === null; tick++) {
      const before = { ...player.transform }, dx = at.x - before.x, dz = at.z - before.z;
      const length = Math.hypot(dx, dz);
      world.applyInput({ ...emptyInput(), move: length > 1e-6 ? { x: dx / length, z: dz / length } : { x: 1, z: 0 } }, 'keyboard');
      world.update();
      if (distance !== null) movingMetres = Math.hypot(player.transform.x - before.x, player.transform.z - before.z);
    }
  } finally { off(); world.clearInput(); }
  return { distance, collected, movingMetres, interact: false, mouseButtons: false };
}

/** Native moving input with E and clicks released. The headlamp is the authored
 * L6 entity; other cells isolate shared production pickup transaction paths. */
export async function pickupApproachFixture(tier: Tier) {
  const cells = [];
  for (const weapon of ['weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.army-mg', 'weapon.shotgun', 'weapon.rocket-launcher', 'weapon.rotary-minigun']) {
    for (const shelf of [false, true]) {
      const world = new SimWorld(); await world.init();
      try {
        world.loadScenario('horde-arena', 1); world.infected!.director.setTier(tier);
        const id = world.combat!.pickups.spawn(weapon, { x: 3.5, z: 0 }, false, { retain: true, interactTicks: 60, ...(shelf ? { surfaceY: .8 } : {}) });
        const sample = await approach(world, id);
        const loadout = world.combat!.runner.loadout.state;
        cells.push({ kind: weapon, shelf, ...sample, effect: [...loadout.LEFT.rack, ...loadout.RIGHT.rack].some(slot => slot.id === weapon) });
      } finally { world.dispose(); }
    }
  }
  {
    const world = new SimWorld(); await world.init();
    try {
      world.loadScenario('horde-arena', 1); world.infected!.director.setTier(tier);
      world.entities.get(1)!.health.current = 40;
      const id = world.pickups!.spawn('medkit', { x: 3.5, z: 0 });
      const sample = await approach(world, id);
      cells.push({ kind: 'medkit', shelf: false, ...sample, effect: world.entities.get(1)!.health.current > 40 });
    } finally { world.dispose(); }
  }
  const world = await loadLevel('L6', 1, undefined, 0, { quality: tier });
  try {
    const lamp = [...world.entities.iterate()].find(entity => entity.archetype === 'pickup.headlamp');
    if (!lamp) throw new Error('Authored L6 headlamp is missing');
    const sample = await approach(world, lamp.id);
    cells.push({ kind: 'headlamp', shelf: false, ...sample, effect: world.entities.get(1)!.inventory?.includes('headlamp') ?? false });
  } finally { world.dispose(); }
  return cells;
}

export function pickupApproachPass(cells: Awaited<ReturnType<typeof pickupApproachFixture>>) {
  return cells.length === 16 && cells.every(cell => cell.distance !== null && cell.distance <= (cell.shelf ? 2.2 : 1.5) + 1e-6 && cell.movingMetres > 0 && cell.collected === 1 && cell.effect && !cell.interact && !cell.mouseButtons);
}
