import { afterEach, describe, expect, test, vi } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { infectedDefinitions } from '../../../src/data/infected';
import type { CoverWall } from '../../../src/sim/combat/HitQuery';
import { SimWorld } from '../../../src/sim/world/SimWorld';

const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });
async function setup(archetype = 'infected.runner', l1 = false, civilian = false, distance = 1.8) {
  const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario('horde-arena', 1);
  if (l1) w.infected!.configureL1v2();
  w.combat!.damage.god = true;
  const p = w.entities.get(1)!;
  Object.assign(p.transform, { x: civilian ? -30 : -distance, z: 0 });
  w.physics.playerBody!.setTranslation(p.transform, true); w.spatial.set(1, p.transform.x, 0);
  const victimId = civilian ? w.npcs!.civilians.spawn('worker', { x: -distance, z: 0 }, { waypoints: [{ x: -distance, z: 0 }] }) : 1;
  const e = w.entities.get(w.infected!.spawn(archetype, { x: 0, z: 0 }, { yaw: 0, perched: false }))!;
  // Ordinary roaming cat; authored perch ambushes retain their own reveal rule.
  if (archetype === 'infected.cat') e.infected!.hidden = false;
  const alerts: { tick: number; sourceId: number; cause: string }[] = [];
  w.events.on('ai.alerted', ev => { if (ev.type === 'ai.alerted' && ev.targetId === e.id) alerts.push(ev); });
  return { w, e, victimId, alerts };
}
const step = (w: SimWorld, ticks: number) => { for (let i = 0; i < ticks; i++) w.update(); };

describe('PO 2026-10-11 close infected hearing @E07', () => {
  for (const l1 of [false, true]) for (const civilian of [false, true]) {
    test.each(infectedDefinitions.map(d => d.id))(`%s hears a ${civilian ? 'civilian' : 'player'} behind it (${l1 ? 'outbreak' : 'archetype'} brain)`, async archetype => {
      const { w, e, victimId, alerts } = await setup(archetype, l1, civilian);
      const at = { x: e.transform.x, z: e.transform.z };
      for (let tick = 0; tick < 30 && alerts.length === 0; tick++) w.update();
      step(w, 6);
      expect(alerts.some(ev => ev.sourceId === victimId && ev.cause === 'hearing' && ev.tick <= 30)).toBe(true);
      expect(Math.hypot(e.transform.x - at.x, e.transform.z - at.z)).toBeLessThan(.05);
      expect(Math.abs(e.transform.yaw)).toBeGreaterThan(.5);
      step(w, Math.max(0, 30 - w.tick));
      expect(['chase', 'attack', 'bite']).toContain(e.infected!.state);
      expect(Math.cos(e.transform.yaw)).toBeLessThan(-.5);
    });
  }
  for (const l1 of [false, true]) {
    test(`2.5 m behind does not trigger hearing (${l1 ? 'outbreak' : 'archetype'})`, async () => {
      const { w, e, alerts } = await setup('infected.runner', l1, false, 2.5);
      step(w, 30); expect(alerts).toHaveLength(0); expect(e.infected!.state).not.toBe('chase');
    });
    test(`a building wall blocks hearing (${l1 ? 'outbreak' : 'archetype'})`, async () => {
      const { w, e, alerts } = await setup('infected.runner', l1);
      const wall: CoverWall = { x: -.9, y: 1.5, z: 0, halfX: .1, halfY: 1.5, halfZ: 4 };
      (w.combat!.query.walls as CoverWall[]).push(wall);
      step(w, 30); expect(alerts).toHaveLength(0); expect(e.infected!.state).not.toBe('chase');
    });
    test(`scripted held infected waits until released (${l1 ? 'outbreak' : 'archetype'})`, async () => {
      const { w, e, alerts } = await setup('infected.runner', l1);
      w.npcs!.civilians.hold(e.id); step(w, 30); expect(alerts).toHaveLength(0);
      w.npcs!.civilians.release(e.id); step(w, 30); expect(alerts.some(ev => ev.cause === 'hearing')).toBe(true);
    });
  }
  test.each(['infected.cat', 'infected.lion'])('%s releases a vanished heard victim without grabbing the distant player', async archetype => {
    const { w, e, victimId } = await setup(archetype, false, true);
    step(w, 1); expect(e.infected!.heardTargetId).toBe(victimId);
    e.infected!.grabUntil = w.tick + 90;
    w.entities.get(victimId)!.hidden = true;
    step(w, 1);
    expect(e.infected!.heardTargetId).toBe(0); expect(e.infected!.grabUntil).toBe(0);
    expect(w.infected!.playerSpeedScale()).toBe(1); expect(w.infected!.playerPinned()).toBe(false);
    expect(Math.abs(e.transform.x)).toBeLessThan(1);
  });
  test('an infected already searching reacquires a heard victim without another notice pause', async () => {
    const { w, e, alerts } = await setup('infected.runner', true);
    const brain = e.infected!.l1!;
    brain.mode = 'search'; brain.search.until = 300; brain.pauseUntil = 100; brain.distractionId = 0; e.infected!.state = 'search';
    for (let tick = 0; tick < 30 && alerts.length === 0; tick++) w.update();
    expect(alerts.some(ev => ev.cause === 'hearing')).toBe(true);
    expect(brain.mode).toBe('chase'); expect(brain.pauseUntil).toBe(100);
    expect(brain.hearingUntil).toBe(0);
  });
  test('a gorilla hearing a civilian closes for a strike instead of throwing at the distant courier', async () => {
    const { w, e, victimId } = await setup('infected.gorilla', false, true);
    // A stationary victim, as in the requested close encounter; suppress only the civilian's routine/flee update.
    vi.spyOn(w.npcs!, 'update').mockImplementation(() => {});
    const body = w.physics.world!.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, .4, 2));
    w.physics.world!.createCollider(RAPIER.ColliderDesc.cuboid(.3, .3, .3).setMass(35), body);
    w.infected!.props.props.push({ id: 999, body, mass: 35, class: 'medium', radius: .3 });
    let strikes = 0, throws = 0;
    w.events.on('infected.attack', ev => { if (ev.type === 'infected.attack' && ev.sourceId === e.id && ev.targetId === victimId) strikes++; });
    w.events.on('infected.prop-thrown', ev => { if (ev.type === 'infected.prop-thrown' && ev.sourceId === e.id) throws++; });
    step(w, 180);
    expect(throws).toBe(0); expect(strikes).toBeGreaterThan(0);
  });
  test('closed dynamic blocker blocks hearing; opening it permits detection', async () => {
    const { w, e, alerts } = await setup('infected.runner', true);
    w.infected!.l1!.los.register({ id: 'door', source: 'gate', active: true, shape: { kind: 'aabb', min: { x: -1, z: -4 }, max: { x: -.8, z: 4 } } });
    step(w, 30); expect(alerts).toHaveLength(0);
    w.infected!.l1!.los.setActive('door', false); step(w, 30);
    expect(alerts.some(ev => ev.cause === 'hearing')).toBe(true); expect(e.infected!.l1!.targetId).toBe(1);
  });
});
