import { readTicks, storyLines } from '../../src/sim/missions/L1Story';
import { expect, test } from 'vitest';
import { loadL1, runL1 } from '../../tools/sim-runner/l1Bots';

test.each([['complete', 1], ['complete', 2], ['newbie', 1]] as const)('@E19 PO UAT story beats: %s bot still completes L1 (seed %i)', async (policy, seed) => {
  const { world, mission } = await loadL1(seed);
  try {
    const report = runL1(world, mission, policy, { seed });
    expect(mission.state.l1!.beatsDone).toEqual(expect.arrayContaining(['pickup', 'handover', 'garage']));
    expect(report.outcome).toBe('complete');
    expect(mission.state.l1!.beatsDone).not.toContain('firestation');
    expect(world.storyLock).toBeNull();
    expect(mission.def.onComplete).not.toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'cinematic' })]));
    expect(['result', 'progression']).toContain(mission.state.phase);
  } finally { world.dispose(); }
}, 600_000);

test('@E19 PO UAT story beat locks input and any press skips it', async () => {
  const { world, mission } = await loadL1(1);
  try {
    const counter = mission.def.anchors['parcel-counter'], p = world.entities.get(1)!;
    Object.assign(p.transform, { x: counter.x, z: counter.z + 1.9 }); world.physics.playerBody!.setTranslation(p.transform, true); world.update();
    world.setInput({ interact: true }); world.update(); world.clearInput(); world.update();
    expect(mission.state.l1!.beat?.id).toBe('pickup'); expect(world.storyLock).not.toBeNull();
    const before = { ...world.entities.get(1)!.transform };
    world.setInput({ move: { x: 0, z: 0 } }); for (let i = 0; i < 10; i++) world.update(); // no press: still locked
    expect(world.storyLock).not.toBeNull(); expect(world.entities.get(1)!.transform.x).toBeCloseTo(before.x, 3);
    // PO: the bubble stays up for its reading time, max(2.5 s, 1 s + 70 ms/char)...
    const say = mission.state.l1!.say!; expect(say.until - say.at).toBe(readTicks(storyLines['pickup.clerk']));
    const click = () => { world.setInput({ left: { down: true, held: false, up: false } }); world.update(); world.clearInput(); world.update(); };
    // ...a first press completes the bubble (beat still running), a second press skips the beat.
    const started = world.tick; click();
    expect(world.storyLock).not.toBeNull(); expect(mission.state.l1!.say!.until).toBeLessThanOrEqual(world.tick);
    click();
    expect(world.storyLock).toBeNull(); expect(mission.state.l1!.carrying).toBe(true); expect(world.tick - started).toBeLessThan(6);
  } finally { world.dispose(); }
}, 120_000);

test('@E19 PO story beat holds until its bubble has been read', async () => {
  const { world, mission } = await loadL1(1);
  try {
    const counter = mission.def.anchors['parcel-counter'], p = world.entities.get(1)!;
    Object.assign(p.transform, { x: counter.x, z: counter.z + 1.9 }); world.physics.playerBody!.setTranslation(p.transform, true); world.update();
    world.setInput({ interact: true }); world.update(); world.clearInput();
    const say = mission.state.l1!.say!;
    let released = -1; for (let i = 0; i < 900 && released < 0; i++) { world.update(); if (!world.storyLock) released = world.tick; }
    expect(released).toBeGreaterThanOrEqual(say.until);
  } finally { world.dispose(); }
}, 120_000);

test('@E19 @E19-AC22 fire-station invitation repeats without moving or protecting the player; entry alone completes', async () => {
  const { world, mission } = await loadL1(1);
  try {
    for (let guard = 0; guard < 8 && mission.state.steps.firestation.status !== 'active'; guard++) {
      mission.setState('exited', true); world.update(); mission.completeObjective(); world.update();
    }
    expect(mission.state.steps.firestation.status).toBe('active');
    const door = mission.def.anchors['fire-bay-door'], inside = mission.def.anchors['fire-bay-trigger'];
    // Inward unit vector (door -> trigger): the bay opens east toward the game camera (PO 2026-10-07).
    const len = Math.hypot(inside.x - door.x, inside.z - door.z), ix = (inside.x - door.x) / len, iz = (inside.z - door.z) / len;
    const p = world.entities.get(1)!, outside = { x: door.x - ix * 2, z: door.z - iz * 2 };
    Object.assign(p.transform, outside); world.physics.playerBody!.setTranslation(p.transform, true); world.clearInput();
    const calls: number[] = []; world.events.on('story.say', e => { if (e.type === 'story.say' && e.text === 'Get in!') calls.push(e.tick); });
    const nav = world.infected!.nav, cell = nav.nearestCell(door.x - ix * 14, door.z - iz * 14, .45);
    const id = world.infected!.spawn('infected.runner', { x: nav.x(cell), z: nav.z(cell) }, { state: 'chase' });
    const chaser = world.entities.get(id)!, before = { ...chaser.transform };
    for (let i = 0; i < 250; i++) world.update();
    expect(calls.length).toBeGreaterThanOrEqual(2); expect(calls[1] - calls[0]).toBe(240);
    expect(mission.state.phase).toBe('playing'); expect(world.storyLock).toBeNull(); expect(mission.state.l1!.beat).toBeFalsy();
    expect(p.hidden).not.toBe(true); expect(p.survivor!.invulnerableUntil ?? 0).toBeLessThan(world.tick);
    expect(p.transform.x).toBeCloseTo(outside.x, 1); expect(p.transform.z).toBeCloseTo(outside.z, 1);
    expect(Math.hypot(chaser.transform.x - before.x, chaser.transform.z - before.z)).toBeGreaterThan(1);
    expect(mission.state.gates['fire-shutter']).toBe(true);
    // Normal held movement crosses the actual open aperture; no setTranslation on the entry path.
    for (let i = 0; i < 150 && mission.state.phase === 'playing'; i++) {
      world.setInput({ move: { x: ix, z: iz } }); world.update();
    }
    expect(mission.state.phase).toBe('result'); expect(world.storyLock).toBeNull();
    expect((p.transform.x - door.x) * ix + (p.transform.z - door.z) * iz).toBeGreaterThan(0);
    expect(Math.hypot(p.transform.x - inside.x, p.transform.z - inside.z)).toBeLessThanOrEqual(inside.radius);
    expect(mission.state.gates['fire-shutter']).toBe(false);
  } finally { world.dispose(); }
}, 120_000);
