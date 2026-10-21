// Adapted from folio-2025 Menu.js / Modals.js by Bruno Simon (MIT, 41046b5):
// named screens, visibility classes, first focus, and separate gameplay input context.
import homePlaceholders from '../../public/ui/home/placeholders.json';
import type { Game } from '../Game';
import { newCampaign, type CampaignSave, type Level } from '../sim/progression/Campaign';
import { defaultBindings, type Action } from '../data/bindings';
import { Hud } from './Hud';
import { debugEntityCounts } from './debugEntityCounts';
import { button, node, setHidden } from './dom';
import { Settings, type UISettings } from './Settings';
import { audioCredits, codeCredits, technologyCredits, toolchainCredits, originalCredit, type Credit } from '../data/credits';
import { madeBy } from '../data/madeBy';
import './ui.css';

const levelTitles = ['Special Delivery', 'The Failed Rescue', 'The Police Collapse', 'The Safe City Falls', 'Aftermath', 'The Subway', 'The Ruined City', 'The Zoo', 'The Crossing', 'The Cure'];
const resumeLevel = (save: CampaignSave | null): number | null => save?.cureResume ? 10 : save?.l9Crash && !save.crossingHandover ? 9 : null;

type Screen = 'title' | 'character' | 'levels' | 'pause' | 'settings' | 'credits' | 'upgrades' | 'rack' | 'loading' | null;
declare const __BUILD_COMMIT__: string;
export class GameUI {
  readonly root = node('div', 'menus');
  enabled: boolean;
  readonly settings: Settings;
  /** Latest DOM update duration, measured independently of WebGL work. */
  updateMs = 0;
  readonly hud: Hud;
  private screen: Screen = null;
  private back: Screen = 'title';
  private levelsBack: 'title' | 'character' = 'character';
  private variant: 'male' | 'female' = 'female';
  private nextLevel = 'L1';
  private started = false;
  private missionPhase = '';
  private readonly debugEnabled: boolean;
  private readonly fpsSamples: { at: number; fps: number }[] = [];
  private debugText: HTMLPreElement | null = null;
  private readonly screens = new Map<Exclude<Screen, null>, HTMLElement>();
  private readonly pauseButton = button('pause-button', 'Ⅱ Pause', () => this.pause());
  /** HUD Home button (PO 10-12): one tap back to the initial menu; progress stays at the last checkpoint. */
  private readonly homeButton = homeButton('home-button', () => this.show('title'));
  constructor(private readonly game: Game) {
    this.debugEnabled = ['true', '1'].includes(game.params.get('debug') ?? '');
    this.enabled = game.params.get('test') !== '1' || game.params.get('ui') === '1';
    let storage: Storage | undefined;
    try { storage = localStorage; } catch { /* Storage may be disabled. */ }
    this.settings = new Settings(storage);
    this.hud = new Hud(game);
  }
  init(force = false): void {
    if (this.started) return;
    if (force) this.enabled = true;
    if (!this.enabled) return;
    document.body.classList.add('full-ui');document.body.classList.toggle('debug-ui',this.game.params.has('debug'));
    document.body.classList.toggle('touch-ui', navigator.maxTouchPoints > 0 || matchMedia('(pointer:coarse)').matches); this.root.className = 'menus'; this.root.prepend(homeArt());
    this.pauseButton.setAttribute('aria-label', 'Pause');
    const pauseLabel = node('span', 'pause-label', 'Pause');
    this.pauseButton.replaceChildren(node('span', 'pause-icon', 'Ⅱ '), pauseLabel);
    this.homeButton.hidden = true;
    this.build(); document.querySelector('#game')!.append(this.root, this.pauseButton, this.homeButton);
    window.addEventListener('keydown', this.key, true);
    window.addEventListener('pointerdown', this.unhide, true);
    document.addEventListener('click', this.missionAccept);
    this.hud.init(); this.hud.loaded();
    this.applySettings(false); this.show('title'); this.started = true;
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
    title.append(button('start-game', 'Start game', () => {
      const saved = this.game.saves.load();
      if (saved.status === 'ok') { this.levelsBack = 'title'; this.settings.patch(saved.save.settings); this.game.campaign = saved.save; this.show('levels'); }
      else this.show('character');
    }),
      button('title-settings', 'Settings', () => { this.back = 'title'; this.show('settings'); }),
      button('title-credits', 'Credits & Licenses', () => this.show('credits')));
    const character = this.panel('character', 'Choose your survivor', 'Same courage. Your style.');
    for (const variant of ['female', 'male'] as const) character.append(button(`character-${variant}`, variant === 'female' ? 'Female survivor' : 'Male survivor', () => {
      this.levelsBack = 'character';
      this.variant = variant; this.game.world.player?.select(variant, 0);
      this.game.campaign = newCampaign(variant, Number(this.game.params.get('seed') ?? 1));
      this.game.campaign.settings = { ...this.game.audio.settings }; this.applySettings(); this.show('levels');
    }));
    character.append(button('character-back', 'Back', () => this.show('title')));
    const levels = this.panel('levels', 'Choose a level', 'Replay any unlocked level.');
    const levelList = node('div', 'level-list'); levelList.className = 'level-list'; levels.append(levelList);
    const lockHint = document.createElement('p'); lockHint.className = 'lock-hint'; lockHint.setAttribute('role', 'status'); lockHint.hidden = true;
    for (let i = 1; i <= 10; i++) {
      const b = button(`level-L${i}`, `L${i} · ${levelTitles[i - 1]}`, () => {
        // Locked levels stay focusable (aria-disabled) so a tap or keyboard focus can explain why; activation is blocked.
        // Debug builds (?debug=1) keep the lock styling but let a click start the level anyway (PO 10-20 #76).
        if (b.getAttribute('aria-disabled') === 'true' && !this.debugEnabled) { lockHint.textContent = `Complete Level ${i - 1} first`; lockHint.hidden = false; return; }
        void this.load(`L${i}`, false, resumeLevel(this.game.campaign) === i);
      });
      b.addEventListener('focus', () => { if (b.getAttribute('aria-disabled') === 'true') { lockHint.textContent = `Complete Level ${i - 1} first`; lockHint.hidden = false; } else lockHint.hidden = true; });
      const row = node('div', `level-row-L${i}`); row.className = 'level-row';
      const restart = button(`level-restart-L${i}`, 'Restart', () => { void this.load(`L${i}`); });
      restart.setAttribute('aria-label', `Restart Level ${i}`); restart.hidden = true;
      row.append(b, restart); levelList.append(row);
    }
    levels.append(lockHint);
    levels.append(button('levels-back', 'Back', () => this.show(this.levelsBack)));
    // PO: pausing freezes the game but leaves the scene fully visible; the menu is a compact bar on top (screenshots).
    const pause = this.panel('pause', 'Paused', 'P / Esc to resume · R to restart · H hides the UI for screenshots');
    pause.setAttribute('aria-modal', 'false');
    pause.append(button('resume-game', 'Resume', () => this.resume()),
      button('pause-settings', 'Settings', () => { this.back = 'pause'; this.show('settings'); }),
      button('pause-restart', 'Restart level', () => this.askRestart()),
      button('pause-hide-ui', 'Hide UI (H)', () => this.hideUi(true)),
      homeButton('pause-title', () => this.show('title'), true));
    if (this.debugEnabled) {
      const debug = node('section', 'pause-debug'); debug.className = 'pause-debug'; debug.dataset.testid = 'pause-debug';
      const heading = node('h2', 'pause-debug-heading', 'Debug info');
      this.debugText = node('pre', 'pause-debug-text'); this.debugText.setAttribute('aria-label', 'Copyable debug information');
      debug.append(heading, this.debugText, button('pause-debug-copy', 'Copy', () => { void this.copyDebug(); }));
      pause.append(debug);
    }
    // In-page confirmation (no browser confirm()): replaces the bar buttons until answered.
    const confirm = node('div', 'restart-confirm'); confirm.className = 'restart-confirm'; confirm.hidden = true; confirm.setAttribute('role', 'alertdialog');
    confirm.setAttribute('aria-labelledby', 'restart-confirm-text');
    const confirmText = node('span', 'restart-confirm-text', ''); confirmText.id = 'restart-confirm-text';
    confirm.append(confirmText, button('restart-confirm-yes', 'Restart', () => { void this.restart(); }), button('restart-confirm-cancel', 'Cancel', () => this.cancelRestart()));
    pause.append(confirm);
    const credits = this.panel('credits', 'Credits & Licenses', 'Who made Minor Incident, and every library, recording and reference it uses, with its license.');
    // Generated from package.json and the audio ledger (tools/credits/generate.ts), so the list stays complete.
    const list = node('div', 'credits-list'); list.className = 'credits-list';
    list.tabIndex = 0; list.setAttribute('role', 'region'); list.setAttribute('aria-label', 'Credits and licenses');
    const link = (id: string, label: string, href: string) => { const a = node('a', id, label); a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; };
    // Hand-authored makers first (PO 10-15), then the generated licence list, unchanged.
    list.append(node('h2', 'credits-made-heading', madeBy.headline));
    list.append(node('p', 'credits-scope', 'All LLMs and harnesses, all libraries and all technologies used to make Minor Incident.'));
    const author = node('p', 'credits-made-author'); author.className = 'credit-row';
    author.append(link('credits-made-author-link', madeBy.author.name, madeBy.author.url), ' · ', madeBy.author.role);
    list.append(author);
    for (const group of madeBy.groups) {
      const row = node('p', `credits-made-${group.id}`); row.className = 'credit-row';
      row.append(node('strong', `credits-made-${group.id}-heading`, group.heading), node('small', `credits-made-${group.id}-names`, group.names.join(' · ')));
      list.append(row);
    }
    const section = (id: string, heading: string, entries: readonly Credit[], note?: string) => {
      list.append(node('h2', `credits-${id}-heading`, heading));
      if (note) list.append(node('p', `credits-${id}-note`, note));
      entries.forEach((credit, i) => {
        const row = node('p', `credits-${id}-${i}`); row.className = 'credit-row';
        row.append(credit.url ? link(`credits-${id}-${i}-source`, credit.title, credit.url) : credit.title, ' by ',
          credit.authorUrl ? link(`credits-${id}-${i}-author`, credit.author, credit.authorUrl) : credit.author, ' · ',
          link(`credits-${id}-${i}-license`, credit.license, credit.licenseUrl));
        if (credit.detail) row.append(node('small', `credits-${id}-${i}-detail`, credit.detail));
        if (credit.files) row.append(node('small', `credits-${id}-${i}-files`, `Files: ${credit.files.join(', ')}`));
        list.append(row);
      });
    };
    section('code', 'Runtime libraries and references', codeCredits);
    section('toolchain', 'Build, test and asset tools', toolchainCredits, 'Used to build and test the game; none of it is shipped to players unless listed above.');
    section('technology', 'Technologies and platforms', technologyCredits);
    section('audio', 'Music, sound and voices', audioCredits, 'Recordings edited for the game: excerpts, EQ, pitch, fades, compression, loudness normalization and encoding.');
    section('original', 'Original work', [originalCredit]);
    credits.append(list);
    credits.append(button('credits-back', 'Back', () => this.show('title')));
    const settings = this.panel('settings', 'Settings', 'Make yourself comfortable. Changes save automatically.');
    const form = node('div', 'settings-fields'); form.className = 'settings-fields';
    settings.append(form);
    this.select(form, 'textSize', 'Text size', ['1', '1.25', '1.5']);
    this.select(form, 'aimAssist', 'Aim assist', ['Off', 'Low', 'Default', 'High']);
    this.select(form, 'gore', 'Blood', ['Off', 'Reduced', 'Full']);
    this.select(form, 'quality', 'Quality', ['auto', 'high', 'low']);
    for (const [key, label] of [['cameraShake', 'Camera shake'], ['flashReduction', 'Reduce flashes'], ['colorblind', 'Colorblind telegraphs'], ['slowMotion', 'Explosion slow motion'], ['muted', 'Mute audio']] as const) {
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
    controls.append(node('p', 'controls-guide', 'Mouse: Click to move; hold LMB on ground to walk. LMB/RMB on infected to attack; RMB on ground attacks without moving. Wheel zooms the camera. 1–9 choose a weapon by its fixed number; Shift+1/2/3 select RIGHT rack slots. Q cycles the last-used side; clicking a HUD slot cycles it. Middle-click interacts. Driving: hold LMB to drive, release to brake. Keyboard: WASD, J / K (aim assist), Q, F / E. Touch: floating stick, pinch to zoom, LEFT / RIGHT (drag to aim; swipe up to switch), ACTION near interactables. ACTION exits cars.'));
    const action = node('select', 'binding-action'); action.setAttribute('aria-label', 'Action to rebind');
    for (const name of Object.keys(defaultBindings) as Action[]) { const option = node('option', `binding-${name}`, name); option.value = name; action.append(option); }
    const code = node('input', 'binding-code'); code.setAttribute('aria-label', 'Keyboard code'); code.placeholder = 'KeyZ';
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
  applySettings(persist = true): void {
    if (!this.enabled) return;
    const value = this.settings.value;
    this.game.setQuality(value.quality);
    const quality = this.game.quality.tier;
    for (const [key, setting] of Object.entries(value)) {
      const control = this.root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-testid=setting-${key}]`);
      if (control instanceof HTMLInputElement) control.checked = setting as boolean;
      else if (control) control.value = String(setting);
    }
    document.body.style.setProperty('--text-scale', String(value.textSize));
    document.body.classList.toggle('colorblind-ui', value.colorblind);
    this.game.view.settings({ gore: value.gore, cameraShake: value.cameraShake, flashReduction: value.flashReduction, colorblind: value.colorblind, slowMotion: value.slowMotion, quality });
    this.game.world.npcs?.setQuality(quality);
    this.game.audio.set({ muted: value.muted || this.game.params.get('audio') === 'muted', gore: value.gore }, persist);
    if (this.game.world.combat) this.game.world.combat.assist.setting = value.aimAssist;
    if (persist) this.game.campaignSettings(value);
  }
  private async load(id: string, racks = false, resume = false): Promise<void> {
    const left: string[] = [], right: string[] = [];
    if (racks) for (const side of ['LEFT', 'RIGHT'] as const) for (let i = 0; i < 3; i++) {
      const value = this.root.querySelector<HTMLSelectElement>(`[data-testid="rack-${side}-${i}"]`)!.value;
      if (value) (side === 'LEFT' ? left : right).push(value);
    }
    this.show('loading');
    try {
      if (this.game.campaign) await this.game.continueCampaign(this.game.campaign, resume ? undefined : Number(id.slice(1)) as Level);
      else { await this.game.loadLevel(id); this.game.world.player?.select(this.variant, 0); }
      if (racks && left.length && right.length) this.game.world.combat?.setLoadout(left, right);
      else if (id === 'L1') this.game.world.combat?.clearLoadout();
      this.applySettings(false); this.show(null);
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
    if (screen === 'title') this.game.telemetry?.home();
    if (screen === 'title') {
      this.game.campaignUI.hide();
    }
    if (screen === 'levels') {
      const unlocked = this.game.campaign?.unlockedLevel ?? 1, resume = resumeLevel(this.game.campaign);
      this.root.querySelector<HTMLElement>('.lock-hint')!.hidden = true;
      for (let i = 1; i <= 10; i++) {
        const b = this.root.querySelector<HTMLButtonElement>(`[data-testid=level-L${i}]`)!, locked = i > unlocked;
        if (locked) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled'); b.classList.toggle('is-locked', locked); b.textContent = `${locked ? '🔒 ' : ''}L${i} · ${levelTitles[i - 1]}`;
        b.classList.toggle('is-recommended', i === unlocked);
        if (!locked && i === resume) { const tag = node('small', `level-resume-L${i}`, 'Resume'); tag.className = 'resume-tag'; b.append(tag); }
        this.root.querySelector<HTMLButtonElement>(`[data-testid=level-restart-L${i}]`)!.hidden = locked || i !== resume;
        if (locked) { b.title = `Complete Level ${i - 1} first`; b.setAttribute('aria-label', `Level ${i}, locked. Complete Level ${i - 1} first`); } else { b.removeAttribute('title'); b.removeAttribute('aria-label'); }
      }
    }
    if (screen === 'pause') this.setRestartConfirm(false);
    for (const [name, panel] of this.screens) panel.hidden = name !== screen;
    this.root.hidden = screen === null;
    if (screen === null && this.root.contains(document.activeElement)) (document.activeElement as HTMLElement)?.blur();
    if (screen !== 'pause') document.body.classList.remove('ui-hidden');
    document.body.dataset.uiScreen = screen ?? 'game';
    if (screen) {
      this.game.clock.pause();
      const focus = this.screens.get(screen)?.querySelector<HTMLElement>(screen === 'levels' ? '.is-recommended' : 'button, select, input');
      focus?.focus();
    }
    this.pauseButton.hidden = screen !== null; this.homeButton.hidden = true;
  }
  private restartPending(): boolean { return !this.screens.get('pause')!.querySelector<HTMLElement>('[data-testid=restart-confirm]')!.hidden; }
  private setRestartConfirm(on: boolean): void {
    const pause = this.screens.get('pause')!;
    pause.querySelector<HTMLElement>('[data-testid=restart-confirm]')!.hidden = !on;
    pause.classList.toggle('is-confirming', on);
    for (const child of Array.from(pause.querySelectorAll<HTMLElement>(':scope > button'))) child.hidden = on;
    pause.querySelector<HTMLElement>('[data-testid=pause-restart]')!.hidden = on || !this.game.canRestartLevel;
  }
  private askRestart(): void {
    if (!this.game.canRestartLevel) return;
    const id = this.game.world.missions?.def.id ?? 'L1';
    this.root.querySelector('[data-testid=restart-confirm-text]')!.textContent = `Restart Level ${id.slice(1)}? Progress since the level start is lost.`;
    this.setRestartConfirm(true);
    this.root.querySelector<HTMLElement>('[data-testid=restart-confirm-cancel]')!.focus({ preventScroll: true });
  }
  private cancelRestart(): void { this.setRestartConfirm(false); this.root.querySelector<HTMLElement>('[data-testid=pause-restart]')?.focus({ preventScroll: true }); }
  private async restart(): Promise<void> {
    this.setRestartConfirm(false); this.show('loading');
    try {
      await this.game.restartLevel();
      this.applySettings(false); this.show(null);
      if (!this.game.audio.snapshot().background) this.game.clock.resume();
      this.game.view.update(1);
    } catch (error) {
      console.error(error); this.show('pause');
    }
  }
  /** Clean screenshots: hides every HUD element and the pause bar; any key or click brings the bar back. */
  hideUi(hidden: boolean): void {
    document.body.classList.toggle('ui-hidden', hidden);
    if (!hidden) this.screens.get('pause')?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
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
    this.applySettings(false); this.hud.loaded();
  }
  async prepareHud(): Promise<void> {
    if (!this.enabled || !this.started) return;
    await this.hud.prepare();
    const hidden = this.pauseButton.hidden;
    this.pauseButton.style.visibility = 'hidden'; this.pauseButton.hidden = false;
    this.pauseButton.getBoundingClientRect();
    this.pauseButton.hidden = hidden; this.pauseButton.style.visibility = '';
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
    setHidden(this.pauseButton, !this.game.campaignUI.root.hidden || this.screen !== null || (!!mission && !['playing', 'cinematic'].includes(mission.state.phase)));
    // Home is hidden during cutscenes, briefings, results and loading (only live play), and via CSS while the UI is hidden (H).
    setHidden(this.homeButton, !this.game.campaignUI.root.hidden || this.screen !== null || (!!mission && mission.state.phase !== 'playing'));
    if (this.debugEnabled && this.screen === 'pause') this.updateDebugInfo();
    this.updateMs = performance.now() - start;
  }
  private updateDebugInfo(): void {
    const now = performance.now(), fps = this.game.frameMs > 0 ? 1000 / this.game.frameMs : 0;
    this.fpsSamples.push({ at: now, fps });
    while (this.fpsSamples.length && now - this.fpsSamples[0].at > 2000) this.fpsSamples.shift();
    const world = this.game.world, player = world.entities.get(1), mission = world.missions;
    const active = mission?.def.steps.find(step => mission.state.steps[step.id]?.status === 'active');
    const nearest: { id: string; distance: number }[] = [];
    if (player && world.districts) for (const district of world.districts.districts) {
      const [ox, oz] = district.origin;
      for (const [id, point] of Object.entries(district.layout.anchors)) nearest.push({ id: `${district.layout.district}/${id}`, distance: Math.hypot(player.transform.x - (point.position[0] + ox), player.transform.z - (point.position[2] + oz)) });
      for (const building of district.layout.buildings) nearest.push({ id: `${district.layout.district}/${building.id}`, distance: Math.hypot(player.transform.x - ((building.aabb.min[0] + building.aabb.max[0]) / 2 + ox), player.transform.z - ((building.aabb.min[2] + building.aabb.max[2]) / 2 + oz)) });
      for (const placement of district.layout.placements) nearest.push({ id: `${district.layout.district}/${placement.id}`, distance: Math.hypot(player.transform.x - (placement.position[0] + ox), player.transform.z - (placement.position[2] + oz)) });
    }
    const closest = nearest.filter(item => item.distance <= 10).sort((a, b) => a.distance - b.distance)[0];
    const entities = [...world.entities.iterate()];
    const counts = debugEntityCounts(entities);
    const loadout = player?.weapons ? this.game.world.combat!.runner.loadout.activeEntries().map(entry => entry.id).join(', ') : 'none';
    const seed = world.seed;
    const district = world.districts?.districts.map(d => {
      const bounds = d.layout.bounds;
      const center = bounds.reduce((sum, point) => [sum[0] + point[0] / bounds.length, sum[1] + point[1] / bounds.length], [d.origin[0], d.origin[1]] as [number, number]);
      return { id: d.id, distance: Math.hypot((player?.transform.x ?? 0) - center[0], (player?.transform.z ?? 0) - center[1]) };
    }).sort((a, b) => a.distance - b.distance)[0]?.id ?? 'unknown';
    const bike = player?.riding ? world.entities.get(player.riding)?.bicycle : undefined;
    const driving = player?.riding ? world.entities.get(player.riding)?.vehicle?.driver === player.id : false;
    const fields = [
      `Level: ${mission?.def.id ?? world.scenario ?? 'unknown'} · Seed: ${seed}`,
      `Step: ${active ? `${active.id} · ${active.text}` : 'none'} · Checkpoint: ${mission?.state.checkpoint ?? 'none'}`,
      `Sim: tick ${world.tick} · ${(world.tick / 60).toFixed(1)} s elapsed`,
      `Player (x, z, y): ${player ? `${player.transform.x.toFixed(2)}, ${player.transform.z.toFixed(2)}, ${player.transform.y.toFixed(2)}` : 'unavailable'} · yaw ${player?.transform.yaw.toFixed(3) ?? 'n/a'} rad`,
      `District: ${district} · Nearest: ${closest ? `${closest.id} (${closest.distance.toFixed(1)} m)` : 'none within 10 m'}`,
      `Vehicle: ${driving ? 'driving' : bike?.mounted ? 'on bike' : 'on foot'}${player?.riding ? ` · entity ${player.riding}` : ''} · HP ${player ? `${player.health.current}/${player.health.max}` : 'n/a'}`,
      `Loadout: ${loadout || 'empty'} · Camera: ${this.game.view.view.getState().spot ?? 'follow'} / zoom ${this.game.view.view.getState().zoom.toFixed(2)}`,
      `Backend: ${this.game.view.renderer.selectedBackend} · Quality: ${this.game.quality.tier} · FPS (2 s avg): ${this.fpsSamples.length ? (this.fpsSamples.reduce((sum, sample) => sum + sample.fps, 0) / this.fpsSamples.length).toFixed(1) : 'n/a'}`,
      `Entities: pedestrians ${counts.pedestrians} · infected alive ${counts.alive} · downed ${counts.downed} · corpses ${counts.corpses}`,
      `Build: ${typeof __BUILD_COMMIT__ === 'undefined' ? 'unknown' : __BUILD_COMMIT__}`,
    ];
    if (this.debugText) this.debugText.textContent = fields.join('\n');
  }
  private async copyDebug(): Promise<void> {
    const text = this.debugText?.textContent ?? '';
    try { await navigator.clipboard.writeText(text); }
    catch {
      if (!this.debugText) return;
      const selection = document.createRange(); selection.selectNodeContents(this.debugText);
      const current = window.getSelection(); current?.removeAllRanges(); current?.addRange(selection);
      document.execCommand('copy'); current?.removeAllRanges();
    }
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
  private readonly unhide = (event: Event): void => { if (document.body.classList.contains('ui-hidden')) { event.preventDefault(); event.stopPropagation(); this.hideUi(false); } };
  private readonly key = (event: KeyboardEvent): void => {
    if (!this.enabled || !this.game.campaignUI.root.hidden) return;
    if (!event.repeat && this.game.input.bindings.action(event.code) === 'pause' && !(event.target as HTMLElement)?.closest('input,select,textarea')) {
      event.preventDefault(); event.stopImmediatePropagation();
      // P and Esc toggle: pause, back out of settings, resume (a background auto-pause still needs the Resume button).
      if (this.screen === null) this.pause(); else if (this.screen === 'settings') this.show(this.back); else if (this.screen === 'pause') { if (this.restartPending()) this.cancelRestart(); else this.resume(); }
      return;
    }
    if (this.screen === 'pause' && !event.repeat && !(event.target as HTMLElement)?.closest('input,select,textarea')) {
      if (document.body.classList.contains('ui-hidden')) { event.preventDefault(); this.hideUi(false); return; }
      if (event.code === 'KeyR' && !this.restartPending()) { event.preventDefault(); this.askRestart(); return; }
      if (event.code === 'KeyH') { event.preventDefault(); this.hideUi(true); return; }
    }
    if (event.code !== 'Tab') return;
    const panel = this.screen ? this.screens.get(this.screen) : document.querySelector<HTMLElement>('.mission-panel:not([hidden])');
    if (!panel) return;
    const controls = panel.querySelectorAll<HTMLElement>('button:not([hidden]),select,input');
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  dispose(): void { window.removeEventListener('keydown', this.key, true); window.removeEventListener('pointerdown', this.unhide, true); document.removeEventListener('click', this.missionAccept); this.root.remove(); this.pauseButton.remove(); this.homeButton.remove(); this.hud.dispose(); document.body.classList.remove('full-ui', 'touch-ui'); delete document.body.dataset.uiScreen; }
}

/** House icon + "Home" label; the HUD variant shows the icon only (label stays accessible). */
function homeButton(id: string, click: () => void, withLabel = false): HTMLButtonElement {
  const element = button(id, '', click);
  const ns = 'http://www.w3.org/2000/svg', icon = document.createElementNS(ns, 'svg');
  icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('width', '20'); icon.setAttribute('height', '20'); icon.setAttribute('aria-hidden', 'true'); icon.setAttribute('class', 'home-icon');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M3 11.5 12 4l9 7.5M5.5 10v9.5h4.5v-5.5h4v5.5h4.5V10'); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '2.2'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
  icon.append(path); element.append(icon);
  if (withLabel) element.append(' Home'); else element.dataset.hudHome = '1';
  element.setAttribute('aria-label', 'Home'); element.title = 'Home';
  return element;
}

/**
 * Title-screen background (PO #1): art-directed landscape/portrait crops, AVIF with WebP fallback at several widths
 * (public/ui/home, < 250 KB each), object-fit cover, a tiny blurred placeholder behind it while the image loads.
 */
function homeArt(): HTMLElement {
  const sizes = { landscape: [640, 1280, 1920, 2560], portrait: [640, 1080, 1290] } as const;
  const picture = document.createElement('picture'); picture.className = 'home-art'; picture.setAttribute('aria-hidden', 'true');
  picture.style.backgroundImage = `url(${homePlaceholders.landscape})`;
  const portraitQuery = '(orientation: portrait)';
  for (const [kind, media] of [['portrait', portraitQuery], ['landscape', undefined]] as const) for (const [type, ext] of [['image/avif', 'avif'], ['image/webp', 'webp']] as const) {
    const source = document.createElement('source'); source.type = type; if (media) source.media = media;
    source.srcset = sizes[kind].map(w => `/ui/home/home-${kind}-${w}.${ext} ${w}w`).join(', '); source.sizes = '100vw'; picture.append(source);
  }
  const img = document.createElement('img'); img.alt = ''; img.decoding = 'async'; img.src = '/ui/home/home-landscape-1280.webp'; img.draggable = false;
  img.addEventListener('load', () => { picture.style.backgroundImage = 'none'; });
  const shade = document.createElement('span'); shade.className = 'home-art-shade';
  picture.append(img, shade); return picture;
}
