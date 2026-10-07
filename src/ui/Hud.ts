// Adapted from folio-2025 Map.js / Notifications.js by Bruno Simon (MIT, 41046b5):
// world-to-map projection, persistent DOM pins, and identity-preserving text updates.
import type { Game } from '../Game';
import { action } from '../data/actions/catalog';
import { actionIconUrl } from '../assets/icons';
import { button, node, text } from './dom';
import { Onboarding } from './Onboarding';
import type { GameEvent } from '../sim/world/types';
const sides = ['LEFT', 'RIGHT'] as const;
const clamp = (x: number): number => Math.max(0, Math.min(1, x));
export class Hud {
  readonly root = node('div', 'hud');
  readonly onboarding: Onboarding;
  private readonly portrait = node('div', 'survivor-portrait');
  private readonly health = this.bar('health');
  private readonly armor = this.bar('armor');
  private readonly companion = node('span', 'corgi-state');
  private readonly corgiBadge = node('span', 'corgi-badge', '🐕');
  private readonly detail = node('dialog', 'objective-detail');
  private readonly fullText = node('p', 'objective-full-text');
  private readonly trackerText = node('span', 'objective-text');
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
  private readonly civilianBark = node('div', 'civilian-bark', 'Hey!');
  private civilianBarkUntil = -1;
  /** E19 story beat line above the speaker (one at a time, follows the speaker). */
  private readonly storyBubble = node('div', 'story-bubble', '');
  private storyX = 0;
  private storyZ = 0;
  private readonly interaction = node('div', 'interaction-ring');
  private readonly stops: (() => void)[] = [];
  private damagedUntil = -1;
  private barkUntil = -1;
  private loadedScenario: string | null = null;
  constructor(private readonly game: Game) {
    this.onboarding = new Onboarding(game.world, game.input.bindings);
    this.civilianBark.className = 'hud-panel'; this.civilianBark.style.cssText = 'position:absolute;pointer-events:none'; this.civilianBark.hidden = true; this.root.append(this.civilianBark);
    // PO: story bubbles read comfortably: larger outlined text, fade in/out, kept inside the frame above the speaker.
    this.storyBubble.className = 'hud-panel story-bubble'; this.storyBubble.style.cssText = 'position:absolute;pointer-events:none;transform:translate(-50%,-100%);max-width:min(340px,80vw);padding:8px 14px;border-radius:12px;font:700 19px/1.3 system-ui,sans-serif;color:#fff;text-shadow:0 0 3px #0b0f18,0 0 3px #0b0f18,1px 1px 0 #0b0f18,-1px -1px 0 #0b0f18,1px -1px 0 #0b0f18,-1px 1px 0 #0b0f18;white-space:normal;text-align:center;opacity:0'; this.storyBubble.hidden = true; this.root.append(this.storyBubble);
    this.root.className = 'hud'; this.root.hidden = true;
    const vitals = node('div', 'vitals'); vitals.className = 'hud-vitals hud-panel';
    this.portrait.className = 'hud-portrait'; this.portrait.setAttribute('aria-label', 'Survivor portrait');
    const bars = node('div', 'vital-bars'); bars.className = 'hud-bars'; bars.append(this.health.root, this.armor.root);
    this.corgiBadge.className = 'hud-corgi-badge';
    vitals.append(this.portrait, bars, this.corgiBadge);
    const companion = node('div', 'corgi-companion'); companion.className = 'hud-companion hud-panel';
    const face = node('div', 'corgi-portrait'); face.className = 'hud-portrait'; face.style.backgroundImage = 'url(/assets/ui/portrait-corgi.png)'; companion.append(face, this.companion);
    this.map.className = 'hud-map'; this.map.setAttribute('aria-label', 'North-up minimap, range 30 meters');
    const north = node('span', 'minimap-north', 'N'); north.className = 'hud-map-n';
    this.map.append(north, this.playerPin, this.objectivePin, this.homePin);
    // Allocated once; no entity snapshots, DOM creation, or pin lists per frame.
    for (let i = 0; i < 256; i++) { const pin = this.pin(`threat-${i}`); pin.classList.add('hud-pin-threat'); pin.hidden = true; this.threats.push(pin); this.map.append(pin); }
    this.tracker.className = 'hud-tracker hud-panel'; this.tracker.append(this.trackerText);
    this.detail.className = 'hud-objective-detail hud-panel';
    this.detail.setAttribute('aria-label', 'Current objective');
    this.detail.append(this.fullText, button('objective-close', 'Close', () => this.detail.close()));
    const activate = (element: HTMLElement, callback: () => void): void => {
      if (!(navigator.maxTouchPoints > 0 || matchMedia('(pointer:coarse)').matches)) return;
      element.setAttribute('role', 'button'); element.tabIndex = 0;
      element.addEventListener('click', callback);
      element.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); callback(); } });
    };
    activate(this.map, () => {
      const collapsed = this.map.classList.toggle('is-collapsed');
      this.map.setAttribute('aria-expanded', String(!collapsed));
    });
    if (this.map.getAttribute('role') === 'button') this.map.setAttribute('aria-expanded', 'true');
    activate(this.tracker, () => { text(this.fullText, this.trackerText.textContent ?? ''); this.detail.showModal(); });
    const slots = node('div', 'slot-cards'); slots.className = 'hud-slots'; for (const slot of this.slots) slots.append(slot.root);
    this.vignette.className = 'hud-vignette'; this.damage.className = 'hud-damage'; this.bark.className = 'hud-bark'; this.interaction.className = 'hud-interaction';
    this.damage.hidden = this.bark.hidden = this.interaction.hidden = true;
    const stick = node('div', 'stick-zone'); stick.className = 'hud-stick-zone';
    this.root.append(stick, this.vignette, vitals, companion, this.map, this.tracker, slots, this.damage, this.bark, this.interaction, this.onboarding.element, this.detail);
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
    root.setAttribute('role', 'button'); root.tabIndex = 0; root.setAttribute('aria-label', `Cycle ${side} weapon`);
    root.addEventListener('click', () => this.game.input.cycle(side));
    root.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); this.game.input.cycle(side); } });
    root.title = `${side === 'LEFT' ? '1/2/3' : 'Shift+1/2/3'} · click to cycle`;
    root.className = 'hud-slot hud-panel'; title.className = 'hud-slot-title'; name.className = 'hud-slot-name'; stats.className = 'hud-slot-stats'; ring.className = 'hud-progress'; rack.className = 'hud-rack';
    icon.alt = ''; root.append(icon, title, stats, name, ring, rack);
    const strips = [];
    for (let i = 0; i < 3; i++) { const strip = node('span', `rack-${side}-item-${i}`); rack.append(strip); strips.push(strip); }
    return { root, icon, title, name, stats, ring, strips, actionId: '' };
  }
  init(): void { document.querySelector('#game')!.append(this.root); }
  /** Reset subscriptions after EventBus.reset; old-level feedback cannot survive a load. */
  clear(): void { for (const stop of this.stops) stop(); this.stops.length = 0; this.onboarding.clear(); this.detail.close(); this.root.hidden = true; }
  loaded(): void {
    this.clear();
    this.damagedUntil = this.barkUntil = this.civilianBarkUntil = -1;
    this.loadedScenario = this.game.world.scenario;
    if (!this.loadedScenario) return;
    this.onboarding.reset();
    for (const type of ['combat.hit', 'corgi.sound', 'civilian.bark'] as const) this.stops.push(this.game.world.events.on(type, this.event, 20));
  }
  private readonly event = (event: GameEvent): void => {
    if (event.type === 'civilian.bark') {
      const p = this.game.view.project(event.position.x, 1.8, event.position.z);
      this.civilianBark.style.left = `${(p[0] + 1) * 50}%`; this.civilianBark.style.top = `${(1 - p[1]) * 50}%`;
      this.civilianBarkUntil = this.game.world.tick + 72;
    } else if (event.type === 'combat.hit' && event.targetId === 1) {
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
    this.portrait.style.backgroundImage = `url(/assets/ui/portrait-survivor-${player.survivor?.variant === 'male' ? 'm' : 'f'}.png)`;
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
    const corgiStatus = corgi ? corgi.hidden ? 'Corgi · hiding' : 'Corgi · following' : 'Corgi · awaiting rescue';
    text(this.companion, corgiStatus); this.corgiBadge.title = corgiStatus; this.corgiBadge.setAttribute('aria-label', corgiStatus);
    this.corgiBadge.dataset.state = corgi ? corgi.hidden ? 'hiding' : 'following' : 'awaiting-rescue';
    this.place(this.playerPin, px, pz, px, pz); this.playerPin.style.rotate = `${-player.transform.yaw + Math.PI / 2}rad`;
    const anchor = mission?.state.marker ? mission.def.anchors[mission.state.marker] : null;
    this.objectivePin.hidden = !anchor;
    if (anchor) this.place(this.objectivePin, anchor.x, anchor.z, px, pz, true);
    const home = mission?.def.anchors.home ?? player.survivor?.checkpoint;
    this.homePin.hidden = !home; if (home) this.place(this.homePin, home.x, home.z, px, pz, true);
    const objective = mission?.def.steps.find(step => mission.state.steps[step.id].status === 'active');
    // L1 v2 beat 5: after the hand-over the panel shows the completed tick and no new objective.
    const done = !objective && mission?.def.l1 ? [...mission.def.steps].reverse().find(step => mission.state.steps[step.id].status === 'completed') : undefined;
    this.tracker.hidden = !objective && !done; if (done) text(this.trackerText, `✓ ${done.text}`);
    const remaining = mission?.def.id === 'L3' && mission.state.deadlineTicks !== null ? Math.ceil(mission.state.deadlineTicks / 60) : null;
    const deadline = remaining === null ? '' : `Gates close in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} · `;
    if (objective) text(this.trackerText, `${deadline}${objective.text}${anchor ? ` · ${Math.round(Math.hypot(anchor.x - px, anchor.z - pz))}\u00a0m` : ''}`);
    for (let i = 0; i < sides.length; i++) {
      const side = sides[i], card = this.slots[i], state = player.weapons?.[side]; card.root.hidden = !state && !mission?.def.l1;
      if (!state) { text(card.name, side === 'LEFT' ? 'Unarmed' : 'Locked'); text(card.stats, 'Find a weapon'); card.icon.hidden=false;card.icon.src=actionIconUrl(side==='LEFT'?'icon.fists':'icon.kick');card.actionId=''; card.ring.hidden=true; for(const strip of card.strips)strip.hidden=true;this.game.input.touch.setEmpty(side==='LEFT'?'left':'right');continue; }
      card.icon.hidden=card.ring.hidden=false;
      const slot = state.rack[state.index], def = action(slot.id);
      card.root.classList.toggle('is-selected', player.weapons!.selectedSide === side);
      card.root.setAttribute('aria-label', `${side}${player.weapons!.selectedSide === side ? ' selected' : ''}`);
      const key = this.game.input.scheme === 'touch' ? '☝' : this.game.input.scheme === 'keyboard' ? this.game.input.bindings.keyLabel(side === 'LEFT' ? 'left' : 'right') : side === 'LEFT' ? 'LMB' : 'RMB';
      const mouse = this.game.input.scheme.startsWith('mouse');
      const loadout = world.combat?.runner.loadout, entries = loadout?.activeEntries() ?? [];
      const active = entries.findIndex(e => e.side === player.weapons!.selectedSide && e.index === player.weapons![e.side].index);
      const next = entries[(active + 1) % entries.length];
      const label = (id: string) => ['weapon.fists', 'weapon.kick'].includes(id) ? 'unarmed' : id.split('.')[1].replaceAll('-', ' ');
      text(card.title, mouse ? side === player.weapons!.selectedSide ? 'ACTIVE · LMB' : 'RMB · NEXT' : `${side} · ${key}`);
      const preview = mouse && side !== player.weapons!.selectedSide;
      const displayId = preview && next ? next.id : slot.id;
      if (card.actionId !== displayId) { card.actionId = displayId; card.icon.src = actionIconUrl(action(displayId).iconId); text(card.name, label(displayId)); }
      card.ring.hidden = preview;
      text(card.stats, def.magazine ? `${slot.magazine} / ${def.magazine}` : def.charges ? `${slot.charges} charges` : def.cooldown ? `${Math.max(0, (slot.readyAt - world.tick) / 60).toFixed(1)}s` : 'Ready');
      if (preview) text(card.stats, 'RMB to equip');
      card.stats.dataset.ammo = String(slot.magazine); card.stats.dataset.charges = String(slot.charges);
      const until = slot.reloadUntil || slot.nextCharge || slot.readyAt;
      const duration = (slot.reloadUntil ? def.reloadTime : slot.nextCharge ? def.recharge : Math.max(def.cooldown, def.windup + def.active + def.recovery)) * 60;
      const progress = until > world.tick ? 1 - clamp((until - world.tick) / (duration || 1)) : 1;
      card.ring.style.setProperty('--progress', String(progress));
      this.game.input.touch.setWeapon(side === 'LEFT' ? 'left' : 'right', actionIconUrl(def.iconId), `${card.name.textContent}, ${card.stats.textContent}`, progress, player.weapons!.selectedSide === side, slot.magazine, slot.charges);
      card.ring.dataset.until = String(until); text(card.ring, slot.reloadUntil ? '↻' : until > world.tick ? Math.max(0, (until - world.tick) / 60).toFixed(1) : '✓');
      for (let j = 0; j < card.strips.length; j++) { card.strips[j].hidden = j >= state.rack.length; card.strips[j].classList.toggle('is-current', j === state.index); }
    }
    const id = world.interactables?.activeId, device = id != null ? world.entities.get(id)?.interactable : null;
    this.interaction.hidden = !device;
    if (device) { this.interaction.style.background = `conic-gradient(#64dccc ${device.progress * 360}deg,#182333 0)`; text(this.interaction, device.hint || `${device.label} · ${Math.round(device.progress * 100)}%`); this.interaction.dataset.progress = String(device.progress); }
    this.damage.hidden = world.tick > this.damagedUntil; this.bark.hidden = world.tick > this.barkUntil;
    this.civilianBark.hidden = world.tick > this.civilianBarkUntil;
    this.updateStory();
    this.onboarding.update(this.game.input.scheme, visible);
  }
  /** Story bubble from the mission state (`l1.say`): fades in over 10 ticks, out over 15 after its reading time. */
  private updateStory(): void {
    const world = this.game.world, say = world.missions?.state.l1?.say, tick = world.tick;
    const opacity = say ? Math.min(1, (tick - say.at) / 10, 1 - (tick - say.until) / 15) : 0;
    this.storyBubble.hidden = !say || opacity <= 0;
    if (!say || this.storyBubble.hidden) return;
    if (this.storyBubble.textContent !== say.text) this.storyBubble.textContent = say.text;
    this.storyBubble.style.opacity = String(Math.max(0, opacity));
    if (say.id === 0) { this.storyBubble.style.left = '50%'; this.storyBubble.style.top = '78%'; return; }
    const speaker = world.entities.get(say.id); if (speaker && !speaker.hidden) { this.storyX = speaker.transform.x; this.storyZ = speaker.transform.z; }
    const p = this.game.view.project(this.storyX, 2.3, this.storyZ);
    this.storyBubble.style.left = `${Math.max(14, Math.min(86, (p[0] + 1) * 50))}%`; this.storyBubble.style.top = `${Math.max(16, Math.min(88, (1 - p[1]) * 50))}%`;
  }
  dispose(): void { this.clear(); this.onboarding.dispose(); this.root.remove(); }
}
