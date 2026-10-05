// Adapted from folio-2025 by Bruno Simon (MIT).
// Source: Inputs/Keyboard.js, commit 41046b5.
/** Key codes, repeat suppression and blur release; injected event target allows Node tests. */
export class Keyboard {
  readonly pressed = new Set<string>();
  constructor(private readonly target: EventTarget, private readonly change: (code: string, held: boolean) => void) {}
  init(): void { this.target.addEventListener('keydown', this.down); this.target.addEventListener('keyup', this.up); this.target.addEventListener('blur', this.release); }
  private readonly down = (raw: Event): void => {
    const event = raw as KeyboardEvent;
    const element = event.target as HTMLElement | null;
    if (element?.closest?.('input, textarea, select, [contenteditable]')) return;
    if (event.repeat || this.pressed.has(event.code)) return;
    this.pressed.add(event.code); this.change(event.code, true);
    // Keep browser scrolling and page search out of game controls.
    if (/^(Arrow|Space|Tab)/.test(event.code)) event.preventDefault();
  };
  private readonly up = (raw: Event): void => {
    const code = (raw as KeyboardEvent).code;
    if (this.pressed.delete(code)) this.change(code, false);
  };
  readonly release = (): void => { for (const code of this.pressed) this.change(code, false); this.pressed.clear(); };
  dispose(): void { this.release(); this.target.removeEventListener('keydown', this.down); this.target.removeEventListener('keyup', this.up); this.target.removeEventListener('blur', this.release); }
}
