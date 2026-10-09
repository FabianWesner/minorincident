import { ColorManagement, Group, NoToneMapping, PerspectiveCamera, Scene, type WebGPURenderer } from 'three/webgpu';
import { expect, test, vi } from 'vitest';
import { PostFx } from '../../../src/render/PostFx';

for (const fail of [false, true]) test(`streamed warm-up captures gameplay HDR context and restores it before ${fail ? 'rejection' : 'completion'}`, async () => {
  const scene = new Scene(), camera = new PerspectiveCamera(), root = new Group();
  const canvasTarget = null, canvasMrt = null, originalColor = 'srgb', originalTone = 4;
  let target: unknown = canvasTarget, mrt: unknown = canvasMrt, finish!: () => void, reject!: (reason: Error) => void;
  const pending = new Promise<void>((resolve, fail) => { finish = resolve; reject = fail; });
  const getContext = vi.fn((_target, _mrt, depth = 0) => depth);
  const contexts = { get: getContext };
  const renderer = { _renderContexts: contexts, samples: 4, toneMapping: originalTone, outputColorSpace: originalColor,
    getRenderTarget: () => target, setRenderTarget: (value: unknown) => { target = value; }, getMRT: () => mrt, setMRT: (value: unknown) => { mrt = value; }, getOutputBufferType: () => 1016,
    compileAsync: vi.fn((object, view, lightingScene) => {
      expect(contexts.get(target, mrt)).toBe(1);
      expect(object).toBe(root); expect(view).toBe(camera); expect(lightingScene).toBe(scene);
      expect(target).not.toBe(canvasTarget); expect(renderer.toneMapping).toBe(NoToneMapping); expect(renderer.outputColorSpace).toBe(ColorManagement.workingColorSpace);
      return pending;
    }),
  };
  const fx = new PostFx(renderer as unknown as WebGPURenderer, scene, camera, 'low');
  const warm = fx.compile(undefined, root);
  // The real clock keeps rendering while an asynchronous streamed program compiles.
  expect(renderer.compileAsync).toHaveBeenCalledOnce(); expect(contexts.get).toBe(getContext); expect(target).toBe(canvasTarget); expect(mrt).toBe(canvasMrt);
  expect(renderer.toneMapping).toBe(originalTone); expect(renderer.outputColorSpace).toBe(originalColor);
  if (fail) { reject(new Error('compile failed')); await expect(warm).rejects.toThrow('compile failed'); } else { finish(); await warm; }
  expect(target).toBe(canvasTarget); expect(mrt).toBe(canvasMrt); fx.dispose();
});
