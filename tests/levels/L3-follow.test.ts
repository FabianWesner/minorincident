import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { emptyInput } from '../../src/input/InputFrame';
import { l3 } from '../../src/data/l3';
import { ArmyCheckpointBoom } from '../../src/sim/missions/ArmyCheckpointBoom';
import { missionControls } from '../../src/sim/missions/controls';
import { loadL3, followFrustum } from '../../tools/sim-runner/l3Bots';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import type { DistrictLayout, Placement } from '../../src/levels/districts/types';

describe('L3 squad and checkpoint', () => {
  test('@E21 army compound is walkable before the rendezvous and does not finish while the courier rests', async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      m.completeObjective('armory'); m.completeObjective('defend');
      const ring = m.def.anchors['l3-zone'], nav = w.infected!.nav;
      expect(ring.x).toBe(149);
      for (let i = 0; i < 8; i++) expect(nav.clear(ring.x + Math.cos(i * Math.PI / 4) * ring.radius, Math.sin(i * Math.PI / 4) * ring.radius, .35)).toBe(true);
      const path: number[] = [];
      expect(nav.path(nav.nearestCell(144, 0, .35), nav.nearestCell(ring.x, ring.z, .35), path, 1600)).toBe(true);
      missionControls(w).teleport('player', { x: 144, z: 0 });
      for (let i = 0; i < 300; i++) w.update();
      expect(m.state.phase).toBe('playing');
      expect(m.state.marker).toBe('l3-zone');
      expect(m.state.l3!.crossedAt).toBe(0);
      expect(w.infected!.active.filter(e => e.health.current > 0 && e.transform.x >= l3.map.zoneX)).toEqual([]);
    } finally { w.dispose(); }
  }, 120_000);
  for (const condition of ['stalled officer', 'dead officer', 'turning officer', 'occupied boom'] as const) test(`@E21 @E21-AC17 arrival finishes with ${condition}`, async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      m.completeObjective('armory'); m.completeObjective('defend');
      const s = m.state.l3!, api = missionControls(w);
      // Isolate arrival from combat. The real-input full-level test covers the journey and casualties.
      s.pending = []; s.waves = []; s.populated = [true, true, true];
      for (const e of w.infected!.active) { e.health.current = 0; e.infected!.recoverAt = -1; }
      for (const q of s.squad) api.teleport(q.id, { x: 144, z: 3 });
      const officer = w.entities.get(s.squad[0].id)!;
      if (condition === 'stalled officer') {
        api.teleport(officer.id, { x: 135, z: 3 });
        delete officer.civilian!.ally!.follow;
        officer.civilian!.ally!.hold = true;
        officer.civilian!.ally!.post = { x: 135, z: 3 };
      } else if (condition === 'dead officer') officer.health.current = 0;
      else if (condition === 'turning officer') w.npcs!.civilians.outbreak!.infect(officer, 1);
      else {
        const guard = w.entities.get(s.soldierIds[0])!;
        api.teleport(guard.id, { x: l3.finale.barrierX, z: 0 });
        guard.civilian!.ally!.post = { x: l3.finale.barrierX, z: 0 };
        guard.civilian!.ally!.hold = true;
      }
      api.teleport('player', { x: m.def.anchors['l3-zone'].x, z: 0 });
      for (let i = 0; i < 90 && m.state.phase === 'playing'; i++) w.update();
      expect(s.crossedAt).toBeGreaterThan(0);
      expect(m.state.phase).toBe('progression');
      expect(m.state.marker).toBeNull();
      if (condition === 'occupied boom') expect(s.barrierClosedAt ?? 0).toBe(0);
      expect(w.events.events().filter(e => e.type === 'level.completed')).toHaveLength(1);
    } finally { w.dispose(); }
  }, 120_000);
  test('closed checkpoint boom stops a walking courier and shared NPC navigation; opening restores the lane', async () => {
    const { world: w } = await loadL3(1);
    try {
      const p = w.entities.get(1)!, start = { x: l3.finale.barrierX - 2, y: p.transform.y, z: 0 };
      Object.assign(p.transform, start); w.physics.playerBody!.setTranslation(start, true); w.spatial.set(1, start.x, 0);
      const boom = new ArmyCheckpointBoom(w, l3.finale.barrierX); boom.set(true);
      for (let i = 0; i < 120; i++) { w.applyInput({ ...emptyInput(), move: { x: 1, z: 0 }, walk: true }, 'mouse-only'); w.update(); }
      expect(p.transform.x).toBeLessThan(l3.finale.barrierX);
      expect(w.infected!.nav.clear(l3.finale.barrierX, 0, .35)).toBe(false);
      boom.set(false);
      expect(w.infected!.nav.clear(l3.finale.barrierX, 0, .35)).toBe(true);
      for (let i = 0; i < 180; i++) { w.applyInput({ ...emptyInput(), move: { x: 1, z: 0 }, walk: true }, 'mouse-only'); w.update(); }
      expect(p.transform.x, JSON.stringify(p.transform)).toBeGreaterThan(l3.finale.barrierX + 1);
    } finally { w.dispose(); }
  }, 120_000);
  test('fallback recruits every living human officer, including the yard posts', async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      const living = m.state.l3!.officerIds.filter(id => { const e = w.entities.get(id)!; return e.health.current > 0 && !e.infection; });
      expect(living.length).toBeGreaterThan(l3.officers.squad.size);
      m.completeObjective('armory'); m.completeObjective('defend');
      expect(m.state.l3!.squad.map(q => q.id).sort()).toEqual([...living].sort());
      for (const id of living) expect(w.entities.get(id)!.civilian!.ally!.follow?.targetId).toBe(1);
    } finally { w.dispose(); }
  }, 120_000);
  test('all three routes have sidewalk med packs within 40 m and reachable from the street', async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      const nav = w.infected!.nav;
      const layout: DistrictLayout = JSON.parse(readFileSync('public/assets/layouts/D-CORRIDOR.layout.json', 'utf8'));
      expect(m.state.l3!.medkitIds).toHaveLength(28);
      for (const z of Object.values(l3.map.streets)) {
        const positions = l3.medkits.positions.slice(1).filter(p => Math.abs(p[1] - z) < 5).sort((a, b) => a[0] - b[0]);
        expect(positions).toHaveLength(9);
        expect(positions[0][0] - l3.map.corridor[0]).toBeLessThanOrEqual(40);
        for (let i = 1; i < positions.length; i++) expect(positions[i][0] - positions[i - 1][0]).toBeLessThanOrEqual(40);
        for (const [x, authoredZ] of positions) {
          const index = l3.medkits.positions.findIndex(p => p[0] === x && p[1] === authoredZ);
          const kit = w.entities.get(m.state.l3!.medkitIds[index])!.transform;
          // D-CORRIDOR: Boulevard is 7 m wide, the other roads 5 m; sidewalks are 2 m.
          const roadEdge = z === l3.map.streets.blvd ? 3.5 : 2.5;
          const location = JSON.stringify({ authored: [x, authoredZ], actual: [kit.x, kit.z] });
          expect(Math.abs(kit.z - z), location).toBeGreaterThan(roadEdge);
          expect(Math.abs(kit.z - z), location).toBeLessThan(roadEdge + 2);
          // Exported street/sidewalk surfaces are rectangles; include cross streets as well.
          const surfaces = layout.surfaces.filter(s => kit.x >= Math.min(...s.polygon.map(p => p[0])) && kit.x <= Math.max(...s.polygon.map(p => p[0])) && kit.z >= Math.min(...s.polygon.map(p => p[1])) && kit.z <= Math.max(...s.polygon.map(p => p[1])));
          expect(surfaces.some(s => s.surface === 'tile'), location).toBe(true);
          expect(surfaces.some(s => s.surface === 'asphalt'), location).toBe(false);
          expect(nav.clear(kit.x, kit.z, .3)).toBe(true);
          const path: number[] = [];
          expect(nav.path(nav.nearestCell(x, z, .3), nav.nearestCell(kit.x, kit.z, .3), path, 1600)).toBe(true);
        }
      }
    } finally { w.dispose(); }
  }, 120_000);
  test('boom waits for the last living officer; a dead officer cannot prevent closure', async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      const ids = [1, ...m.state.l3!.squadIds], boom = new ArmyCheckpointBoom(w, l3.finale.barrierX);
      ids.forEach(id => { w.entities.get(id)!.transform.x = 142; });
      const last = w.entities.get(ids.at(-1)!)!; last.transform.x = 136;
      expect(boom.ready(ids)).toBe(false);
      last.transform.x = 139; expect(boom.ready(ids)).toBe(true);
      last.transform.x = 136; last.health.current = 0; expect(boom.ready(ids)).toBe(true);
    } finally { w.dispose(); }
  }, 120_000);
  test('every closed army kit placement keeps the arm collider; only explicitly raised arms omit it', () => {
    const p: Placement = { id: 'checkpoint', assetId: 'kit.army-checkpoint', position: [0, 0, 0], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: '', visualAabb: { min: [-9, 0, -9], max: [9, 6, 9] } };
    const closed = placementColliders([p], []), open = placementColliders([{ ...p, boomOpen: true }], []);
    expect(closed.length - open.length).toBe(1);
    expect(closed.some(c => c.aabb.min[0] < -6 && c.aabb.max[0] > -6 && c.aabb.min[2] < 0 && c.aabb.max[2] > 0 && c.aabb.min[1] > 1)).toBe(true);
  });
  for (const street of ['commerce', 'blvd', 'oak'] as const) test(`living officers regroup on ${street} instead of being marked separated`, async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      m.completeObjective('armory'); m.completeObjective('defend');
      // Isolate shared follower steering; street crowds are covered by the real-input playthrough.
      m.state.l3!.pending = []; m.state.l3!.waves = []; m.state.l3!.populated = [true, true, true];
      const p = w.entities.get(1)!, z = l3.map.streets[street];
      const start = { x: -110, y: p.transform.y, z }; Object.assign(p.transform, start); w.physics.playerBody!.setTranslation(start, true);
      const squad = m.state.l3!.squad;
      squad.forEach((q, i) => { const e = w.entities.get(q.id)!; Object.assign(e.transform, { x: -115 - i, z: z + (i % 2 ? 1 : -1) * 1.5 }); });
      const still = new Map<number, { x: number; z: number; ticks: number }>();
      let stuckTicks = 0;
      for (let tick = 0; tick < 900; tick++) {
        followFrustum(w); w.applyInput({ ...emptyInput(), moveTarget: { x: -62, z }, navigation: true }, 'mouse-only'); w.update();
        for (const q of squad) {
          const e = w.entities.get(q.id)!, previous = still.get(q.id);
          const ticks = previous && Math.hypot(e.transform.x - previous.x, e.transform.z - previous.z) < .005 ? previous.ticks + 1 : 0;
          still.set(q.id, { x: e.transform.x, z: e.transform.z, ticks });
          if (Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) > 10) stuckTicks = Math.max(stuckTicks, ticks);
        }
      }
      expect(stuckTicks).toBeLessThanOrEqual(180);
      expect(p.transform.x).toBeGreaterThan(-64);
      expect(m.state.l3!.lost.filter(q => q.cause === 'separated')).toHaveLength(0);
      for (const q of squad) {
        const e = w.entities.get(q.id)!;
        expect(e.health.current).toBeGreaterThan(0);
        expect(Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z), JSON.stringify({ courier: p.transform, officer: e.transform })).toBeLessThanOrEqual(8);
        expect(Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z)).toBeGreaterThanOrEqual(3);
      }
    } finally { w.dispose(); }
  }, 120_000);
});
