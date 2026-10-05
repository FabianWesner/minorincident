import { expect, test } from 'vitest';
import manifest from '../../../src/assets/manifest.json';
import { assetReferences, dataReferences } from '../../../tools/assets/references';

test('T-E17-05d @E17-AC05 data references all resolve to a declared manifest ID', () => {
  const references = dataReferences();
  for (const id of references) expect(manifest.some((a)=>a.id===id),id).toBe(true);
  expect(assetReferences("{ asset: 'veh.fire-engine', assetId: 'inf.common-worker' }")).toEqual(['veh.fire-engine','inf.common-worker']);
  // Earlier epics have not added their catalogs yet; the check covers them as they land.
  for (const id of ['veh.fire-engine','inf.common-worker','char.survivor-female','wpn.baseball-bat']) expect(manifest.some((a)=>a.id===id)).toBe(true);
});
