import { expect, test } from 'vitest';
import { infectedDefinitions } from '../../../src/data/infected';
import { arena, hit, spawn, step } from './helpers';
test('T-E07-05 @E07 @E07-AC05 every archetype attack including death explosion has a sufficient telegraph', async () => {
  for (const def of infectedDefinitions) {
    const w = await arena(); const e = spawn(w, def.id.slice(9), 0.9); if (def.special === 'explode') e.health.current = 0;
    step(w, 130); const log = w.events.events(), attacks = log.filter((event) => event.type === 'combat.hit' && event.actionId.startsWith('infected.') && event.amount > 0);
    if (def.special !== 'scream') expect(attacks.length, def.id).toBeGreaterThan(0);
    for (const event of attacks) {
      if (event.type !== 'combat.hit') continue;
      const telegraph = log.find((entry) => entry.type === 'telegraph' && entry.sourceId === event.sourceId && entry.attackId === event.attackId);
      expect(telegraph, def.id).toBeDefined(); expect(event.tick - telegraph!.tick).toBeGreaterThanOrEqual(def.special === 'charge' ? 48 : 21);
    }
  }
});
test('T-E07-06a @E07 @E07-AC06 screamer alerts every infected within 20 m, not beyond', async () => {
  const w = await arena(); spawn(w, 'screamer', 1); const within = spawn(w, 'runner', 20.5, 0, 'idle'), beyond = spawn(w, 'runner', 22, 0, 'idle'); step(w, 51);
  expect(within.infected!.state).not.toBe('idle'); expect(beyond.infected!.state).toBe('idle');
});
test('T-E07-06b @E07 @E07-AC06 bloated burst damages both factions only within 3 m', async () => {
  const w = await arena(), bloated = spawn(w, 'bloated', 1), near = spawn(w, 'runner', 2, 0, 'idle'), far = spawn(w, 'runner', 5, 0, 'idle'); bloated.health.current = 0; step(w, 61);
  expect(w.entities.get(1)!.health.current).toBeLessThan(100); expect(near.health.current).toBe(5); expect(far.health.current).toBe(40);
});
test('T-E07-06c @E07 @E07-AC06 riot frontal bullets block while flank and explosives hit', async () => {
  const w = await arena(), e = spawn(w, 'riot', 2); e.transform.yaw = Math.PI;
  expect(hit(w, e.id, 20, 'bullet')).toBe(0); e.transform.yaw = 0; expect(hit(w, e.id, 20, 'bullet')).toBe(20); e.transform.yaw = Math.PI; expect(hit(w, e.id, 20, 'explosive')).toBe(20);
});
test('T-E07-06d @E07 @E07-AC06 nurse revives one downed runner once', async () => {
  const w = await arena(), runner = spawn(w, 'runner', 2, 0, 'idle'), nurse = spawn(w, 'nurse', 1); runner.health.current = 0; step(w, 25);
  expect(runner.health.current).toBe(40); expect(nurse.infected!.reviveUsed).toBe(true); runner.health.current = 0; step(w, 120); expect(runner.health.current).toBe(0); expect(w.events.events().filter((e) => e.type === 'infected.revived')).toHaveLength(1);
});
test('T-E07-06e @E07 @E07-AC06 brute charge displaces player at least 3 m after 0.8 s', async () => {
  const w = await arena(); spawn(w, 'brute', 5); step(w, 48); expect(Math.abs(w.entities.get(1)!.transform.x)).toBeLessThan(0.01); step(w, 45); expect(Math.abs(w.entities.get(1)!.transform.x)).toBeGreaterThanOrEqual(3);
});
test('T-E07-06f @E07 @E07-AC06 crawler slow ends after 3 hits or 1.5 s', async () => {
  const w = await arena(), crawler = spawn(w, 'crawler', 1); step(w, 22); expect(w.infected!.playerSpeedScale()).toBe(0.5); hit(w, crawler.id); hit(w, crawler.id); hit(w, crawler.id); step(w, 1); expect(w.infected!.playerSpeedScale()).toBe(1);
  crawler.infected!.cooldown = w.tick; step(w, 22); expect(w.infected!.playerSpeedScale()).toBe(0.5); crawler.infected!.cooldown = w.tick + 200; step(w, 90); expect(w.infected!.playerSpeedScale()).toBe(1);
});
test('T-E07-14 @E07 @E07-AC14 settled corpses persist past 60 seconds and beyond 100 bodies', async () => {
  const w = await arena(), e = spawn(w, 'runner', 10, 0, 'idle'), id = e.id; e.health.current = 0;
  step(w, 3601); expect(w.entities.get(id)).toMatchObject({ corpse: true, transform: { y: .7 }, infected: { state: 'dead' } });
  const ids: number[] = [];
  for (let i = 0; i < 101; i++) { const corpse = spawn(w, 'runner', i % 20 - 10, 10 + Math.floor(i / 20), 'idle'); ids.push(corpse.id); corpse.health.current = 0; }
  step(w, 121); expect(w.infected!.active).toHaveLength(0);
  for (const corpseId of [id, ...ids]) expect(w.entities.get(corpseId)?.corpse).toBe(true);
});
test('T-E07-15 @E07 @E07-AC15 leg-targeted explosions make surviving runners crawl with identical gameplay in every gore mode', async () => {
  for (const gore of ['Full', 'Reduced', 'Off'] as const) {
    const w = await arena(); w.infected!.gore = gore; const e = spawn(w, 'runner', 2, 0, 'idle'); hit(w, e.id, 10, 'explosive', 'leg');
    expect(e.health.current).toBe(30); expect(e.infected!.speed).toBe(2); expect(e.infected!.legLost).toBe(true); expect(e.infected!.detached).toBe(gore === 'Full');
  }
});

test('T-E07-role-extras @E07 hazmat aura, fire immunity, armor and butcher combo are mechanical roles', async () => {
  const w = await arena(), hazmat = spawn(w, 'hazmat', 2), firefighter = spawn(w, 'firefighter', 10, 0, 'idle');
  const toxic = { kind: 'toxic' as const, duration: 2, dps: 3, maxStacks: 1, slow: 0.25 };
  w.combat!.status.apply(hazmat, toxic, 1, 'weapon.test'); w.combat!.status.apply(firefighter, { ...toxic, kind: 'burning' }, 1, 'weapon.test'); expect(hazmat.combat!.statuses).toHaveLength(0); expect(firefighter.combat!.statuses).toHaveLength(0);
  step(w, 22); expect(w.entities.get(1)!.combat!.statuses.some((s) => s.kind === 'toxic')).toBe(true);
  const armored = spawn(w, 'armored', 10, 5, 'idle'); armored.transform.yaw = Math.PI; expect(hit(w, armored.id, 40, 'bullet')).toBe(10); armored.transform.yaw = 0; expect(hit(w, armored.id, 40, 'bullet')).toBe(40);
  const w2 = await arena(), butcher = spawn(w2, 'butcher', 1); w2.combat!.damage.god = true; step(w2, 70); expect(w2.events.events().filter((e) => e.type === 'infected.attack' && e.sourceId === butcher.id)).toHaveLength(3);
});
