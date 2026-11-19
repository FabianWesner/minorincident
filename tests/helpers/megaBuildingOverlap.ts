import { expect } from 'vitest';
import { emptyInput } from '../../src/input/InputFrame';
import { runLevel } from '../../tools/sim-runner/levels';

export async function megaBuildingOverlap(): Promise<void> {
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
