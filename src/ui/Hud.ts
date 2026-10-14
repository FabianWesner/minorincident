import { isMega } from '../data/megaPresentation';
import { MegaRing } from './MegaRing';
import { healthFraction } from './health';
import { weatherLabels } from '../data/weather';
// Adapted from folio-2025 Map.js / Notifications.js by Bruno Simon (MIT, 41046b5):
// world-to-map projection, persistent DOM pins, and identity-preserving text updates.
import type { Game } from '../Game';
import { action } from '../data/actions/catalog';
import { actionIconUrl } from '../assets/icons';
import { button, node, text, setHidden, attribute, style } from './dom';
import { Onboarding } from './Onboarding';
import type { GameEvent } from '../sim/world/types';
import type { Mission } from '../sim/missions/Mission';
import { markerAnchor } from '../sim/missions/markerAnchor';
const sides = ['LEFT', 'RIGHT'] as const;
const clamp = (x: number): number => Math.max(0, Math.min(1, x));
export class Hud {
  private prepared = false;
  private preparedImages: HTMLImageElement[] = [];
  readonly root = node('div', 'hud');
  readonly onboarding: Onboarding;
  private readonly portrait = node('div', 'survivor-portrait');
  private readonly health = this.bar('health');
  private readonly durability = this.bar('durability');
  private readonly durabilityPanel = node('div', 'vehicle-durability');
  /** E32 L10-S6 mounted minigun: normalized heat bar, lock-out state and the mount prompt. */
  private readonly heat = this.bar('heat');
  private readonly heatPanel = node('div', 'minigun-heat');
  private readonly companion = node('span', 'corgi-state');
  private readonly corgiBadge = node('span', 'corgi-badge', '🐕');
  private readonly detail = node('dialog', 'objective-detail');
  private readonly fullText = node('p', 'objective-full-text');
  private readonly trackerText = node('span', 'objective-text');
  private readonly map = node('div', 'minimap');
  private readonly megaRing = new MegaRing(this.map);
  private readonly playerPin = this.pin('player', '▲');
  private readonly objectivePin = this.pin('objective');
  private readonly homePin = this.pin('home', '⌂');
  /** E23: the direction of the sign of life the courier just heard (4 s), and the survivors counter beside the objective. */
  private readonly cuePin = this.pin('cue', '♪');
  private readonly survivorText = node('span', 'survivors-found');
  private readonly cueText = node('span', 'sign-of-life');
  private readonly threats: HTMLSpanElement[] = [];
  private readonly tracker = node('div', 'objective-tracker');
  private readonly weapon = this.weaponIcon();
  private weaponActionId = '';
  private weaponHintUntil = -1;
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
  private threatCount = 0;
  private loadedScenario: string | null = null;
  constructor(private readonly game: Game) {
    this.onboarding = new Onboarding(game.world, game.input.bindings);
    this.civilianBark.className = 'hud-panel'; this.civilianBark.style.cssText = 'position:absolute;pointer-events:none'; this.civilianBark.hidden = true; this.root.append(this.civilianBark);
    // PO: story bubbles read comfortably: larger outlined text, fade in/out, kept inside the frame above the speaker.
    this.storyBubble.className = 'hud-panel story-bubble'; this.storyBubble.style.cssText = 'position:absolute;pointer-events:none;transform:translate(-50%,-100%);max-width:min(340px,80vw);padding:8px 14px;border-radius:12px;font:700 19px/1.3 system-ui,sans-serif;color:#fff;text-shadow:0 0 3px #0b0f18,0 0 3px #0b0f18,1px 1px 0 #0b0f18,-1px -1px 0 #0b0f18,1px -1px 0 #0b0f18,-1px 1px 0 #0b0f18;white-space:normal;text-align:center;opacity:0'; this.storyBubble.hidden = true; this.root.append(this.storyBubble);
    // E31 vehicle durability: only while seated in the APC; no repair affordance exists.
    this.durabilityPanel.className = 'hud-durability-panel hud-panel'; this.durabilityPanel.hidden = true; this.durabilityPanel.setAttribute('aria-label', 'Vehicle durability');
    this.durabilityPanel.append(this.durability.root); this.root.append(this.durabilityPanel);
    this.heatPanel.className = 'hud-heat-panel hud-panel'; this.heatPanel.hidden = true; this.heatPanel.setAttribute('aria-label', 'Minigun heat');
    this.heatPanel.append(this.heat.root); this.root.append(this.heatPanel);
    this.root.className = 'hud'; this.root.hidden = true;
    const vitals = node('div', 'vitals'); vitals.className = 'hud-vitals hud-panel';
    this.portrait.className = 'hud-portrait'; this.portrait.setAttribute('aria-label', 'Survivor portrait');
    const bars = node('div', 'vital-bars'); bars.className = 'hud-bars'; bars.append(this.health.root);
    this.corgiBadge.className = 'hud-corgi-badge';
    vitals.append(this.portrait, bars, this.weapon.root, this.corgiBadge);
    const companion = node('div', 'corgi-companion'); companion.className = 'hud-companion hud-panel';
    const face = node('div', 'corgi-portrait'); face.className = 'hud-portrait'; face.style.backgroundImage = 'url(/assets/ui/portrait-corgi.png)'; companion.append(face, this.companion);
    this.map.className = 'hud-map'; this.map.setAttribute('aria-label', 'North-up minimap, range 30 meters');
    const north = node('span', 'minimap-north', 'N'); north.className = 'hud-map-n';
    this.cuePin.hidden = true; this.survivorText.hidden = this.cueText.hidden = true;
    this.map.append(north, this.playerPin, this.objectivePin, this.homePin, this.cuePin);
    // Allocated once; no entity snapshots, DOM creation, or pin lists per frame.
    for (let i = 0; i < 256; i++) { const pin = this.pin(`threat-${i}`); pin.classList.add('hud-pin-threat'); pin.hidden = true; this.threats.push(pin); this.map.append(pin); }
    this.tracker.className = 'hud-tracker hud-panel'; this.tracker.append(this.trackerText, this.survivorText, this.cueText);
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
    this.vignette.className = 'hud-vignette'; this.damage.className = 'hud-damage'; this.bark.className = 'hud-bark'; this.interaction.className = 'hud-interaction';
    this.damage.hidden = this.bark.hidden = this.interaction.hidden = true;
    const stick = node('div', 'stick-zone'); stick.className = 'hud-stick-zone';
    this.root.append(stick, this.vignette, vitals, companion, this.map, this.tracker, this.damage, this.bark, this.interaction, this.onboarding.element, this.detail);
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
  /** PO 10-13: one small icon for the active weapon in the vitals panel; ring = cooldown/reload progress, name as tooltip and brief hint on change. */
  private weaponIcon() {
    const root = node('div', 'weapon-active'), icon = node('img', 'weapon-icon'), hint = node('span', 'weapon-hint');
    root.className = 'hud-weapon'; icon.className = 'hud-weapon-icon'; icon.alt = ''; hint.className = 'hud-weapon-hint';
    root.setAttribute('role', 'button'); root.tabIndex = 0;
    root.append(icon, hint);
    const cycle = (): void => { const side = this.game.world.entities.get(1)?.weapons?.selectedSide ?? 'LEFT'; this.game.input.cycle(side); };
    root.addEventListener('click', cycle);
    root.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); cycle(); } });
    return { root, icon, hint };
  }
  init(): void { document.querySelector('#game')!.append(this.root); }
  /** Reset subscriptions after EventBus.reset; old-level feedback cannot survive a load. */
  clear(): void { for (const stop of this.stops) stop(); this.stops.length = 0; this.onboarding.clear(); this.detail.close(); this.prepared = false; this.preparedImages = []; this.root.hidden = true; }
  /** Shape the real HUD during loading. Its layout survives the briefing;
   * Begin changes visibility without constructing the first text layout. */
  async prepare(): Promise<void> {
    if (!this.game.world.entities.get(1)) return;
    this.prepared = true; this.update(true);
    const variant = this.game.world.entities.get(1)!.survivor?.variant === 'male' ? 'm' : 'f';
    this.preparedImages = [`/assets/ui/portrait-survivor-${variant}.png`, '/assets/ui/portrait-corgi.png'].map(url => { const image = new Image(); image.src = url; return image; });
    await Promise.all([...this.preparedImages, ...this.root.querySelectorAll<HTMLImageElement>('img[src]')].map(image => image.decode().catch(() => {})));
    await document.fonts.ready;
    this.onboarding.prepare(this.game.input.scheme);
    this.root.getBoundingClientRect();
    this.update();
  }
  loaded(): void {
    this.clear();
    this.damagedUntil = this.barkUntil = this.civilianBarkUntil = this.weaponHintUntil = -1; this.weaponActionId = '';
    this.loadedScenario = this.game.world.scenario;
    if (!this.loadedScenario) return;
    this.onboarding.reset();
    for (const type of ['combat.hit', 'corgi.sound', 'civilian.bark', 'ally.callout'] as const) this.stops.push(this.game.world.events.on(type, this.event, 20));
  }
  private readonly event = (event: GameEvent): void => {
    if (event.type === 'civilian.bark' || event.type === 'ally.callout') {
      if (this.game.world.missions?.state.l1?.say?.id === event.id) return; // The story bubble already captions this bark.
      if (this.civilianBark.textContent !== event.text) this.civilianBark.textContent = event.text;
      const p = this.game.view.project(event.position.x, 1.8, event.position.z);
      this.civilianBark.style.left = `${(p[0] + 1) * 50}%`; this.civilianBark.style.top = `${(1 - p[1]) * 50}%`;
      this.civilianBarkUntil = this.game.world.tick + 72;
    } else if (event.type === 'combat.hit' && event.targetId === 1) {
      this.damagedUntil = isMega(this.game.world.entities.get(event.sourceId)) ? -1 : this.game.world.tick + 60;
      const source = this.game.world.entities.get(event.sourceId), player = this.game.world.entities.get(1);
      if (source && player && !isMega(source)) {
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
    style(pin, 'left', `${50 + dx}%`); style(pin, 'top', `${50 + dz}%`);
    attribute(pin, 'data-world-x', String(x)); attribute(pin, 'data-world-z', String(z));
    attribute(pin, 'data-clamped', String(scale < 1));
  }
  private readonly weatherIcon = node('output', 'weather-icon');
  update(preparing = false): void {
    if (!this.weatherIcon.parentNode) { this.weatherIcon.style.cssText = 'position:absolute;right:16px;top:170px;color:white;background:#182333;padding:5px;border-radius:6px'; this.root.append(this.weatherIcon); }
    const weather = this.game.world.weather;
    if (weather) { text(this.weatherIcon, weatherLabels[weather.kind]); attribute(this.weatherIcon, 'data-weather', weather.kind); }
    const world = this.game.world, player = world.entities.get(1), mission = world.missions;
    const visible = !!player && document.body.dataset.uiScreen === 'game' && (!mission || ['playing', 'cinematic'].includes(mission.state.phase));
    // Keep HUD visible beneath Pause / Settings, and update independently of the renderer.
    const hidden = !player || !!world.l7Departure?.cinematic || (document.body.dataset.uiScreen !== 'game' && !['pause', 'settings'].includes(document.body.dataset.uiScreen ?? '')) || (!!mission && !['playing', 'cinematic'].includes(mission.state.phase));
    setHidden(this.root, hidden && !this.prepared);
    const visibility = hidden ? 'hidden' : '';
    if (this.root.style.visibility !== visibility) this.root.style.visibility = visibility;
    if (!player || hidden && !preparing) return;
    if (this.loadedScenario !== world.scenario) this.loaded();
    const hp = healthFraction(player.health.current, player.health.max);
    style(this.health.fill, 'width', `${hp * 100}%`); text(this.health.label, `${Math.ceil(player.health.current)} / ${player.health.max}`);
    attribute(this.health.root, 'aria-valuenow', String(hp * 100));
    const driven = world.vehicles?.active != null ? world.vehicles.cars.get(world.vehicles.active)?.entity : undefined;
    const apc = driven?.archetype === 'vehicle.military-apc' ? driven : null;
    setHidden(this.durabilityPanel, !apc);
    if (apc) {
      const fraction = clamp(apc.health.current / apc.health.max), floor = !!apc.vehicle?.floor && apc.health.current <= 0;
      style(this.durability.fill, 'width', `${fraction * 100}%`);
      text(this.durability.label, floor ? 'Barely functional' : `Armor ${Math.ceil(apc.health.current)} / ${apc.health.max}`);
      attribute(this.durability.root, 'aria-valuenow', String(fraction * 100)); attribute(this.durability.root, 'aria-valuetext', floor ? 'Barely functional' : `${Math.ceil(apc.health.current)} of ${apc.health.max}`);
      attribute(this.durabilityPanel, 'data-stage', String(apc.vehicle?.stage ?? 0)); attribute(this.durabilityPanel, 'data-floor', String(floor));
    }
    const gun = world.mountedGun, near = !!gun && !gun.mounted && gun.canMount();
    setHidden(this.heatPanel, !gun || !(gun.mounted || near || gun.heat > .005));
    if (gun) {
      const percent = Math.round(gun.heat * 100), state = gun.locked ? 'locked' : gun.heat >= .75 ? 'hot' : gun.mounted ? 'ready' : 'idle';
      style(this.heat.fill, 'width', `${percent}%`);
      text(this.heat.label, near ? 'Press E to man the minigun' : gun.locked ? `OVERHEATED ${percent}%` : `Minigun heat ${percent}%`);
      attribute(this.heat.root, 'aria-valuenow', String(percent)); attribute(this.heat.root, 'aria-valuetext', gun.locked ? `Overheated, ${percent} percent` : `${percent} percent`);
      attribute(this.heatPanel, 'data-state', state); attribute(this.heatPanel, 'data-mounted', String(gun.mounted));
    }
    attribute(this.portrait, 'data-variant', player.survivor?.variant ?? 'female');
    const portrait = `url("/assets/ui/portrait-survivor-${player.survivor?.variant === 'male' ? 'm' : 'f'}.png")`;
    style(this.portrait, 'background-image', portrait);
    style(this.vignette, 'opacity', String(clamp((.3 - hp) / .3)));
    this.megaRing.update(world.megaPursuit?.band() ?? null);
    let corgi = null, pinCount = 0;
    const px = player.transform.x, pz = player.transform.z;
    for (const entity of world.entities.iterate()) {
      if (entity.archetype.includes('corgi')) corgi = entity;
      if (isMega(entity)) continue;
      if (entity.faction !== 'infected' || entity.health.current <= 0 || ((entity.hidden || entity.infected?.hidden) && !world.weather?.reveals.has(entity.id)) || Math.hypot(entity.transform.x - px, entity.transform.z - pz) > (world.weather?.reveals.has(entity.id) ? 40 : 30)) continue;
      const pin = this.threats[pinCount]; if (!pin) break; pinCount++;
      setHidden(pin, false); attribute(pin, 'data-entity-id', String(entity.id)); this.place(pin, entity.transform.x, entity.transform.z, px, pz);
    }
    for (let i = pinCount; i < this.threatCount; i++) setHidden(this.threats[i], true);
    this.threatCount = pinCount;
    const absentCompanion = !corgi && (world.scenario === 'L8' || world.scenario === 'L9');
    setHidden(this.companion.parentElement!, absentCompanion); setHidden(this.corgiBadge, absentCompanion);
    const corgiStatus = corgi ? corgi.hidden ? 'Corgi · hiding' : 'Corgi · following' : 'Corgi · awaiting rescue';
    text(this.companion, corgiStatus); attribute(this.corgiBadge, 'title', corgiStatus); attribute(this.corgiBadge, 'aria-label', corgiStatus);
    attribute(this.corgiBadge, 'data-state', corgi ? corgi.hidden ? 'hiding' : 'following' : 'awaiting-rescue');
    this.place(this.playerPin, px, pz, px, pz); style(this.playerPin, 'rotate', `${-player.transform.yaw + Math.PI / 2}rad`);
    const anchor = markerAnchor(mission);
    setHidden(this.objectivePin, !anchor);
    if (anchor) this.place(this.objectivePin, anchor.x, anchor.z, px, pz, true);
    const home = mission?.def.anchors.home ?? player.survivor?.checkpoint;
    setHidden(this.homePin, !home || !!mission?.def.l8); if (home) this.place(this.homePin, home.x, home.z, px, pz, true);
    const objective = mission?.def.steps.find(step => mission.state.steps[step.id].status === 'active');
    // L1 v2 beat 5: after the hand-over the panel shows the completed tick and no new objective.
    const done = !objective && mission?.def.l1 ? [...mission.def.steps].reverse().find(step => mission.state.steps[step.id].status === 'completed') : undefined;
    setHidden(this.tracker, !objective && !done); if (done) text(this.trackerText, `✓ ${done.text}`);
    const remaining = mission?.def.id === 'L3' && mission.state.deadlineTicks !== null ? Math.ceil(mission.state.deadlineTicks / 60) : null;
    const deadline = remaining === null ? '' : `Gates close in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} · `;
    if (objective) text(this.trackerText, `${deadline}${objective.text}${anchor ? ` · ${Math.round(Math.hypot(anchor.x - px, anchor.z - pz))}\u00a0m` : ''}`);
    // Explain standing interactions in their ring; optional objectives remain visible alongside the main task.
    if (objective && mission) {
      const optional = mission.def.steps.filter(step => step.optional && step !== objective && mission.state.steps[step.id].status === 'active');
      const inRing = mission.interactStepInRange();
      if (inRing) {
        const seconds = inRing.complete.kind === 'interact' ? inRing.complete.seconds : 0;
        const progress = seconds ? Math.min(100, Math.round(mission.state.steps[inRing.id].interaction / (seconds * 60) * 100)) : 0;
        text(this.trackerText, `Hold still or press E · ${inRing.text.replace(/^Optional: /, '')} · ${progress}%`);
      }
      else if (optional.length) text(this.trackerText, `${this.trackerText.textContent} · ${optional[0].text}`);
    }
    this.updateSurvivors(mission, px, pz);
    const label = (id: string) => ['weapon.fists', 'weapon.kick'].includes(id) ? 'unarmed' : id === 'weapon.handgun' ? 'Handgun' : id === 'weapon.army-mg' ? 'Machine gun' : id.split('.')[1].replaceAll('-', ' ');
    let shown: { id: string; name: string; stats: string; progress: number; ammo: number; charges: number; state: string } | null = null;
    for (const side of sides) {
      const state = player.weapons?.[side], touchSide = side === 'LEFT' ? 'left' : 'right';
      if (!state) {
        this.game.input.touch.setEmpty(touchSide);
        if (side === (player.weapons?.selectedSide ?? 'LEFT')) shown = { id: side === 'LEFT' ? 'weapon.fists' : 'weapon.kick', name: side === 'LEFT' ? 'Unarmed' : 'Locked', stats: 'Find a weapon', progress: 1, ammo: 0, charges: 0, state: 'empty' };
        continue;
      }
      const slot = state.rack[state.index], def = world.combat?.runner.loadout.definition(slot.id) ?? action(slot.id), selected = player.weapons!.selectedSide === side;
      const name = label(slot.id);
      const stats = def.magazine ? `${slot.magazine} / ${def.magazine}` : def.charges ? `${slot.charges} charges` : def.cooldown ? `${Math.max(0, (slot.readyAt - world.tick) / 60).toFixed(1)}s` : 'Ready';
      const until = slot.reloadUntil || slot.nextCharge || slot.readyAt;
      const duration = (slot.reloadUntil ? def.reloadTime : slot.nextCharge ? def.recharge : Math.max(def.cooldown, def.windup + def.active + def.recovery)) * 60;
      const progress = until > world.tick ? 1 - clamp((until - world.tick) / (duration || 1)) : 1;
      if (selected) shown = { id: slot.id, name, stats, progress, ammo: slot.magazine, charges: slot.charges, state: slot.reloadUntil > world.tick ? 'reloading' : until > world.tick && stats !== 'Ready' ? 'cooldown' : 'ready' };
      this.game.input.touch.setWeapon(touchSide, actionIconUrl(def.iconId), `${name}, ${stats}`, progress, selected, slot.magazine, slot.charges);
    }
    setHidden(this.weapon.root, !shown || (!player.weapons?.LEFT && !player.weapons?.RIGHT && !mission?.def.l1));
    if (shown) {
      const w = this.weapon.root;
      if (this.weaponActionId !== shown.id) {
        if (this.weaponActionId) this.weaponHintUntil = world.tick + 120;
        this.weaponActionId = shown.id; this.weapon.icon.src = actionIconUrl(action(shown.id).iconId);
      }
      text(this.weapon.hint, shown.name); setHidden(this.weapon.hint, world.tick > this.weaponHintUntil);
      const description = `${shown.name}, ${shown.stats}`;
      attribute(w, 'title', `${description} · click, RMB or Q to switch`); attribute(w, 'aria-label', `Active weapon: ${description}`);
      attribute(w, 'data-weapon', shown.id); attribute(w, 'data-state', shown.state); attribute(w, 'data-ammo', String(shown.ammo)); attribute(w, 'data-charges', String(shown.charges));
      style(w, '--progress', String(shown.progress));
    }
    const id = world.interactables?.activeId, device = id != null ? world.entities.get(id)?.interactable : null;
    setHidden(this.interaction, !device);
    if (device) { this.interaction.style.background = `conic-gradient(#64dccc ${device.progress * 360}deg,#182333 0)`; text(this.interaction, device.hint || `${device.label} · ${Math.round(device.progress * 100)}%`); attribute(this.interaction, 'data-progress', String(device.progress)); }
    setHidden(this.damage, world.tick > this.damagedUntil); setHidden(this.bark, world.tick > this.barkUntil);
    setHidden(this.civilianBark, world.tick > this.civilianBarkUntil);
    if (!preparing) { this.updateStory(); this.onboarding.update(this.game.input.scheme, visible); }
  }
  /** E23: "Survivors found n/5", the direction ping of a heard sign of life (4 s, clamped to the map edge) and the stand-still prompt next to a hiding place. */
  private updateSurvivors(mission: Mission | null | undefined, px: number, pz: number): void {
    const l5 = mission?.state.l5, show = !!mission && !!l5 && l5.phase !== 'cellar';
    setHidden(this.survivorText, !show);
    if (!show || !l5 || !mission) { setHidden(this.cueText, true); setHidden(this.cuePin, true); return; }
    text(this.survivorText, ` · Survivors found ${l5.found}/5`);
    const tick = this.game.world.tick, cue = l5.cue && l5.cue.until > tick ? l5.cue : null;
    setHidden(this.cuePin, !cue);
    let cueLabel = cue ? ` · ${cue.text}` : '';
    if (cue) this.place(this.cuePin, cue.x, cue.z, px, pz, true);
    for (const r of l5.survivors) {
      const ring = mission.def.anchors[`l5-ring-${r.key}`];
      if (r.status === 'hidden' && ring && Math.hypot(ring.x - px, ring.z - pz) <= ring.radius && (l5.phase === 'search' || l5.phase === 'metro')) cueLabel = ' · Hold still or press E: someone is here';
    }
    setHidden(this.cueText, !cueLabel); if (cueLabel) text(this.cueText, cueLabel);
  }
  /** Story bubble from the mission state (L1/L2/L6): fades in over 10 ticks, out over 15 after its reading time. */
  private updateStory(): void {
    const world = this.game.world, say = world.missions?.state.l1?.say ?? world.missions?.state.l2?.say ?? world.missions?.state.l6?.say, tick = world.tick;
    const opacity = say ? Math.min(1, (tick - say.at) / 10, 1 - (tick - say.until) / 15) : 0;
    setHidden(this.storyBubble, !say || opacity <= 0);
    if (!say || this.storyBubble.hidden) return;
    if (this.storyBubble.textContent !== say.text) this.storyBubble.textContent = say.text;
    style(this.storyBubble, 'opacity', String(Math.max(0, opacity)));
    if (say.id === 0) { style(this.storyBubble, 'left', '50%'); style(this.storyBubble, 'top', '78%'); return; }
    const speaker = world.entities.get(say.id); if (speaker && !speaker.hidden) { this.storyX = speaker.transform.x; this.storyZ = speaker.transform.z; }
    const p = this.game.view.project(this.storyX, (speaker?.transform.y ?? .7) + 1.6, this.storyZ);
    style(this.storyBubble, 'left', `${Math.max(14, Math.min(86, (p[0] + 1) * 50))}%`); style(this.storyBubble, 'top', `${Math.max(16, Math.min(88, (1 - p[1]) * 50))}%`);
  }
  dispose(): void { this.clear(); this.onboarding.dispose(); this.root.remove(); }
}
