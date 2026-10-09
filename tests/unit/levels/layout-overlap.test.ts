import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from 'vitest';
import { levelTwoLayouts } from '../../../src/levels/L2/layout';
import { levelThreeLayouts } from '../../../src/levels/L3/layout';
import { addedOverlaps } from '../../../src/levels/placementClearance';
import type { DistrictLayout } from '../../../src/levels/districts/types';

/**
 * Layout overlap gate (PO 10-09: "barricades through fence", a car with a lamp post through its bonnet). Everything a level adds
 * on top of the shipped district layout must keep clear of every other solid placement: oriented static-collision boxes, live
 * tier only. A level rule that drops a prop onto a fence, mailbox, lamp or tree fails here with both placement ids.
 */
const dir = 'public/assets/layouts', files = readdirSync(dir).filter(f => f.endsWith('.layout.json'));
const load = (f: string) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as DistrictLayout;
const show = (o: ReturnType<typeof addedOverlaps>) => o.map(x => `${x.a} (${x.assetA}) x ${x.b} (${x.assetB})`);

test('L2 additions on D-GROVE do not cut into any other placement (staticOverlapMax 0)', () => {
  const [layout] = levelTwoLayouts([load('D-GROVE.layout.json')]);
  expect(show(addedOverlaps(layout, 1, p => p.id.startsWith('l2-') && !p.id.startsWith('l2-station-') || p.assetId.startsWith('veh.')))).toEqual([]);
});

test.each(files.filter(f => !f.startsWith('D-GROVE')))('L3 additions on %s do not cut into any other placement (staticOverlapMax 0)', f => {
  const [layout] = levelThreeLayouts([load(f)]);
  expect(show(addedOverlaps(layout, 2, p => p.id.startsWith('l3-') || p.assetId.startsWith('veh.')))).toEqual([]);
});
