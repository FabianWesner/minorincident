import { Matrix4 } from 'three';
import { afterEach, expect, test, vi } from 'vitest';
import { CrowdFigureProbe } from '../../../src/render/characters/CrowdFigureProbe';
import type { CrowdPosePalette } from '../../../src/render/characters/CrowdPosePalette';
import { pickBodies } from '../../../src/render/characters/PickBodies';

afterEach(() => { vi.unstubAllGlobals(); pickBodies.reset(); });

test('timing probe retains actual submission IDs while omitting optional foot diagnostics', () => {
  vi.stubGlobal('location', { search: '?test=1&crowdProbe=drawn' });
  const probe = new CrowdFigureProbe();
  const part = vi.fn();
  const palette = { part } as unknown as CrowdPosePalette;
  probe.add(17, 'shamble', .3, new Matrix4(), palette, 0, 0, 1);
  expect(probe.figures).toEqual([{ id: 17, lod: undefined, clip: 'shamble', phase: .3, drawn: false, feet: [] }]);
  expect(part).not.toHaveBeenCalled();
  probe.draw(); expect(probe.figures[0].drawn).toBe(true);
});

test('ordinary test probes still collect feet and scale', () => {
  vi.stubGlobal('location', { search: '?test=1' });
  const probe = new CrowdFigureProbe();
  const part = vi.fn((_frame: number, _outgoing: number, _weight: number, _part: number, out: Matrix4) => out.identity());
  const palette = { clip: { parts: ['footL', 'footR'] }, part } as unknown as CrowdPosePalette;
  probe.add(18, 'shamble', .3, new Matrix4(), palette, 0, 0, 1);
  expect(part).toHaveBeenCalledTimes(2);
  expect(probe.figures[0].feet).toEqual([[0, 0, 0], [0, 0, 0]]);
  expect(probe.figures[0].scale).toEqual([1, 1, 1]);
});
