// Adapted from folio-2025 by Bruno Simon (MIT).
// Source: Inputs/InteractiveButtons.js / Inputs/Pointer.js, commit 41046b5.
import { Nipple } from './Nipple';
import type { Vec2 } from '../InputFrame';
import { actionIconUrl } from '../../assets/icons';
import { node, text } from '../../ui/dom';

type TouchAction = 'left' | 'right' | 'selector' | 'pause' | 'interact';
interface Contact { action: TouchAction; x: number; y: number; dx: number; dy: number; started: number }
/** Each contact has its own owner. Cancellation releases without firing an action. */
export class Touch {
  readonly stick = new Nipple();
  readonly element = document.createElement('div');
  readonly pauseElement = document.createElement('button');
  readonly aim: Vec2 = { x: 0, z: 0 };
  aiming = false;
  get holdingLeft(): boolean { for (const c of this.contacts.values()) if (c.action === 'left') return true; return false; }
  setInteractable(on: boolean): void { this.element.querySelector<HTMLButtonElement>('[data-touch-action=interact]')!.disabled = !on; }
  private readonly slots = new Map<'left' | 'right', { button: HTMLButtonElement; icon: HTMLImageElement; hint: HTMLSpanElement }>();
  private driving = false;
  private stickId: number | null = null;
  private readonly contacts = new Map<number, Contact>();
  constructor(private readonly canvas: HTMLElement, private readonly activity: () => void, private readonly fire: (action: TouchAction, direction: Vec2 | null, side?: 'LEFT' | 'RIGHT') => void) {
    this.element.dataset.touchControls = ''; this.element.dataset.testid = 'touch-controls';
    this.element.style.cssText = 'position:fixed;bottom:16px;right:16px;display:grid;grid-template-columns:64px 64px;gap:8px;touch-action:none';
    for (const action of ['left', 'right', 'interact', 'pause'] as const) {
      const button = action === 'pause' ? this.pauseElement : document.createElement('button'); button.dataset.touchAction = action; button.dataset.testid = `touch-${action}`;
      button.textContent = action === 'interact' ? 'ACTION' : action.toUpperCase(); button.setAttribute('aria-label', action === 'interact' ? 'ACTION' : `Touch ${action}`);
      button.style.cssText = 'height:64px;color:white;background:#182333;border:2px solid white;border-radius:12px;touch-action:none;user-select:none';
      if (action === 'interact') button.disabled = true;
      if (action === 'left' || action === 'right') {
        const icon = node('img', `touch-icon-${action}`), hint = node('span', `touch-hint-${action}`, action.toUpperCase());
        icon.alt = ''; button.replaceChildren(icon, hint);
        this.slots.set(action, { button, icon, hint });
      }
      if (action === 'pause') button.style.cssText += ';position:fixed;top:16px;right:16px;width:56px;height:56px';
      else this.element.append(button);
    }
  }
  /** Driving keeps the same three buttons; ACTION exits. */
  setDriving(on: boolean): void {
    this.setInteractable(on);
    this.driving = on;
    for (const [side, slot] of this.slots) {
      text(slot.hint, side.toUpperCase());
      slot.icon.hidden = on;
      slot.button.setAttribute('aria-label', `Touch ${side}`);
    }
  }
  /** L1 starts with empty racks; hide empty image elements and stale prior-level icons. */
  setEmpty(side: 'left' | 'right'): void {
    const slot=this.slots.get(side)!;slot.icon.hidden=false;slot.icon.src=actionIconUrl(side==='left'?'icon.fists':'icon.kick');
    slot.button.setAttribute('aria-label', `${side} · ${side==='left'?'unarmed':'locked'}`);
    slot.button.classList.remove('is-selected');slot.button.style.setProperty('--progress','0');
  }
  /** E14 presents the actions themselves as weapon slots, without changing release-to-fire. */
  setWeapon(side: 'left' | 'right', iconUrl: string, label: string, progress: number, selected: boolean, ammo: number, charges: number): void {
    const slot = this.slots.get(side)!;
    slot.icon.hidden=this.driving;
    if (slot.icon.getAttribute('src') !== iconUrl) slot.icon.src = iconUrl;
    slot.button.style.setProperty('--progress', String(progress));
    slot.button.classList.toggle('is-selected', selected);
    slot.button.dataset.ammo = String(ammo); slot.button.dataset.charges = String(charges);
    if (!this.driving) slot.button.setAttribute('aria-label', `${side} · ${label}${selected ? ' selected' : ''}`);
  }
  init(): void {
    this.canvas.style.touchAction = 'none';
    this.canvas.addEventListener('pointerdown', this.down); this.element.addEventListener('pointerdown', this.down); this.pauseElement.addEventListener('pointerdown', this.down);
    window.addEventListener('pointermove', this.move); window.addEventListener('pointerup', this.up); window.addEventListener('pointercancel', this.cancel);
    document.body.append(this.element, this.stick.element, this.pauseElement);
  }
  private readonly down = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') return;
    this.activity(); event.preventDefault();
    const action = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-touch-action]')?.dataset.touchAction as TouchAction | undefined;
    if (action && !(event.target as HTMLElement).closest<HTMLButtonElement>('button')?.disabled) this.contacts.set(event.pointerId, { action, x: event.clientX, y: event.clientY, dx: 0, dy: 0, started: performance.now() });
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
      if ((contact.action === 'left' || contact.action === 'right') && performance.now() - contact.started < 250 && contact.dy <= -40 && Math.abs(contact.dy) > Math.abs(contact.dx) * 1.5) this.fire('selector', null, contact.action === 'left' ? 'LEFT' : 'RIGHT');
      else this.fire(contact.action, distance >= 8 ? this.aim : null);
    }
  }
  release(): void { this.stickId = null; this.stick.release(); this.contacts.clear(); this.aiming = false; }
  dispose(): void {
    this.release(); this.canvas.removeEventListener('pointerdown', this.down); this.element.removeEventListener('pointerdown', this.down); this.pauseElement.removeEventListener('pointerdown', this.down);
    window.removeEventListener('pointermove', this.move); window.removeEventListener('pointerup', this.up); window.removeEventListener('pointercancel', this.cancel);
    this.element.remove(); this.stick.element.remove(); this.pauseElement.remove();
  }
}
