import { FileLoader, LoaderUtils } from 'three/webgpu';
import type { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Paces heavy main-thread load steps (GLB parse, static batching) once a level is playable:
 * at most one step per rendered frame, run after that frame, so background streaming never
 * stacks several parses into one long frame (M1-22). While a loading screen is up it is open. */
export class LoadGate {
  paced = false;
  private scheduled = false;
  private readonly waiting: (() => void)[] = [];
  setPaced(paced: boolean): void {
    this.paced = paced;
    if (!paced) for (const release of this.waiting.splice(0)) release();
  }
  get pending(): number { return this.waiting.length; }
  wait(): Promise<void> {
    if (!this.paced) return Promise.resolve();
    return new Promise(resolve => { this.waiting.push(resolve); this.schedule(); });
  }
  private schedule(): void {
    if (this.scheduled || !this.waiting.length) return;
    this.scheduled = true;
    requestAnimationFrame(() => setTimeout(() => { this.scheduled = false; this.waiting.shift()?.(); this.schedule(); }, 0));
  }
}
export const loadGate = new LoadGate();

/** Download in parallel, then parse through the gate (GLTFLoader.loadAsync would parse on arrival). */
export async function loadGltf(loader: GLTFLoader, url: string): Promise<GLTF> {
  const data = await new FileLoader(loader.manager).setResponseType('arraybuffer').loadAsync(url) as ArrayBuffer;
  await loadGate.wait();
  return loader.parseAsync(data, LoaderUtils.extractUrlBase(url));
}
