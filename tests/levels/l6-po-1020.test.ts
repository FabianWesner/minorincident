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
  s.leaderZ = 15; s.leaderX = 84; w.update();
  expect(m.def.anchors['l6-next'].x).toBeCloseTo(Math.min(90, s.leaderX + l6.follow.aheadM), 1);
  s.leaderX = 70; w.update();
  expect(m.def.anchors['l6-next'].x).toBeCloseTo(s.leaderX + l6.follow.aheadM, 1);
  // Walk right, away from the group (PO: "the group of people is below me, but I walk right").
  const walkers = s.survivors.filter(r => r.status === 'following').map(r => w.entities.get(r.id)!);
  const far = Math.max(...walkers.map(e => e.transform.x)) + l6.follow.strayM + 3;
  put(w, far, 15); w.update();
  expect(s.strayed).toBe(true); expect(m.state.marker).toBe('l6-group'); expect(LevelSixSubway.text(m)).toBe('Stay with the group');
  const group = m.def.anchors['l6-group'], cx = walkers.reduce((t, e) => t + e.transform.x, 0) / walkers.length;
  expect(Math.abs(group.x - cx)).toBeLessThan(2);
  // Hysteresis: between regroupM and strayM it keeps pointing at the group.
  const nearest = walkers.reduce((a, e) => e.transform.x > a.transform.x ? e : a);
  put(w, nearest.transform.x + 12, nearest.transform.z); w.update();
  expect(s.strayed).toBe(true);
  // Rejoin.
  put(w, nearest.transform.x + 1, nearest.transform.z); w.update();
  expect(s.strayed).toBe(false); expect(m.state.marker).toBe('l6-next'); expect(LevelSixSubway.text(m)).toBeNull();
  // Checkpoints keep it (the anchors are rebuilt from the restored group on the next tick).
  put(w, far, 15); w.update(); m.checkpoint('abandon'); m.restore('abandon'); w.update();
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
