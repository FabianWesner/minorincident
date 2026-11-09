import { expect, test } from 'vitest';
import { missionIds } from '../../../src/levels/missions';
import { morningSweep } from './morning';

test('2/3 @nightly high: seated support and scripted actor persistence across L1–L10 for 90 seconds', async () => {
  for (const level of missionIds) {
    const result = await morningSweep(level, 'high');
    expect(result.seats, `${level}: every seated pose has authored support`).toEqual([]);
    expect(result.actors, `${level}: scripted cast persists: ${JSON.stringify(result.cast)}`).toEqual([]);
    console.log(`[qa:invariants] morning ${level}/high: 5400 frames, cast ${JSON.stringify(result.cast)}, seats and actors PASS`);
  }
}, 480_000);
