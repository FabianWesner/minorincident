import { interactionPromptPosition, type PromptRect } from './promptPosition';
import { survivorName } from '../sim/missions/survivorName';
import { objectiveText, l8SanctuaryResting } from '../sim/missions/objectiveText';
import { LevelSixSubway } from '../sim/missions/LevelSixSubway';
import { devicePrompt } from './devicePrompt';
import { l5, l5Survivors } from '../data/l5';
import { isMega } from '../data/megaPresentation';
import { SurvivorRadar } from './SurvivorRadar';
import { healthFraction } from './health';
import { weatherLabels } from '../data/weather';
// Adapted from folio-2025 Map.js / Notifications.js by Bruno Simon (MIT, 41046b5):
// world-to-map projection, persistent DOM pins, and identity-preserving text updates.
import type { Game } from '../Game';
import { weaponKey } from '../data/weaponKeys';
import { action } from '../data/actions/catalog';
import { actionIconUrl } from '../assets/icons';
import { button, node, text as domText, setHidden, attribute, style } from './dom';
import { Onboarding } from './Onboarding';
import type { GameEvent } from '../sim/world/types';
import type { Mission } from '../sim/missions/Mission';
import { markerAnchor } from '../sim/missions/markerAnchor';
const text: typeof domText = (element, value) => domText(element, devicePrompt(value, document.body.classList.contains('touch-ui')));
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
  private readonly playerPin = this.pin('player', '▲');
  private readonly objectivePin = this.pin('objective');
  private readonly routePin = this.pin('route', '◆');
  private readonly cellarTurn = { x: 0, z: 0 };
  private readonly homePin = this.pin('home', '⌂');
  /** E23: the direction of the sign of life the courier just heard (4 s), and the survivors counter beside the objective. */
  private readonly cuePin = this.pin('cue', '♪');
  private readonly survivorVitals = node('div', 'survivor-vitals');
  private readonly survivorCards = l5Survivors.map(def => ({ def, root: node('div', `survivor-${def.key}`), face: node('div', `survivor-face-${def.key}`), health: this.bar(`survivor-health-${def.key}`) }));
  private readonly survivorText = node('span', 'survivors-found');
  private readonly cueText = node('span', 'sign-of-life');
  private readonly followerRadar = new SurvivorRadar(this.map);
  private readonly threats: HTMLSpanElement[] = [];
  private readonly tracker = node('div', 'objective-tracker');
  private readonly weapon = this.weaponIcon();
  private weaponActionId = '';
  private readonly weaponRack = node('div', 'weapon-rack');
  private weaponRackSignature = '';
  private readonly weaponRackItems = new Map<string, HTMLElement>();
  private weaponHintUntil = -1;
  private emptyWeapon: { id: string; until: number; tooClose?: boolean } | null = null;
  private readonly vignette = node('div', 'low-health-vignette');
  private readonly damage = node('div', 'damage-direction', '▼');
  private readonly shieldBlock = node('div', 'shield-block', 'SHIELD STRAIN · CHIP');
  private shieldBlockUntil = -1;
  private readonly bark = node('div', 'corgi-bark', 'Woof!');
  private readonly civilianBark = node('div', 'civilian-bark', 'Hey!');
  private civilianBarkUntil = -1;
  /** E19 story beat line above the speaker (one at a time, follows the speaker). */
  private readonly storyBubble = node('div', 'story-bubble', '');
  /** L5 sign-of-life subtitle, projected at its source or clamped to the view edge. */
  private readonly survivorCue = node('div', 'survivor-world-cue', '');
  private readonly survivorCueArrow = node('span', 'survivor-cue-arrow', '›');
  private readonly survivorCueLine = node('span', 'survivor-cue-line');
  private cueLayoutSignature = '';
  private cueSize = { width: 340, height: 96 };
  private cuePanels: HTMLElement[] = [];
  private cueObstacles: PromptRect[] = [];
  private storyX = 0;
  private storyZ = 0;
  private storyLayoutSignature = '';
  private storySize = { width: 0, height: 0 };
  private storyObstacles: PromptRect[] = [];
  private readonly interaction = node('div', 'interaction-ring');
  private readonly finaleAction = button('dispersal-action', 'Activate dispersal console', () => this.game.input.interactOnce());
  private readonly stops: (() => void)[] = [];
  private damagedUntil = -1;
  private barkUntil = -1;
  private threatCount = 0;
  private readonly discoveries: HTMLSpanElement[] = [];
  private loadedScenario: string | null = null;
  constructor(private readonly game: Game) {
    this.onboarding = new Onboarding(game.world, game.input.bindings);
    this.civilianBark.className = 'hud-panel'; this.civilianBark.style.cssText = 'position:absolute;pointer-events:none'; this.civilianBark.hidden = true; this.root.append(this.civilianBark);
    // PO: story bubbles read comfortably: larger outlined text, fade in/out, kept inside the frame above the speaker.
    this.storyBubble.className = 'hud-panel story-bubble'; this.storyBubble.style.cssText = 'position:absolute;pointer-events:none;transform:translate(-50%,-100%);width:max-content;max-width:min(340px,80vw);padding:8px 14px;border-radius:12px;font:700 19px/1.3 system-ui,sans-serif;color:#fff;text-shadow:0 0 3px #0b0f18,0 0 3px #0b0f18,1px 1px 0 #0b0f18,-1px -1px 0 #0b0f18,1px -1px 0 #0b0f18,-1px 1px 0 #0b0f18;white-space:normal;text-align:center;opacity:0'; this.storyBubble.hidden = true; this.root.append(this.storyBubble);
    this.survivorCue.className = 'hud-panel survivor-world-cue';
    this.survivorCue.style.cssText = this.storyBubble.style.cssText;
    this.survivorCue.style.width = 'min(340px,80vw)'; this.survivorCue.style.boxSizing = 'border-box'; this.survivorCue.style.transform = 'none';
    this.survivorCueArrow.style.cssText = 'position:absolute;font:700 26px/1 system-ui,sans-serif;transform-origin:center';
    this.survivorCueArrow.setAttribute('aria-hidden', 'true');
    this.survivorCue.hidden = this.survivorCueArrow.hidden = true;
    this.survivorCue.append(this.survivorCueArrow, this.survivorCueLine); this.root.append(this.survivorCue);
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
    this.weaponRack.className = 'hud-weapon-rack hud-panel'; this.weaponRack.setAttribute('aria-label', 'Carried weapons and number keys');
    vitals.append(this.portrait, bars, this.weapon.root, this.corgiBadge);
    const companion = node('div', 'corgi-companion'); companion.className = 'hud-companion hud-panel';
    const face = node('div', 'corgi-portrait'); face.className = 'hud-portrait'; face.style.backgroundImage = 'url(/assets/ui/portrait-corgi.png)'; companion.append(face, this.companion);
    this.survivorVitals.className = 'hud-survivor-vitals';
    for (const card of this.survivorCards) {
      card.root.className = 'hud-survivor-card hud-panel'; card.root.hidden = true;
      card.face.className = 'hud-portrait'; card.face.style.backgroundImage = `url(/assets/ui/portrait-survivor-${['rosa', 'mia'].includes(card.def.key) ? 'f' : 'm'}.png)`;
      card.face.setAttribute('aria-label', card.def.name); card.face.title = card.def.name;
      card.root.append(card.face, node('span', `survivor-name-${card.def.key}`, card.def.name), card.health.root);
      this.survivorVitals.append(card.root);
    }
    this.root.append(this.survivorVitals);
    this.map.className = 'hud-map'; this.map.setAttribute('aria-label', 'North-up minimap, range 30 meters');
    const north = node('span', 'minimap-north', 'N'); north.className = 'hud-map-n';
    this.cuePin.hidden = true; this.survivorText.hidden = this.cueText.hidden = true;
    this.routePin.style.background = '#64d9ee'; this.routePin.setAttribute('aria-label', 'Next turn on the cellar route');
    this.map.append(north, this.routePin, this.playerPin, this.objectivePin, this.homePin, this.cuePin);
    // Allocated once; no entity snapshots, DOM creation, or pin lists per frame.
    for (let i = 0; i < 256; i++) { const pin = this.pin(`threat-${i}`); pin.classList.add('hud-pin-threat'); pin.hidden = true; this.threats.push(pin); this.map.append(pin); }
    for (let i = 0; i < 16; i++) { const pin = this.pin(`discovery-${i}`, '✦'); pin.classList.add('hud-pin-discovery'); pin.hidden = true; this.discoveries.push(pin); this.map.append(pin); }
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
    this.shieldBlock.className = 'hud-shield-block';
    this.damage.hidden = this.shieldBlock.hidden = this.bark.hidden = this.interaction.hidden = true;
    const stick = node('div', 'stick-zone'); stick.className = 'hud-stick-zone';
    this.finaleAction.className = 'hud-dispersal-action'; this.finaleAction.hidden = true;
    const navigation = node('div', 'radar-navigation'); navigation.className = 'hud-navigation';
    this.weatherIcon.className = 'hud-weather';
    navigation.append(this.map, this.weatherIcon, this.tracker);
    this.root.append(this.weaponRack, this.finaleAction, stick, this.vignette, vitals, companion, navigation, this.damage, this.shieldBlock, this.bark, this.interaction, this.onboarding.element, this.detail);
    this.cuePanels = [vitals, companion, this.survivorVitals, this.map, this.weatherIcon, this.tracker, this.weaponRack, this.onboarding.element];
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
  clear(): void { for (const stop of this.stops) stop(); this.stops.length = 0; this.onboarding.clear(); this.detail.close(); this.prepared = false; this.preparedImages = []; this.root.hidden = true; text(this.trackerText, ''); text(this.survivorText, ''); text(this.cueText, ''); this.tracker.hidden = true; }
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
    this.shieldBlockUntil = -1;
    this.damagedUntil = this.barkUntil = this.civilianBarkUntil = this.weaponHintUntil = -1; this.weaponActionId = '';
    this.emptyWeapon = null;
    this.loadedScenario = this.game.world.scenario;
    if (!this.loadedScenario) return;
    this.onboarding.reset();
    for (const type of ['combat.hit', 'combat.empty', 'corgi.sound', 'civilian.bark', 'ally.callout'] as const) this.stops.push(this.game.world.events.on(type, this.event, 20));
  }
  private readonly event = (event: GameEvent): void => {
    if (event.type === 'combat.hit' && (event.blocked || event.shieldGlance) && event.sourceId === 1) {
      const p = this.game.view.project(event.position.x, event.position.y + 1.2, event.position.z);
      this.shieldBlock.textContent = event.shieldBreak ? 'SHIELD BROKEN · 1.5s' : event.shieldGlance ? 'SHIELD STRAIN · CHIP' : 'BLOCKED · FLANK';
      this.shieldBlock.style.left = `${Math.max(10, Math.min(90, (p[0] + 1) * 50))}%`;
      this.shieldBlock.style.top = `${Math.max(18, Math.min(85, (1 - p[1]) * 50))}%`;
      this.shieldBlockUntil = this.game.world.tick + (event.shieldBreak ? 90 : 30);
      return;
    }
    if (event.type === 'combat.empty' && event.sourceId === 1) {
      this.emptyWeapon = { id: event.actionId, until: this.game.world.tick + 120, ...(event.reason === 'too-close' ? { tooClose: true } : {}) };
      return;
    }
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
    if (__QA_HOOKS__) { attribute(pin, 'data-world-x', String(x)); attribute(pin, 'data-world-z', String(z)); }
    attribute(pin, 'data-clamped', String(scale < 1));
  }
  private readonly weatherIcon = node('output', 'weather-icon');
  update(preparing = false): void {
    const weather = this.game.world.weather;
    setHidden(this.weatherIcon, !weather);
    if (weather) { text(this.weatherIcon, weatherLabels[weather.kind]); attribute(this.weatherIcon, 'data-weather', weather.kind); }
    const world = this.game.world, player = world.entities.get(1), mission = world.missions;
    const visible = !!player && document.body.dataset.uiScreen === 'game' && (!mission || ['playing', 'cinematic'].includes(mission.state.phase));
    // Keep HUD visible beneath Pause / Settings, and update independently of the renderer.
    const hidden = !player || document.body.classList.contains('cinematic-ui') || (document.body.dataset.uiScreen !== 'game' && !['pause', 'settings'].includes(document.body.dataset.uiScreen ?? '')) || (!!mission && !['playing', 'cinematic'].includes(mission.state.phase));
    setHidden(this.root, hidden && !this.prepared);
    const visibility = hidden ? 'hidden' : '';
    if (this.root.style.visibility !== visibility) this.root.style.visibility = visibility;
    if (!player || hidden && !preparing) return;
    if (this.loadedScenario !== world.scenario) this.loaded();
    const hp = healthFraction(player.health.current, player.health.max);
    style(this.health.fill, 'width', `${hp * 100}%`); text(this.health.label, `${Math.ceil(player.health.current)} / ${player.health.max}`);
    attribute(this.health.root, 'aria-valuenow', String(hp * 100));
    const driven = world.vehicles?.active != null ? world.vehicles.cars.get(world.vehicles.active)?.entity : undefined;
    // L8's APC takes damage while the courier is still on foot at the boarding
    // ring. Keep its durability visible throughout the escape, not only after
    // entering the driver's seat.
    // Only once the escape to the APC has begun (PO 2026-11-09: the bar showed during the calm tour).
    // PO queue 11-09: not during the animal arenas either — only once every arena before the elephant is cleared (vehicle yard open).
    const l8YardOpen = (mission?.l8?.state.arenas ?? []).every(a => a.id === 'elephant' || a.phase === 3);
    const l8Escape = !!mission?.def.l8 && (mission.state.steps.escape?.status === 'active' && l8YardOpen || mission.state.steps.depart?.status === 'active');
    const l8CarId = l8Escape ? mission!.l8?.state.carId : undefined;
    const escapeApc = l8CarId ? world.entities.get(l8CarId) : undefined;
    const apc = driven?.archetype === 'vehicle.military-apc' ? driven
      : escapeApc?.archetype === 'vehicle.military-apc' && escapeApc.health.current > 0 ? escapeApc : null;
    setHidden(this.durabilityPanel, !apc);
    if (apc) {
      const fraction = clamp(apc.health.current / apc.health.max), floor = !!apc.vehicle?.floor && apc.health.current <= 0;
      style(this.durability.fill, 'width', `${fraction * 100}%`);
      const warning = !floor && fraction <= .25 ? ' · CRITICAL' : '';
      text(this.durability.label, floor ? 'APC barely functional' : `APC armor ${Math.ceil(apc.health.current)} / ${apc.health.max}${warning}`);
      attribute(this.durability.root, 'aria-valuenow', String(fraction * 100)); attribute(this.durability.root, 'aria-valuetext', floor ? 'Barely functional' : `${Math.ceil(apc.health.current)} of ${apc.health.max}`);
      attribute(this.durabilityPanel, 'data-stage', String(apc.vehicle?.stage ?? 0)); attribute(this.durabilityPanel, 'data-floor', String(floor));
      attribute(this.durabilityPanel, 'data-warning', String(!floor && fraction <= .25));
    }
    const gun = world.mountedGun, near = !!gun && !gun.mounted && gun.canMount();
    setHidden(this.heatPanel, !gun || !(gun.mounted || near || gun.heat > .005));
    if (gun) {
      const percent = Math.round(gun.heat * 100), state = gun.locked ? 'locked' : gun.heat >= .75 ? 'hot' : gun.mounted ? 'ready' : 'idle';
      style(this.heat.fill, 'width', `${percent}%`);
      const mountHint = this.game.input.scheme === 'touch' ? 'Tap ACTION to man the minigun' : 'Press E to man the minigun';
      text(this.heat.label, near ? mountHint : gun.locked ? `OVERHEATED ${percent}%` : `Minigun heat ${percent}%`);
      attribute(this.heat.root, 'aria-valuenow', String(percent)); attribute(this.heat.root, 'aria-valuetext', gun.locked ? `Overheated, ${percent} percent` : `${percent} percent`);
      attribute(this.heatPanel, 'data-state', state); attribute(this.heatPanel, 'data-mounted', String(gun.mounted));
    }
    attribute(this.portrait, 'data-variant', player.survivor?.variant ?? 'female');
    const portrait = `url("/assets/ui/portrait-survivor-${player.survivor?.variant === 'male' ? 'm' : 'f'}.png")`;
    style(this.portrait, 'background-image', portrait);
    style(this.vignette, 'opacity', String(clamp((.3 - hp) / .3)));
    let corgi = null, pinCount = 0, discoveryCount = 0;
    const px = player.transform.x, pz = player.transform.z;
    for (const entity of world.entities.iterate()) {
      if (entity.archetype.includes('corgi')) corgi = entity;
      if (world.scenario === 'L10' && entity.pickup && !entity.hidden && !('collected' in entity.pickup && entity.pickup.collected) && Math.hypot(entity.transform.x - px, entity.transform.z - pz) <= 25 && discoveryCount < this.discoveries.length) {
        const pin = this.discoveries[discoveryCount++]; setHidden(pin, false);
        attribute(pin, 'aria-label', 'Optional discovery'); this.place(pin, entity.transform.x, entity.transform.z, px, pz);
      }
      if (entity.faction !== 'infected' || entity.health.current <= 0 || ((entity.hidden || entity.infected?.hidden) && !world.weather?.reveals.has(entity.id)) || Math.hypot(entity.transform.x - px, entity.transform.z - pz) > (world.weather?.reveals.has(entity.id) ? 40 : 30)) continue;
      const pin = this.threats[pinCount]; if (!pin) break; pinCount++;
      setHidden(pin, false); attribute(pin, 'data-entity-id', String(entity.id)); attribute(pin, 'data-mega', String(isMega(entity)));
      attribute(pin, 'data-kind', entity.archetype === 'infected.dog' ? 'dog' : entity.archetype === 'infected.alpha' ? 'alpha' : 'regular');
      if (isMega(entity)) pin.setAttribute('aria-label', 'Mega Alpha'); else pin.removeAttribute('aria-label');
      this.place(pin, entity.transform.x, entity.transform.z, px, pz);
    }
    for (let i = pinCount; i < this.threatCount; i++) setHidden(this.threats[i], true);
    this.threatCount = pinCount;
    for (let i = discoveryCount; i < this.discoveries.length; i++) setHidden(this.discoveries[i], true);
    const corgiHiding = corgi?.hidden || corgi?.companion?.state === 'hide';
    const rejoining = !!corgi?.companion?.rejoining;
    const corgiStatus = corgi ? rejoining ? 'Corgi · rejoining' : corgiHiding ? 'Corgi · hiding' : corgi.companion?.state === 'fetch' ? 'Corgi · fetching' : 'Corgi · following' : 'Corgi · awaiting rescue';
    text(this.companion, corgiStatus); attribute(this.corgiBadge, 'title', corgiStatus); attribute(this.corgiBadge, 'aria-label', corgiStatus);
    attribute(this.corgiBadge, 'data-state', corgi ? rejoining ? 'rejoining' : corgiHiding ? 'hiding' : 'following' : 'awaiting-rescue');
    this.place(this.playerPin, px, pz, px, pz); style(this.playerPin, 'rotate', `${-player.transform.yaw + Math.PI / 2}rad`);
    const anchor = markerAnchor(mission);
    // Show the destination, leaving route discovery to the player (G-08 / Q-277).
    const cellarDistance: number | null = null;
    setHidden(this.routePin, cellarDistance === null || !!anchor && Math.hypot(this.cellarTurn.x - anchor.x, this.cellarTurn.z - anchor.z) < 2);
    if (cellarDistance !== null) this.place(this.routePin, this.cellarTurn.x, this.cellarTurn.z, px, pz, true);
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
    if (!objective && !done) text(this.trackerText, '');
    const distanceAnchor = LevelSixSubway.regroupTarget(mission) ? null : mission?.def.l3 && objective ? mission.def.anchors[objective.anchor] : anchor;
    if (objective) text(this.trackerText, `${deadline}${objectiveText(mission!, objective.text)}${distanceAnchor && !l8SanctuaryResting(mission!) ? ` · ${Math.round(cellarDistance ?? Math.hypot(distanceAnchor.x - px, distanceAnchor.z - pz))}\u00a0m` : ''}`);
    const finaleStep = mission?.def.id === 'L10' ? mission.interactStepInRange() : null;
    const finaleAction = !!finaleStep && ['install', 'hold', 'release'].includes(finaleStep.id);
    setHidden(this.finaleAction, !finaleAction);
    if (finaleAction) text(this.finaleAction, finaleStep!.id === 'install' ? 'Install cure' : finaleStep!.id === 'hold' ? 'Activate dispersal console' : 'Release cure');
    // Explain standing interactions in their ring; optional objectives remain visible alongside the main task.
    if (objective && mission) {
      const optional = mission.def.steps.filter(step => step.optional && step !== objective && mission.state.steps[step.id].status === 'active');
      const inRing = mission.interactStepInRange();
      if (inRing) {
        const seconds = inRing.complete.kind === 'interact' ? inRing.complete.seconds : 0;
        const progress = seconds ? Math.min(100, Math.round(mission.state.steps[inRing.id].interaction / (seconds * 60) * 100)) : 0;
        const explicit = mission.def.id === 'L10' && ['hold', 'release'].includes(inRing.id);
        const line = explicit ? `Press E or tap the console action · ${inRing.text}` : `Hold still or press E · ${inRing.text.replace(/^Optional: /, '')} · ${progress}%`;
        const duplicate = mission.def.id === 'L10' && !!this.trackerText.textContent?.includes(inRing.text);
        text(this.trackerText, duplicate
          ? `${this.trackerText.textContent} · ${explicit ? 'Press E or tap the console action' : `Hold still or press E · ${progress}%`}`
          : line);
      }
      else if (optional.length) {
        const current = this.trackerText.textContent ?? '';
        const extra = optional[0].text.replace(/^Optional: /, '');
        if (!current.split(' · ').some(part => part === extra || part.startsWith(`${extra} · `)))
          text(this.trackerText, `${current} · ${optional[0].text}`);
      }
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
      const slot = world.combat!.runner.loadout.current(side), def = world.combat?.runner.loadout.definition(slot.id) ?? action(slot.id), selected = player.weapons!.selectedSide === side;
      const name = label(slot.id);
      const empty = !world.combat!.runner.loadout.hasAmmo(slot);
      const stats = empty ? 'Empty' : slot.id === 'weapon.flamethrower' ? `Fuel ${Math.round(slot.magazine / def.magazine * 100)}%` : def.magazine ? `${slot.magazine} / ${def.magazine}` : def.charges ? `${slot.charges} charges` : def.cooldown ? `${Math.max(0, (slot.readyAt - world.tick) / 60).toFixed(1)}s` : 'Ready';
      const until = slot.reloadUntil || slot.nextCharge || slot.readyAt;
      const duration = (slot.reloadUntil ? def.reloadTime : slot.nextCharge ? def.recharge : Math.max(def.cooldown, def.windup + def.active + def.recovery)) * 60;
      const progress = until > world.tick ? 1 - clamp((until - world.tick) / (duration || 1)) : 1;
      if (selected) shown = { id: slot.id, name, stats, progress, ammo: slot.magazine, charges: slot.charges, state: empty ? 'empty' : slot.reloadUntil > world.tick ? 'reloading' : until > world.tick && stats !== 'Ready' ? 'cooldown' : 'ready' };
      this.game.input.touch.setWeapon(touchSide, actionIconUrl(def.iconId), `${name}, ${stats}`, progress, selected, slot.magazine, slot.charges);
    }
    const entries = player.weapons ? world.combat?.runner.loadout.activeEntries() ?? [] : [];
    const signature = entries.map(entry => entry.id).join(',');
    if (signature !== this.weaponRackSignature) {
      this.weaponRackSignature = signature; this.weaponRack.replaceChildren(); this.weaponRackItems.clear();
      for (const entry of entries) {
        const item = node('button', `weapon-rack-${entry.id}`), icon = document.createElement('img'), key = weaponKey(entry.id);
        item.className = 'hud-weapon-choice'; item.dataset.weapon = entry.id;
        icon.src = actionIconUrl(action(entry.id).iconId); icon.alt = '';
        item.title = `${label(entry.id)}${key === undefined ? '' : ` · ${key}`}`; item.setAttribute('aria-label', item.title);
        item.type = 'button'; item.tabIndex = -1; item.disabled = key === undefined;
        // Same input path as the number key. mousedown/pointerdown never reach the canvas (HUD is a sibling), so no shot, move or aim.
        item.addEventListener('mousedown', event => event.preventDefault()); // keep keyboard focus on the canvas so Space/Enter never re-click a slot
        item.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); if (key !== undefined) this.game.input.selectWeaponKey(key); });
        item.append(icon);
        if (key !== undefined) { const badge = node('span', `weapon-key-${key}`, String(key)); badge.className = 'hud-weapon-key'; item.append(badge); }
        this.weaponRackItems.set(entry.id, item); this.weaponRack.append(item);
      }
    }
    const selectedId = shown?.id === 'weapon.kick' ? 'weapon.fists' : shown?.id;
    for (const [id, item] of this.weaponRackItems) attribute(item, 'data-selected', String(id === selectedId && !gun?.mounted));
    setHidden(this.weaponRack, !entries.length || this.game.input.scheme === 'touch');
    // Manned minigun: the weapon icon shows the gun she holds, not the weapon she carries (rack and touch slots are untouched).
    if (gun?.mounted) shown = { id: 'weapon.rotary-minigun', name: 'Minigun', stats: gun.locked ? 'Overheated' : `Heat ${Math.round(gun.heat * 100)}%`, progress: 1, ammo: 0, charges: 0, state: gun.locked ? 'cooldown' : 'ready' };
    setHidden(this.weapon.root, !shown || (!player.weapons?.LEFT && !player.weapons?.RIGHT && !mission?.def.l1));
    if (shown) {
      const w = this.weapon.root;
      if (this.weaponActionId !== shown.id) {
        if (this.weaponActionId) this.weaponHintUntil = world.tick + 120;
        this.weaponActionId = shown.id; this.weapon.icon.src = actionIconUrl(action(shown.id).iconId);
      }
      const emptyCue = this.emptyWeapon && world.tick <= this.emptyWeapon.until
        ? this.emptyWeapon.tooClose ? 'Too close!' : `${label(this.emptyWeapon.id)} · Empty`
        : null;
      text(this.weapon.hint, emptyCue ?? shown.name); setHidden(this.weapon.hint, !emptyCue && world.tick > this.weaponHintUntil);
      const description = `${shown.name}, ${shown.stats}`;
      attribute(w, 'title', `${description} · ${this.game.input.scheme === 'touch' ? 'swipe up LEFT / RIGHT to switch' : 'weapon slot, RMB or Q to switch'}`); attribute(w, 'aria-label', `Active weapon: ${description}`);
      attribute(w, 'data-weapon', shown.id); attribute(w, 'data-state', shown.state); attribute(w, 'data-ammo', String(shown.ammo)); attribute(w, 'data-charges', String(shown.charges));
      style(w, '--progress', String(shown.progress));
    }
    const id = world.interactables?.activeId, device = id != null ? world.entities.get(id)?.interactable : null;
    setHidden(this.interaction, !device);
    if (device) { this.interaction.style.background = `conic-gradient(#64dccc ${device.progress * 360}deg,#182333 0)`; text(this.interaction, device.hint || `${device.label} · ${Math.round(device.progress * 100)}%`); attribute(this.interaction, 'data-progress', String(device.progress)); }
    setHidden(this.damage, world.tick > this.damagedUntil); setHidden(this.bark, world.tick > this.barkUntil);
    setHidden(this.shieldBlock, world.tick > this.shieldBlockUntil);
    setHidden(this.civilianBark, world.tick > this.civilianBarkUntil);
    if (!preparing) { this.updateStory(); this.onboarding.update(this.game.input.scheme, visible); }
  }
  /** E23: survivor counter, the transient world caption, and the nearby interaction prompt. */
  private updateSurvivors(mission: Mission | null | undefined, px: number, pz: number): void {
    this.followerRadar.update(this.game.world.entities, px, pz);
    for (const card of this.survivorCards) {
      const r = mission?.state.l5?.survivors.find(r => r.key === card.def.key);
      const e = r && this.game.world.entities.get(r.id);
      const alive = !!e && !e.hidden && !e.infection && e.health.current > 0 && (r?.status === 'following' || r?.status === 'sheltered');
      setHidden(card.root, !alive);
      if (alive && e) {
        const fraction = healthFraction(e.health.current, e.health.max);
        style(card.health.fill, 'width', `${fraction * 100}%`);
        text(card.health.label, `${Math.ceil(e.health.current)}/${e.health.max}`);
        attribute(card.health.root, 'aria-valuenow', String(Math.round(fraction * 100)));
        attribute(card.root, 'aria-label', `${card.def.name}, health ${Math.round(fraction * 100)}%`);
      }
    }
    const world = this.game.world;
    this.updateSurvivorCue(mission, px, pz);
    const target = LevelSixSubway.regroupTarget(mission);
    if (target) {
      setHidden(this.survivorText, true);
      setHidden(this.cuePin, true);
      setHidden(this.cueText, true);
      this.waitCue(target ? { ...target.transform, name: survivorName(target), id: String(target.id) } : undefined, px, pz);
      setHidden(this.cueText, true);
      return;
    }
    if (world.l7Encounters && mission?.state.steps.corridor?.status === 'active') {
      const missing = world.l7Encounters.corridorGroup().missing[0];
      const target = missing && world.entities.get(missing.id);
      setHidden(this.survivorText, true);
      this.waitCue(target ? { ...target.transform, name: survivorName(target), id: String(target.id) } : undefined, px, pz);
      // The shared objective line already includes this person's name and distance.
      setHidden(this.cueText, true);
      return;
    }
    const departure = this.game.world.l7Departure;
    if (departure && mission?.state.steps.departure?.status === 'active') {
      const status = departure.boardingStatus();
      setHidden(this.survivorText, false); text(this.survivorText, ` · ${status.count}`);
      setHidden(this.cuePin, !status.target); setHidden(this.cueText, !status.waiting);
      text(this.cueText, status.waiting ? ` · ${status.waiting}` : '');
      if (status.target) {
        this.place(this.cuePin, status.target.x, status.target.z, px, pz, true);
        attribute(this.cuePin, 'aria-label', `Find ${status.target.name}`);
        attribute(this.cuePin, 'data-survivor', String(status.target.id));
      }
      return;
    }
    if (mission?.def.l8 && (mission.state.steps.depart?.status === 'active' || mission.l8!.boarding())) {
      // The objective line already shows the exact aboard count. The remaining
      // passengers are being escorted by the boarding AI, so a nearest-person
      // "Find" cue sends the player away from the APC while they queue there.
      setHidden(this.survivorText, true); text(this.survivorText, '');
      setHidden(this.cuePin, true); setHidden(this.cueText, true); text(this.cueText, '');
      return;
    }
    if (mission?.def.id === 'L10') {
      setHidden(this.survivorText, true);
      setHidden(this.cuePin, true); setHidden(this.cueText, true);
      return;
    }
    const l5 = mission?.state.l5, show = !!mission && !!l5 && l5.phase !== 'cellar';
    setHidden(this.survivorText, !show);
    if (!show || !l5 || !mission) { setHidden(this.cueText, true); setHidden(this.cuePin, true); return; }
    const metro = mission.l5?.metroStatus();
    setHidden(this.survivorText, !!metro);
    text(this.survivorText, ` · Survivors found ${l5.found}/5`);
    // Q-302 (PO 10-31 "I like the old approach, that I need to search them. Since I only hear the noise, it's not really a
    // checkpoint"): no pin, place name or distance to a hiding place; the sign-of-life sounds lead the search.
    // Q-321 (PO 11-01 "L5 is not showing the accusting icons anymore on the radar"): the ♪ ping shows only while a call
    // is heard, at its source, and goes with the sound.
    const cue = l5.cue;
    // The simulated ping window is a maximum duration, not proof that the
    // positional one-shot is still audible. Audio voices can end earlier
    // (for example Mia's recorded call), so keep the minimap note tied to the
    // live source at that exact hiding-place position.
    const voicePlaying = cue && [...this.game.audio.graph.active.values()].some(voice =>
      !voice.stopped && voice.position && Math.hypot(voice.position.x - cue.x, voice.position.z - cue.z) < 0.01);
    const heard = cue && cue.until > this.game.world.tick && voicePlaying ? cue : null;
    text(this.cuePin, '♪');
    setHidden(this.cuePin, !heard);
    if (heard) { this.place(this.cuePin, heard.x, heard.z, px, pz, true); attribute(this.cuePin, 'aria-label', 'A sign of life'); attribute(this.cuePin, 'data-survivor', heard.key); }
    let cueLabel = '';
    for (const r of l5.survivors) {
      const ring = mission.def.anchors[`l5-ring-${r.key}`];
      if (r.status === 'hidden' && ring && Math.hypot(ring.x - px, ring.z - pz) <= ring.radius && (l5.phase === 'search' || l5.phase === 'metro')) cueLabel = ` · ${l5Survivors.find(s => s.key === r.key)!.prompt}`;
    }
    setHidden(this.cueText, !cueLabel); if (cueLabel) text(this.cueText, cueLabel);
  }
  private updateSurvivorCue(mission: Mission | null | undefined, px: number, pz: number): void {
    const tick = this.game.world.tick;
    const warning = this.game.world.l7Encounters?.state.alarm ?? mission?.state.l5?.alarm ?? mission?.state.l6?.alarm;
    const regroup = LevelSixSubway.regroupTarget(mission);
    const alarm = warning && tick < warning.until ? warning : undefined;
    const source = alarm && 'id' in alarm ? this.game.world.entities.get(alarm.id) : undefined;
    const cue = regroup ? { key: `l6-regroup-${regroup.id}`, until: Number.MAX_SAFE_INTEGER, ...regroup.transform, text: `Rejoin ${survivorName(regroup)} · ${Math.ceil(Math.hypot(regroup.transform.x-px,regroup.transform.z-pz))} m` }
      : alarm && source && !source.hidden ? { ...alarm, ...source.transform } : alarm ?? mission?.state.l5?.cue;
    attribute(this.survivorCue, 'data-alarm', String(!!alarm));
    if (!cue || tick >= cue.until || !alarm && !regroup && (!mission?.state.l5 || mission.state.l5.phase === 'cellar' || Math.hypot(cue.x - px, cue.z - pz) > l5.survivors.cueRangeM)) {
      setHidden(this.survivorCue, true); return;
    }
    const p = this.game.view.project(cue.x, (regroup?.transform.y ?? source?.transform.y ?? -.2) + .9, cue.z), behind = p[2] > 1;
    const sx = (p[0] + 1) * 50, sy = (1 - p[1]) * 50;
    const offscreen = behind || p[2] < -1 || Math.abs(p[0]) > 1 || Math.abs(p[1]) > 1;
    let left = sx, top = sy, offsetX = .5, offsetY = 1, arrowAngle = 0, arrowLeft = '50%', arrowTop = '100%';
    if (offscreen) {
      let dx = p[0], dy = -p[1];
      if (behind) { dx = -dx; dy = -dy; }
      if (!dx && !dy) dx = 1;
      if (Math.abs(dx) >= Math.abs(dy)) {
        left = dx > 0 ? 94 : 6; top = 50 + Math.max(-35, Math.min(35, dy / Math.abs(dx || 1) * 35));
        offsetX = dx > 0 ? 1 : 0; offsetY = .5;
        arrowLeft = dx > 0 ? '100%' : '0%'; arrowTop = '50%';
      } else {
        left = 50 + Math.max(-40, Math.min(40, dx / Math.abs(dy) * 40)); top = dy > 0 ? 92 : 8;
        offsetY = dy > 0 ? 1 : 0;
        arrowLeft = '50%'; arrowTop = dy > 0 ? '100%' : '0%';
        const halfWidth = Math.min(170, innerWidth * .4) / innerWidth * 100 + 2;
        left = Math.max(halfWidth, Math.min(100 - halfWidth, left));
      }
      arrowAngle = Math.atan2(dy * innerHeight, dx * innerWidth);
    } else {
      const halfWidth = Math.min(170, innerWidth * .4) / innerWidth * 100 + 2;
      left = Math.max(halfWidth, Math.min(100 - halfWidth, left));
      top = Math.max(18, Math.min(92, top));
    }
    const remaining = (cue.until - tick) / (60 * (alarm ? 5 : l5.survivors.pingS));
    // A grab's rescue window is only one second: urgent alarms must be fully
    // readable on arrival, rather than spending that window fading in.
    const opacity = regroup ? 1 : alarm ? Math.min(1, remaining * 6) : Math.min(1, (1 - remaining) * 6, remaining * 6);
    text(this.survivorCueLine, cue.text); setHidden(this.survivorCue, false);
    const signature = `${cue.key}:${cue.until}:${innerWidth}:${innerHeight}:${mission?.state.l5?.found}:${this.tracker.textContent}`;
    if (signature !== this.cueLayoutSignature) {
      this.cueLayoutSignature = signature;
      const rect = this.survivorCue.getBoundingClientRect(); this.cueSize = { width: rect.width, height: rect.height };
      const subtitle = document.querySelector<HTMLElement>('.mission-subtitle');
      this.cueObstacles = [...this.cuePanels, ...(subtitle ? [subtitle] : [])].flatMap(panel => {
        const box = panel.getBoundingClientRect();
        return panel.hidden || !box.width || !box.height ? [] : [{ left: box.left, top: box.top, right: box.right, bottom: box.bottom }];
      });
    }
    const position = interactionPromptPosition({ x: innerWidth * left / 100 - this.cueSize.width * offsetX,
      y: innerHeight * top / 100 - this.cueSize.height * offsetY }, this.cueSize,
      { left: 0, top: 0, right: innerWidth, bottom: innerHeight }, this.cueObstacles);
    style(this.survivorCue, 'left', `${position.x}px`); style(this.survivorCue, 'top', `${position.y}px`);
    style(this.survivorCue, 'opacity', String(opacity));
    this.survivorCueArrow.hidden = !offscreen;
    if (offscreen) {
      style(this.survivorCueArrow, 'left', arrowLeft); style(this.survivorCueArrow, 'top', arrowTop);
      style(this.survivorCueArrow, 'transform', `translate(-50%,-50%) rotate(${arrowAngle}rad)`);
    }
    setHidden(this.survivorCue, false);
  }
  /** The same persistent cue locates people, a waiting transport, or a long finale objective. */
  private waitCue(target: { x: number; z: number; name: string; id: string } | undefined, px: number, pz: number): void {
    text(this.cuePin, '☺');
    setHidden(this.cuePin, !target); setHidden(this.cueText, !target);
    if (!target) return;
    const distance = Math.ceil(Math.hypot(target.x - px, target.z - pz));
    this.place(this.cuePin, target.x, target.z, px, pz, true);
    attribute(this.cuePin, 'aria-label', `${target.name}, ${distance} meters`);
    attribute(this.cuePin, 'data-survivor', target.id);
    text(this.cueText, ` · ${target.name} · ${distance} m`);
  }
  /** Story bubble from the mission state (L1/L2/L6): fades in over 10 ticks, out over 15 after its reading time. */
  private updateStory(): void {
    const world = this.game.world, say = world.missions?.state.l1?.say ?? world.missions?.state.l2?.say ?? world.missions?.state.l6?.say, tick = world.tick;
    const opacity = say ? Math.min(1, (tick - say.at) / 10, 1 - (tick - say.until) / 15) : 0;
    setHidden(this.storyBubble, !say || opacity <= 0);
    if (!say || this.storyBubble.hidden) return;
    text(this.storyBubble, say.text);
    style(this.storyBubble, 'opacity', String(Math.max(0, opacity)));
    if (say.id === 0) { style(this.storyBubble, 'left', '50%'); style(this.storyBubble, 'top', '78%'); return; }
    const speaker = world.entities.get(say.id); if (speaker && !speaker.hidden) { this.storyX = speaker.transform.x; this.storyZ = speaker.transform.z; }
    const p = this.game.view.project(this.storyX, (speaker?.transform.y ?? .7) + 1.6, this.storyZ);
    // Clamp the whole bubble and keep it clear of the fixed HUD. Clamping only
    // its speaker anchor left offscreen dialogue behind the portrait and bars.
    const signature = `${say.text}:${innerWidth}:${innerHeight}:${this.tracker.textContent}:${document.body.className}`;
    if (signature !== this.storyLayoutSignature) {
      this.storyLayoutSignature = signature;
      const rect = this.storyBubble.getBoundingClientRect(); this.storySize = { width: rect.width, height: rect.height };
      this.storyObstacles = [...this.cuePanels, ...document.querySelectorAll<HTMLElement>('.mission-subtitle,[data-testid="pause-button"],[data-testid="home-button"]')].flatMap(panel => {
        const box = panel.getBoundingClientRect();
        return panel.hidden || !box.width || !box.height ? [] : [box];
      });
      const debugRow = parseFloat(getComputedStyle(document.body).getPropertyValue('--debug-row')) || 0;
      if (debugRow) this.storyObstacles.push({ left: 0, top: 0, right: innerWidth, bottom: debugRow });
    }
    const { width, height } = this.storySize;
    const position = interactionPromptPosition({ x: (p[0] + 1) * innerWidth / 2 - width / 2, y: (1 - p[1]) * innerHeight / 2 - height },
      this.storySize, { left: 0, top: 0, right: innerWidth, bottom: innerHeight }, this.storyObstacles);
    style(this.storyBubble, 'left', `${position.x + width / 2}px`); style(this.storyBubble, 'top', `${position.y + height}px`);
  }
  dispose(): void { this.clear(); this.onboarding.dispose(); this.root.remove(); }
}
