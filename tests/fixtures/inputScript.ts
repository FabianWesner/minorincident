import type { InputFrame } from '../../src/sim/world/types';

/** A square in XZ; enough direction changes to exercise physics and injection. */
export function scriptedInput(tick: number): Partial<InputFrame> {
  const direction = Math.floor(tick / 60) % 4;
  return { move: { x: direction === 0 ? 1 : direction === 2 ? -1 : 0, z: direction === 1 ? 1 : direction === 3 ? -1 : 0 } };
}
