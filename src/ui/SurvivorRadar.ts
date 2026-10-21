import type { EntityStore } from '../sim/world/EntityStore';
import { attribute, node, setHidden, style } from './dom';

/** Persistent pins read live components in every level, including shelters and allied squads. */
export class SurvivorRadar {
  private readonly pins: HTMLSpanElement[] = [];
  private count = 0;
  constructor(map: HTMLElement) {
    // More than the complete campaign group; never grow DOM or build entity/pin lists during update.
    for (let i = 0; i < 256; i++) {
      const pin = node('span', `minimap-follower-${i}`);
      pin.className = 'hud-pin hud-pin-follower'; pin.hidden = true;
      pin.setAttribute('aria-label', 'Survivor');
      this.pins.push(pin); map.append(pin);
    }
  }
  update(entities: EntityStore, px: number, pz: number): void {
    let count = 0;
    for (const entity of entities.iterate()) {
      if (entity.id === 1 || entity.hidden || entity.health.current <= 0 || entity.infection || entity.infected || entity.faction === 'infected') continue;
      const civilian = entity.civilian;
      if (!(civilian?.survivor?.mode === 'follow' || civilian?.ally?.follow?.targetId === 1 || entity.escort && entity.escort.state !== 'dead')) continue;
      const pin = this.pins[count]; if (!pin) break; count++;
      const dx = entity.transform.x - px, dz = entity.transform.z - pz;
      const scale = 44 / Math.max(30, Math.hypot(dx, dz));
      setHidden(pin, false);
      attribute(pin, 'data-entity-id', String(entity.id));
      attribute(pin, 'aria-label', civilian?.survivor?.key ?? 'Survivor');
      attribute(pin, 'data-clamped', String(Math.hypot(dx, dz) > 30));
      attribute(pin, 'data-world-x', String(entity.transform.x)); attribute(pin, 'data-world-z', String(entity.transform.z));
      style(pin, 'left', `${50 + dx * scale}%`); style(pin, 'top', `${50 + dz * scale}%`);
    }
    for (let i = count; i < this.count; i++) setHidden(this.pins[i], true);
    this.count = count;
  }
}
