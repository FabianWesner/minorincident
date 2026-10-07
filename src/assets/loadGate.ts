import { FileLoader, LoaderUtils } from 'three/webgpu';
import type { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Paces heavy main-thread load steps (GLB parse, static batching) once a level is playable:
 * at most one step per rendered frame, run after that frame, so background streaming never
 * stacks several parses into one long frame (M1-22). While a loading screen is up it is open. */
/** Run after the next frame has been presented (outside browsers: next task). */
function afterPaint(run: () => void): void {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(run, 0)); else setTimeout(run, 0);
}
export class LoadGate {
  paced = false;
  /** Background (menu-time) loading: also yields while the player is interacting (pointer/key in the
   * last 300 ms) so the menus stay responsive. */
  private backgroundMode = false;
  private readonly foregroundWaiters: (() => void)[] = [];
  get background(): boolean { return this.backgroundMode; }
  set background(value: boolean) {
    this.backgroundMode = value;
    // Release in a later task: the input handler that switched to foreground (a level pick) paints first.
    if (!value) afterPaint(() => { if (!this.backgroundMode) for (const release of this.foregroundWaiters.splice(0)) release(); });
  }
  /** Work that cannot be sliced (shader node builds, crowd bakes) waits until the player has picked
   * the level, so menu-time preloading never blocks the menus for long. */
  foreground(): Promise<void> {
    return this.backgroundMode ? new Promise(resolve => this.foregroundWaiters.push(resolve)) : Promise.resolve();
  }
  private lastInput = -Infinity;
  private scheduled = false;
  private readonly waiting: (() => void)[] = [];
  constructor() {
    if (typeof addEventListener === 'function') for (const type of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'])
      addEventListener(type, () => { this.lastInput = performance.now(); }, { capture: true, passive: true });
  }
  setPaced(paced: boolean): void {
    this.paced = paced;
    if (!paced) { this.background = false; afterPaint(() => { if (!this.paced) for (const release of this.waiting.splice(0)) release(); }); }
  }
  get pending(): number { return this.waiting.length; }
  wait(): Promise<void> {
    if (!this.paced) return Promise.resolve();
    return new Promise(resolve => { this.waiting.push(resolve); this.schedule(); });
  }
  private schedule(): void {
    if (this.scheduled || !this.waiting.length) return;
    this.scheduled = true;
    requestAnimationFrame(() => setTimeout(() => {
      this.scheduled = false;
      if (!(this.background && performance.now() - this.lastInput < 300)) this.waiting.shift()?.();
      this.schedule();
    }, 0));
  }
}
export const loadGate = new LoadGate();

/** Download in parallel, then parse through the gate (GLTFLoader.loadAsync would parse on arrival). */
export async function loadGltf(loader: GLTFLoader, url: string): Promise<GLTF> {
  const data = await new FileLoader(loader.manager).setResponseType('arraybuffer').loadAsync(url) as ArrayBuffer;
  await loadGate.wait();
  return loader.parseAsync(data, LoaderUtils.extractUrlBase(url));
}
