import { expect, test } from 'vitest';
import { GameView } from '../../../src/render/GameView';

test.each(['', 'test=1'])('briefing holds background music downloads even after rendered frames (%s)', query => {
  const world = { missions: { state: { phase: 'briefing' } } };
  const view = Object.assign(Object.create(GameView.prototype) as GameView, {
    params: new URLSearchParams(query), playSeconds: 2, background: false, warming: null, world,
  });
  expect(view.backgroundReady).toBe(false);
  world.missions.state.phase = 'playing';
  expect(view.backgroundReady).toBe(true);
});
