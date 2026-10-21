import { afterEach, expect, test } from 'vitest';
import { loadL6 } from '../../tools/sim-runner/l6Bots';
import { followFrustum } from '../../tools/sim-runner/l3Bots';
import { emptyInput } from '../../src/input/InputFrame';
import { l6, l6Doors } from '../../src/data/l6';
import { LevelSixSubway } from '../../src/sim/missions/LevelSixSubway';
import type { SimWorld } from '../../src/sim/world/SimWorld';
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const put = (w: SimWorld, x: number, z: number) => { const p = w.entities.get(1)!; Object.assign(p.transform, { x, y: 1.3, z }); w.physics.playerBody!.setTranslation(p.transform, true); w.spatial.set(1, x, z); };

test('@E24 PO 10-20 #65 the retreat ring sits on the group\'s next waypoint; away from the group it reads "Stay with the group" and moves onto the group', async () => {
  const { world: w, mission: m } = await loadL6(); world = w;
  w.combat!.damage.god = true; m.completeObjective('shelter'); m.completeObjective('stop');
  for (let i = 0; i < 5; i++) w.update();
  const s = m.state.l6!;
  expect(s.phase).toBe('retreat'); expect(m.state.marker).toBe('l6-next'); expect(s.strayed).toBe(false);
  // Shelter leg: the group first walks onto the track at the leader's x.
  expect(m.def.anchors['l6-next']).toMatchObject({ x: s.leaderX, z: l6.tunnel.z });
  expect(LevelSixSubway.text(m)).toBeNull();
  // Tunnel leg: the next gate, never more than aheadM in front of the walking head.
  const column = (x: number) => s.survivors.filter(r => r.status === 'following').forEach((r, i) => { const e = w.entities.get(r.id)!; Object.assign(e.transform, { x: x - Math.floor(i / 3) * 1.4, z: 15 + (i % 3 - 1) * 1.2 }); w.spatial.set(e.id, e.transform.x, e.transform.z); });
  s.leaderZ = 15; s.leaderX = 84; column(84); w.update();
  expect(m.def.anchors['l6-next']).toMatchObject(LevelSixSubway.gateWait(90));
  s.leaderX = 70; column(70); w.update();
  expect(m.def.anchors['l6-next'].x).toBeCloseTo(s.leaderX + l6.follow.aheadM, 1);
  // Walk right, away from the group (PO: "the group of people is below me, but I walk right").
  const walkers = s.survivors.filter(r => r.status === 'following').map(r => w.entities.get(r.id)!);
  // The group walks on (2.2 m/s) during the strayDwellS hold (QA #84), so start clearly beyond strayM.
  const far = Math.max(...walkers.map(e => e.transform.x)) + l6.follow.strayM + 8, dwell = l6.follow.strayDwellS * 60 + 1;
  const hold = (x: number, z: number) => { for (let i = 0; i < dwell; i++) { put(w, x, z); w.update(); } };
  hold(far, 15);
  expect(s.strayed).toBe(true); expect(m.state.marker).toBe('l6-group'); expect(LevelSixSubway.text(m)).toBe('Stay with the group');
  const group = m.def.anchors['l6-group'], cx = walkers.reduce((t, e) => t + e.transform.x, 0) / walkers.length;
  expect(Math.abs(group.x - cx)).toBeLessThan(2);
  // Hysteresis: between regroupM and strayM it keeps pointing at the group.
  const nearest = walkers.reduce((a, e) => e.transform.x > a.transform.x ? e : a);
  put(w, nearest.transform.x + 12, nearest.transform.z); w.update();
  expect(s.strayed).toBe(true);
  // Rejoin.
  hold(nearest.transform.x + 1, nearest.transform.z);
  expect(s.strayed).toBe(false); expect(m.state.marker).toBe('l6-next'); expect(LevelSixSubway.text(m)).toBeNull();
  // Checkpoints keep it (the anchors are rebuilt from the restored group on the next tick).
  hold(far + 8, 15); m.checkpoint('abandon'); m.restore('abandon'); w.update();
  expect(m.state.marker).toBe('l6-group');
}, 240_000);

test('@E24 PO 10-20 #64 a closed tunnel hatch holds its arrivals: telegraphed bashes, breaks after 8 s, then they come through', async () => {
  const { world: w, mission: m } = await loadL6(); world = w;
  w.combat!.damage.god = true; m.completeObjective('shelter'); m.completeObjective('stop');
  const s = m.state.l6!, entry = s.entries!.find(e => e.door === 5)!, door = l6Doors[5];
  const sw = w.entities.get(entry.switchId!)!;
  expect(sw.interactable).toMatchObject({ kind: 'switch', enabled: true, label: 'Close the hatch' });
  // Real input: stand at the hatch and press E.
  put(w, sw.transform.x - .4, sw.transform.z); w.update();
  const frame = emptyInput(); frame.interact = true;
  for (let i = 0; i < 3; i++) { w.applyInput(frame, 'keyboard'); w.update(); }
  w.clearInput(); w.update();
  expect(entry.closedAt).toBeGreaterThan(0); expect(sw.interactable!.enabled).toBe(false); expect(sw.interactable!.label).toBe('Hatch closed');
  const hits: number[] = [], spawnedAt: number[] = [];
  w.events.on('barricade.sound', e => { if (e.type === 'barricade.sound' && e.sourceId === sw.id && (e.phase === 'hit' || e.phase === 'break')) hits.push(e.tick); });
  // Courier waits near the hatch (it is ahead of her, inside the warning window).
  put(w, door.x - 10, 15);
  const start = w.tick;
  for (let i = 0; i < 60 * 14; i++) {
    followFrustum(w); w.update();
    if (s.spawnLog.some(l => l.door === 5) && !spawnedAt.length) spawnedAt.push(w.tick);
  }
  expect(entry.warnedAt).toBeGreaterThan(0);
  expect(hits.length).toBe(l6.hatch.hits);
  for (let i = 1; i < hits.length; i++) expect(hits[i] - hits[i - 1]).toBe(60);
  expect(entry.brokenAt).toBe(hits[hits.length - 1]);
  // Nobody came through while it held; arrivals follow the break.
  expect(spawnedAt[0]).toBeGreaterThanOrEqual(entry.brokenAt!);
  expect(entry.brokenAt! - entry.warnedAt).toBeGreaterThanOrEqual(120 + (l6.hatch.hits - 1) * 60);
  expect(sw.interactable!.label).toBe('Hatch broken');
  expect(start).toBeLessThan(entry.brokenAt!);
  // A hatch that was never closed releases its first arrival two seconds after the bang (unchanged pacing).
  const open = s.entries!.find(e => e.door === 3)!;
  put(w, l6Doors[3].x - 20, 15);
  for (let i = 0; i < 60 * 3; i++) { followFrustum(w); w.update(); }
  expect(open.closedAt ?? 0).toBe(0);
  expect(s.spawnLog.filter(l => l.door === 3).length).toBeGreaterThan(0);
}, 240_000);

test('@E24 PO 10-20 #63 the courier walks onto both drawn tunnel walkways (no invisible wall mid-walkway)', async () => {
  const { world: w, mission: m } = await loadL6(); world = w;
  m.completeObjective('shelter'); m.completeObjective('stop');
  const p = w.entities.get(1)!, frame = emptyInput();
  for (const [dz, edge] of [[1, 18.2], [-1, 11.8]] as const) {
    put(w, 100, 15); frame.move = { x: 0, z: dz };
    for (let i = 0; i < 120; i++) { w.applyInput(frame, 'keyboard'); w.update(); }
    // The old phantom walls stopped her at z 17.13 / 12.87, 1.3 m short of the drawn walkway edge.
    expect(dz > 0 ? p.transform.z : -p.transform.z).toBeGreaterThan(dz > 0 ? edge : -edge);
  }
  // Screen-left (W+A diagonal back toward home) along the camera-side walkway is continuous between barrier piers.
  put(w, 112, 17.6); frame.move = { x: -1, z: 0 };
  for (let i = 0; i < 90; i++) { w.applyInput(frame, 'keyboard'); w.update(); }
  expect(p.transform.x).toBeLessThan(106);
}, 240_000);

// QA 10-21 #84 "L6 exit (253,16) ticks 63000-89000: objective text flaps "Stay with the group" <-> "Bring the survivors
// into the night" every 1-3 s (53 flips) while the group is 20-35 m behind; #65 checkpoint needs hysteresis."
test('@E24 QA #84 the exit "Stay with the group" text switches once per real change, not with every distance wobble', async () => {
  const { world: w, mission: m } = await loadL6(); world = w;
  w.combat!.damage.god = true; m.completeObjective('shelter'); m.completeObjective('stop'); m.completeObjective('retreat');
  const s = m.state.l6!; expect(s.phase).toBe('exit');
  const walkers = s.survivors.filter(r => r.status === 'following').map(r => w.entities.get(r.id)!);
  const nearest = () => Math.max(...walkers.filter(e => !e.hidden).map(e => e.transform.x));
  const heads: string[] = []; let last = '';
  const sample = () => { const t = LevelSixSubway.text(m) ?? 'Bring the survivors into the night'; if (t !== last) heads.push(t); last = t; };
  // The nearest walker's distance wobbles across the 10/15 m band every 0.75 s (combat, fleeing): no flip at all.
  for (let i = 0; i < 30 * 60; i++) { put(w, nearest() + ((i / 45 | 0) % 2 ? 17 : 8), 15); w.update(); sample(); }
  expect(heads).toEqual(['Bring the survivors into the night']);
  // A real change (courier clearly away for longer than strayDwellS) switches exactly once, and back once on rejoin.
  for (let i = 0; i < (l6.follow.strayDwellS + 1) * 60; i++) { put(w, nearest() + 30, 15); w.update(); sample(); }
  for (let i = 0; i < (l6.follow.strayDwellS + 1) * 60; i++) { put(w, nearest() + 2, 15); w.update(); sample(); }
  expect(heads).toEqual(['Bring the survivors into the night', 'Stay with the group', 'Bring the survivors into the night']);
}, 240_000);

// QA 10-21 #83 "L6 first service gate x~90 … survivors bunch west of the gate among infected and do not pass for 420 s twice".
// Probe (non-fighting courier on the gate ring): the group held at the gate for an injured straggler that cannot be bitten
// (story-protected) but fled its biters into the tunnel wall for good; the ring kept pointing at the gate; and one healthy
// survivor fighting far back made the whole group wait as "the rear".
test('@E24 QA #83 a protected straggler limps toward the group through its biters; the held group names it and the ring leads there', async () => {
  const { world: w, mission: m } = await loadL6(1, 'low'); world = w;
  w.combat!.damage.god = true; m.completeObjective('shelter'); m.completeObjective('stop');
  const s = m.state.l6!; s.leaderX = 88; s.leaderZ = 15;
  const live = s.survivors.filter(r => r.status === 'following');
  const lame = live.find(r => r.injured)!, rest = live.filter(r => r !== lame);
  rest.forEach((r, i) => { const e = w.entities.get(r.id)!; Object.assign(e.transform, { x: 86 - Math.floor(i / 3) * 1.4, z: 15 + (i % 3 - 1) * 1.2 }); w.spatial.set(e.id, e.transform.x, e.transform.z); });
  const e = w.entities.get(lame.id)!; Object.assign(e.transform, { x: 60, z: 12.2 }); w.spatial.set(e.id, 60, 12.2); lame.straggler = true;
  put(w, LevelSixSubway.gateWait(90).x, LevelSixSubway.gateWait(90).z);
  for (const [x, z] of [[61.4, 12.6], [61.2, 11.8]]) w.infected!.spawn('infected.runner', { x, z });
  w.update(); w.update();
  expect(s.paused).toBe(true); expect(s.waitFor).toEqual({ kind: 'fetch', id: lame.id });
  expect(m.state.marker).toBe('l6-help'); expect(LevelSixSubway.text(m)).toBe('The group waits: help the injured survivor who fell behind');
  for (let i = 0; i < 8 * 60; i++) { put(w, LevelSixSubway.gateWait(90).x, LevelSixSubway.gateWait(90).z); w.update(); }
  expect(e.transform.x, 'the straggler limps on toward the group instead of fleeing into the wall').toBeGreaterThan(66);
  expect(Math.hypot(m.def.anchors['l6-help'].x - e.transform.x, m.def.anchors['l6-help'].z - e.transform.z)).toBeLessThan(1);
}, 240_000);

test('@E24 QA #83 a healthy survivor fighting far behind the column does not hold the group at the gate', async () => {
  const { world: w, mission: m } = await loadL6(1, 'low'); world = w;
  w.combat!.damage.god = true; m.completeObjective('shelter'); m.completeObjective('stop');
  const s = m.state.l6!; s.leaderX = 89; s.leaderZ = 15;
  const live = s.survivors.filter(r => r.status === 'following' && !r.injured);
  live.forEach((r, i) => { const e = w.entities.get(r.id)!; Object.assign(e.transform, { x: 87 - Math.floor(i / 3) * 1.4, z: 15 + (i % 3 - 1) * 1.2 }); w.spatial.set(e.id, e.transform.x, e.transform.z); });
  for (const r of s.survivors.filter(r => r.injured)) r.status = 'dead';
  const far = w.entities.get(live[live.length - 1].id)!; Object.assign(far.transform, { x: 20, z: 15 }); w.spatial.set(far.id, 20, 15);
  w.infected!.spawn('infected.runner', { x: 22, z: 15 });
  put(w, LevelSixSubway.gateWait(90).x, LevelSixSubway.gateWait(90).z); w.update();
  expect(s.paused).toBe(false); expect(s.tailX).toBeGreaterThan(60);
}, 240_000);

for (const [x, z, y, gate, seconds] of [[192.7, 11.8, 1.57, 210, 30], [59, 18.2, 1.3, 90, 30], [32.4, 25.3, 1.3, 90, 60]] as const)
test(`@E24 #96 collected injured follower rejoins from walkable position (${x}, ${z})`, async () => {
  const { world: w, mission: m } = await loadL6(1, 'low'); world = w;
  w.combat!.damage.god = true; m.completeObjective('shelter'); m.completeObjective('stop');
  const s = m.state.l6!; s.leaderX = gate - 1; s.leaderZ = 15;
  const injured = s.survivors.find(r => r.injured)!;
  for (const [i, r] of s.survivors.filter(r => r.status === 'following' && r !== injured).entries()) {
    const e = w.entities.get(r.id)!;
    Object.assign(e.transform, { x: gate - 2, z: 15 + (i % 3 - 1) * .725 });
    w.spatial.set(e.id, e.transform.x, e.transform.z);
  }
  injured.straggler = true; injured.collected = true; injured.rejoined = false;
  const e = w.entities.get(injured.id)!;
  Object.assign(e.transform, { x, y, z }); w.spatial.set(e.id, x, z);
  for (let i = 0; i < seconds * 60; i++) {
    const before = { ...e.transform };
    put(w, LevelSixSubway.gateWait(gate).x, LevelSixSubway.gateWait(gate).z); w.update();
    expect(Math.hypot(e.transform.x-before.x,e.transform.z-before.z)).toBeLessThan(.25);
  }
  expect(injured.rejoined, `follower moved from (${x}, ${z}): ${JSON.stringify(e.transform)}`).toBe(true);
  expect(e.transform.x).toBeGreaterThan(gate - 12);
  expect(Math.abs(e.transform.z-15)).toBeLessThan(1.5);
}, 240_000);
