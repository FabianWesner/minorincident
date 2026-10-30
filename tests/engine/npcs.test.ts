// NPC core: civilians (panic, grab, turning), escorts and the corgi use one NPC system in every level.
import { afterEach, expect, test } from 'vitest';
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { npcs } from '../../src/data/npcs';
import { adultMaleStandingHeight, civilianHeight, fitCivilianHeight, heroineStandingHeight } from '../../src/render/npc/figureHeight';
import { SimWorld } from '../../src/sim/world/SimWorld';

const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds.splice(0)) w.dispose(); });
async function world(name = 'horde-arena', seed = 1) { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario(name, seed); w.combat!.damage.god = true; return w; }
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };
function teleport(w: SimWorld, x: number, z: number) { const p = w.entities.get(1)!; p.transform.x = x; p.transform.z = z; w.physics.playerBody!.setTranslation(p.transform, true); w.physics.playerBody!.setLinvel({ x: 0, y: 0, z: 0 }, true); w.spatial.set(1, x, z); }
function pair(w: SimWorld) { const id = w.npcs!.civilians.spawn('cashier', { x: 5, z: 0 }), attacker = w.infected!.spawn('infected.runner', { x: 5, z: 0 }); return { e: w.entities.get(id)!, attacker: w.entities.get(attacker)! }; }

test('civilians: seeded grab → bite → down → glowing eyes → rising → infected cycle in place; panic flees; a kill during the grab saves', async () => {
  expect(civilianHeight('npc.civilian-woman-a')).toBeCloseTo(heroineStandingHeight, 3);
  expect(civilianHeight('npc.civilian-adult-f')).toBeCloseTo(heroineStandingHeight, 3);
  expect(civilianHeight('npc.lab-tech-a')).toBeCloseTo(heroineStandingHeight, 3);
  expect(civilianHeight('npc.dale.aftermath')).toBeCloseTo(adultMaleStandingHeight, 3);
  expect(adultMaleStandingHeight / heroineStandingHeight).toBeGreaterThanOrEqual(1.05);
  expect(adultMaleStandingHeight / heroineStandingHeight).toBeLessThanOrEqual(1.12);
  expect(civilianHeight('npc.civilian-elderly') / adultMaleStandingHeight).toBeGreaterThanOrEqual(.95);
  expect(civilianHeight('npc.civilian-elderly')).toBeLessThanOrEqual(adultMaleStandingHeight);
  expect(civilianHeight('npc.civilian-kid')).toBe(1.4744);
  expect(civilianHeight('npc.brother')).toBe(1.4265);
  const calibrated = new Group(), rig = new Group(), body = new Mesh(new BoxGeometry(.4, 1.2, .3), new MeshBasicMaterial());
  rig.name = 'root'; rig.userData.preserveAuthoredBodyScale = true; body.name = 'skin_body'; calibrated.add(rig); rig.add(body);
  fitCivilianHeight(calibrated, 'npc.depot-clerk');
  expect(new Box3().setFromObject(body).getSize(new Vector3()).y).toBeCloseTo(civilianHeight('npc.depot-clerk'), 4);

  const timings = new Set<number>();
  for (const seed of [1, 2, 3, 4, 5]) {
    const w = await world('horde-arena', seed), { e, attacker } = pair(w);
    expect(w.npcs!.civilians.grab(e.id, attacker.id, true)).toBe(true);
    step(w, 89); expect(e.civilian!.state).toBe('grabbed'); step(w, 1); expect(e.civilian!.state).toBe('bitten');
    step(w, e.civilian!.until - w.tick); expect(e.civilian!.state).toBe('down');
    const down = e.civilian!.downTicks; timings.add(down);
    step(w, down - npcs.eyesTicks - 1); expect(e.civilian!.eyesGlow).toBe(false); step(w, 1); expect(e.civilian!.eyesGlow).toBe(true);
    step(w, npcs.eyesTicks); expect(e.civilian!.state).toBe('rising'); const p = { x: e.transform.x, z: e.transform.z };
    step(w, 72); expect(e.civilian!.state).toBe('infected');
    expect(w.events.events().find(ev => ev.type === 'civilian.turned')).toMatchObject({ variant: 'inf.cashier', position: p });
  }
  expect(timings.size).toBeGreaterThan(1);

  const f = await world(), jogger = f.npcs!.civilians.spawn('jogger', { x: 10, z: 0 }), sourceId = f.infected!.spawn('infected.runner', { x: 2, z: 0 });
  f.events.emit({ type: 'infected.attack', tick: f.tick, sourceId, targetId: 1, amount: 10, special: 'lunge', attackId: 1 });
  step(f, 30); expect(f.entities.get(jogger)!.civilian!.state).toBe('flee'); const initial = f.entities.get(jogger)!.transform.x;
  step(f, 180); expect(f.entities.get(jogger)!.transform.x).toBeGreaterThan(initial + 10);

  for (const mode of ['kill', 'late'] as const) {
    const s = await world(), { e, attacker } = pair(s); s.npcs!.civilians.grab(e.id, attacker.id, true); step(s, mode === 'late' ? 90 : 30);
    attacker.health.current = 0; step(s, 1);
    expect(s.events.events().some(ev => ev.type === 'civilian.saved'), mode).toBe(mode !== 'late');
  }
});

test('escort: follows through a maze without crossing walls, a 2 s stand revives to 50 %, unattended 20 s down fails the mission', async () => {
  const w = await world('maze'); teleport(w, -23, 0);
  const e = w.entities.get(w.npcs!.escorts.spawn({ x: -25, z: 0 }))!;
  for (const target of [{ x: -13, z: 4 }, { x: -7, z: 4 }, { x: -3, z: -3 }, { x: 3, z: -3 }, { x: 7, z: 4 }, { x: 13, z: 4 }, { x: 24, z: 0 }]) {
    for (let i = 0; i < 1500; i++) {
      const p = w.entities.get(1)!, dx = target.x - p.transform.x, dz = target.z - p.transform.z, d = Math.hypot(dx, dz);
      if (d < .4) break; w.setInput({ move: { x: dx / d * .55, z: dz / d * .55 } }); w.update();
      expect(w.infected!.nav.clear(e.transform.x, e.transform.z, .35)).toBe(true);
    }
  }
  w.clearInput(); step(w, 240);
  const p = w.entities.get(1)!;
  expect(Math.hypot(p.transform.x - 24, p.transform.z)).toBeLessThan(1);
  expect(Math.hypot(p.transform.x - e.transform.x, p.transform.z - e.transform.z)).toBeLessThan(4);

  for (const revive of [true, false]) {
    const r = await world('civ-street'), id = r.npcs!.escorts.spawn({ x: revive ? 1 : 10, z: 0 }), escort = r.entities.get(id)!;
    escort.health.current = 0; step(r, 1); expect(escort.escort!.state).toBe('downed');
    if (revive) { step(r, 119); expect(escort.health.current).toBe(50); }
    else { step(r, 1200); expect(r.events.events().find(ev => ev.type === 'mission.failed')).toMatchObject({ reason: 'escort-died' }); }
  }
});

test('corgi: warns of an offscreen threat within 18 m with a unit direction', async () => {
  const w = await world('civ-street'); w.infected!.director.camera.halfWidth = 5; w.infected!.director.camera.halfDepth = 5;
  const threat = w.infected!.spawn('infected.runner', { x: 17, z: 0 }, { state: 'chase' }); step(w, 1);
  expect(w.events.events().find(e => e.type === 'corgi.bark')).toMatchObject({ threatId: threat, direction: { x: 1, z: 0 } });
});
