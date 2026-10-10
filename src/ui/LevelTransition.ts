import { DefaultLoadingManager } from 'three/webgpu';
import { dialogue } from '../data/dialogue';
import { button, node } from './dom';
import './ui.css';

const titles = ['Stop the Outbreak', 'The Failed Rescue', 'The Police Collapse', 'The Safe City Falls', 'Aftermath', 'The Subway'];
/** Covers native scene teardown through the first full-size draw. Progress reports completed
 * loading stages, loader items and shader batches; it never advances on a timer. */
export class LevelTransition {
  readonly root = node('div', 'level-transition');
  private readonly heading = node('h1', 'transition-title');
  private readonly story = node('p', 'transition-story');
  private readonly status = node('p', 'transition-status');
  private readonly retry = button('transition-retry', 'Try again', () => { this.retryLoad(this.level); });
  private level = 'L1';
  private readonly progress = node('progress', 'transition-progress');
  private loadedBefore = 0;
  private stage = .2;
  private watching = false;
  private previousProgress = DefaultLoadingManager.onProgress;
  private previousStart = DefaultLoadingManager.onStart;
  constructor(private readonly retryLoad: (id: string) => void) {
    this.root.className = 'level-transition'; this.root.hidden = true;
    this.root.setAttribute('role', 'status'); this.root.setAttribute('aria-live', 'polite');
    const card = node('section', 'transition-card'); card.className = 'menu-panel';
    this.progress.max = 1; this.progress.setAttribute('aria-label', 'Level loading progress');
    this.retry.hidden = true; card.append(this.heading, this.story, this.progress, this.status, this.retry); this.root.append(card);
    document.querySelector('#game')!.append(this.root);
  }
  begin(id: string): void {
    const continuing = !this.root.hidden && this.level === id && this.retry.hidden;
    this.level = id; this.retry.hidden = true;
    const number = Number(id.slice(1));
    this.heading.textContent = /^L[1-6]$/.test(id) ? `Level ${number} · ${titles[number - 1]}` : 'Loading neighborhood';
    this.story.textContent = dialogue[`${id}.briefing`] ?? 'Getting the neighborhood ready.';
    if (!continuing) { this.progress.value = 0; this.stage = .2; }
    this.root.hidden = false;
    document.body.classList.remove('ui-hidden');
    this.status.textContent = 'Loading neighborhood…';
  }
  /** The default manager covers every Three loader, including GLB dependencies and textures. */
  watchAssets(): void {
    if (this.watching) return;
    this.watching = true; let first = true;
    this.previousProgress = DefaultLoadingManager.onProgress; this.previousStart = DefaultLoadingManager.onStart;
    DefaultLoadingManager.onStart = (url, loaded, total) => {
      if (first) { this.loadedBefore = loaded; first = false; }
      this.previousStart?.(url, loaded, total);
    };
    DefaultLoadingManager.onProgress = (url, loaded, total) => {
      if (first) { this.loadedBefore = Math.max(0, loaded - 1); first = false; }
      if (this.stage === .2) this.update(.2 + .55 * (loaded - this.loadedBefore) / Math.max(1, total - this.loadedBefore), 'Loading assets…');
      this.previousProgress?.(url, loaded, total);
    };
  }
  update(value: number, message: string): void {
    this.progress.value = Math.max(this.progress.value, Math.min(1, value));
    this.status.textContent = message;
  }
  shaders(completed: number, total: number, id = this.level): void {
    if (id !== this.level) return;
    this.stage = .8; this.update(.8 + .15 * completed / Math.max(1, total), 'Preparing the scene…');
  }
  private stopWatching(): void {
    if (!this.watching) return;
    DefaultLoadingManager.onProgress = this.previousProgress; DefaultLoadingManager.onStart = this.previousStart; this.watching = false;
  }
  finish(): void { this.stopWatching(); this.progress.value = 1; this.root.hidden = true; }
  fail(): void { this.stopWatching(); this.status.textContent = 'Could not load the neighborhood. Please try again.'; this.retry.hidden = false; }
  dispose(): void { this.stopWatching(); this.root.remove(); }
}

/** Give the card a presented frame before teardown, parsing or shader work starts. */
export function transitionPaint(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
}
