// Adapted from folio-2025 Menu.js / Modals.js by Bruno Simon (MIT, 41046b5):
// named screens, visibility classes, first focus, and separate gameplay input context.
import type { Game } from '../Game';
import { newCampaign, type Level } from '../sim/progression/Campaign';
import { defaultBindings, type Action } from '../data/bindings';
import { Hud } from './Hud';
import { button, node } from './dom';
import { Settings, type UISettings } from './Settings';
import './ui.css';

type Screen = 'title' | 'character' | 'levels' | 'pause' | 'settings' | 'credits' | 'upgrades' | 'rack' | 'loading' | null;
export class GameUI {
  readonly root = node('div', 'menus');
  readonly enabled: boolean;
  readonly settings: Settings;
  /** Latest DOM update duration, measured independently of WebGL work. */
  updateMs = 0;
  readonly hud: Hud;
  private screen: Screen = null;
  private back: Screen = 'title';
  private variant: 'male' | 'female' = 'female';
  private nextLevel = 'L1';
  private started = false;
  private missionPhase = '';
  private readonly screens = new Map<Exclude<Screen, null>, HTMLElement>();
  private readonly pauseButton = button('pause-button', 'Ⅱ Pause', () => this.pause());
  constructor(private readonly game: Game) {
    this.enabled = game.params.get('test') !== '1' || game.params.get('ui') === '1';
    let storage: Storage | undefined;
    try { storage = localStorage; } catch { /* Storage may be disabled. */ }
    this.settings = new Settings(storage);
    this.hud = new Hud(game);
  }
  init(): void {
    if (!this.enabled) return;
    document.body.classList.add('full-ui');
    document.body.classList.toggle('touch-ui', navigator.maxTouchPoints > 0 || matchMedia('(pointer:coarse)').matches); this.root.className = 'menus';
    this.pauseButton.setAttribute('aria-label', 'Pause');
    const pauseLabel = node('span', 'pause-label', 'Pause');
    this.pauseButton.replaceChildren(node('span', 'pause-icon', 'Ⅱ '), pauseLabel);
    this.build(); document.querySelector('#game')!.append(this.root, this.pauseButton);
    window.addEventListener('keydown', this.key, true);
    document.addEventListener('click', this.missionAccept);
    this.hud.init(); this.hud.loaded();
    this.applySettings(); this.show('title'); this.started = true;
  }
  private panel(id: Exclude<Screen, null>, title: string, detail: string): HTMLElement {
    const panel = node('section', `menu-${id}`); panel.dataset.menuScreen = id;
    panel.className = `menu-panel menu-${id}`; panel.hidden = true;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', `heading-${id}`);
    const heading = node('h1', `heading-${id}`, title); heading.id = `heading-${id}`;
    panel.append(heading, node('p', `detail-${id}`, detail));
    this.screens.set(id, panel); this.root.append(panel); return panel;
  }
  private build(): void {
    const title = this.panel('title', 'MINOR INCIDENT', 'A quieter neighborhood today · Braver people tomorrow');
    title.append(button('start-game', 'Start game', () => this.show('character')),
      button('continue-game', 'Continue', () => { void this.continueSaved(); }),
      button('title-levels', 'Level select', () => { const saved = this.game.saves.load(); if (saved.status === 'ok') { this.game.campaign = saved.save; this.show('levels'); } }),
      button('title-settings', 'Settings', () => { this.back = 'title'; this.show('settings'); }),
      button('title-credits', 'Credits', () => this.show('credits')));
    const character = this.panel('character', 'Choose your survivor', 'Same courage. Your style.');
    for (const variant of ['female', 'male'] as const) character.append(button(`character-${variant}`, variant === 'female' ? 'Female survivor' : 'Male survivor', () => {
      this.variant = variant; this.game.world.player?.select(variant, 0);
      this.game.campaign = newCampaign(variant, Number(this.game.params.get('seed') ?? 1));
      this.game.campaign.settings = { ...this.game.audio.settings }; this.applySettings(); this.show('levels');
    }));
    character.append(button('character-back', 'Back', () => this.show('title')));
    const levels = this.panel('levels', 'Choose a level', 'Start in Sunset Grove.');
    const names = ['Stop the Outbreak', 'Get Them Out', 'Reach the Safe Zone', 'Open the Escape Route', 'Hold the Line', 'Get Out'];
    for (let i = 1; i <= 6; i++) levels.append(button(`level-L${i}`, `L${i} · ${names[i - 1]}`, () => { void this.load(`L${i}`); }));
    levels.append(button('levels-back', 'Back', () => this.show('character')));
    const pause = this.panel('pause', 'Game paused', 'Take a breath. The neighborhood can wait.');
    pause.append(button('resume-game', 'Resume', () => this.resume()),
      button('pause-settings', 'Settings', () => { this.back = 'pause'; this.show('settings'); }),
      button('pause-title', 'Title screen', () => this.show('title')));
    const credits = this.panel('credits', 'Credits', 'Minor Incident · Technology adapted from Bruno Simon’s folio-2025 (MIT), Three.js and Rapier.');
    credits.append(button('credits-back', 'Back', () => this.show('title')));
    const settings = this.panel('settings', 'Settings', 'Make yourself comfortable. Changes save automatically.');
    const form = node('div', 'settings-fields'); form.className = 'settings-fields';
    settings.append(form);
    this.select(form, 'textSize', 'Text size', ['1', '1.25', '1.5']);
    this.select(form, 'aimAssist', 'Aim assist', ['Off', 'Low', 'Default', 'High']);
    this.select(form, 'gore', 'Blood', ['Off', 'Reduced', 'Full']);
    this.select(form, 'quality', 'Quality', ['auto', 'high', 'low']);
    for (const [key, label] of [['cameraShake', 'Camera shake'], ['flashReduction', 'Reduce flashes'], ['colorblind', 'Colorblind telegraphs'], ['muted', 'Mute audio']] as const) {
      const row = node('label', `label-${key}`, label), input = node('input', `setting-${key}`);
      input.type = 'checkbox'; input.checked = this.settings.value[key];
      input.addEventListener('change', () => { this.settings.patch({ [key]: input.checked }); this.applySettings(); });
      row.append(input); form.append(row);
    }
    for (const [key, label] of [['captions', 'Sound captions'], ['mono', 'Mono audio'], ['haptics', 'Haptics'], ['noiseRings', 'Visual sound cues']] as const) {
      const row = node('label', `audio-label-${key}`, label), input = node('input', `audio-${key}`);
      input.type = 'checkbox'; input.checked = this.game.audio.settings[key];
      input.addEventListener('change', () => this.game.audio.set({ [key]: input.checked })); row.append(input); form.append(row);
    }
    const controls = node('div', 'settings-controls'); controls.className = 'settings-controls';
    controls.append(node('p', 'controls-guide', 'Mouse: cursor to move, LMB / RMB, wheel, stand to interact. Keyboard: WASD, arrows, J / K, Q, E. Touch: stick, drag or tap actions, stand to interact.'));
    const action = node('select', 'binding-action'); action.setAttribute('aria-label', 'Action to rebind');
    for (const name of Object.keys(defaultBindings) as Action[]) { const option = node('option', `binding-${name}`, name); option.value = name; action.append(option); }
    const code = node('input', 'binding-code'); code.setAttribute('aria-label', 'Keyboard code'); code.placeholder = 'KeyF';
    const status = node('output', 'binding-status'); status.setAttribute('role', 'status');
    controls.append(action, code, button('bind-key', 'Bind key', () => { status.textContent = this.game.input.rebind(action.value as Action, code.value).message; }), status);
    settings.append(controls, button('settings-back', 'Back', () => this.show(this.back)));
    const upgrades = this.panel('upgrades', 'Choose an upgrade', 'Your next step toward a braver tomorrow.');
    for (const [id, label] of [['health', 'Health'], ['speed', 'Speed'], ['melee', 'Melee damage']] as const) upgrades.append(button(`upgrade-${id}`, label, () => {
      // E13 owns effect application; emit the choice at its existing progression handoff.
      this.root.dispatchEvent(new CustomEvent('upgrade-selected', { bubbles: true, detail: { id, level: this.game.world.scenario } }));
      this.show('rack');
    }));
    const rack = this.panel('rack', 'Set up your racks', 'One to three actions per side.');
    const choices = ['weapon.fists', 'weapon.kick', 'weapon.bat', 'weapon.pistol', 'weapon.grenade'];
    for (const side of ['LEFT', 'RIGHT'] as const) for (let i = 0; i < 3; i++) {
      const select = node('select', `rack-${side}-${i}`); select.setAttribute('aria-label', `${side} rack slot ${i + 1}`);
      for (const id of ['', ...choices]) { const option = node('option', `rack-${side}-${i}-${id || 'none'}`, id ? id.split('.')[1] : 'Empty'); option.value = id; select.append(option); }
      select.value = i === 0 ? side === 'LEFT' ? 'weapon.bat' : 'weapon.kick' : ''; rack.append(select);
    }
    rack.append(button('rack-continue', 'Continue to briefing', () => { void this.load(this.nextLevel, true); }));
    this.panel('loading', 'Loading neighborhood…', 'Getting everything ready.');
  }
  private select(parent: HTMLElement, key: 'textSize' | 'aimAssist' | 'gore' | 'quality', label: string, choices: string[]): void {
    const row = node('label', `label-${key}`, label), select = node('select', `setting-${key}`);
    for (const value of choices) { const option = node('option', `${key}-${value}`, value); option.value = value; select.append(option); }
    select.value = String(this.settings.value[key]);
    select.addEventListener('change', () => { this.settings.patch({ [key]: key === 'textSize' ? Number(select.value) : select.value } as Partial<UISettings>); this.applySettings(); });
    row.append(select); parent.append(row);
  }
  applySettings(): void {
    if (!this.enabled) return;
    const value = this.settings.value;
    const quality = value.quality === 'auto' ? matchMedia('(pointer:coarse)').matches ? 'low' : 'high' : value.quality;
    for (const [key, setting] of Object.entries(value)) {
      const control = this.root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-testid=setting-${key}]`);
      if (control instanceof HTMLInputElement) control.checked = setting as boolean;
      else if (control) control.value = String(setting);
    }
    document.body.style.setProperty('--text-scale', String(value.textSize));
    document.body.classList.toggle('colorblind-ui', value.colorblind);
    this.game.view.settings({ gore: value.gore, cameraShake: value.cameraShake, flashReduction: value.flashReduction, colorblind: value.colorblind, quality });
    this.game.world.npcs?.setQuality(quality);
    this.game.audio.set({ muted: value.muted || this.game.params.get('audio') === 'muted', gore: value.gore });
    if (this.game.world.combat) this.game.world.combat.assist.setting = value.aimAssist;
    this.game.campaignSettings(value);
  }
  private async continueSaved(): Promise<void> {
    const saved = this.game.saves.load(); if (saved.status !== 'ok') return;
    this.show('loading');
    try {
      await this.game.continueCampaign(saved.save);
      if (this.game.campaignUI.root.hidden) this.show(null);
    } catch {
      this.show('title'); this.screens.get('title')!.querySelector('p')!.textContent = 'Could not load saved campaign. Please try again.';
    }
  }
  private async load(id: string, racks = false): Promise<void> {
    const left: string[] = [], right: string[] = [];
    if (racks) for (const side of ['LEFT', 'RIGHT'] as const) for (let i = 0; i < 3; i++) {
      const value = this.root.querySelector<HTMLSelectElement>(`[data-testid="rack-${side}-${i}"]`)!.value;
      if (value) (side === 'LEFT' ? left : right).push(value);
    }
    this.show('loading');
    try {
      if (this.game.campaign) await this.game.continueCampaign(this.game.campaign, Number(id.slice(1)) as Level);
      else { await this.game.loadLevel(id); this.game.world.player?.select(this.variant, 0); }
      if (racks && left.length && right.length) this.game.world.combat?.setLoadout(left, right);
      else if (id === 'L1' && !this.game.campaign) this.game.world.combat?.setLoadout(['weapon.fists'], ['weapon.kick']);
      this.applySettings(); this.show(null);
      if (!this.game.audio.snapshot().background) this.game.clock.resume();
      this.game.view.update(1);
    } catch (error) {
      this.show('levels'); this.screens.get('levels')!.querySelector('p')!.textContent = `Could not load ${id}. Please try again.`;
      console.error(error);
    }
  }
  show(screen: Screen): void {
    if (!this.enabled) return;
    this.game.input.clear(); this.game.world.clearInput();
    this.screen = screen;
    if (screen === 'title') {
      this.game.campaignUI.hide();
      const saved = this.game.saves.load();
      for (const id of ['continue-game', 'title-levels']) this.root.querySelector<HTMLButtonElement>(`[data-testid=${id}]`)!.hidden = saved.status !== 'ok';
    }
    if (screen === 'levels') for (let i = 1; i <= 6; i++) this.root.querySelector<HTMLButtonElement>(`[data-testid=level-L${i}]`)!.disabled = i > (this.game.campaign?.unlockedLevel ?? 1);
    for (const [name, panel] of this.screens) panel.hidden = name !== screen;
    this.root.hidden = screen === null;
    if (screen === null && this.root.contains(document.activeElement)) (document.activeElement as HTMLElement)?.blur();
    document.body.dataset.uiScreen = screen ?? 'game';
    if (screen) {
      this.game.clock.pause();
      this.screens.get(screen)?.querySelector<HTMLElement>('button, select, input')?.focus({ preventScroll: true });
    }
    this.pauseButton.hidden = screen !== null;
  }
  pause(): void {
    if (!this.enabled || !this.game.campaignUI.root.hidden) return;
    if (this.screen === null && (!this.game.world.missions || ['playing', 'cinematic'].includes(this.game.world.missions.state.phase))) this.show('pause');
  }
  resume(): void {
    if (document.hidden || this.game.audio.snapshot().background) return;
    this.show(null); this.game.ticker.reset(); this.game.clock.resume();
  }
  reset(): void { if (this.enabled) this.hud.clear(); }
  /** Called only after a world load completes; UI itself never mutates sim snapshots. */
  loaded(): void {
    if (!this.started || !this.enabled) return;
    this.missionPhase = ''; if (this.screen !== 'loading') this.show(null);
    if (this.game.campaign) this.settings.patch(this.game.campaign.settings, false);
    this.applySettings(); this.hud.loaded();
  }
  update(): void {
    if (!this.enabled) return;
    const start = performance.now();
    const mission = this.game.world.missions;
    if (mission?.state.phase !== this.missionPhase) {
      this.missionPhase = mission?.state.phase ?? '';
      if (mission?.state.phase === 'progression' && !this.game.campaign) { this.nextLevel = `L${Math.min(6, Number(mission.def.id.slice(1)) + 1)}`; this.show('upgrades'); }
    }
    this.hud.update();
    this.pauseButton.hidden = !this.game.campaignUI.root.hidden || this.screen !== null || (!!mission && !['playing', 'cinematic'].includes(mission.state.phase));
    this.updateMs = performance.now() - start;
  }
  private readonly missionAccept = (event: MouseEvent): void => {
    if (!(event.target as HTMLElement).closest('[data-testid=mission-button]')) return;
    if (this.game.world.missions?.state.phase === 'progression') {
      // A paused result click must hand off without waiting for the next render frame.
      this.game.campaignUI.update(); this.update();
    } else if (this.game.world.missions?.state.phase === 'playing' && !this.game.audio.snapshot().background) {
      this.game.input.clear(); this.game.clock.resume(); this.game.ticker.reset(); this.update();
    }
  };
  private readonly key = (event: KeyboardEvent): void => {
    if (!this.enabled || !this.game.campaignUI.root.hidden) return;
    if (!event.repeat && this.game.input.bindings.action(event.code) === 'pause' && !(event.target as HTMLElement)?.closest('input,select,textarea')) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (this.screen === null) this.pause(); else if (this.screen === 'settings') this.show(this.back);
      return; // Escape never resumes after a background pause.
    }
    if (event.code !== 'Tab') return;
    const panel = this.screen ? this.screens.get(this.screen) : document.querySelector<HTMLElement>('.mission-panel:not([hidden])');
    if (!panel) return;
    const controls = panel.querySelectorAll<HTMLElement>('button:not([hidden]),select,input');
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  dispose(): void { window.removeEventListener('keydown', this.key, true); document.removeEventListener('click', this.missionAccept); this.root.remove(); this.pauseButton.remove(); this.hud.dispose(); document.body.classList.remove('full-ui', 'touch-ui'); delete document.body.dataset.uiScreen; }
}
