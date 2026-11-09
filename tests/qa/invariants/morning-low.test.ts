import { expect, test } from 'vitest';
import { missionIds } from '../../../src/levels/missions';
import { morningSweep } from './morning';

for (const level of missionIds) test(`2/3 @nightly low ${level}: seated support and scripted actor persistence for 90 seconds`, async () => {
  const result = await morningSweep(level, 'low');
  expect(result.seats, 'every seated pose has authored support').toEqual([]);
  expect(result.actors, `scripted cast persists: ${JSON.stringify(result.cast)}`).toEqual([]);
}, 480_000);
