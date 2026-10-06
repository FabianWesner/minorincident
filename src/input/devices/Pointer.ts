// Adapted from folio-2025 by Bruno Simon (MIT).
// Source: Inputs/Pointer.js, commit 41046b5.
/** Canvas-scoped mouse coordinates and buttons, with outside-canvas release. */
export class Pointer {
  x = 0; y = 0; valid = false;
  private readonly pressed = new Set<number>();
  constructor(private readonly element: HTMLElement, private readonly target: Window, private readonly activity: () => void, private readonly change: (token: string, held: boolean) => void) {}
  init(): void {
    this.element.tabIndex = 0;
    this.element.addEventListener('pointermove', this.move); this.element.addEventListener('pointerdown', this.move); this.element.addEventListener('mousedown', this.down);
    this.target.addEventListener('mouseup', this.up); this.target.addEventListener('pointercancel', this.cancel);
    this.element.addEventListener('auxclick', this.prevent); this.element.addEventListener('contextmenu', this.prevent);
  }
  private readonly prevent = (event: Event): void => { event.preventDefault(); };
  private readonly move = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    this.coordinates(event);
  };
  private coordinates(event: MouseEvent): void { this.x = event.clientX; this.y = event.clientY; this.valid = true; this.activity(); }
  // Pointer events retain subpixel coordinates; mouse edges fire for each chorded button.
  private readonly down = (event: MouseEvent): void => {
    this.valid = true; this.activity(); this.element.focus({ preventScroll: true }); event.preventDefault(); this.pressed.add(event.button); this.change(`Mouse${event.button}`, true);
  };
  private readonly up = (event: MouseEvent): void => {
    if (!this.pressed.delete(event.button)) return;
    this.change(`Mouse${event.button}`, false);
  };
  private readonly cancel = (event: PointerEvent): void => { if (event.pointerType === 'mouse') this.release(); };
  release(): void { for (const button of this.pressed) this.change(`Mouse${button}`, false); this.pressed.clear(); this.valid = false; }
  dispose(): void {
    this.release(); this.element.removeEventListener('pointermove', this.move); this.element.removeEventListener('pointerdown', this.move); this.element.removeEventListener('mousedown', this.down);
    this.target.removeEventListener('mouseup', this.up); this.target.removeEventListener('pointercancel', this.cancel);
    this.element.removeEventListener('auxclick', this.prevent); this.element.removeEventListener('contextmenu', this.prevent);
  }
}
