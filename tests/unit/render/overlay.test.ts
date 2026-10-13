import { expect, test, vi } from 'vitest';
import { PerspectiveCamera, Scene } from 'three/webgpu';
import { Renderer } from '../../../src/render/Renderer';

test('T-E07-bars-overlay @E07-AC19 @E18-AC01 overlays preserve the single-sample postprocessed canvas', () => {
  const renderer = Object.create(Renderer.prototype) as Renderer;
  Object.assign(renderer, { _samples: 4, _renderTarget: null, _currentRenderContext: null });
  Object.defineProperty(renderer, 'needsFrameBufferTarget', { value: false });
  const render = vi.fn(() => { expect(renderer.currentSamples).toBe(0); });
  renderer.render = render;
  const scene = new Scene(), camera = new PerspectiveCamera();
  expect(renderer.currentSamples).toBe(4);
  renderer.renderOverlay(scene, camera);
  expect(render).toHaveBeenCalledWith(scene, camera);
  expect(renderer.currentSamples).toBe(4);
  render.mockImplementation(() => { throw new Error('draw failed'); });
  expect(() => renderer.renderOverlay(scene, camera)).toThrow('draw failed');
  expect(renderer.currentSamples).toBe(4);
});
