// Adapted from folio-2025 Map.js / Notifications.js by Bruno Simon (MIT, 41046b5):
// world-to-map projection, persistent DOM pins, and identity-preserving text updates.
import type { Game } from '../Game';
import { action } from '../data/actions/catalog';
import { actionIconUrl } from '../assets/icons';
import { node, text } from './dom';
import { Onboarding } from './Onboarding';
import type { GameEvent } from '../sim/world/types';
const sides = ['LEFT', 'RIGHT'] as const;
const clamp = (x: number): number => Math.max(0, Math.min(1, x));
export class Hud {
  readonly root = node('div', 'hud');
  readonly onboarding: Onboarding;
  private readonly portrait = node('div', 'survivor-portrait', '●');
  private readonly health = this.bar('health');
  private readonly armor = this.bar('armor');
  private readonly companion = node('span', 'corgi-state');
  private readonly map = node('div', 'minimap');
  private readonly playerPin = this.pin('player', '▲');
  private readonly objectivePin = this.pin('objective');
  private readonly homePin = this.pin('home', '⌂');
  private readonly threats: HTMLSpanElement[] = [];
  private readonly tracker = node('div', 'objective-tracker');
  private readonly slots = sides.map(side => this.card(side));
  private readonly vignette = node('div', 'low-health-vignette');
  private readonly damage = node('div', 'damage-direction', '▼');
  private readonly bark = node('div', 'corgi-bark', 'Woof!');
  private readonly interaction = node('div', 'interaction-ring');
  private readonly stops: (() => void)[] = [];
  private damagedUntil = -1;
  private barkUntil = -1;
  private loadedScenario: string | null = null;
  constructor(private readonly game: Game) {
    this.onboarding = new Onboarding(game.world, game.input.bindings);
    this.root.className = 'hud'; this.root.hidden = true;
    const vitals = node('div', 'vitals'); vitals.className = 'hud-vitals hud-panel';
    this.portrait.className = 'hud-portrait'; this.portrait.setAttribute('aria-label', 'Survivor portrait');
    const bars = node('div', 'vital-bars'); bars.className = 'hud-bars'; bars.append(this.health.root, this.armor.root);
    vitals.append(this.portrait, bars);
    const companion = node('div', 'corgi-companion'); companion.className = 'hud-companion hud-panel';
    const face = node('div', 'corgi-portrait', '🐕'); face.className = 'hud-portrait'; companion.append(face, this.companion);
    this.map.className = 'hud-map'; this.map.setAttribute('aria-label', 'North-up minimap, range 30 meters');
    const north = node('span', 'minimap-north', 'N'); north.className = 'hud-map-n';
    this.map.append(north, this.playerPin, this.objectivePin, this.homePin);
    // Allocated once; no entity snapshots, DOM creation, or pin lists per frame.
    for (let i = 0; i < 256; i++) { const pin = this.pin(`threat-${i}`); pin.classList.add('hud-pin-threat'); pin.hidden = true; this.threats.push(pin); this.map.append(pin); }
    this.tracker.className = 'hud-tracker hud-panel';
    const slots = node('div', 'slot-cards'); slots.className = 'hud-slots'; for (const slot of this.slots) slots.append(slot.root);
    this.vignette.className = 'hud-vignette'; this.damage.className = 'hud-damage'; this.bark.className = 'hud-bark'; this.interaction.className = 'hud-interaction';
    this.damage.hidden = this.bark.hidden = this.interaction.hidden = true;
    const stick = node('div', 'stick-zone', '◉ Move'); stick.className = 'hud-stick-zone';
    this.root.append(stick, this.vignette, vitals, companion, this.map, this.tracker, slots, this.damage, this.bark, this.interaction, this.onboarding.element);
  }
  private bar(name: string) {
    const root = node('div', `${name}-bar`), fill = node('div', `${name}-fill`), label = node('span', `${name}-label`);
    root.className = `hud-bar hud-${name}`; fill.className = 'hud-bar-fill'; label.className = 'hud-bar-label';
    root.setAttribute('role', 'meter'); root.setAttribute('aria-label', name); root.setAttribute('aria-valuemin', '0'); root.setAttribute('aria-valuemax', '100');
    root.append(fill, label); return { root, fill, label };
  }
  private pin(id: string, label = ''): HTMLSpanElement {
    const pin = node('span', `minimap-${id}`, label); pin.className = `hud-pin hud-pin-${id}`; return pin;
  }
  private card(side: 'LEFT' | 'RIGHT') {
    const root = node('div', `slot-${side}`), icon = node('img', `icon-${side}`), title = node('span', `side-${side}`, side);
    const name = node('div', `action-${side}`), stats = node('div', `stats-${side}`), ring = node('div', `reload-${side}`), rack = node('div', `rack-${side}`);
    root.className = 'hud-slot hud-panel'; title.className = 'hud-slot-title'; name.className = 'hud-slot-name'; stats.className = 'hud-slot-stats'; ring.className = 'hud-progress'; rack.className = 'hud-rack';
    icon.alt = ''; root.append(icon, title, stats, name, ring, rack);
    const strips = [];
    for (let i = 0; i < 3; i++) { const strip = node('span', `rack-${side}-item-${i}`); rack.append(strip); strips.push(strip); }
    return { root, icon, title, name, stats, ring, strips, actionId: '' };
  }
  init(): void { document.querySelector('#game')!.append(this.root); }
  /** Reset subscriptions after EventBus.reset; old-level feedback cannot survive a load. */
  clear(): void { for (const stop of this.stops) stop(); this.stops.length = 0; this.onboarding.clear(); this.root.hidden = true; }
  loaded(): void {
    this.clear();
    this.damagedUntil = this.barkUntil = -1;
    this.loadedScenario = this.game.world.scenario;
    if (!this.loadedScenario) return;
    this.onboarding.reset();
    for (const type of ['combat.hit', 'corgi.sound'] as const) this.stops.push(this.game.world.events.on(type, this.event, 20));
  }
  private readonly event = (event: GameEvent): void => {
    if (event.type === 'combat.hit' && event.targetId === 1) {
      this.damagedUntil = this.game.world.tick + 60;
      const source = this.game.world.entities.get(event.sourceId), player = this.game.world.entities.get(1);
      if (source && player) {
        const origin = this.game.view.project(player.transform.x, player.transform.y, player.transform.z);
        const projected = this.game.view.project(source.transform.x, source.transform.y, source.transform.z);
        this.damage.style.setProperty('--direction', `${Math.atan2(origin[1] - projected[1], projected[0] - origin[0]) - Math.PI / 2}rad`);
      }
    } else if (event.type === 'corgi.sound' && event.kind === 'warning') {
      this.barkUntil = this.game.world.tick + 120;
      const p = this.game.view.project(event.position.x, event.position.y ?? .7, event.position.z);
      this.bark.style.left = `${Math.max(10, Math.min(90, (p[0] + 1) * 50))}%`;
      this.bark.style.top = `${Math.max(10, Math.min(80, (1 - p[1]) * 50))}%`;
    }
  };
  private place(pin: HTMLElement, x: number, z: number, px: number, pz: number, clampEdge = false): void {
    let dx = (x - px) / 30 * 44, dz = (z - pz) / 30 * 44;
    const scale = clampEdge ? Math.min(1, 44 / (Math.hypot(dx, dz) || 1)) : 1;
    dx *= scale; dz *= scale;
    pin.style.left = `${50 + dx}%`; pin.style.top = `${50 + dz}%`;
    pin.dataset.worldX = String(x); pin.dataset.worldZ = String(z);
    pin.dataset.clamped = String(scale < 1);
  }
  update(): void {
    const world = this.game.world, player = world.entities.get(1), mission = world.missions;
    const visible = !!player && document.body.dataset.uiScreen === 'game' && (!mission || ['playing', 'cinematic'].includes(mission.state.phase));
    // Keep HUD visible beneath Pause / Settings, and update independently of the renderer.
    this.root.hidden = !player || (document.body.dataset.uiScreen !== 'game' && !['pause', 'settings'].includes(document.body.dataset.uiScreen ?? '')) || (!!mission && !['playing', 'cinematic'].includes(mission.state.phase));
    if (!player || this.root.hidden) return;
    if (this.loadedScenario !== world.scenario) this.loaded();
    const hp = clamp(player.health.current / player.health.max);
    this.health.fill.style.width = `${hp * 100}%`; text(this.health.label, `${Math.ceil(player.health.current)} / ${player.health.max}`);
    this.health.root.setAttribute('aria-valuenow', String(hp * 100));
    const shield = world.combat?.effects.shielded(player.transform) || player.combat?.shield ? 1 : player.combat?.armor ?? 0;
    this.armor.fill.style.width = `${clamp(shield) * 100}%`; text(this.armor.label, shield ? `Armor ${Math.round(shield * 100)}%` : 'Armor 0%');
    this.armor.root.setAttribute('aria-valuenow', String(clamp(shield) * 100));
    this.portrait.dataset.variant = player.survivor?.variant ?? 'female';
    text(this.portrait, player.survivor?.variant === 'male' ? '👨' : '👩');
    this.vignette.style.opacity = String(clamp((.3 - hp) / .3));
    let corgi = null, pinCount = 0;
    const px = player.transform.x, pz = player.transform.z;
    for (const entity of world.entities.iterate()) {
      if (entity.archetype.includes('corgi')) corgi = entity;
      if (entity.faction !== 'infected' || entity.health.current <= 0 || entity.hidden || entity.infected?.hidden || Math.hypot(entity.transform.x - px, entity.transform.z - pz) > 30) continue;
      const pin = this.threats[pinCount++]; if (!pin) break;
      pin.hidden = false; pin.dataset.entityId = String(entity.id); this.place(pin, entity.transform.x, entity.transform.z, px, pz);
    }
    for (let i = pinCount; i < this.threats.length; i++) this.threats[i].hidden = true;
    text(this.companion, corgi ? corgi.hidden ? 'Corgi · hiding' : 'Corgi · following' : 'Corgi · awaiting rescue');
    this.place(this.playerPin, px, pz, px, pz); this.playerPin.style.rotate = `${-player.transform.yaw + Math.PI / 2}rad`;
    const anchor = mission?.state.marker ? mission.def.anchors[mission.state.marker] : null;
    this.objectivePin.hidden = !anchor;
    if (anchor) this.place(this.objectivePin, anchor.x, anchor.z, px, pz, true);
    const home = mission?.def.anchors.home ?? player.survivor?.checkpoint;
    this.homePin.hidden = !home; if (home) this.place(this.homePin, home.x, home.z, px, pz, true);
    const objective = mission?.def.steps.find(step => mission.state.steps[step.id].status === 'active');
    this.tracker.hidden = !objective; if (objective) text(this.tracker, `${objective.text}${anchor ? ` · ${Math.round(Math.hypot(anchor.x - px, anchor.z - pz))} m` : ''}`);
    for (let i = 0; i < sides.length; i++) {
      const side = sides[i], card = this.slots[i], state = player.weapons?.[side]; card.root.hidden = !state;
      if (!state) continue;
      const slot = state.rack[state.index], def = action(slot.id);
      card.root.classList.toggle('is-selected', player.weapons!.selectedSide === side);
      card.root.setAttribute('aria-label', `${side}${player.weapons!.selectedSide === side ? ' selected' : ''}`);
      if (card.actionId !== slot.id) { card.actionId = slot.id; card.icon.src = actionIconUrl(def.iconId); text(card.name, slot.id.split('.')[1].replaceAll('-', ' ')); }
      const key = this.game.input.scheme === 'touch' ? '☝' : this.game.input.scheme === 'keyboard' ? this.game.input.bindings.keyLabel(side === 'LEFT' ? 'left' : 'right') : side === 'LEFT' ? 'LMB' : 'RMB';
      text(card.title, `${side} · ${key}`);
      text(card.stats, def.magazine ? `${slot.magazine} / ${def.magazine}` : def.charges ? `${slot.charges} charges` : def.cooldown ? `${Math.max(0, (slot.readyAt - world.tick) / 60).toFixed(1)}s` : 'Ready');
      card.stats.dataset.ammo = String(slot.magazine); card.stats.dataset.charges = String(slot.charges);
      const until = slot.reloadUntil || slot.nextCharge || slot.readyAt;
      const duration = (slot.reloadUntil ? def.reloadTime : slot.nextCharge ? def.recharge : Math.max(def.cooldown, def.windup + def.active + def.recovery)) * 60;
      card.ring.style.setProperty('--progress', String(until > world.tick ? 1 - clamp((until - world.tick) / (duration || 1)) : 1));
      card.ring.dataset.until = String(until); text(card.ring, slot.reloadUntil ? '↻' : until > world.tick ? Math.max(0, (until - world.tick) / 60).toFixed(1) : '✓');
      for (let j = 0; j < card.strips.length; j++) { card.strips[j].hidden = j >= state.rack.length; card.strips[j].classList.toggle('is-current', j === state.index); }
    }
    const id = world.interactables?.activeId, device = id != null ? world.entities.get(id)?.interactable : null;
    this.interaction.hidden = !device;
    if (device) { this.interaction.style.background = `conic-gradient(#64dccc ${device.progress * 360}deg,#182333 0)`; text(this.interaction, device.hint || `${device.label} · ${Math.round(device.progress * 100)}%`); this.interaction.dataset.progress = String(device.progress); }
    this.damage.hidden = world.tick > this.damagedUntil; this.bark.hidden = world.tick > this.barkUntil;
    this.onboarding.update(this.game.input.scheme, visible);
  }
  dispose(): void { this.clear(); this.onboarding.dispose(); this.root.remove(); }
}
