import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { l1v2 } from '../../../src/data/l1v2';
import { districtGameplay } from '../../../src/levels/districts';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import { compositions } from '../../../src/levels/compositions';
import { validateLayout } from '../../../src/levels/districts/validate';
import { worldAssets } from '../../../src/assets/worldDefinitions';
import { l1AccidentEvents } from '../../../src/sim/outbreak/types';

const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as DistrictLayout;
const fixed = ['player-start', 'bike-start', 'cafe-patio', 'bus-stop', 'parcel-counter', 'parcel-door', 'lab-gate', 'lab-bike-rack', 'lab-nobike-zone', 'lab-door', 'lab-tech-spawn', 'lab-exit-front', 'lab-exit-side', 'lab-exit-window', 'lab-smoke-vent', 'lab-smoke-window', 'garage-door', 'garage-bat', 'garage-nobike-zone', 'fire-bay-door', 'fire-bay-trigger', 'fire-nobike-zone', 'carwash-start', 'carwash-bay', 'elm-horde-entry',
  ...[1, 2, 3].map((i) => `gate-${i}`), ...[1, 2].flatMap((i) => [`dumpster-${i}`, `dumpster-${i}-end`]), ...[1, 2, 3, 4].map((i) => `alarm-car-${i}`),
  ...['morning', 'pickup', 'facility', 'accident', 'escape', 'spread', 'garage', 'horde', 'safe'].map((n) => `photo-l1-${n}`)];

test('T-E19-scaffold @E19 L0 scaffold: D-GROVE exports every fixed anchor, zone polygons and valid layout JSON', () => {
  for (const name of fixed) expect(layout.anchors[name], name).toBeDefined();
  expect(Object.keys(layout.anchors).filter((n) => n.startsWith('refuge-door-')).length).toBeGreaterThanOrEqual(12);
  expect(Object.keys(layout.anchors).filter((n) => n.startsWith('edge-in-')).length).toBeGreaterThanOrEqual(6);
  for (const zone of ['lab-nobike-zone', 'garage-nobike-zone', 'fire-nobike-zone', 'carwash-bay']) expect(layout.zones?.[zone]?.length, zone).toBeGreaterThanOrEqual(5);
  expect(validateLayout(layout, worldAssets)).toEqual([]);
  expect(districtGameplay['D-GROVE'].id).toBe('D-GROVE');
  expect(compositions['D-GROVE'].districts[0].id).toBe('D-GROVE');
  expect(compositions.L1.districts.map((d) => d.id)).not.toContain('D-GROVE');
});
test('T-E19-scaffold @E19 L0 scaffold: tuning table and accident event names', () => {
  expect(l1v2.speedTiers.frail.baseMs).toBeGreaterThan(l1v2.player.runMs);
  expect(l1AccidentEvents).toEqual(['l1.flicker', 'l1.blast', 'l1.ringing', 'l1.smoke', 'l1.screams', 'l1.infectedExit']);
});
