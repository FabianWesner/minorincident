import { expect, test, vi } from 'vitest';
import { BoxGeometry } from 'three/webgpu';
// Three r186's internal geometry manager has no declaration.
// @ts-expect-error internal module has no declaration
import Geometries from 'three/src/renderers/common/Geometries.js';
import { Renderer } from '../../../src/render/Renderer';

test('@E18-AC05 shared geometry releases retired render contexts and initializes on its next level', () => {
  const attributes = { delete: vi.fn() }, info = { memory: { geometries: 0 } };
  const geometries = new Geometries(attributes, info);
  const geometry = new BoxGeometry();
  const renderObject = { geometry, getAttributes: () => Object.values(geometry.attributes), context: { level: 'old' } };
  geometries.initGeometry(renderObject);
  expect(geometries.has(renderObject)).toBe(true);
  const retiredListener = geometries._geometryDisposeListeners.get(geometry);
  const renderer = { levelCacheReleases: 0, _geometries: geometries, selectedBackend: 'webgpu', _objects: { dispose: vi.fn() }, _nodes: { dispose: vi.fn() }, _renderLists: { dispose: vi.fn() }, _renderContexts: { dispose: vi.fn() } };
  Renderer.prototype.releaseLevelCaches.call(renderer as unknown as Renderer);
  expect(info.memory.geometries).toBe(0);
  expect(geometries._geometryDisposeListeners.size).toBe(0);
  expect(geometries.has(renderObject)).toBe(false);
  expect(geometry.hasEventListener('dispose', retiredListener)).toBe(false);
  expect(attributes.delete).toHaveBeenCalledWith(geometry.index);
  // Retained CPU geometry is usable, and its new listener owns the new context.
  geometries.initGeometry({ ...renderObject, context: { level: 'new' } });
  expect(info.memory.geometries).toBe(1);
  expect(geometries._geometryDisposeListeners.get(geometry)).not.toBe(retiredListener);
  geometry.dispose();
  expect(info.memory.geometries).toBe(0);
  expect(geometries._geometryDisposeListeners.size).toBe(0);
});
