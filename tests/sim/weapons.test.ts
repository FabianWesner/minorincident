import { expect, test } from 'vitest';
import { catalog, action } from '../../src/data/actions/catalog';
import { arena, dummy, equip, fire, health, step } from './combat/helpers';

test('T-E06-03 @E06 @E06-AC03 close shotgun / distant SMG role differentiation and heavy ranges', async () => {
  const dps = async (id: string, range: number): Promise<number> => {
    const w = await arena(); equip(w, [id]); w.combat!.assist.setting = 'Off';
    const target = dummy(w, range, 0, 100000); w.setInput({ aim: { x: 1, z: 0 }, left: { down: false, held: true, up: false } }); step(w, 600);
    return (100000 - health(w, target)) / 10;
  };
  expect(await dps('weapon.shotgun', 3)).toBeGreaterThan(await dps('weapon.smg', 3));
  expect(await dps('weapon.smg', 12)).toBeGreaterThan(await dps('weapon.shotgun', 12));
  const w = await arena(); equip(w, ['weapon.hunting-rifle']); Object.assign(w.entities.get(1)!.transform, { x: -12.5 }); w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true); const target = dummy(w, 12.5); fire(w); step(w, 2); expect(health(w, target)).toBeLessThan(100);
  expect(action('weapon.rocket-launcher').splash!.radius).toBeGreaterThanOrEqual(3.5);
  Object.assign(w.entities.get(1)!.transform, { x: 0 }); w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true);
  equip(w, ['weapon.rocket-launcher']); const center = dummy(w, 7, 0, 1000), edge = dummy(w, 7, 3.5, 1000); fire(w); step(w, 40); expect(health(w, center)).toBeLessThan(1000); expect(health(w, edge)).toBeLessThan(1000);
});

test('T-E06-04 @E06 @E06-AC04 pistol alerts idle infected within 25m; melee kill only within 6m', async () => {
  for (const [id, radius] of [['weapon.pistol', 25], ['weapon.bat', 6]] as const) {
    const w = await arena(); equip(w, [id]); dummy(w, 1, 0, 1);
    const near = w.spawnDummy('infected.runner', { x: 0, z: radius - 0.1 }, { reactive: true });
    const outside = w.spawnDummy('infected.runner', { x: 0, z: radius + 0.1 }, { reactive: true });
    fire(w); step(w, 10);
    const alerts = w.events.events().filter((e) => e.type === 'ai.alerted' && e.cause === 'noise');
    expect(alerts.some((e) => e.type === 'ai.alerted' && e.targetId === near)).toBe(true);
    expect(alerts.some((e) => e.type === 'ai.alerted' && e.targetId === outside)).toBe(false);
    expect(w.events.events().some((e) => e.type === 'noise' && e.radius === radius)).toBe(true);
  }
});

test('T-E06-05 @E06 @E06-AC05 Molotov burns a 4m zone for 6s and infected route around it', async () => {
  const w = await arena(); equip(w, ['weapon.molotov']); w.combat!.damage.god = true;
  const inside = dummy(w, 6, 1, 1000), outside = dummy(w, 6, 4.2, 1000);
  fire(w, 'LEFT', { x: 1, z: 0 }, { x: 6, z: 0 }); step(w, 40);
  const zone = w.combat!.effects.zones[0]; expect(zone.kind).toBe('fire'); expect(zone.radius).toBe(4); expect(zone.expires - zone.created).toBe(360);
  expect(w.entities.get(inside)!.combat!.statuses.some((s) => s.kind === 'burning')).toBe(true);
  expect(w.entities.get(outside)!.combat!.statuses).toHaveLength(0);
  const walker = w.spawnDummy('infected.runner', { x: 11.2, z: 0 }, { reactive: true, hp: 1000 });
  w.combat!.effects.noise({ x: 0, z: 0 }, 25, 'weapon.pistol');
  let lateral = 0;
  for (let i = 0; i < 300; i++) { step(w, 1); const p = w.entities.get(walker)!.transform; lateral = Math.max(lateral, Math.abs(p.z)); expect(Math.hypot(p.x - 6, p.z)).toBeGreaterThanOrEqual(4); }
  expect(lateral).toBeGreaterThan(4); expect(w.entities.get(walker)!.transform.x).toBeLessThan(5);
  step(w, zone.expires - w.tick); expect(w.combat!.effects.zones).toHaveLength(0); expect(health(w, inside)).toBeLessThan(990);
});

test('T-E06-06 @E06 @E06-AC06 firecracker attracts all infected within 15m for exactly 5s', async () => {
  const w = await arena(); equip(w, ['weapon.firecracker-lure']);
  const near = w.spawnDummy('infected.runner', { x: 6, z: 14.9 }, { reactive: true });
  const outside = w.spawnDummy('infected.runner', { x: 6, z: 15.1 }, { reactive: true });
  fire(w, 'LEFT', { x: 1, z: 0 }, { x: 6, z: 0 }); step(w, 35);
  const zone = w.combat!.effects.zones[0]; expect(zone.expires - zone.created).toBe(300);
  expect(w.entities.get(near)!.hearing!.target).toEqual({ x: 6, z: 0 }); expect(w.entities.get(outside)!.hearing!.mode).toBe('idle');
  const before = w.entities.get(near)!.transform.z; step(w, 60); expect(w.entities.get(near)!.transform.z).toBeLessThan(before);
  w.combat!.effects.noise({ x: -5, z: -5 }, 35, 'weapon.pistol'); expect(w.entities.get(near)!.hearing!.target).toEqual({ x: 6, z: 0 });
  step(w, zone.expires - w.tick - 1); expect(w.entities.get(near)!.hearing!.mode).toBe('lured'); step(w, 1); expect(w.entities.get(near)!.hearing!.mode).toBe('idle');
});

test('T-E06-07 @E06 @E06-AC07 walking over pickup fills selected rack or replaces current and drops old item', async () => {
  const w = await arena(); equip(w, ['weapon.bat'], ['weapon.pistol']);
  w.combat!.runner.loadout.state.selectedSide = 'RIGHT';
  const pickup = w.combat!.pickups.spawn('weapon.smg', { x: 1, z: 0 });
  w.setInput({ move: { x: 1, z: 0 } }); step(w, 15); w.clearInput(); step(w, 10);
  expect(w.entities.get(pickup)).toBeUndefined(); expect(w.combat!.runner.loadout.state.RIGHT.rack.map((s) => s.id)).toEqual(['weapon.pistol', 'weapon.smg']);
  expect(w.combat!.runner.loadout.state.LEFT.rack.map((s) => s.id)).toEqual(['weapon.bat']);
  equip(w, ['weapon.bat', 'weapon.knife', 'weapon.crowbar']); w.combat!.runner.loadout.state.LEFT.index = 1;
  w.combat!.pickups.spawn('weapon.katana', w.entities.get(1)!.transform); step(w, 1);
  expect(w.combat!.runner.loadout.current('LEFT').id).toBe('weapon.katana');
  const drops = w.query({ kind: 'pickup' }); expect(drops).toHaveLength(1); expect(drops[0].pickup!.actionId).toBe('weapon.knife');
  step(w, 120); expect(w.combat!.runner.loadout.current('LEFT').id).toBe('weapon.katana');
  Object.assign(w.entities.get(1)!.transform, { x: 4, z: 0 }); w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true); step(w, 2);
  Object.assign(w.entities.get(1)!.transform, { x: drops[0].transform.x, z: drops[0].transform.z }); w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true); step(w, 2); expect(w.combat!.runner.loadout.current('LEFT').id).toBe('weapon.knife');
});

for (const side of ['LEFT', 'RIGHT'] as const) for (const def of Object.values(catalog)) test(`T-E06-02-${side}-${def.id} @E06 @E06-AC02 every action resolves its role on ${side}`, async () => {
  const w = await arena(); equip(w, [def.id], [def.id]); w.combat!.damage.god = true;
  const target = w.spawnDummy('infected.runner', { x: 1, z: 0 }, { reactive: true, hp: 1000 });
  if (def.effect?.kind === 'smoke') w.combat!.effects.noise({ x: 0, z: 0 }, 25, 'weapon.pistol');
  fire(w, side, { x: 1, z: 0 }, { x: 1, z: 0 }); step(w, 120);
  expect(w.events.events().some((e) => e.type === 'combat.attack' && e.actionId === def.id && e.side === side)).toBe(true);
  if (def.damage || def.status) { expect(w.events.events().some((e) => e.type === 'combat.hit' && e.actionId === def.id && e.targetId === target)).toBe(true); if (def.status) expect(w.entities.get(target)!.combat!.statuses.some((s) => s.kind === def.status!.kind)).toBe(true); }
  else if (def.effect?.kind === 'lure') expect(w.entities.get(target)!.hearing!.mode).toBe('lured');
  else if (def.effect?.kind === 'smoke') expect(w.entities.get(target)!.hearing!.mode).toBe('idle');
  else if (def.effect?.kind === 'shield') { w.combat!.damage.god = false; expect(w.combat!.effects.shielded(w.entities.get(1)!.transform)).toBe(true); expect(w.combat!.damage.apply({ attackId: 0, actionId: 'test', sourceId: target, targetId: 1, origin: { x: 1, z: 0 }, direction: { x: -1, z: 0 }, base: 10, multiplier: 1, type: 'melee', knockback: 0, stagger: 0 })).toBe(0); }
  else if (def.effect?.kind === 'adrenaline') expect(w.combat!.effects.speedMultiplier).toBe(1.5);
  else throw new Error(`Unverified utility ${def.id}`);
});

test('T-E06-utility-timers @E06 @E06-AC02 @E06-AC10 utilities demonstrate effects and restore their timed state', async () => {
  const w = await arena(); equip(w, ['ability.adrenaline'], ['ability.shield-bubble']);
  fire(w); w.setInput({ move: { x: 1, z: 0 } }); step(w, 60);
  expect(w.entities.get(1)!.transform.x).toBeGreaterThan(6); w.clearInput(); step(w, 250); expect(w.combat!.effects.speedMultiplier).toBe(1);
  const enemy = dummy(w, 1); fire(w, 'RIGHT'); step(w, 1);
  const hit = { attackId: 0, actionId: 'test', sourceId: enemy, targetId: 1, origin: { x: 1, z: 0 }, direction: { x: -1, z: 0 }, base: 10, multiplier: 1, type: 'melee' as const, knockback: 0, stagger: 0 };
  expect(w.combat!.damage.apply(hit)).toBe(0); step(w, 240); expect(w.combat!.damage.apply(hit)).toBe(10);
});

test('T-E06-perf @E06 @perf sustained weapons, fire and 200 reactive infected stay below 4ms sim p95', async () => {
  const { performance } = await import('node:perf_hooks'), { mkdirSync, writeFileSync } = await import('node:fs');
  const w = await arena(); equip(w, ['weapon.smg'], ['weapon.molotov']); w.combat!.damage.god = true; w.combat!.runner.infiniteCharges = true;
  for (let i = 0; i < 200; i++) w.spawnDummy('infected.runner', { x: 2 + i % 10, z: Math.floor(i / 10) - 10 }, { reactive: true, hp: 100000 });
  const frame = (await import('../../src/input/InputFrame')).emptyInput(); frame.aim = { x: 1, z: 0 }; frame.aimPoint = { x: 6, z: 0 }; frame.left.held = true;
  const times: number[] = [];
  for (let i = 0; i < 3720; i++) { frame.right.down = i % 360 === 0; w.applyInput(frame, 'keyboard'); const start = performance.now(); w.update(); if (i >= 120) times.push(performance.now() - start); }
  times.sort((a, b) => a - b); const data = { ticks: times.length, infected: 200, simMsP95: times[Math.floor(times.length * 0.95)], budgetMs: 4 };
  mkdirSync('test-results/epics/E06', { recursive: true }); writeFileSync('test-results/epics/E06/sim-perf.json', JSON.stringify(data, null, 2)); expect(data.simMsP95).toBeLessThan(4);
});

test('T-E06-smoke-role @E06 @E06-AC02 @E06-AC10 smoke breaks investigation and suppresses hearing for 12s', async () => {
  const w = await arena(); equip(w, ['weapon.smoke-grenade']);
  const id = w.spawnDummy('infected.runner', { x: 4, z: 0 }, { reactive: true });
  w.combat!.effects.noise({ x: 0, z: 0 }, 25, 'weapon.pistol'); expect(w.entities.get(id)!.hearing!.mode).toBe('investigate');
  fire(w, 'LEFT', { x: 1, z: 0 }, { x: 4, z: 0 }); step(w, 30);
  const zone = w.combat!.effects.zones[0], position = { ...w.entities.get(id)!.transform };
  expect(zone.kind).toBe('smoke'); expect(zone.radius).toBe(6); expect(zone.expires - zone.created).toBe(720);
  expect(position.x).toBeGreaterThan(2); expect(w.entities.get(id)!.hearing!.mode).toBe('idle');
  w.combat!.effects.noise({ x: 0, z: 0 }, 25, 'weapon.pistol'); step(w, 60); expect(w.entities.get(id)!.transform).toEqual(position);
  step(w, zone.expires - w.tick); w.combat!.effects.noise({ x: 0, z: 0 }, 25, 'weapon.pistol'); expect(w.entities.get(id)!.hearing!.mode).toBe('investigate'); step(w, 30); expect(w.entities.get(id)!.transform.x).toBeLessThan(position.x);
});
