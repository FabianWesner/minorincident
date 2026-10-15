import { expect, test } from 'vitest';
import { forecourt } from '../fixtures/l1Forecourt';

test.each(['high', 'low'] as const)('PO #3/#4b @E19 %s: 28 living infected, bounded forecourt attackers and bike reachable within 20 s', async tier => {
  const { w, mission, bike } = await forecourt();
  try {
    w.npcs!.setQuality(tier);
    expect(mission.state.checkpoint).toBe('bat');
    expect(mission.state.steps.firestation.status).toBe('active');
    // Freeze population provenance, not enemy behaviour: all 28 retain normal perception, combat and movement.
    for (const e of [...w.infected!.active]) w.infected!.release(e);
    for (const e of w.entities.iterate()) if (e.civilian) e.hidden = true;
    mission.state.l1!.house = { door: 0, house: '', x: 0, z: 0, nx: 0, nz: 1, floor: [], sx: 0, sz: 0, route: [], ox: 0, oz: 0, next: 0, ids: [] };
    mission.state.l1!.streetGroups = [];
    const ids: number[] = [];
    for (let i = 0; i < 28; i++) {
      const cell = w.infected!.nav.nearestCell(10 + (i % 14) * 1.7, 30 + Math.floor(i / 14) * 1.8, .45);
      ids.push(w.infected!.spawn('infected.runner', { x: w.infected!.nav.x(cell), z: w.infected!.nav.z(cell) }, { state: 'chase' }));
    }
    let maxAttackers = 0;
    for (let i = 0; i < 20 * 60; i++) {
      w.update();
      const p = w.entities.get(1)!.transform;
      const attackers = w.infected!.active.filter(e => e.health.current > 0 && e.infected!.l1?.targetId === 1 && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 6).length;
      maxAttackers = Math.max(maxAttackers, attackers);
    }
    console.log('PO forecourt stationary 20 s', { maxAttackers, total: ids.filter(id => w.entities.get(id)!.health.current > 0).length });
    expect(maxAttackers).toBeLessThanOrEqual(3);
    const bench = w.props!.items.find(p => p.id === 'D-GROVE/prop.bench:1309')!;
    w.props!.place(bench, { p: [22.8, .3, 34.75], q: [Math.SQRT1_2, 0, 0, Math.SQRT1_2] });
    w.props!.updateNavigation();
    // Observe pressure safely, then escape with the PO's actual health and normal damage.
    w.entities.get(1)!.health.current = 90; w.combat!.damage.god = false;
    const begin = w.tick;
    for (let i = 0; i < 20 * 60 && !w.vehicles!.canInteract(); i++) {
      w.setInput({ moveTarget: { x: bike.transform.x, z: bike.transform.z } }); w.update();
    }
    expect(w.vehicles!.canInteract(), JSON.stringify(w.entities.get(1)!.transform)).toBe(true);
    expect(w.entities.get(1)!.transform.z, 'courier has crossed the fence opening onto the sidewalk').toBeLessThan(34.5);
    expect(w.tick - begin).toBeLessThanOrEqual(1200);
    expect(w.entities.get(1)!.health.current).toBeGreaterThan(0);
    expect(ids.filter(id => w.entities.get(id)!.health.current > 0)).toHaveLength(28);
    console.log('PO bike escape seconds', (w.tick - begin) / 60);
  } finally { w.dispose(); }
}, 120000);
