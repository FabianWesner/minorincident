import { expect, test } from 'vitest';
import { clickGroundInput } from '../../tools/playtest/input';

test('#99 approaching a visible ally attacker releases held walking/attack keys before clicking', async () => {
  const calls: string[] = [];
  await clickGroundInput({
    releaseKeys: async () => { calls.push('keys-up'); },
    releaseAim: async () => { calls.push('aim-up'); },
    mouse: {
      move: async (x,y) => { calls.push(`move ${x} ${y}`); },
      down: async () => { calls.push('mouse-down'); },
      up: async () => { calls.push('mouse-up'); },
    },
  }, 640, 360);
  expect(calls).toEqual(['keys-up','aim-up','move 640 360','mouse-down','mouse-up']);
});
