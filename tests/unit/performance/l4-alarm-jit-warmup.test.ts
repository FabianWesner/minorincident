import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { compositions } from '../../../src/levels/compositions';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import { warmL4Alarm } from '../../../src/sim/missions/l4AlarmWarmup';
import { SimWorld } from '../../../src/sim/world/SimWorld';

test('T-E22-20-alarm-jit @E22-AC20 the private alarm warms ninety active ticks without changing the authored layouts', async () => {
  const composition = compositions.L4, layouts = composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))) as DistrictLayout[];
  const before = JSON.stringify(layouts), update = SimWorld.prototype.update;
  let ticks = 0;
  const spy = vi.spyOn(SimWorld.prototype, 'update').mockImplementation(function (this: SimWorld) { ticks++; return update.call(this); });
  try { await warmL4Alarm(composition, layouts, 2, 'low'); }
  finally { spy.mockRestore(); }
  expect(ticks).toBe(91); // ride boundary, then ninety private alarm ticks
  expect(JSON.stringify(layouts)).toBe(before);
}, 120_000);
