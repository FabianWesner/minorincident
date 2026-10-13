import { expect, test } from 'vitest';
import { npcWorld, step } from './helpers';

/** l4-collapse-2 perf: a failed NPC route search is retried after a second, not every tick (a soldier sent to a post behind a closed
 * barricade ran a 1600-expansion A* per tick, 3 ms of every L4 war tick and the phone hitches). A new target is searched at once. */
test('T-E22-20-unreachable @E22 @E22-AC20 an unreachable NPC target is searched once a second, a new target at once', async () => {
  const w = await npcWorld(); step(w, 2);
  // A detached copy (its own routine would steer the live one to other targets every tick).
  const e = { ...structuredClone([...w.entities.iterate()].find(x => x.civilian && !x.companion && x.health.current > 0)!), id: 999_999 };
  const nav = w.infected!.nav, steer = nav.steer.bind(nav); let calls = 0;
  nav.steer = ((position, ...rest) => { if (position === e.transform) { calls++; return false; } return steer(position, ...rest); }) as typeof nav.steer;
  const far = { x: e.transform.x + 25, z: e.transform.z + 25 }, route = { path: [] as number[], goal: -1, pathIndex: 0 };
  for (let i = 0; i < 120; i++) { expect(w.npcs!.move(e, far, 3, route)).toBe(false); step(w, 1); }
  expect(calls).toBe(2);
  w.npcs!.move(e, { x: far.x - 5, z: far.z }, 3, route); expect(calls).toBe(3);
  nav.steer = steer; w.dispose();
});
