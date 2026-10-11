import { describe, expect, test } from 'vitest';
import { allyState, updateAlly } from '../../../src/sim/outbreak/Allies';
import { Perception } from '../../../src/sim/ai/Perception';
import { l3 } from '../../../src/data/l3';
import { loadL3 } from '../../../tools/sim-runner/l3Bots';
import { npcWorld, teleport } from './helpers';

describe('armed ally close hearing and self-defence @E21', () => {
  test.each(['officer', 'soldier', 'firefighter', 'civilian'] as const)('%s hears an infected behind at 1.8 m and attacks within 0.5 s; a wall blocks hearing', async role => {
    const w = await npcWorld();
    try {
      const id = w.npcs!.civilians.spawn('officer', { x: 0, z: 0 }), e = w.entities.get(id)!;
      const zid = w.infected!.spawn('infected.runner', { x: -1.8, z: 0 }), z = w.entities.get(zid)!;
      e.transform.yaw = 0;
      e.civilian!.ally = { ...allyState(role, { x: 0, z: 0 }, true), engaged: false, ...(role !== 'firefighter' ? { gun: { ...l3.officers.gun } } : {}) };
      const hearing = w.infected!.hearing;
      expect(hearing).toBeInstanceOf(Perception);
      hearing.los.register({ id: 'wall', source: 'building', active: true, shape: { kind: 'aabb', min: { x: -1, z: -2 }, max: { x: -.8, z: 2 } } });
      const sees = (a: { x: number; z: number }, b: { x: number; z: number }) => hearing.lineOfSight(a, b);
      for (let i = 0; i < 30; i++) { w.tick++; updateAlly(w, e, sees); }
      expect(e.civilian!.ally.targetId).toBe(0);
      expect(e.transform.yaw).toBe(0);
      hearing.los.unregister('wall');
      const start = w.tick;
      let first = -1;
      const off = w.events.on('ally.attack', event => { if (event.type === 'ally.attack' && event.sourceId === id && first < 0) first = event.tick; });
      w.tick++; updateAlly(w, e, sees);
      expect(e.civilian!.ally.targetId).toBe(zid);
      expect(Math.abs(e.transform.yaw)).toBeCloseTo(Math.PI);
      for (let i = 1; i < 30; i++) { w.tick++; updateAlly(w, e, sees); }
      off();
      expect(first - start).toBeGreaterThanOrEqual(0);
      expect(first - start).toBeLessThanOrEqual(30);
      expect(z.health.current).toBeLessThan(z.health.max);
    } finally { w.dispose(); }
  });
  test('a grabbed L3 officer shoves before the bite completes, even away from the courier', async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      const e = w.entities.get(m.state.l3!.officerIds[0])!;
      const at = { x: e.transform.x - .8, z: e.transform.z };
      const zid = w.infected!.spawn('infected.runner', at), z = w.entities.get(zid)!;
      const start = w.tick;
      w.npcs!.civilians.outbreak!.grab(e, z);
      expect(e.civilian!.state).toBe('grabbed');
      for (let i = 0; i < 24; i++) w.update();
      const attacks = w.events.events().filter(event => event.type === 'ally.attack' && event.sourceId === e.id && event.targetId === zid);
      expect(attacks.some(event => event.tick - start <= 24)).toBe(true);
      expect(e.infection).toBeUndefined();
      expect(e.civilian!.state).not.toBe('grabbed');
      expect(w.events.events().some(event => event.type === 'civilian.saved' && event.id === e.id)).toBe(true);
    } finally { w.dispose(); }
  }, 120_000);

  test('L3 regroup orders preserve the pending self-defence shot beyond the follow band', async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      m.completeObjective('armory'); m.completeObjective('defend');
      m.state.l3!.pending = []; m.state.l3!.waves = []; m.state.l3!.populated = [true, true, true];
      teleport(w, -105, 0);
      const e = w.entities.get(m.state.l3!.squad[0].id)!;
      Object.assign(e.transform, { x: -115, z: 0 }); w.spatial.set(e.id, -115, 0);
      const zid = w.infected!.spawn('infected.runner', { x: -116.8, z: 0 });
      const start = w.tick;
      for (let i = 0; i < 24; i++) w.update();
      expect(w.events.events().some(event => event.type === 'ally.attack' && event.sourceId === e.id && event.targetId === zid && event.tick - start <= 24)).toBe(true);
      expect(e.transform.x).toBeGreaterThan(-115);
    } finally { w.dispose(); }
  }, 120_000);

  test('a rescued station straggler can still retreat across the district', async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      m.completeObjective('armory'); m.completeObjective('defend');
      m.state.l3!.pending = []; m.state.l3!.waves = []; m.state.l3!.populated = [true, true, true];
      // The courier has moved on after the old 15-second gate timeout, while a rescued officer is still inside.
      w.tick += 16 * 60;
      teleport(w, 139, 0);
      const e = w.entities.get(m.state.l3!.squad[9].id)!;
      Object.assign(e.transform, { x: -143.5404, z: -21.415 }); w.spatial.set(e.id, e.transform.x, e.transform.z);
      for (let i = 0; i < 300; i++) w.update();
      expect(m.state.l3!.gatesClosedAt).toBe(0);
      expect(e.transform.x).toBeGreaterThan(-138);
    } finally { w.dispose(); }
  }, 120_000);
});
