import { afterEach, expect, test } from 'vitest';
import { loadL6 } from '../../tools/sim-runner/l6Bots';
import { l6 } from '../../src/data/l6';
import { LevelSixSubway } from '../../src/sim/missions/LevelSixSubway';
import { emptyInput } from '../../src/input/InputFrame';
import type { SimWorld } from '../../src/sim/world/SimWorld';
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const put = (w: SimWorld, x: number, z: number) => { const p = w.entities.get(1)!; Object.assign(p.transform, { x, y: 1.3, z }); w.physics.playerBody!.setTranslation(p.transform, true); w.spatial.set(1, x, z); };
const place = (w: SimWorld, ids: number[], x: number) => ids.forEach((id, i) => { const e = w.entities.get(id)!; Object.assign(e.transform, { x: x - Math.floor(i / 3) * 1.4, z: 15 + (i % 3 - 1) * 1.2 }); w.spatial.set(id, e.transform.x, e.transform.z); });

// QA 10-21 #87 "rear survivors are killed one by one at gate x~90 … the courier died 10x and every death restarts at the
// shelter (3,0) with checkpoint 'abandon' -> the whole shelter+retreat replays".
test('@E24 QA #87 a death after the group passed a gate respawns at that gate with the surviving group, not at the shelter', async () => {
  const { world: w, mission: m } = await loadL6(1, 'low'); world = w;
  m.completeObjective('shelter'); m.completeObjective('stop'); w.update();
  const s = m.state.l6!; expect(m.state.checkpoint).toBe('abandon');
  const live = s.survivors.filter(r => r.status === 'following');
  // Two lost on the way: the checkpoint keeps the surviving group as it is.
  for (const r of live.slice(-2)) { r.status = 'dead'; w.entities.get(r.id)!.health.current = 0; }
  const walkers = live.slice(0, -2).map(r => r.id);
  s.leaderX = 108; s.leaderZ = 15; place(w, walkers, 106);
  // Playtest 10-21: one survivor still fighting far back ("10/11 through") must not withhold the checkpoint.
  const behind = w.entities.get(walkers[walkers.length - 1])!; Object.assign(behind.transform, { x: 60, z: 15 }); w.spatial.set(behind.id, 60, 15);
  put(w, 70, 15); w.update(); w.update();
  expect(s.gates[0].passed).toBe(true); expect(m.state.checkpoint).toBe('gate-90');
  w.player!.damage(w.entities.get(1)!.health.max, w.tick);
  for (let i = 0; i < 400 && (w.entities.get(1)!.health.current <= 0 || m.state.phase !== 'playing'); i++) w.update();
  const p = w.entities.get(1)!.transform, wait = LevelSixSubway.gateWait(90);
  expect(m.state.checkpoint).toBe('gate-90'); expect(s.phase).toBe('retreat');
  expect(Math.hypot(p.x - wait.x, p.z - wait.z), 'respawn beside the passed gate').toBeLessThan(3);
  expect(m.state.l6!.survivors.filter(r => r.status === 'following').length).toBe(walkers.length);
  for (const id of walkers.slice(0, -1)) expect(w.entities.get(id)!.transform.x).toBeGreaterThan(92);
  // The next gate takes over once the group is through it as well; the first gate's checkpoint is not taken again.
  m.state.l6!.leaderX = 168; place(w, walkers, 166); w.update(); w.update();
  expect(m.state.checkpoint).toBe('gate-150');
}, 240_000);

// QA 10-21 #88 ""Stay with the group" <-> "Cover the retreat through the tunnel" about every 6 s (~30x) while the group
// stayed at the tunnel mouth (32,9.8)/(50,4.8) and the plain-retreat ring pointed at the gate wait spot (92.4,17.3), 40 m
// from the group … Also the held-group reason "cover the rear" flipped 3x in 3 s (13393-13583): waitFor has no dwell".
test('@E24 QA #88 with the group held back, the ring stays with it and the objective text does not alternate', async () => {
  const { world: w, mission: m } = await loadL6(1, 'low'); world = w;
  w.combat!.damage.god = true; m.completeObjective('shelter'); m.completeObjective('stop'); w.update();
  const s = m.state.l6!, walkers = s.survivors.filter(r => r.status === 'following').map(r => r.id);
  s.leaderX = 88; s.leaderZ = 15; place(w, walkers, 50); put(w, 52, 15);
  const texts: string[] = []; let last: string | null | undefined;
  for (let i = 0; i < 30 * 60; i++) {
    // The group is held at the tunnel mouth; the courier walks to wherever the ring points, as the driver did.
    place(w, walkers, 50); s.leaderX = 88;
    const ring = m.def.anchors[m.state.marker ?? 'l6-next'];
    const p = w.entities.get(1)!.transform, d = Math.hypot(ring.x - p.x, ring.z - p.z);
    if (d > .1) put(w, p.x + (ring.x - p.x) / d * Math.min(d, 6 / 60), p.z + (ring.z - p.z) / d * Math.min(d, 6 / 60));
    w.update();
    const t = LevelSixSubway.text(m); if (t !== last) texts.push(t ?? 'Cover the retreat through the tunnel'); last = t;
  }
  expect(texts).toEqual(['Cover the retreat through the tunnel']);
  expect(m.state.marker).toBe('l6-next');
  expect(m.def.anchors['l6-next'].x, 'the ring leads at most aheadM ahead of the group').toBeLessThanOrEqual(50 + l6.follow.aheadM + .5);
}, 240_000);

test('@E24 QA #88 the held-group reason holds through a 1 s wobble of the rear threat', async () => {
  const { world: w, mission: m } = await loadL6(1, 'low'); world = w;
  w.combat!.damage.god = true; m.completeObjective('shelter'); m.completeObjective('stop'); w.update();
  const s = m.state.l6!, walkers = s.survivors.filter(r => r.status === 'following' && !r.injured).map(r => r.id);
  for (const r of s.survivors.filter(r => r.injured)) r.status = 'dead';
  s.leaderX = 89; s.leaderZ = 15; place(w, walkers, 87);
  const biter = w.entities.get(w.infected!.spawn('infected.runner', { x: 74, z: 15 }))!;
  const texts: string[] = []; let last: string | null | undefined;
  for (let i = 0; i < 6 * 60; i++) {
    // The courier is far ahead of the rear; the nearest infected crosses the 20 m "hot" band every second.
    put(w, 93, 17); place(w, walkers, 87); s.leaderX = 89;
    Object.assign(biter.transform, { x: (i / 60 | 0) % 2 ? 40 : 74, z: 15 }); w.spatial.set(biter.id, biter.transform.x, 15);
    w.update();
    const t = LevelSixSubway.text(m); if (t !== last) texts.push(String(t)); last = t;
  }
  expect(texts.filter(t => t === 'The group waits: cover the rear from the infected')).toHaveLength(1);
}, 240_000);

// Playtest 10-21 (baseline weapons run): "Stuck 121 s on "Stay with the group · 0 m"" at x~190: the group was split and
// its centre, where the ring sat, was empty.
test('@E24 playtest a split group puts the "Stay with the group" ring on a survivor, not into the empty gap between', async () => {
  const { world: w, mission: m } = await loadL6(1, 'low'); world = w;
  w.combat!.damage.god = true; m.completeObjective('shelter'); m.completeObjective('stop'); w.update();
  const s = m.state.l6!, walkers = s.survivors.filter(r => r.status === 'following' && !r.injured).map(r => r.id);
  const half = walkers.length >> 1;
  for (let i = 0; i < (l6.follow.strayDwellS + 1) * 60; i++) {
    s.leaderX = 214; s.leaderZ = 15; place(w, walkers.slice(0, half), 172); place(w, walkers.slice(half), 214); put(w, 193, 15); w.update();
  }
  expect(s.strayed).toBe(true); expect(m.state.marker).toBe('l6-group');
  const ring = m.def.anchors['l6-group'];
  expect(Math.min(...walkers.map(id => Math.hypot(w.entities.get(id)!.transform.x - ring.x, w.entities.get(id)!.transform.z - ring.z)))).toBeLessThan(1);
}, 240_000);

test('@E24 playtest one survivor left behind gate 90 does not pull the ring back there once the column walked on', async () => {
  const { world: w, mission: m } = await loadL6(1, 'low'); world = w;
  w.combat!.damage.god = true; m.completeObjective('shelter'); m.completeObjective('stop'); w.update();
  const s = m.state.l6!, walkers = s.survivors.filter(r => r.status === 'following' && !r.injured).map(r => r.id);
  for (const r of s.survivors.filter(r => r.injured)) r.status = 'dead';
  s.leaderX = 140; s.leaderZ = 15; place(w, walkers.slice(0, -1), 138);
  const behind = w.entities.get(walkers[walkers.length - 1])!; Object.assign(behind.transform, { x: 70, z: 15 }); w.spatial.set(behind.id, 70, 15);
  put(w, 140, 15); w.update();
  expect(m.state.marker).toBe('l6-next');
  expect(m.def.anchors['l6-next'].x).toBeGreaterThan(140);
}, 240_000);

// Playtest 10-21 (male, campaign weapons): "Stay with the group" pointed at a survivor at (32.4,25.3)/(30.8,27.4) for the
// rest of the run; the exit never counted everyone out and was skipped at the level cap.
test('@E24 playtest a survivor who fled into the side rooms beside the tunnel mouth walks back to the group', async () => {
  const { world: w, mission: m } = await loadL6(1, 'low'); world = w;
  w.combat!.damage.god = true; m.completeObjective('shelter'); m.completeObjective('stop'); w.update();
  const s = m.state.l6!, r = s.survivors.find(r => r.status === 'following' && !r.injured)!, e = w.entities.get(r.id)!;
  Object.assign(e.transform, { x: 32.4, z: 25.3 }); w.spatial.set(e.id, 32.4, 25.3);
  for (let i = 0; i < 40 * 60; i++) { s.leaderX = 120; s.leaderZ = 15; w.update(); }
  expect(e.transform.x).toBeGreaterThan(90); expect(Math.abs(e.transform.z - l6.tunnel.z)).toBeLessThan(l6.tunnel.width / 2);
}, 240_000);

// Playtest 10-21 (fists, 22 survivors): "Bring the injured survivor back to the group · 0 m" held 7 min at gate 90.
test('@E24 playtest a collected straggler brought into the middle of a long column rejoins; the bring ring leads to the tail', async () => {
  const { world: w, mission: m } = await loadL6(1, 'low'); world = w;
  w.combat!.damage.god = true; m.completeObjective('shelter'); m.completeObjective('stop'); w.update();
  const s = m.state.l6!, live = s.survivors.filter(r => r.status === 'following'), lame = live.find(r => r.injured)!;
  const rest = live.filter(r => r !== lame).map(r => r.id);
  s.leaderX = 89; s.leaderZ = 15; place(w, rest, 89);
  const e = w.entities.get(lame.id)!; Object.assign(e.transform, { x: 60, z: 15 }); w.spatial.set(e.id, 60, 15); lame.straggler = true;
  put(w, 61, 15); w.update(); w.update();
  expect(lame.collected).toBe(true); expect(LevelSixSubway.text(m)).toBe('Bring the injured survivor back to the group');
  expect(m.state.marker).toBe('l6-help'); expect(Math.abs(m.def.anchors['l6-help'].x - s.tailX!)).toBeLessThan(2);
  // Courier and straggler stand in the middle of the column, more than 5 m ahead of its tail.
  Object.assign(e.transform, { x: s.tailX! + 6, z: 15 }); w.spatial.set(e.id, e.transform.x, 15); put(w, s.tailX! + 7, 15); w.update();
  expect(lame.rejoined).toBe(true);
}, 240_000);

test('@E24 a returned straggler rejoins the real column before the courier fetches the next one, even when the leader is held behind it', async () => {
  const { world: w, mission: m } = await loadL6(1, 'low'); world = w;
  m.completeObjective('shelter'); m.completeObjective('stop'); w.update();
  const s = m.state.l6!, live = s.survivors.filter(r => r.status === 'following');
  const injured = live.filter(r => r.injured), returned = injured[0];
  // Combat can displace the walking column beyond a held leader. Another injured survivor still needs fetching,
  // so the leader cannot catch up to the real group while the courier brings this survivor into its tail.
  s.leaderX = 89; s.leaderZ = 15;
  place(w, live.filter(r => !r.injured).map(r => r.id), 108);
  for (const r of live.filter(r => !r.injured)) {
    const c = w.entities.get(r.id)!.civilian!;
    c.dangerUntil = w.tick + 600; c.threat = { x: 90, z: 15 };
  }
  for (const r of injured) { place(w, [r.id], r === returned ? 99 : 60); r.straggler = true; }
  returned.collected = true; put(w, 100, 15); w.update();
  expect(s.tailX).toBeGreaterThan(s.leaderX + l6.follow.rejoinM);
  expect(s.waitFor).toEqual({ kind: 'fetch', id: injured[1].id });
  // Follow that next fetch with ordinary movement while the column still flees the last threat.
  // Before the fix the returned survivor follows the courier back out of the column, and the HUD
  // interrupts the new fetch with "Bring ... back" for the same survivor all over again.
  const frame = emptyInput(); frame.move = { x: -1, z: 0 };
  for (let i = 0; i < 360; i++) { w.applyInput(frame, 'keyboard'); w.update(); }
  expect(s.waitFor, 'the next fetch must not loop back to bringing the already returned survivor').toEqual({ kind: 'fetch', id: injured[1].id });
  expect(returned.rejoined, 'a returned survivor must not start the fetch/bring loop again').toBe(true);
  expect(returned.collected).toBe(false);
}, 240_000);

// Orchestrator 10-21 (fists playtest, male L5->L6): "help the injured survivor who fell behind" <-> "Bring the injured
// survivor back" looped at gate 90: the gate checkpoint was taken with an injured straggler still far back, so every
// respawn restored them there and the courier fetched them again through the horde.
test('@E24 playtest the gate checkpoint waits until no injured straggler is out behind the group', async () => {
  const { world: w, mission: m } = await loadL6(1, 'low'); world = w;
  w.combat!.damage.god = true; m.completeObjective('shelter'); m.completeObjective('stop'); w.update();
  const s = m.state.l6!, live = s.survivors.filter(r => r.status === 'following'), lame = live.find(r => r.injured)!;
  const rest = live.filter(r => r !== lame).map(r => r.id);
  s.leaderX = 108; s.leaderZ = 15; place(w, rest, 106);
  const e = w.entities.get(lame.id)!; Object.assign(e.transform, { x: 62, z: 15 }); w.spatial.set(e.id, 62, 15); lame.straggler = true;
  put(w, 100, 15); w.update(); w.update();
  expect(s.gates[0].passed).toBeFalsy(); expect(m.state.checkpoint).toBe('abandon');
  // Brought back into the column: now the gate's checkpoint is taken, with them in it.
  Object.assign(e.transform, { x: 100, z: 15 }); w.spatial.set(e.id, 100, 15); lame.collected = true; w.update(); w.update();
  expect(lame.rejoined).toBe(true); expect(m.state.checkpoint).toBe('gate-90');
}, 240_000);

test('@E24 playtest the mid-tunnel checkpoint waits for the column when the courier runs ahead', async () => {
  const { world: w, mission: m } = await loadL6(1, 'low'); world = w;
  w.combat!.damage.god = true; m.completeObjective('shelter'); m.completeObjective('stop'); w.update();
  const s = m.state.l6!, live = s.survivors.filter(r => r.status === 'following' && !r.injured).map(r => r.id);
  for (const r of s.survivors.filter(r => r.injured)) r.status = 'dead';
  s.leaderX = 118; s.leaderZ = 15; place(w, live, 116); put(w, 151, 15); w.update(); w.update();
  expect(s.mid).toBe(false); expect(m.state.checkpoint).not.toBe('mid-tunnel');
  s.leaderX = 150; place(w, live, 148); put(w, 151, 15); w.update(); w.update();
  expect(m.state.checkpoint).toBe('mid-tunnel');
}, 240_000);

// Orchestrator 10-21 (fists playtest after gate 150): "Stay with the group" every ~30 s; the courier respawned at
// (152.4,17.3) while the ring led ~40 m back to the last survivors behind the gate, and died there again.
test('@E24 playtest no gate checkpoint while most of the living group is still behind it; respawn there leads forward', async () => {
  const { world: w, mission: m } = await loadL6(1, 'low'); world = w;
  m.completeObjective('shelter'); m.completeObjective('stop'); w.update();
  const s = m.state.l6!, live = s.survivors.filter(r => r.status === 'following' && !r.injured);
  for (const r of s.survivors.filter(r => r.injured)) r.status = 'dead';
  const [ahead, ...rest] = live.map(r => r.id); for (const id of rest.slice(2)) { s.survivors.find(r => r.id === id)!.status = 'dead'; w.entities.get(id)!.health.current = 0; }
  const back = rest.slice(0, 2);
  s.leaderX = 160; s.leaderZ = 15; place(w, [ahead], 158); place(w, back, 104); m.checkpoint('mid-tunnel'); s.mid = true;
  for (const g of s.gates) if (g.x < 150) g.passed = true;
  put(w, 150, 15); w.update(); w.update();
  expect(s.gates[1].passed, '1 of 3 through gate 150').toBeFalsy(); expect(m.state.checkpoint).toBe('mid-tunnel');
  // All three through: the checkpoint is taken and a respawn there has the ring ahead, not back down the tunnel.
  place(w, back, 156); w.update(); w.update();
  expect(m.state.checkpoint).toBe('gate-150');
  w.player!.damage(w.entities.get(1)!.health.max, w.tick);
  for (let i = 0; i < 400 && (w.entities.get(1)!.health.current <= 0 || m.state.phase !== 'playing'); i++) w.update();
  for (let i = 0; i < 3 * 60; i++) w.update();
  expect(LevelSixSubway.text(m)).not.toBe('Stay with the group');
  expect(m.def.anchors[m.state.marker!].x).toBeGreaterThan(145);
}, 240_000);
