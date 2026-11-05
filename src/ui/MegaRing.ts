import type { PursuitBand } from '../sim/ai/MegaPursuit';
import { megaBands } from '../data/megaPresentation';
import { node, setHidden, attribute, style, text } from './dom';
/** Player-centered band ring: intentionally accepts no entity id, distance or coordinates. */
export class MegaRing {
  readonly ring = node('span', 'mega-distance-ring');
  readonly label = node('output', 'mega-distance-label');
  constructor(map: HTMLElement) {
    this.ring.className = 'hud-mega-ring'; this.label.className = 'hud-mega-label';
    this.label.setAttribute('role', 'status'); this.label.setAttribute('aria-live', 'polite');
    this.ring.setAttribute('aria-hidden', 'true'); map.append(this.ring, this.label); this.update(null);
  }
  update(band: PursuitBand | null): void {
    setHidden(this.ring, !band); setHidden(this.label, !band);
    if (!band) return;
    const info = megaBands[band];
    attribute(this.ring, 'data-band', band); style(this.ring, 'width', `${info.ringPercent}%`); style(this.ring, 'height', `${info.ringPercent}%`);
    text(this.label, info.label);
  }
}
