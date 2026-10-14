import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

/** lod-pop: a placement must never be drawn from a coarser stand-in mesh than its selected LOD band once the scene is ready
 *  (`metrics.lodPlaceholders`, gate `lodPlaceholderFramesMax`). Every L10 cure-* catalog scene carries the gate at 0. */
test('@lod-pop L10 cure-* catalog scenes gate stand-in LOD draws at zero', () => {
  const dir = 'specs/scenes/catalog', names = readdirSync(dir).filter(n => /^cure-.*\.json$/.test(n));
  expect(names.length).toBeGreaterThanOrEqual(13);
  for (const name of names) expect(JSON.parse(readFileSync(`${dir}/${name}`, 'utf8')).expect.lodPlaceholderFramesMax, name).toBe(0);
});
