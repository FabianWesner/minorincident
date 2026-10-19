import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { emptyInput } from '../../src/input/InputFrame';
import { l3, l3ArmyOffset } from '../../src/data/l3';
import { ArmyCheckpointBoom } from '../../src/sim/missions/ArmyCheckpointBoom';
import { respawnAtCheckpoint, respawnRule } from '../../src/sim/missions/Respawn';
import { missionControls } from '../../src/sim/missions/controls';
import { loadL3, followFrustum } from '../../tools/sim-runner/l3Bots';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import type { DistrictLayout, Placement } from '../../src/levels/districts/types';

describe('L3 squad and checkpoint', () => {
  test('@E21 retry relief also covers a street segment first populated after the respawn', async () => {
    const counts: { inside: number; outside: string[]; total: number }[] = [];
    for (const retry of [false, true]) {
      const { world: w, mission: m } = await loadL3(1);
      try {
        const s = m.state.l3!, api = missionControls(w);
        s.phase = 'corridor'; s.fallbackAt = 1; s.pending = []; s.waves = []; s.populated = [true, false, false];
        api.teleport('player', { x: -110, z: 0 }); m.checkpoint('fallback');
        if (retry) m.l3!.restore(0);
        w.update();
        expect(s.populated[1]).toBe(false);
        api.teleport('player', { x: -94, z: 0 }); w.update();
        expect(s.populated[1]).toBe(true);
        const entries = s.pending.filter(q => q.segment === 1);
        const inside = entries.filter(q => q.home.x > -130 && q.home.x < -20);
        counts.push({ inside: inside.length, outside: entries.filter(q => !inside.includes(q)).map(q => JSON.stringify({ door: q.door, home: q.home })), total: entries.length });
      } finally { w.dispose(); }
    }
    expect(counts[0].total).toBe(l3.density.groups[1].reduce((n, [, , size]) => n + size * l3.density.streetMultiplier, 0));
    expect(counts[0].inside).toBeGreaterThan(0);
    expect(counts[1].inside).toBe(Math.ceil(counts[0].inside * .5));
    expect(counts[1].outside).toEqual(counts[0].outside);
  }, 120_000);
  test('@E21 a distant failed encounter keeps retry pursuit relief until the courier approaches, retaining every actor', async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      const s = m.state.l3!, api = missionControls(w);
      s.phase = 'corridor'; s.fallbackAt = 1; s.pending = []; s.waves = []; s.populated = [true, true, true];
      api.teleport('player', { x: -110, z: 0 }); m.checkpoint('fallback');
      api.teleport('player', { x: -20, z: -23 }); w.events.emit({ type: 'player.died', tick: w.tick, id: 1 });
      api.teleport('player', { x: -110, z: 0 });
      const id = w.infected!.spawn('infected.runner', { x: -22, z: -28 }), actor = w.entities.get(id)!;
      m.l3!.restore(0); m.l3!.update();
      const health = actor.health.current;
      w.tick += (l3.mercy.respawnDelayS + 1) * 60; m.l3!.update();
      expect(w.entities.get(id)).toBe(actor); expect(actor.health.current).toBe(health);
      expect(actor.infected!.l1!.ignoreUntil).toBe(w.tick + l3.mercy.respawnDelayS * 60);
      const until = actor.infected!.l1!.ignoreUntil;
      api.teleport('player', { x: -49, z: -23 }); w.tick += 60; m.l3!.update();
      expect(actor.infected!.l1!.ignoreUntil).toBe(until); // The ordinary 20-second clock now runs out.
    } finally { w.dispose(); }
  }, 120_000);
  test('@E21 a returning body keeps its timer and the L3 pursuit delay when it gets up after respawn', async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      const s = m.state.l3!, api = missionControls(w);
      s.phase = 'corridor'; s.fallbackAt = 1; s.pending = []; s.waves = []; s.populated = [true, true, true];
      api.teleport('player', { x: -110, z: 0 });
      const id = w.infected!.spawn('infected.runner', { x: -106, z: 0 }), body = w.entities.get(id)!, player = w.entities.get(1)!;
      w.combat!.damage.apply({ attackId: 1, actionId: 'weapon.handgun', sourceId: 1, targetId: id, origin: { ...player.transform }, direction: { x: 1, z: 0 }, base: 10000, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
      const recovery = body.infected!.recoverAt;
      w.tick = recovery - 300; // The checkpoint captured a body that gets up after the default four-second delay expires.
      respawnAtCheckpoint(w, player.transform, false);
      const ignoreUntil = w.tick + l3.mercy.respawnDelayS * 60;
      expect(player.transform.x).toBe(-110); expect(player.transform.z).toBe(0);
      expect(player.survivor!.invulnerableUntil).toBe(w.tick + respawnRule.graceS * 60);
      expect(body.infected!.recoverAt).toBe(recovery);
      expect(body.infected!.l1!.ignoreUntil).toBe(ignoreUntil);
      for (let i = 0; i < 301; i++) w.update();
      expect(w.entities.get(id)).toBe(body); expect(body.health.current).toBe(body.health.max);
      expect(body.infected!.l1!.ignoreUntil).toBe(ignoreUntil); expect(ignoreUntil).toBeGreaterThan(w.tick);
    } finally { w.dispose(); }
  }, 120_000);
  test('@E21 second-retry relief thins the living crowd while retaining each downed body and recovery slot', async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      const s = m.state.l3!, api = missionControls(w), ai = w.infected!;
      s.phase = 'corridor'; s.fallbackAt = 1; s.pending = []; s.waves = []; s.populated = [true, true, true];
      api.teleport('player', { x: -110, z: 0 });
      const fresh = Array.from({ length: 6 }, (_, i) => ai.spawn('infected.runner', { x: -96 + i, z: 0 }));
      const id = ai.spawn('infected.runner', { x: -89, z: 0 }), body = w.entities.get(id)!;
      w.combat!.damage.apply({ attackId: 1, actionId: 'weapon.handgun', sourceId: 1, targetId: id, origin: { ...w.entities.get(1)!.transform }, direction: { x: 1, z: 0 }, base: 10000, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
      const recovery = body.infected!.recoverAt;
      expect(recovery).toBeGreaterThan(w.tick);
      m.l3!.restore(0); m.l3!.restore(0); w.update();
      expect(fresh.filter(id => w.entities.get(id))).toHaveLength(3);
      expect(w.entities.get(id)).toBe(body); expect(body.health.current).toBe(0);
      expect(body.infected!.recoverAt).toBe(recovery); expect(ai.active).toContain(body);
      expect(ai.director.count).toBeGreaterThanOrEqual(4);
    } finally { w.dispose(); }
  }, 120_000);
  test('@E21 @E21-AC17 fatal bites at the infected cap retain a dead officer without blocking rescue or allied fire', async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      const s = m.state.l3!, api = missionControls(w), x = l3.finale.barrierX;
      const victim = w.entities.get(s.officerIds[0])!, shooter = w.entities.get(s.officerIds[1])!;
      api.teleport(victim.id, { x, z: 0 }); api.teleport(shooter.id, { x: x + 3, z: 0 });
      const id = w.infected!.spawn('infected.runner', { x: x - 4, z: 0 }), target = w.entities.get(id)!;
      w.infected!.director.levelCap = w.infected!.director.count;
      expect(w.combat!.query.alliedShotClear(shooter, target, w.tick)).toBe(false);
      w.events.emit({ type: 'outbreak.bite', tick: w.tick, sourceId: id, targetId: victim.id, position: { ...victim.transform }, turns: false });
      expect(victim.civilian!.state).toBe('finished'); expect(victim.health.current).toBe(0);
      expect(w.entities.get(victim.id)).toBe(victim);
      expect(new ArmyCheckpointBoom(w, x).ready([victim.id])).toBe(true);
      expect(w.combat!.query.alliedShotClear(shooter, target, w.tick)).toBe(true);
    } finally { w.dispose(); }
  }, 120_000);
  test('@E21 @E21-AC17 HMG post can fire down the approach and into the resting compound', async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      const gunner = w.entities.get(m.state.l3!.soldierIds.at(-1)!)!;
      expect(gunner.civilian!.ally!.weapon).toBe('hmg');
      for (const x of [l3.map.zoneX - 6, l3.map.zoneX, l3.map.zoneX + 4]) {
        expect(w.combat!.query.shotVisible(gunner.transform, { x, z: 0, y: .7 })).toBe(true);
      }
    } finally { w.dispose(); }
  }, 120_000);
  test('@E21 @E21-AC17 rescued officers at the compound edge stay inside after boom closure', async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      m.completeObjective('armory'); m.completeObjective('defend');
      const s = m.state.l3!, api = missionControls(w);
      s.pending = []; s.waves = []; s.populated = [true, true, true];
      for (const e of w.infected!.active) { e.health.current = 0; e.infected!.recoverAt = -1; }
      s.squad.forEach((q, i) => api.teleport(q.id, { x: l3.map.zoneX + (i === 0 ? .7 : 4 + i), z: i % 2 ? 1 : -1 }));
      for (const e of w.entities.iterate()) if (e.companion) api.teleport(e.id, { x: l3.map.zoneX + 4, z: 1 });
      api.teleport('player', { x: m.def.anchors['l3-zone'].x, z: 0 });
      s.finaleAt = w.tick - l3.finale.minFightS * 60;
      w.update();
      expect(s.barrierClosedAt).toBeGreaterThan(0);
      for (let i = 0; i < 66 * 60 && m.state.phase === 'playing'; i++) {
        w.update();
        expect(s.barrierClosedAt).toBeGreaterThan(0);
        for (const q of s.squad) expect(w.entities.get(q.id)!.transform.x).toBeGreaterThanOrEqual(l3.map.zoneX);
      }
      expect(s.doneAt - s.crossedAt).toBe(15 * 60);
      expect(m.state.phase).toBe('progression');
    } finally { w.dispose(); }
  }, 120_000);
  test('@E21 army compound is walkable before the rendezvous and does not finish while the courier rests', async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      m.completeObjective('armory'); m.completeObjective('defend');
      const ring = m.def.anchors['l3-zone'], nav = w.infected!.nav;
      expect(ring.x).toBe(149 + l3ArmyOffset);
      for (let i = 0; i < 8; i++) expect(nav.clear(ring.x + Math.cos(i * Math.PI / 4) * ring.radius, Math.sin(i * Math.PI / 4) * ring.radius, .35)).toBe(true);
      const path: number[] = [];
      expect(nav.path(nav.nearestCell(144 + l3ArmyOffset, 0, .35), nav.nearestCell(ring.x, ring.z, .35), path, 1600)).toBe(true);
      missionControls(w).teleport('player', { x: 144 + l3ArmyOffset, z: 0 });
      for (let i = 0; i < 300; i++) w.update();
      expect(m.state.phase).toBe('playing');
      expect(m.state.marker).toBe('l3-route');
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
      for (const q of s.squad) api.teleport(q.id, { x: 144 + l3ArmyOffset, z: 3 });
      for (const e of w.entities.iterate()) if (e.companion) api.teleport(e.id, { x: 145 + l3ArmyOffset, z: 2 });
      const officer = w.entities.get(s.squad[0].id)!;
      if (condition === 'stalled officer') {
        api.teleport(officer.id, { x: 135 + l3ArmyOffset, z: 3 });
        delete officer.civilian!.ally!.follow;
        officer.civilian!.ally!.hold = true;
        officer.civilian!.ally!.post = { x: 135 + l3ArmyOffset, z: 3 };
      } else if (condition === 'dead officer') officer.health.current = 0;
      else if (condition === 'turning officer') w.npcs!.civilians.outbreak!.infect(officer, 1);
      else {
        const guard = w.entities.get(s.soldierIds[0])!;
        api.teleport(guard.id, { x: l3.finale.barrierX, z: 0 });
        guard.civilian!.ally!.post = { x: l3.finale.barrierX, z: 0 };
        guard.civilian!.ally!.hold = true;
      }
      api.teleport('player', { x: m.def.anchors['l3-zone'].x, z: 0 });
      // PO 2026-10-12 ("army rescues us", superseding the player-only transition): the rescue fight lasts minFightS (60 s) and the
      // rendezvous completes after the safe boom closure. Missing, dead, turning or stalled officers are not waited for, and a
      // bystander in the arm's path is stepped aside.
      if (condition === 'stalled officer') {
        // A living group member outside keeps the boom open (spec: it waits or reopens); once she is inside it closes.
        for (let i = 0; i < 80 * 60; i++) w.update();
        expect(s.crossedAt).toBeGreaterThan(0); expect(s.barrierClosedAt ?? 0).toBe(0);
        api.teleport(officer.id, { x: 144 + l3ArmyOffset, z: 3 });
      }
      for (let i = 0; i < 90 * 60 && m.state.phase === 'playing'; i++) w.update();
      expect(s.crossedAt).toBeGreaterThan(0);
      expect(m.state.phase).toBe('progression');
      expect(m.state.marker).toBeNull();
      expect(s.barrierClosedAt ?? 0).toBeGreaterThan(0);
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
  test('@E21 the Boulevard wreck passing line collects its existing sidewalk medkits', async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      missionControls(w).teleport('player', { x: 25, z: -24.75 });
      const player = w.entities.get(1)!;
      player.health.current = 20;
      const ids = l3.medkits.positions.flatMap(([x, z], i) => (x === 29 || x === 60) && z < -20 ? [m.state.l3!.medkitIds[i]] : []);
      for (let tick = 0; tick < 1200 && player.transform.x < 64; tick++) {
        w.applyInput({ ...emptyInput(), moveTarget: { x: 65, z: -24.75 }, navigation: true }, 'mouse-only'); w.update();
      }
      expect(player.transform.x).toBeGreaterThan(64);
      expect(ids).toHaveLength(2);
      for (const id of ids) expect(w.events.events().some(e => e.type === 'pickup.collected' && 'id' in e && e.id === id)).toBe(true);
      expect(player.health.current).toBeGreaterThanOrEqual(95);
    } finally { w.dispose(); }
  }, 120_000);

  test.each([
    { name: 'first Boulevard turn', from: [-13.75, -8], to: [-13.75, -18], kit: [-13.75, -12] },
    { name: 'Boulevard corner', from: [-13.75, -22.75], to: [0, -22.75], kit: [-9, -23.6] },
    { name: 'last street turn', from: [131.75, -12], to: [131.75, -2.75], kit: [131.75, -6] },
    { name: 'bus passing-line end', from: [76, -24.75], to: [84, -24.75], kit: [80, -24] },
    { name: 'entry ramp', from: [131.75, -2.75], to: [149.25, 2.75], kit: [138.75, -.5] },
    { name: 'upper ramp', from: [160.25, -2.75], to: [166.75, -2.25], kit: [162, -2.6] },
    { name: 'exit ramp', from: [197.75, -2.75], to: [205.25, -.75], kit: [201, -1.8] },
  ])('@E21 the $name medkit is collected on the walking line', async ({ from, to, kit }) => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      missionControls(w).teleport('player', { x: from[0], z: from[1] });
      const player = w.entities.get(1)!;
      player.health.current = 20;
      const id = m.state.l3!.medkitIds[l3.medkits.positions.findIndex(([x, z]) => x === kit[0] && z === kit[1])];
      for (let tick = 0; tick < 600 && Math.hypot(player.transform.x - to[0], player.transform.z - to[1]) > .5; tick++) {
        w.applyInput({ ...emptyInput(), moveTarget: { x: to[0], z: to[1] }, navigation: true }, 'mouse-only'); w.update();
      }
      expect(w.events.events().some(e => e.type === 'pickup.collected' && 'id' in e && e.id === id)).toBe(true);
      expect(player.health.current).toBeGreaterThanOrEqual(60);
    } finally { w.dispose(); }
  }, 120_000);

  test('all three routes have sidewalk med packs within 40 m and reachable from the street', async () => {
    const { world: w, mission: m } = await loadL3(1);
    try {
      const nav = w.infected!.nav;
      const layout: DistrictLayout = JSON.parse(readFileSync('public/assets/layouts/D-CORRIDOR.layout.json', 'utf8'));
      expect(m.state.l3!.medkitIds).toHaveLength(l3.medkits.positions.length);
      for (const z of Object.values(l3.map.streets)) {
        const positions = l3.medkits.positions.slice(1).filter(p => p[0] <= 128).filter(p => Math.abs(p[1] - z) < 5).sort((a, b) => a[0] - b[0]);
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
      const offset = l3.map.zoneX - 140;
      const ids = [1, ...m.state.l3!.squadIds], boom = new ArmyCheckpointBoom(w, l3.finale.barrierX);
      ids.forEach(id => { w.entities.get(id)!.transform.x = 142 + offset; });
      const last = w.entities.get(ids.at(-1)!)!; last.transform.x = 136 + offset;
      expect(boom.ready(ids)).toBe(false);
      last.transform.x = 139 + offset; expect(boom.ready(ids)).toBe(true);
      last.transform.x = 136 + offset; last.health.current = 0; expect(boom.ready(ids)).toBe(true);
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
      for(const id of m.state.l3!.officerIds) if(!m.state.l3!.squadIds.includes(id)) w.entities.get(id)!.health.current=0;
      m.completeObjective('armory'); m.completeObjective('defend');
      for(const e of w.entities.iterate()) if(e.hazard?.kind==='fire') e.hazard.activeUntil=-1;
      // Isolate shared follower steering; street crowds are covered by the real-input playthrough.
      m.state.l3!.pending = []; m.state.l3!.waves = []; m.state.l3!.populated = [true, true, true];
      const quiet = () => {
        m.state.l3!.furthestAt = w.tick; // This locomotion fixture does not exercise forward-pressure emergences.
        for (const e of w.infected!.active) { e.health.current = 0; e.infected!.recoverAt = -1; }
      };
      const p = w.entities.get(1)!, z = l3.map.streets[street];
      const start = { x: -110, y: p.transform.y, z }; Object.assign(p.transform, start); w.physics.playerBody!.setTranslation(start, true);
      const squad = m.state.l3!.squad;
      squad.forEach((q, i) => { const e = w.entities.get(q.id)!; Object.assign(e.transform, { x: -115 - i, z: z + (i % 2 ? 1 : -1) * 1.5 }); });
      const still = new Map<number, { x: number; z: number; ticks: number }>();
      let stuckTicks = 0;
      for (let tick = 0; tick < 3000 && Math.hypot(p.transform.x + 62, p.transform.z - z) > .8; tick++) {
        quiet();
        followFrustum(w); w.applyInput({ ...emptyInput(), moveTarget: { x: -62, z }, navigation: true }, 'mouse-only'); w.update();
        for (const q of squad) {
          const e = w.entities.get(q.id)!, previous = still.get(q.id);
          const ticks = previous && Math.hypot(e.transform.x - previous.x, e.transform.z - previous.z) < .005 ? previous.ticks + 1 : 0;
          still.set(q.id, { x: e.transform.x, z: e.transform.z, ticks });
          if (Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) > 10) stuckTicks = Math.max(stuckTicks, ticks);
        }
      }
      for(let tick=0;tick<300;tick++){quiet();w.applyInput({...emptyInput(),cancelMove:true},'mouse-only');w.update();}
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
