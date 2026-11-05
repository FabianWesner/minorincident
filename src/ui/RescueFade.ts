/** Short black fade while the sim moves a stranded group back onto the route (TrapRescue.fading), and the L5 cellar exit dip (slower fade in). Presentation only. */
export class RescueFade {
  private readonly root = document.createElement('div');
  private on = false;
  constructor(parent: HTMLElement = document.body) {
    Object.assign(this.root.style, { position: 'fixed', inset: '0', background: '#000', opacity: '0', pointerEvents: 'none', transition: 'opacity .2s linear', zIndex: '40' });
    this.root.setAttribute('aria-hidden', 'true'); parent.appendChild(this.root);
  }
  set(fading: boolean, outS = .2, inS = .2): void { if (fading !== this.on) { this.on = fading; this.root.style.transitionDuration = `${fading ? outS : inS}s`; this.root.style.opacity = fading ? '1' : '0'; } }
}
