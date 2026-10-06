import { expect, test } from 'vitest';
import { npcs } from '../../../src/data/npcs';
import { npcWorld, step, teleport } from './helpers';
test('T-E08-04 @E08 @E08-AC04 three-minute combat bot: corgi close 95% and no player obstruction', async () => {
  const w = await npcWorld(), corgi = [...w.entities.iterate()].find(e => e.companion)!;
  w.combat!.damage.god = false;
  let close = 0, blocked = 0, maxBlocked = 0; w.setInput({ move: { x: 1, z: 0 }, left: { down: false, held: true, up: false }, aim: { x: 1, z: 0 } });
  for (let tick = 0; tick < 10800; tick++) {
    const p = w.entities.get(1)!;
    if (tick % 300 === 0) { const phase = (tick / 300) % 4; w.setInput({ move: { x: phase === 0 ? 1 : phase === 2 ? -1 : 0, z: phase === 1 ? 1 : phase === 3 ? -1 : 0 } }); }
    if (tick % 600 === 0) { const id = w.infected!.spawn('infected.runner', { x: p.transform.x + 5, z: p.transform.z }); w.entities.get(id)!.health.current = 20; }
    if (tick % 30 === 0) { const threat = w.infected!.active.find(e => e.health.current > 0); if (threat) { const dx = threat.transform.x - p.transform.x, dz = threat.transform.z - p.transform.z, d = Math.hypot(dx, dz) || 1; w.setInput({ aim: { x: dx / d, z: dz / d } }); } }
    const x = p.transform.x, z = p.transform.z; w.update();
    if (Math.hypot(p.transform.x - corgi.transform.x, p.transform.z - corgi.transform.z) <= 6) close++;
    blocked = Math.hypot(p.transform.x - x, p.transform.z - z) < .005 ? blocked + 1 : 0; maxBlocked = Math.max(maxBlocked, blocked);
  }
  expect(close / 10800).toBeGreaterThanOrEqual(.95); expect(maxBlocked).toBeLessThanOrEqual(30); expect(corgi.health.current).toBe(100); expect(w.entities.get(1)!.health.current).toBeGreaterThan(0); expect(w.events.events().some(e => e.type === 'combat.attack')).toBe(true); w.dispose();
});
test('T-E08-05 @E08 @E08-AC05 approaching offscreen threat within 18m barks with unit direction', async () => {
  const w = await npcWorld(); w.infected!.director.camera.halfWidth = 5; w.infected!.director.camera.halfDepth = 5;
  const threat = w.infected!.spawn('infected.runner', { x: 17, z: 0 }, { state: 'chase' }); step(w, 1);
  expect(w.events.events().find(e => e.type === 'corgi.bark')).toMatchObject({ threatId: threat, direction: { x: 1, z: 0 } }); w.dispose();
});
test('T-E08-06 @E08 @E08-AC06 escort navigates maze behind moving player with no wall crossing', async () => {
  const w = await npcWorld('maze'); teleport(w, -23, 0); const id = w.npcs!.escorts.spawn({ x: -25, z: 0 }), e = w.entities.get(id)!;
  const route = [{ x: -13, z: 4 }, { x: -7, z: 4 }, { x: -3, z: -3 }, { x: 3, z: -3 }, { x: 7, z: 4 }, { x: 13, z: 4 }, { x: 24, z: 0 }];
  for (const target of route) {
    for (let i = 0; i < 1500; i++) {
      const p = w.entities.get(1)!, dx = target.x - p.transform.x, dz = target.z - p.transform.z, d = Math.hypot(dx, dz);
      if (d < .4) break; w.setInput({ move: { x: dx / d * .55, z: dz / d * .55 } }); w.update();
      expect(w.infected!.nav.clear(e.transform.x, e.transform.z, .35)).toBe(true);
    }
  }
  w.clearInput(); step(w, 240); const p = w.entities.get(1)!; expect(Math.hypot(p.transform.x - 24, p.transform.z)).toBeLessThan(1); expect(Math.hypot(p.transform.x - e.transform.x, p.transform.z - e.transform.z)).toBeLessThanOrEqual(6);
  const before = { ...e.transform }; step(w, 120); expect(e.transform).toEqual(before); w.dispose();
});
test('T-E08-07 @E08 @E08-AC07 2s stand revives 50%; unattended 20s down fails mission', async () => {
  for (const revive of [true, false]) {
    const w = await npcWorld(), id = w.npcs!.escorts.spawn({ x: revive ? 1 : 10, z: 0 }), e = w.entities.get(id)!; e.health.current = 0; step(w, 1); expect(e.escort!.state).toBe('downed');
    if (revive) { step(w, 118); expect(e.health.current).toBe(0); step(w, 1); expect(e.health.current).toBe(50); expect(w.events.events().some(e => e.type === 'escort.revived')).toBe(true); }
    else { step(w, 1199); expect(e.escort!.state).toBe('downed'); step(w, 1); expect(w.events.events().find(e => e.type === 'mission.failed')).toMatchObject({ reason: 'escort-died' }); }
    w.dispose();
  }
});
test('T-E08-15 @E08 @E08-AC15 protected kids/brother never bitten, targeted or gored in full L2 duration', async () => {
  const w = await npcWorld(); w.npcs!.civilians.level = 2; const child = w.npcs!.civilians.spawn('kid', { x: 3, z: 0 }, { child: true }), brother = w.npcs!.escorts.spawn({ x: 1, z: 0 }, true);
  const source = w.infected!.spawn('infected.butcher', { x: 3, z: 0 }); expect(w.npcs!.civilians.grab(child, source, true)).toBe(false); expect(w.npcs!.civilians.grab(brother, source, true)).toBe(false);
  w.entities.get(brother)!.health.current = 0; step(w, 120); expect(w.entities.get(brother)!.health.current).toBe(50);
  const events: import('../../../src/sim/world/types').GameEvent[] = []; const stopAttack = w.events.on('infected.attack', e => events.push(e)), stopGrab = w.events.on('civilian.grabbed', e => events.push(e));
  step(w, 36000); expect(events.filter(e => 'targetId' in e && [child, brother].includes(e.targetId))).toHaveLength(0);
  expect(w.entities.get(child)!.civilian).toMatchObject({ state: 'calm', adult: false, gore: false }); expect(w.entities.get(brother)!.escort).toMatchObject({ child: true, gore: false }); stopAttack(); stopGrab(); w.dispose();
});
test('@E08 corgi fetch, courage recovery and E06 lure use production systems', async () => {
  const w = await npcWorld(), corgi = [...w.entities.iterate()].find(e => e.companion)!;
  const id = w.pickups!.spawn('item', { x: 5, z: 0 }, 'key'); step(w, 100); expect(w.entities.get(1)!.inventory).toContain('key'); expect(w.events.events().find(e => e.type === 'corgi.fetched')).toMatchObject({ pickupId: id });
  w.npcs!.companion.hit(corgi, 100); step(w, npcs.corgiRecoveryTicks - 1); expect(corgi.companion!.state).toBe('hide'); step(w, 1); expect(corgi.companion).toMatchObject({ state: 'follow', courage: 100 });
  const enemy = w.infected!.spawn('infected.runner', { x: 10, z: 0 }); w.combat!.setLoadout(['weapon.bat'], ['ability.corgi-lure']); w.setInput({ right: { down: true, held: true, up: false } }); step(w, 40); expect(w.entities.get(enemy)!.noiseTarget?.id).toBe(corgi.id); w.dispose();
});

test('@E08 escort seeks reachable cover behind a wall within the 8m threat radius', async () => {
  const w = await npcWorld('maze'); teleport(w, -20, 0);
  const id = w.npcs!.escorts.spawn({ x: -11, z: 2 }), e = w.entities.get(id)!, source = w.infected!.spawn('infected.runner', { x: -13, z: 0 });
  step(w, 1); expect(e.escort!.state).toBe('cover'); const cover = e.escort!.cover!; expect(cover).not.toBeNull(); expect(w.infected!.nav.clear(cover.x, cover.z, .65)).toBe(true);
  expect(w.infected!.nav.visible(w.entities.get(source)!.transform, cover, .1)).toBe(false);
  for (let i = 0; i < 180; i++) { w.update(); expect(w.infected!.nav.clear(e.transform.x, e.transform.z, .35)).toBe(true); }
  w.entities.get(source)!.health.current = 0; step(w, 1); expect(e.escort!.state).toBe('follow'); w.dispose();
});

test('@E08 @E08-AC15 unattended brother fails mission while remaining downed, never dead or bitten', async () => {
  const w = await npcWorld('turning-probe'), id = w.npcs!.escorts.spawn({ x: 10, z: 0 }, true), e = w.entities.get(id)!;
  e.health.current = 0; step(w, 1201); expect(e.escort).toMatchObject({ state: 'downed', child: true, failed: true, gore: false });
  expect(w.events.events().filter(e => e.type === 'mission.failed')).toHaveLength(1); step(w, 60); expect(w.events.events().filter(e => e.type === 'mission.failed')).toHaveLength(1); w.dispose();
});
