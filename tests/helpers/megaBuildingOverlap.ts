import { expect } from 'vitest';
import { emptyInput } from '../../src/input/InputFrame';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { installMegaPursuit } from '../../src/sim/ai/MegaPursuit';
import { runLevel } from '../../tools/sim-runner/levels';

async function detour(wall: boolean): Promise<{ ticks: number; path: number; side: number }> {
  const world = new SimWorld();
  try {
    await world.init(); world.loadScenario('horde-arena'); world.combat!.damage.god = true;
    const player = world.entities.get(1)!;
    Object.assign(player.transform, { x: 10, z: 0 });
    world.physics.playerBody!.setTranslation({ x: 10, y: player.transform.y, z: 0 }, true);
    if (wall) {
      const box = { x: 0, z: 0, y: 1, halfX: 1, halfZ: 4, halfY: 1 };
      world.solids.setBarrier('mega-test-house', box);
      world.events.emit({ type: 'world.blocker.changed', tick: world.tick, id: 987656, blocked: true, wall: box });
    }
    const pursuit = installMegaPursuit(world, { introduceTick: null, spawn: { x: -10, z: 0 }, resident: () => true,
      route: { nodes: [{ id: 'a', x: -10, z: 0 }, { id: 'b', x: 10, z: 0 }], links: [['a', 'b']], pressure: { from: 'a', trailM: 1 } } });
    const mega = world.entities.get(pursuit.introduce())!;
    let ticks = 0, path = 0, side = 0, previous = { x: mega.transform.x, z: mega.transform.z };
    while (ticks < 1800 && Math.hypot(mega.transform.x - 10, mega.transform.z) > 4) {
      world.update(); ticks++;
      path += Math.hypot(mega.transform.x - previous.x, mega.transform.z - previous.z);
      previous = { x: mega.transform.x, z: mega.transform.z }; side = Math.max(side, Math.abs(mega.transform.z));
      expect(world.solids.clear(mega.transform, mega.combat!.radius, mega.id, false, 1e-8), `detour tick ${ticks}`).toBe(true);
    }
    expect(ticks, 'Mega reaches the far side').toBeLessThan(1800);
    return { ticks, path, side };
  } finally { world.dispose(); }
}

export async function megaBuildingOverlap(): Promise<void> {
  const clear = await detour(false), blocked = await detour(true);
  expect(blocked.ticks, 'wall costs real time').toBeGreaterThan(clear.ticks + 60);
  expect(blocked.path, 'wall requires a longer path').toBeGreaterThan(clear.path + 2);
  expect(blocked.side, 'Mega goes around the wall').toBeGreaterThan(5);
  for (const level of ['L9', 'L10'] as const) for (const passive of [false, true]) {
    const intersections: string[] = [];
    let samples = 0, stationaryTicks = 0;
    const report = await runLevel(level, 'complete', 1, level === 'L10' ? 3600 : 900, 'auto', undefined, undefined, 0, {
      passive,
      beforeBegin: world => {
        if (passive && level === 'L10') {
          const apply = world.applyInput.bind(world);
          world.applyInput = (frame, scheme) => {
            const stationary = !!world.missions?.state.states['charge-active'];
            if (stationary) stationaryTicks++;
            apply(stationary ? emptyInput() : frame, scheme);
          };
        }
        const update = world.update.bind(world);
        world.update = (...args: Parameters<typeof world.update>) => {
          update(...args);
          const id = level === 'L9' ? world.missions?.l9?.driving.state.megaId : world.megaPursuit?.state.id;
          const mega = id ? world.entities.get(id) : undefined;
          if (!mega || (mega.hidden || mega.infected?.hidden) && !world.infected!.director.inFrame(mega.transform)) return;
          samples++;
          if (!world.solids.clear(mega.transform, mega.combat!.radius, mega.id, false, 1e-8)) {
            intersections.push(`tick=${world.tick} x=${mega.transform.x.toFixed(2)} z=${mega.transform.z.toFixed(2)} mode=${world.megaPursuit?.state.mode ?? 'sighting'} hidden=${!!mega.infected?.hidden} contacts=${JSON.stringify(world.solids.staticContacts(mega.transform, mega.combat!.radius, mega.id))}`);
          }
        };
      },
    });
    expect(report.outcome).not.toBe('load-error');
    if (!passive) expect(report.completed, `${level}: ${report.outcome}`).toBe(true);
    expect(samples).toBeGreaterThan(0);
    if (passive && level === 'L10') expect(stationaryTicks).toBeGreaterThan(60);
    expect(intersections.join('\n')).toBe('');
  }
}
