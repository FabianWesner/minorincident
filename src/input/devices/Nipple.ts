// Adapted from folio-2025 by Bruno Simon (MIT).
// Source: Inputs/Nipple.js, commit 41046b5.
import type { Vec2 } from '../InputFrame';
/** Floating 60px stick: Bruno's radial progress/angle, presented as functional DOM for E14. */
export class Nipple {
  readonly move: Vec2 = { x: 0, z: 0 };
  readonly element = document.createElement('div');
  private x = 0; private y = 0;
  constructor() {
    this.element.dataset.touchStick = ''; this.element.dataset.testid = 'touch-stick'; this.element.hidden = true;
    this.element.style.cssText = 'position:fixed;width:120px;height:120px;border:2px solid white;border-radius:50%;background:#ffffff20;pointer-events:none;box-sizing:border-box';
  }
  start(x: number, y: number): void {
    this.x = x; this.y = y; this.move.x = 0; this.move.z = 0;
    this.element.style.left = `${x - 60}px`; this.element.style.top = `${y - 60}px`; this.element.hidden = false;
  }
  drag(x: number, y: number): void {
    const dx = x - this.x, dy = y - this.y, distance = Math.hypot(dx, dy);
    const progress = Math.min(1, distance / 60);
    this.move.x = distance ? dx / distance * progress : 0; this.move.z = distance ? dy / distance * progress : 0;
  }
  release(): void { this.move.x = 0; this.move.z = 0; this.element.hidden = true; }
}
