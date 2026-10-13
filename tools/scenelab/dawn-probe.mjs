import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { WebGPURenderer, Scene, Mesh, BoxGeometry, MeshBasicMaterial, PerspectiveCamera, RenderTarget } from 'three/webgpu';

// Optional research dependency, installed OUTSIDE the repository. This checks a pure render,
// not the game's DOM, asset streaming, PostFx, browser backend selection or input integration.
// DAWN_MODULE=/tmp/.../node_modules/webgpu/index.js sh tools/perf/quiet-run.sh node tools/scenelab/dawn-probe.mjs
if (process.env.MI_PERF_LOCK_HELD !== '1') throw new Error('Run under tools/perf/quiet-run.sh');
if (!process.env.DAWN_MODULE) throw new Error('Set DAWN_MODULE to an isolated webgpu npm installation');
const { create, globals } = await import(pathToFileURL(process.env.DAWN_MODULE).href);
Object.assign(globalThis, globals);
const gpu = create(['backend=metal']);
Object.defineProperty(globalThis, 'navigator', { value: { gpu }, configurable: true });
globalThis.self = { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} };
// three's asynchronous node builder yields through the browser-global RAF API.
globalThis.requestAnimationFrame = callback => setTimeout(() => callback(performance.now()), 0);
globalThis.cancelAnimationFrame = clearTimeout;
const began = performance.now();
const adapter = await gpu.requestAdapter();
if (!adapter) throw new Error('No Dawn Metal adapter');
const device = await adapter.requestDevice();
const errors = [];
device.addEventListener('uncapturederror', event => errors.push(event.error.message));
const canvas = { width: 1280, height: 720, style: {}, addEventListener() {}, removeEventListener() {} };
// Render only to a three.js RenderTarget: no window, display server or canvas surface.
const renderer = new WebGPURenderer({ device, canvas, antialias: false });
const scene = new Scene(), geometry = new BoxGeometry(), material = new MeshBasicMaterial({ color: '#00ff00' });
scene.add(new Mesh(geometry, material));
const camera = new PerspectiveCamera(45, 1280 / 720, .1, 100);
camera.position.z = 3;
const target = new RenderTarget(1280, 720);
try {
  await renderer.init();
  renderer.setSize(1280, 720, false);
  renderer.setRenderTarget(target);
  await renderer.compileAsync(scene, camera);
  const warmupMs = performance.now() - began;
  const samples = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    renderer.render(scene, camera);
    const pixel = await renderer.readRenderTargetPixelsAsync(target, 640, 360, 1, 1);
    if (pixel[1] < 200 || pixel[0] > 10 || pixel[2] > 10) throw new Error(`Wrong center pixel: ${pixel}`);
    samples.push(performance.now() - start);
  }
  await device.queue.onSubmittedWorkDone();
  if (errors.length) throw new Error(errors.join('\n'));
  const info = adapter.info;
  const result = { adapter: { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description, isFallbackAdapter: info.isFallbackAdapter }, warmupMs, checks: samples.length, totalMs: samples.reduce((a, b) => a + b, 0), medianMs: samples.toSorted((a, b) => a - b)[50], rssMiB: process.memoryUsage().rss / 1048576, peakRssMiB: process.resourceUsage().maxRSS / 1024, errors };
  console.log(JSON.stringify(result, null, 2));
  if (process.env.DAWN_OUT) writeFileSync(process.env.DAWN_OUT, JSON.stringify(result, null, 2));
} finally {
  target.dispose(); geometry.dispose(); material.dispose(); renderer.dispose(); device.destroy();
  delete globalThis.navigator;
}
// Dawn retains its native event loop until finalization. Only this owned process exits.
process.exit(0);
