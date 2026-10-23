import { afterEach, expect, test, vi } from 'vitest';
import { installTestApi } from '../../../src/debug/testApi';
import { LevelSevenBot } from '../../../src/debug/bot/LevelSevenBot';
import { LevelTenBot } from '../../../src/debug/bot/LevelTenBot';
import { Walker } from '../../../src/debug/bot/Walker';
import type { Game } from '../../../src/Game';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fixture(level = 'L10') {
  const player = { id: 1, transform: { x: 4000, z: -23, yaw: 0 }, health: { current: 100 }, weapons: { RIGHT: { rack: [{ id: 'weapon.fire-axe' }, { id: 'weapon.rocket-launcher' }] } } };
  const enemy = { id: 3, transform: { x: 4008, z: -23 }, health: { current: 3000 } };
  const world = {
    scenario: level, tick: 60, entities: new Map([[1, player], [2, { ...player, id: 2 }]]),
    infected: { active: [enemy], nav: { visible: () => true } }, vehicles: { active: null },
    missions: { state: { phase: 'playing', steps: { hold: { status: 'active' } }, states: {} }, def: { steps: [{ id: 'hold', anchor: 'cure-console' }], anchors: { 'cure-console': { x: 4002, z: -23, radius: 3 } } }, l8: { state: {} }, l9: { state: { carId: 2, phase: 'driving', finished: false } } },
    l7Encounters: { state: { started: true, roster: [] } }, l7Departure: { state: { phase: 'waiting', boarded: [] } },
  } as unknown as SimWorld;
  vi.spyOn(Walker.prototype, 'step').mockReturnValue({ x: 1, z: 0 });
  return { world, player, enemy };
}

test.each(['L7', 'L8', 'L9', 'L10'])('bot.start dispatches %s, emits input and reports stop without E19 pending', level => {
  const { world } = fixture(level);
  vi.stubGlobal('window', {});
  const game = { world, driver: null } as unknown as Game;
  const api = installTestApi(game, Promise.resolve());
  api.bot.start('complete');
  expect(api.bot.status()).toEqual({ running: true, policy: 'complete' });
  expect(game.driver!.sample()).toHaveProperty('move');
  api.bot.stop();
  expect(api.bot.status()).toEqual({ running: false, policy: null });
});

test('L7 picks the rocket and waits for the living group while retaining fire input', () => {
  const { world, player, enemy } = fixture('L7');
  player.transform.x = 60; player.transform.z = 15;
  enemy.transform.x = 64; enemy.transform.z = 15;
  world.entities.get(2)!.transform = { x: 0, y: 0, z: 15, yaw: 0 };
  const encounters = world.l7Encounters!;
  encounters.state.roster = [{ id: 2, status: 'following' }] as typeof encounters.state.roster;
  const frame = new LevelSevenBot(world).sample();
  expect(frame.selectedSlot).toEqual({ side: 'RIGHT', index: 1 });
  expect(frame.move).toEqual({ x: 0, z: 0 });
  expect(frame.attackTarget).toEqual({ id: 3, side: 'RIGHT' });
  expect(frame.right.held).toBe(true);
});

test('L10 uses recovered rockets and keeps moving around the console during boss defence', () => {
  const { world } = fixture();
  const mission = world.missions!;
  mission.state.steps = { mega: { ...mission.state.steps.hold } };
  mission.def.steps = [{ ...mission.def.steps[0], id: 'mega' }];
  const frame = new LevelTenBot(world).sample();
  expect(frame.selectedSlot).toEqual({ side: 'RIGHT', index: 1 });
  expect(frame.right.held).toBe(true);
  expect(frame.aim).toEqual({ x: 1, z: 0 });
  expect(Walker.prototype.step).toHaveBeenLastCalledWith(world, expect.objectContaining({ x: expect.any(Number), z: expect.any(Number) }), 1, 'dodge');
});

test('L10 does not shoot hidden enemies or attack after cure release', () => {
  const { world, enemy } = fixture();
  Object.assign(enemy, { hidden: true });
  expect(new LevelTenBot(world).sample().right.held).toBe(false);
  Object.assign(enemy, { hidden: false });
  world.missions!.state.states['cure-released'] = true;
  expect(new LevelTenBot(world).sample().right.held).toBe(false);
});

test('L9 completion waits for the completed crawl, then reports finished', () => {
  const { world } = fixture('L9');
  vi.stubGlobal('window', {});
  const game = { world, driver: null } as unknown as Game;
  const api = installTestApi(game, Promise.resolve());
  api.bot.start('complete');
  world.missions!.l9!.state.phase = 'crawl';
  expect(game.driver!.sample().drive).toBeUndefined();
  expect(api.bot.status().running).toBe(true);
  world.missions!.l9!.state.finished = true;
  expect(api.bot.status().running).toBe(false);
});
