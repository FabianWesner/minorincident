// Adapted from folio-2025 Inputs/InteractiveButtons.js / Inputs/Pointer.js by Bruno Simon (MIT).
import { Nipple } from './Nipple';
import type { Vec2 } from '../InputFrame';

type TouchAction = 'left' | 'right' | 'selector' | 'pause';
interface Contact { action: TouchAction; x: number; y: number; dx: number; dy: number }
/** Each contact has its own owner. Cancellation releases without firing an action. */
export class Touch {
  readonly stick = new Nipple();
  readonly element = document.createElement('div');
  readonly aim: Vec2 = { x: 0, z: 0 };
  aiming = false;
  private stickId: number | null = null;
  private readonly contacts = new Map<number, Contact>();
  constructor(private readonly canvas: HTMLElement, private readonly activity: () => void, private readonly fire: (action: TouchAction, direction: Vec2 | null) => void) {
    this.element.dataset.touchControls = '';
    this.element.style.cssText = 'position:fixed;bottom:16px;right:16px;display:grid;grid-template-columns:64px 64px;gap:8px;touch-action:none';
    for (const action of ['selector', 'pause', 'left', 'right'] as const) {
      const button = document.createElement('button'); button.dataset.touchAction = action;
      button.textContent = action === 'selector' ? 'NEXT' : action.toUpperCase(); button.setAttribute('aria-label', `Touch ${action}`);
      button.style.cssText = 'height:64px;color:white;background:#182333;border:2px solid white;border-radius:12px;touch-action:none;user-select:none';
      this.element.append(button);
    }
  }
  init(): void {
    this.canvas.style.touchAction = 'none';
    this.canvas.addEventListener('pointerdown', this.down); this.element.addEventListener('pointerdown', this.down);
    window.addEventListener('pointermove', this.move); window.addEventListener('pointerup', this.up); window.addEventListener('pointercancel', this.cancel);
    document.body.append(this.element, this.stick.element);
  }
  private readonly down = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') return;
    this.activity(); event.preventDefault();
    const action = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-touch-action]')?.dataset.touchAction as TouchAction | undefined;
    if (action) this.contacts.set(event.pointerId, { action, x: event.clientX, y: event.clientY, dx: 0, dy: 0 });
    else if (event.clientX < innerWidth / 2 && this.stickId === null) { this.stickId = event.pointerId; this.stick.start(event.clientX, event.clientY); }
  };
  private readonly move = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') return;
    if (event.pointerId === this.stickId) { this.activity(); event.preventDefault(); this.stick.drag(event.clientX, event.clientY); }
    const contact = this.contacts.get(event.pointerId);
    if (contact) {
      this.activity(); contact.dx = event.clientX - contact.x; contact.dy = event.clientY - contact.y;
      if ((contact.action === 'left' || contact.action === 'right') && Math.hypot(contact.dx, contact.dy) >= 8) {
        this.aim.x = contact.dx; this.aim.z = contact.dy; this.aiming = true;
      }
    }
  };
  private readonly up = (event: PointerEvent): void => { this.end(event, true); };
  private readonly cancel = (event: PointerEvent): void => { this.end(event, false); };
  private end(event: PointerEvent, fire: boolean): void {
    if (event.pointerId === this.stickId) { this.stick.release(); this.stickId = null; }
    const contact = this.contacts.get(event.pointerId);
    if (!contact) return;
    this.contacts.delete(event.pointerId); this.aiming = false;
    if (fire) {
      this.activity(); const distance = Math.hypot(contact.dx, contact.dy);
      if (distance >= 8) { this.aim.x = contact.dx / distance; this.aim.z = contact.dy / distance; }
      this.fire(contact.action, distance >= 8 ? this.aim : null);
    }
  }
  release(): void { this.stickId = null; this.stick.release(); this.contacts.clear(); this.aiming = false; }
  dispose(): void {
    this.release(); this.canvas.removeEventListener('pointerdown', this.down); this.element.removeEventListener('pointerdown', this.down);
    window.removeEventListener('pointermove', this.move); window.removeEventListener('pointerup', this.up); window.removeEventListener('pointercancel', this.cancel);
    this.element.remove(); this.stick.element.remove();
  }
}
