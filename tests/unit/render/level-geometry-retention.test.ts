import { expect, test, vi } from 'vitest';
import { BoxGeometry, MaterialNode, MeshBasicNodeMaterial, NodeFrame, type Node } from 'three/webgpu';
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

test('@E18-AC05 @E24-AC19 cached material properties release their last level and rebind without rebuilding the property node', () => {
  type Reference = { reference: unknown; node: { value: unknown } };
  const accessor = new MaterialNode('alphaTest') as unknown as { getCache(property: string, type: string): Reference };
  const reference = accessor.getCache('alphaTest', 'float'), old = new MeshBasicNodeMaterial({ alphaTest: .5 }), next = new MeshBasicNodeMaterial({ alphaTest: .25 });
  try {
    const frame = new NodeFrame(); frame.material = old; frame.updateNode(reference as unknown as Node); old.dispose();
    expect(reference.reference).toBe(old);
    const renderer = { levelCacheReleases: 0, _geometries: null, _objects: null, _nodes: null, _renderLists: null, _renderContexts: null, selectedBackend: 'webgpu' };
    Renderer.prototype.releaseLevelCaches.call(renderer as unknown as Renderer);
    expect(reference.reference, 'the module-level property cache must not own a retired material').toBeNull();
    expect(accessor.getCache('alphaTest', 'float')).toBe(reference);
    frame.material = next; frame.updateNode(reference as unknown as Node);
    expect(reference.reference).toBe(next); expect(reference.node.value).toBe(.25);
    Renderer.prototype.releaseLevelCaches.call(renderer as unknown as Renderer);
  } finally { next.dispose(); }
});
