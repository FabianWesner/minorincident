import { expect, test } from 'vitest';
import { CrowdVisibility } from '../../../src/render/CrowdVisibility';

test('a streamed civilian keeps its finer resident body until the selected coarser band is ready', () => {
  const visibility = new CrowdVisibility(), model = 'npc.civilian-man-a';
  visibility.resident.set(model, new Set(['lod0']));
  expect(visibility.band(1, 130, model)).toBe('lod0');
  expect(visibility.band(1, 50, model)).toBe('lod0');
  visibility.resident.get(model)!.add('lod1');
  expect(visibility.band(1, 50, model)).toBe('lod1');
  visibility.resident.get(model)!.add('lod2');
  expect(visibility.band(1, 50, model)).toBe('lod2');
  visibility.heroes.add(1); visibility.heroModels.add(model);
  expect(visibility.band(1, 250, model)).toBe('lod0');
  // Other crowd renderers retain their existing band policy.
  expect(visibility.band(2, 50, 'infected.runner')).toBe('lod2');
});
