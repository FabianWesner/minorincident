// Adapted from folio-2025 Inputs/Wheel.js by Bruno Simon (MIT).
/** Pixel trackpad gestures debounce for 120ms; line/page and discrete 100px notches do not. */
export class Wheel {
  private lastTrackpad = -Infinity;
  private delta = 0;
  constructor(private readonly element: HTMLElement, private readonly roll: (direction: -1 | 1) => void) {}
  init(): void { this.element.addEventListener('wheel', this.onWheel, { passive: false }); }
  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (!event.deltaY) return;
    const now = performance.now();
    const notch = event.deltaMode !== 0 || Math.abs(event.deltaY) >= 100;
    if (notch) { this.roll(event.deltaY < 0 ? -1 : 1); return; }
    if (now - this.lastTrackpad < 120) return;
    if (Math.sign(this.delta) !== Math.sign(event.deltaY)) this.delta = 0;
    this.delta += event.deltaY;
    if (Math.abs(this.delta) < 4) return;
    this.roll(this.delta < 0 ? -1 : 1); this.lastTrackpad = now; this.delta = 0;
  };
  reset(): void { this.lastTrackpad = -Infinity; this.delta = 0; }
  dispose(): void { this.element.removeEventListener('wheel', this.onWheel); this.reset(); }
}
