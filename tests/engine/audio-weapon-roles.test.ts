import { expect, test, vi } from 'vitest';
import { AudioEventMapper, type AudioEventHost } from '../../src/audio/AudioEventMapper';
import type { GameEvent } from '../../src/sim/world/types';

test('weapon hits select their own recorded impacts and flame stops after the stream', () => {
  const target = { id: 2, faction: 'infected', archetype: 'infected.runner', health: { current: 20 }, transform: { x: 1, y: 0, z: 0, yaw: 0 } };
  const context = { currentTime: 1 };
  const play = vi.fn(), loop = vi.fn(), stopLoop = vi.fn();
  const host = { available: () => true, level: () => 'L1', ring: vi.fn(), context, play, loop, stopLoop,
    alarm: { onEvent: () => false }, world: { entities: new Map([[2, target]]) },
    graph: { buses: { ambience: { gain: { setTargetAtTime: vi.fn() } } } } } as unknown as AudioEventHost;
  const mapper = new AudioEventMapper(host);
  for (const weapon of ['handgun', 'army-mg', 'shotgun', 'hunting-rifle', 'nail-gun', 'assault-rifle', 'flamethrower']) {
    play.mockClear();
    mapper.event({ type: 'combat.hit', tick: 1, attackId: 1, sourceId: 1, targetId: 2, actionId: `weapon.${weapon}`, amount: 1, damageType: 'bullet', position: target.transform } as GameEvent);
    expect(play.mock.calls.some(([cue]) => cue === `weapon.impact.${weapon}`), weapon).toBe(true);
  }
  play.mockClear();
  mapper.event({ type: 'noise', tick: 1, sourceId: 1, actionId: 'weapon.flamethrower', kind: 'ranged', position: target.transform, radius: 1, loudness: 1 } as GameEvent);
  expect(play).toHaveBeenCalledWith('weapon.flame-ignite', expect.anything(), 1);
  expect(loop).toHaveBeenCalledWith('flame:1', 'weapon.flame-loop', expect.anything(), 1);
  context.currentTime = 1.2; mapper.advance();
  expect(stopLoop).toHaveBeenCalledWith('flame:1');
  expect(play).toHaveBeenCalledWith('weapon.flame-stop', expect.anything(), 1);
});
