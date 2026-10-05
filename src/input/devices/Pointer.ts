// Adapted from folio-2025 Inputs/Pointer.js by Bruno Simon (MIT).
/** Canvas-scoped mouse coordinates and buttons, with outside-canvas release. */
export class Pointer {
  x = 0; y = 0; valid = false;
  private readonly pressed = new Set<number>();
  constructor(private readonly element: HTMLElement, private readonly target: Window, private readonly activity: () => void, private readonly change: (token: string, held: boolean) => void) {}
  init(): void {
    this.element.tabIndex = 0;
    this.element.addEventListener('pointermove', this.move); this.element.addEventListener('pointerdown', this.down);
    this.target.addEventListener('pointerup', this.up); this.target.addEventListener('pointercancel', this.up);
    this.element.addEventListener('mousedown', this.prevent); this.element.addEventListener('auxclick', this.prevent); this.element.addEventListener('contextmenu', this.prevent);
  }
  private readonly prevent = (event: Event): void => { event.preventDefault(); };
  private readonly move = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    this.x = event.clientX; this.y = event.clientY; this.valid = true; this.activity();
  };
  private readonly down = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    this.move(event); this.element.focus({ preventScroll: true }); event.preventDefault(); this.pressed.add(event.button); this.change(`Mouse${event.button}`, true);
  };
  private readonly up = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' || !this.pressed.delete(event.button)) return;
    this.change(`Mouse${event.button}`, false);
  };
  release(): void { for (const button of this.pressed) this.change(`Mouse${button}`, false); this.pressed.clear(); this.valid = false; }
  dispose(): void {
    this.release(); this.element.removeEventListener('pointermove', this.move); this.element.removeEventListener('pointerdown', this.down);
    this.target.removeEventListener('pointerup', this.up); this.target.removeEventListener('pointercancel', this.up);
    this.element.removeEventListener('mousedown', this.prevent); this.element.removeEventListener('auxclick', this.prevent); this.element.removeEventListener('contextmenu', this.prevent);
  }
}
