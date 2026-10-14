import { afterEach, expect, test } from 'vitest';
import { loadL4 } from '../../tools/sim-runner/l4Bots';
import { spawnSetPiece } from '../../src/sim/missions/L4Spectacle';
import { l4AlphaEmergence } from '../../src/levels/L4/layout';
import type { SimWorld } from '../../src/sim/world/SimWorld';

let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
for (const tier of ['high', 'low'] as const) for (const seed of [1, 2, 3]) test(`L4 war tank Alphas resume combat and bodies persist (${tier}, seed ${seed}) @E22-AC12 @E22-AC14`, async () => {
  const { world: w, mission: m } = await loadL4(seed, tier); world = w;
  const s = m.state.l4!, ai = w.infected!, p = w.entities.get(1)!;
  // Start at the reported battle state, leaving production controller/AI/cleanup active.
  s.phase = 'war'; s.turnAt = 1; s.warAt = 1; s.waveAt = 1e9; s.insideAt = 1e9;
  s.alphaAnchors = l4AlphaEmergence.map(e => e.anchor);
  p.hidden = false; w.storyLock = null; w.combat!.damage.god = true;
  const clear = (x: number, z: number) => {
    const cell = ai.nav.nearestCell(x, z); expect(cell).toBeGreaterThanOrEqual(0);
    return { x: ai.nav.x(cell), z: ai.nav.z(cell) };
  };
  Object.assign(p.transform, clear(-12, 25)); w.physics.playerBody!.setTranslation(p.transform, true); w.player!.locomotion.reset();
  const tank = spawnSetPiece(w, 'veh.tank', { x: -20, z: 22, yaw: 0 });
  s.tankId = tank.id; s.tankPhase = 'hold'; s.tankFireAt = 1e9;
  const at = clear(-16, 28), id = ai.spawn('infected.alpha', at, { yaw: -Math.atan2(p.transform.z - at.z, p.transform.x - at.x) });
  const alpha = w.entities.get(id)!; alpha.combat!.allyResist = 0;
  s.alphaIds = [id]; s.director.alphaJobs = [{ alphaId: id, job: 'line', stage: 'tank', startedAt: w.tick }];
  alpha.infected!.scripted = clear(-20, 25);
  let engaged = -1, idle = 0, worstIdle = 0;
  for (let i = 0; i < 600; i++) {
    s.turnAt = Math.max(1, w.tick); // Keep the war beat stable while testing its live brains.
    const before = { ...alpha.transform }; w.update();
    const busy = !!alpha.infected!.specialAttack || alpha.infected!.state === 'attack';
    if (!alpha.infected!.scripted && (busy || distance(before, alpha.transform) > .005) && engaged < 0) engaged = i;
    idle = !busy && distance(before, alpha.transform) < .005 ? idle + 1 : 0; worstIdle = Math.max(worstIdle, idle);
  }
  expect(engaged).toBeGreaterThanOrEqual(0); expect(engaged).toBeLessThanOrEqual(120);
  expect(worstIdle).toBeLessThanOrEqual(180);
  expect(w.events.events().some(ev => ev.type === 'infected.attack' && ev.sourceId === id)).toBe(true);
  // Under spawn pressure a knocked-down regular keeps its timer and rises on schedule.
  const runner = w.entities.get(ai.spawn('infected.runner', clear(-14, 27)))!;
  w.combat!.damage.apply({ sourceId: 1, targetId: runner.id, attackId: 999, actionId: 'weapon.bat', origin: p.transform, direction: { x: 0, z: 0 }, base: 999, multiplier: 1, type: 'melee', stagger: 0, knockback: 0 });
  const recoverAt = runner.infected!.recoverAt;
  ai.director.levelCap = tier === 'high' ? ai.director.count : ai.director.count * 2;
  for (let i = 0; w.tick < recoverAt; i++) { s.turnAt = w.tick; w.update(); }
  expect(w.entities.get(runner.id)).toBe(runner);
  expect(runner.health.current).toBeGreaterThan(0); expect(runner.corpse).toBeFalsy();
  ai.director.levelCap = 200;
  // A dense pile exceeds the former per-cell cleanup limit. Permanent bodies must all survive.
  const ids: number[] = [];
  for (let i = 0; i < 10; i++) {
    const cid = ai.spawn('infected.runner', clear(-12 + i * .1, 27)); ids.push(cid);
    w.combat!.damage.apply({ sourceId: 1, targetId: cid, attackId: 1000 + i, actionId: 'weapon.grenade', origin: p.transform, direction: { x: 0, z: 0 }, base: 999, multiplier: 1, type: 'explosive', stagger: 0, knockback: 0 });
  }
  // Jump fixed time only after the normal death/settle lifecycle, then tick production cleanup through 120 seconds.
  for (let i = 0; i < 150; i++) { s.turnAt = w.tick; w.update(); }
  for (const cid of ids) expect(w.entities.get(cid)?.corpse).toBe(true);
  for (let second = 0; second < 121; second++) {
    w.tick += 60; s.turnAt = w.tick; w.update();
    for (const cid of ids) expect(w.entities.get(cid)?.corpse, `corpse ${cid} at ${second}s`).toBe(true);
  }
}, 120_000);
