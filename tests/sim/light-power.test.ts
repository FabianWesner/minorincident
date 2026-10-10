import { afterEach, expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { LightPower } from '../../src/sim/lighting/LightPower';
import { emptyInput } from '../../src/input/InputFrame';

let world: SimWorld;
afterEach(() => world?.dispose());
async function fixture() {
  world = new SimWorld(); await world.init(); world.loadScenario('blast-lab');
  const lights = new LightPower(world);
  lights.register({ id: 'tower/head', group: 'generator:tower', x: 0, y: 3.4, z: 0, range: 16, breakable: true }, false);
  return lights;
}

test('T-E25-07s @E25 @E25-AC07 generator interaction starts three emissive transitions in 1.5 seconds; power.off is immediate', async () => {
  const lights = await fixture();
  const generator = world.interactables!.spawn('generator', world.entities.get(1)!.transform, { fuel: 20, powerGroup: 'generator:tower' });
  const input = emptyInput(); input.interact = true;
  world.interactables!.update(input);
  expect(world.entities.get(generator)!.interactable!.powered).toBe(true);
  expect(world.events.events().filter(e => e.type === 'power.on')).toHaveLength(1);
  const emissions: boolean[] = [];
  for (let tick = 0; tick <= 90; tick++) { world.tick = tick; lights.update(); emissions.push(lights.isOn('tower/head')); }
  const transitions = emissions.slice(1).filter((value, i) => value !== emissions[i]).length;
  expect(transitions).toBeGreaterThanOrEqual(3); expect(transitions).toBeLessThanOrEqual(4);
  expect(emissions.at(-1)).toBe(true);
  lights.setGroup('generator:tower', false);
  expect(lights.isOn('tower/head')).toBe(false);
  expect(world.events.events().filter(e => e.type === 'power.off')).toHaveLength(1);
});

test('T-E25-08s @E25 @E25-AC08 one pistol hit breaks a lamp once, emits sparks, and lowers darkness sight by exactly 40%', async () => {
  const lights = await fixture(); lights.setGroup('generator:tower', true, false);
  const lamp = lights.lamps.get('tower/head')!;
  expect(lights.sightMultiplier({ x: 0, z: 0 }, true)).toBe(1);
  const player = world.entities.get(1)!;
  lamp.x = player.transform.x + 4; lamp.z = player.transform.z;
  const entity = world.entities.get(lamp.entityId!)!; entity.transform.x = lamp.x; entity.transform.z = lamp.z;
  world.spatial.set(entity.id, lamp.x, lamp.z);
  world.combat!.setLoadout(['weapon.pistol'], ['weapon.grenade']);
  world.setInput({ aim: { x: 1, z: 0 }, left: { down: true, held: true, up: false } });
  world.update(); world.clearInput();
  expect(lights.isOn(lamp.id)).toBe(false);
  expect(lights.sightMultiplier({ x: 0, z: 0 }, true)).toBe(.6);
  expect(lights.sightMultiplier({ x: 0, z: 0 }, false)).toBe(1);
  expect(world.events.events().filter(e => e.type === 'light.broken')).toHaveLength(1);
  expect(world.events.events().some(e => e.type === 'vfx.effect' && e.kind === 'electric')).toBe(true);
  lights.setGroup(lamp.group, false); lights.setGroup(lamp.group, true, false);
  expect(lights.isOn(lamp.id)).toBe(false);
});

test('T-E25-08p @E25 @E25-AC08 darkness feeds both detection and tracking in the production perception path', async () => {
  const lights = await fixture(); world.lightPower = lights;
  world.districts = { composition: { timeOfDay: 'night' } } as import('../../src/sim/world/DistrictWorld').DistrictWorld;
  const { Perception } = await import('../../src/sim/ai/Perception');
  const perception = new Perception(world);
  const enemy = world.entities.get(world.infected!.spawn('infected.runner', { x: 0, z: 0 }, { yaw: 0 }))!;
  const target = { x: perception.rangeM * .8, z: 0 };
  lights.setGroup('generator:tower', true, false);
  expect(perception.inCone(enemy, target)).toBe(true); expect(perception.tracks(enemy, target)).toBe(true);
  world.hazards!.hit(lights.lamps.get('tower/head')!.entityId!, 1, 'bullet');
  expect(perception.inCone(enemy, target)).toBe(false); expect(perception.tracks(enemy, target)).toBe(false);
});

test('T-E25-07c @E25 @E25-AC07 power and broken-lamp state rebind from plain entity checkpoint components', async () => {
  const lights = await fixture(); lights.setGroup('generator:tower', true, false);
  const snapshot = world.query({});
  world.hazards!.hit(lights.lamps.get('tower/head')!.entityId!, 1, 'bullet');
  expect(lights.isOn('tower/head')).toBe(false);
  world.entities.restore(snapshot, world.entities.get(1)!);
  world.events.emit({ type: 'checkpoint.restored', tick: world.tick, id: 'lamp-test' });
  expect(lights.isOn('tower/head')).toBe(true);
  expect(lights.lamps.get('tower/head')!.broken).toBe(false);
});

test('T-E25-07i @E25 authored lamps preserve gameplay IDs across creation and checkpoint restore', async () => {
  const { EntityStore } = await import('../../src/sim/world/EntityStore');
  const entities = new EntityStore();
  const actor = { kind: 'infected', archetype: 'infected.runner', faction: 'infected', transform: { x: 0, y: 0, z: 0, yaw: 0 }, health: { current: 1, max: 1 } };
  const player = entities.create(actor);
  const lamp = entities.createAuxiliary({ ...actor, kind: 'light' });
  expect(entities.create(actor).id).toBe(2);
  entities.restore(structuredClone(entities.values()), player);
  expect(entities.create(actor).id).toBe(3);
  expect(entities.createAuxiliary({ ...actor, kind: 'light' }).id).toBe(lamp.id + 1);
});
