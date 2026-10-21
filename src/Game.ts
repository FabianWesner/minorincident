import { LevelEightBot } from './debug/bot/LevelEightBot';
import { markerAnchor, searchAnchors } from './sim/missions/markerAnchor';
import { LevelSixBot } from './debug/bot/LevelSixBot';
import type { Inspection } from './debug/Inspection';
import { LevelOneBot } from './debug/bot/LevelOneBot';
import { LevelThreeBot } from './debug/bot/LevelThreeBot';
import { LevelFourBot } from './debug/bot/LevelFourBot';
import { LevelFiveBot } from './debug/bot/LevelFiveBot';
import type { LevelTwoBot } from './debug/bot/LevelTwoBot';
import { LevelTransition, transitionPaint } from './ui/LevelTransition';
import { RescueFade } from './ui/RescueFade';
import { l5 } from './data/l5';
import { GameUI } from './ui/GameUI';
import { CampaignUI } from './ui/CampaignUI';
import { completePending,newCampaign, reservedCampaignIds, nextLevelAfter, preset, type CampaignSave, type CampaignSettings, type Level, type ProgressionPreset } from './sim/progression/Campaign';
import { applyCampaign } from './sim/progression/apply';
import { SaveStore } from './sim/progression/Save';
import { completeCampaignLevel } from './sim/progression/carryover';
import type { SurvivorVariant } from './data/survivor';
import { performanceLevels, installPerformanceLevel } from '../tests/fixtures/scenarios/performance';
import { Quality, type QualitySetting } from './core/Quality';
import { PerfOverlay } from './debug/performance/PerfOverlay';
import type { BarricadeBot } from './debug/bot/BarricadeBot';
import { Driver } from './debug/bot/Driver';
import { AudioService } from './audio/AudioService';
// Adapted from folio-2025 by Bruno Simon (MIT).
import { Matrix4 } from 'three';
import { missionSandbox } from '../tests/fixtures/scenarios/mission-sandbox';
import { missionIds, resolveCampaignMission, type MissionId } from './levels/missions';
import { Combat } from './sim/combat/Combat';
import type { TelemetrySink } from './telemetry/sink';
import { InputSystem } from './input/InputSystem';
import { Clock, SIM_FRAME_BUDGET_MS } from './core/Clock';
import { Services } from './core/Services';
import { Ticker } from './core/Ticker';
import { GameView } from './render/GameView';
import { loadLayouts } from './levels/layouts';
import type { DistrictLayout, LevelComposition, Tier } from './levels/districts/types';
import { SimWorld } from './sim/world/SimWorld';
import { warmL4Alarm } from './sim/missions/l4AlarmWarmup';
import { loadMeasure } from './assets/loadTiming';
import { assetUrl } from './assets/assetUrl';
import { prefetchLevel } from './assets/prefetch';
import { compositions } from './levels/compositions';
import { civilianBakeStats } from './assets/civilianBake';
import { loadGate } from './assets/loadGate';

/** Injected composition root, with staged initialization adapted from Bruno Game.js. */
export class Game {
  readonly quality: Quality;
  private overlay: PerfOverlay | null = null;
  private simulatedFrameMs = 0;
  private restoredWhilePaused = false;
  readonly services = new Services();
  readonly world = this.services.add(new SimWorld());
  readonly clock: Clock;
  readonly view: GameView;
  readonly input: InputSystem;
  readonly audio: AudioService;
  readonly ui: GameUI;
  readonly transition: LevelTransition;
  private readonly rescueFade = new RescueFade();
  readonly ticker = new Ticker();
  campaign: CampaignSave | null = null;
  /** Anonymous play telemetry (src/telemetry), installed after boot on the live site; null in tests and local dev. */
  telemetry: TelemetrySink | null = null;
  readonly saves = new SaveStore({ getItem: key => localStorage.getItem(key), setItem: (key,value) => localStorage.setItem(key,value), removeItem: key => localStorage.removeItem(key) });
  campaignUI!: CampaignUI;
  lastLoad:{dataMs:number;simMs:number;viewMs:number}|null=null;
  inspect: Inspection | null = null;
  driver: LevelEightBot | LevelSixBot | BarricadeBot | LevelOneBot | Driver | LevelThreeBot | LevelFourBot | LevelFiveBot | LevelTwoBot | null = null;
  frameMs = 0;
  simMs = 0;
  simTicks = 0;
  simWorldMs = 0;
  /** Largest fixed simulation tick in the last render frame; simMs includes every catch-up tick. */
  simTickMs = 0;
  private readonly spawnFrustum = new Matrix4();
  private loading = false;
  private prefetchedMission: object | null = null;
  private completedAt: { target: string; at: number } | null = null;
  private renderedDistricts: SimWorld['districts'] = null;
  private levelQueue: Promise<void> = Promise.resolve();
  /** Level loaded behind the title/menus (load lane): consumed by the matching loadLevel. */
  private speculative: { id: string; seed: number } | null = null;
  /** perf-w6: the L4 alarm runs once per page in a scratch world behind the loading card (JIT warm-up, see l4AlarmWarmup). */
  private alarmWarmup: { composition: LevelComposition; layouts: DistrictLayout[]; seed: number } | null = null;
  private alarmWarmed = false;
  private async warmAlarm(): Promise<void> {
    const pending = this.alarmWarmup; this.alarmWarmup = null;
    if (!pending || this.alarmWarmed) return;
    const start = performance.now();
    await warmL4Alarm(pending.composition, pending.layouts, pending.seed, this.quality.tier === 'low' ? 'low' : 'high');
    this.alarmWarmed = true; loadMeasure('level:l4-alarm-warmup', start);
  }
  private speculativeRunning = false;
  /** Focus/visibility loss paused the clock (AudioService host). The pause menu must show once the UI can take it: a loss during
   * a level load (UI on the loading card) used to leave a no-briefing level (L7) frozen at tick 0 with no Resume (P0 10-20). */
  private awayPaused = false;
  /** How the current mission level was started (restart replays it; campaign is the state at level start). */
  private levelStart: { id: string; seed?: number; tier?: Tier; campaign: CampaignSave | null; setup?: (world: SimWorld) => void } | null = null;
  /** A level pick may arrive before the menu preload finishes its layout/audio awaits. */
  private preloadForeground = false;
  /** Boot-time sound bank load that runs after the title is shown; awaited before the next audio reset. */
  private audioLoad: Promise<void> = Promise.resolve();
  constructor(readonly params: URLSearchParams) {
    const requested = params.get('quality') ?? 'auto';
    if (!['auto', 'high', 'low'].includes(requested)) throw new RangeError('Invalid quality setting');
    this.quality = new Quality(requested as QualitySetting, { userAgent: navigator.userAgent, touchPoints: navigator.maxTouchPoints, coarsePointer: matchMedia('(pointer: coarse)').matches, memoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory });
    this.clock = new Clock(params.get('test') === '1' ? 20 : 5, SIM_FRAME_BUDGET_MS);
    this.view = this.services.add(new GameView(this.world, params, this.quality.tier));
    this.view.onMissionChange = () => {
      // Begin/retry is a UI handoff. Its synchronous work is not elapsed play
      // time, and the active ticker will render the changed scene next frame.
      this.ticker.reset();
      if (this.world.missions?.state.phase === 'playing') this.view.refreshMissionUI(); else this.view.update(1);
    };
    this.input = this.services.add(new InputSystem(this.view.renderer.domElement, this.view.camera, delta => { this.telemetry?.zoom(delta); this.view.view.zoom(delta); }, () => this.view.view.azimuth));
    this.input.cursor.setHeightField((x, z) => this.world.districts?.pavingHeight(x, z) ?? 0);
    this.input.reach = () => {
      const combat = this.world.combat, weapons = this.world.entities.get(1)?.weapons;
      if (!combat || !weapons) return null;
      const def = combat.runner.loadout.definition(combat.runner.loadout.current(weapons.selectedSide).id);
      return def.category === 'melee' ? def.range : null;
    };
    this.audio = this.services.add(new AudioService(this.world, {
      settingsChanged: patch => this.campaignSettings(patch),
      pause: () => { this.clock.pause(); this.awayPaused = true; this.ui?.pause(); }, resume: () => { this.ticker.reset(); this.clock.resume(); this.ui?.show(null); },
      release: () => { this.input.clear(); this.world.clearInput(); this.ticker.reset(); },
      readyForBackground: () => !this.loading && this.view.backgroundReady,
      offscreen: (p) => { const q = this.view.project(p.x, p.y ?? 0.7, p.z); return Math.abs(q[0]) > 1 || Math.abs(q[1]) > 1 || q[2] > 1; },
      project: (p) => { const q = this.view.project(p.x, p.y ?? 0, p.z); return { x: (q[0] + 1) / 2, y: (1 - q[1]) / 2 }; },
    }, params));
    this.ui = new GameUI(this);
    this.transition = new LevelTransition(id => { void this.loadLevel(id).catch(() => {}); });
    this.view.loadProgress = (done, total) => this.transition.shaders(done, total, this.world.scenario ?? '');
    this.audio.graph.setTier(this.quality.tier);
    this.quality.onChange(() => this.applyQuality());
    this.view.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    this.view.renderer.domElement.addEventListener('webglcontextrestored', this.contextRestored);
    document.addEventListener('visibilitychange', this.visibility);
  }
  async init(): Promise<void> {
    await this.services.init();
    this.campaignUI = new CampaignUI(this);
    // The title backdrop does not wait for sound banks: they stream while the player reads the menu.
    await this.loadScenario(this.params.get('test') === '1' ? 'empty' : 'survivor', Number(this.params.get('seed') ?? 1), this.params.get('test') !== '1');
    this.world.player?.select(this.params.get('survivor') === 'male' ? 'male' : 'female', 0);
    this.view.update(1);
    this.ui.init();
    const saved = this.saves.load();
    if ((!this.ui.enabled && saved.status !== 'empty') || saved.status === 'error') this.campaignUI.showMenu(saved);
    this.ticker.events.on('frame', ({ seconds }) => {
      this.frameMs = seconds * 1000;
      if (!this.loading) this.campaignUI.update();
      if (!this.loading && this.renderedDistricts !== this.world.districts) this.refreshView();
      // While the L1 warm-up runs behind the briefing only the mission UI updates; the clock waits.
      if (!this.loading && !this.view.contextLost && this.view.warming) this.view.update(1);
      else if (!this.loading && !this.view.contextLost) {
        if (document.hidden) this.clock.pause();
        if (!this.clock.paused) this.awayPaused = false; else if (this.awayPaused) this.ui.pause();
        if (!this.clock.paused && !this.inspect?.enabled) this.quality.observe(Math.max(this.frameMs, this.simulatedFrameMs), seconds, Boolean(this.world.missions?.state.cinematic));
        // E27 bullet time: big blasts near the player slow the presentation and the fixed-step clock together.
        const slow = this.clock.paused ? 1 : this.view.vfx?.blasts.timeScale(seconds) ?? 1;
        if (!this.clock.paused) this.view.frame(seconds * slow);
        const start = performance.now(), tickBefore = this.world.tick; this.simWorldMs = 0; this.simTickMs = 0;
        this.clock.advance(seconds * slow, () => this.simTick());
        this.simMs = performance.now() - start;
        this.simTicks = this.world.tick - tickBefore;
        this.inspect?.update(seconds);
        const l5Exit = this.world.missions?.l5?.fading ?? false;
        this.rescueFade.set(l5Exit || (this.world.trapRescue?.fading ?? this.world.l7Departure?.fading ?? false), l5Exit ? l5.emerge.fadeOutS : undefined, this.world.scenario === 'L5' ? l5.emerge.fadeInS : undefined);
        if (!this.clock.paused || this.restoredWhilePaused || this.inspect?.enabled) this.view.update(this.clock.paused ? 1 : this.clock.alpha);
      }
      if (!this.loading) {
        const departure = this.world.l7Departure;
        if (departure?.state.phase === 'done' && (!this.world.missions || this.world.missions.state.phase === 'result') && !departure.handedOver) { departure.handedOver = true; void this.handOver(7); }
        const mission = this.world.missions;
        if (mission && this.prefetchedMission !== mission && /^L[1-5]$/.test(mission.def.id) && (mission.def.id === 'L2' && mission.state.phase === 'playing' && this.world.tick >= 300 || ['result', 'progression'].includes(mission.state.phase) || mission.def.finish.some(id => ['active', 'completed'].includes(mission.state.steps[id]?.status ?? '')))) { this.prefetchedMission = mission; void prefetchLevel(`L${Number(mission.def.id.slice(1)) + 1}`, 4, this.quality.tier); }
      }
      this.ui.update();
      this.overlay?.update(seconds);
    });
    if (this.params.has('perf')) this.overlay = new PerfOverlay(this);
    this.ticker.init();
    // While the player reads the menus, warm the HTTP cache with the level they will most likely start.
    // While the player reads the menus, load the level they will most likely start (L1 for a new or
    // L1 campaign) behind the title; other levels only warm the HTTP cache.
    const next = `L${saved.status === 'ok' ? saved.save.unlockedLevel : 1}`;
    if (this.params.get('test') !== '1') void this.audioLoad.then(() => this.preloadForeground ? undefined : next === 'L1' && this.params.get('preload') !== '0' ? (this.speculativeRunning = true, this.loadLevel('L1', { seed: Number(this.params.get('seed') ?? 1) }, undefined, true).catch(error => console.warn('Speculative L1 load failed', error)).finally(() => { this.speculativeRunning = false; })) : prefetchLevel(next, 4, this.quality.tier));
  }
  /** Serialize native-world changes so overlapping API loads cannot leak resources. */
  loadScenario(name: string | null, seed = 1, deferAudio = false): Promise<void> {
    if (name && performanceLevels[name]) return this.loadLevel(performanceLevels[name].level, { seed }, name);
    const load = this.levelQueue.then(async () => {
      this.speculative = null; this.levelStart = null; this.telemetry?.scenarioUnloaded(); this.view.missionHidden = false; this.view.unfreeze();
      this.loading = true; this.restoredWhilePaused = false;
      try {
        await this.audioLoad; this.campaign = null; this.campaignUI.reset(); this.audio.reset(); this.ui.reset(); if (this.driver instanceof LevelOneBot) this.driver.dispose(); this.driver = null; this.input.reset(); this.view.reset(); this.world.reset(); this.clock.reset();
        if (name !== null) { this.world.loadScenario(name, seed); if (name === 'survivor') this.world.player?.select(this.params.get('survivor') === 'male' ? 'male' : 'female', 0); this.quality.startLevel(); this.applyQuality(); if (name === 'mission-sandbox') this.world.loadMission(missionSandbox()); await this.view.load(); }
        else this.view.update();
        this.renderedDistricts=this.world.districts;
        if (deferAudio) this.audioLoad = this.audio.load().catch(error => console.error(error)); else await this.audio.load();
        this.ui.loaded();
      } finally { this.loading = false; this.ticker.reset(); }
    });
    this.levelQueue = load.catch(() => {}); return load;
  }
  /** E10 composition plus E12 mission briefing; checkpoints restore reached state or reconstruct an authored graph prefix. */
  /** `source`/`setup` (Scene Lab): a prebuilt composition instead of the layout files, and a sim hook after assembly, before the view loads. */
  loadLevel(id:string,opts?:{seed?:number;tier?:Tier;checkpoint?:string;progression?:ProgressionPreset;source?:{composition:LevelComposition;layouts:DistrictLayout[]};setup?:(world:SimWorld)=>void;record?:boolean}, performanceScenario?: string, speculative = false):Promise<void>{
    // The player picked a level while one loads behind the menus: finish it at full speed.
    if (!speculative) {
      this.transition.begin(id);
      if (this.completedAt?.target !== id) this.completedAt = null;
      this.clock.pause();
      this.preloadForeground = true;
      this.view.background = false; loadGate.background = false;
      // Still loading or warming: release the pacing; LOD0 streaming (after load) keeps its pacing.
      if (this.speculativeRunning || this.view.warming) loadGate.setPaced(false);
    }
    const load=this.levelQueue.then(async()=>{
      if (!speculative) { this.transition.begin(id); await transitionPaint(); }
      try { await this.view.warming; } catch (error) { if (!speculative) this.transition.fail(); throw error; }
      // A level already loaded behind the menus only needs the campaign, audio and UI steps it skipped.
      const ready = this.speculative;
      if (!speculative && ready && ready.id === id && (opts?.seed ?? 1) === ready.seed && !opts?.tier && !opts?.checkpoint && !opts?.progression && !performanceScenario && this.world.missions?.def.id === id) {
        this.speculative = null; this.noteLevelStart(id, opts);
        const quality = this.campaign?.settings.quality ?? this.params.get('quality');
        if (quality === 'low' || quality === 'auto' && matchMedia('(pointer:coarse)').matches) this.world.npcs?.setQuality('low');
        if (this.campaign) { this.applyCampaign(); if (id === 'L1') this.world.combat?.clearLoadout(); this.watchCampaign(); }
        this.quality.startLevel(); this.applyQuality();
        this.view.missionHidden = false;
        await this.view.prepareCharacterVariant();
        await this.warmAlarm();
        await this.audio.load(); this.ui.loaded(); await this.ui.prepareHud(); this.view.unfreeze(); this.view.update(1);
        await this.view.renderer.finishWarmUp(); await transitionPaint(); this.firstLevelFrame(id);
        return;
      }
      this.speculative = null;
      this.loading=true; this.restoredWhilePaused = false;
      try{
        if(opts?.progression)this.campaign=preset(opts.progression);
        if (id === 'L10' && !this.campaign) this.campaign = preset('L10-default');
        if (!speculative && !(opts?.checkpoint && this.levelStart?.id === id)) this.noteLevelStart(id, opts, !!performanceScenario);
        if(opts?.checkpoint && this.world.missions?.def.id === id) { this.world.missions.loadCheckpoint(opts.checkpoint); this.view.update(1); await this.view.renderer.finishWarmUp(); await transitionPaint(); this.transition.finish(); return; }
        if (!speculative) this.campaignUI.reset();
        // Keep the current picture (title backdrop) on screen while the level loads and warms up.
        if (speculative) this.view.freeze();
        const start=performance.now();
        const {composition,layouts}=opts?.source??await loadLayouts(id,opts?.tier,async(url)=>{const r=await fetch(assetUrl(url));if(!r.ok)throw new Error(`Layout request failed: ${url}`);return r.json();});
        const data=loadMeasure('level:layouts',start);
        if (!speculative) this.transition.update(.1, 'Building the neighborhood…');
        const cosmetic=this.world.entities.get(1)?.survivor;
        const audioWait=performance.now(); await this.audioLoad; loadMeasure('level:boot-audio-wait',audioWait); this.audio.reset(); if (!speculative) this.ui.reset(); this.view.missionHidden = speculative; this.view.background = speculative && !this.preloadForeground; if (this.driver instanceof LevelOneBot) this.driver.dispose(); this.driver = null; this.input.reset();this.view.reset(composition.districts.map(d => `${d.id}:${d.origin.join(',')}`).sort().join('|'));this.world.reset();this.clock.reset();const worldStart = performance.now(); this.world.loadComposition(composition,layouts,opts?.seed??1,id==='L2'?this.campaign?.world?.L1??null:null,id==='L7'?this.campaign?.results?.L6?.escapedSurvivors:id==='L8'?this.campaign?.results?.L7?.escapedSurvivors:undefined,id==='L8'?this.campaign?.results?.L7?.companion:undefined,reservedCampaignIds(id,this.campaign??undefined));
        const missionStart = loadMeasure('level:world+nav', worldStart);
        const quality = this.campaign?.settings.quality ?? this.params.get('quality');
        if(quality === 'low' || quality === 'auto' && matchMedia('(pointer:coarse)').matches) this.world.npcs?.setQuality('low');
        if(cosmetic)this.world.player!.select(cosmetic.variant,cosmetic.gearTier);
        if(missionIds.includes(id as MissionId)) {
          this.world.combat ??= new Combat(this.world, { name:id,survivor:true,combat:true,ground:{width:100,depth:100},player:{...this.world.entities.get(1)!.transform} });
          if(this.campaign)this.applyCampaign();
          if (id === 'L1') this.world.combat.clearLoadout();
          const campaign = resolveCampaignMission(id as MissionId, this.world.districts!);
          const mission=this.world.loadMission(campaign);
          if(opts?.checkpoint) mission.loadCheckpoint(opts.checkpoint);
        }
        if (id === 'L7') {
          this.world.l7Encounters!.prepare();
          this.world.missions!.begin();
        }
        opts?.setup?.(this.world);
        if(this.campaign && id !== 'L10')this.watchCampaign();
        this.quality.startLevel();this.applyQuality();
        if (performanceScenario) installPerformanceLevel(this.world, this.quality.tier, performanceScenario);
        this.world.missions?.prepare();
        // Restore L10 actors/chunks before asset loading and shader warmup see the resident population.
        if (id === 'L10') {
          this.world.missions?.begin();
          if (this.campaign?.cureResume && !opts?.checkpoint) this.world.missions?.loadResume(this.campaign.cureResume);
        }
        const physicsStart = loadMeasure('level:mission+cast', missionStart);
        this.world.physics.prepare(); loadMeasure('level:physics-prepare', physicsStart);
        if (!speculative) { this.transition.update(.2, 'Loading assets…'); this.transition.watchAssets(); }
        const sim=loadMeasure('level:sim',data);this.alarmWarmup = id === 'L4' && !this.alarmWarmed ? { composition, layouts, seed: opts?.seed ?? 1 } : null;const alarm = speculative ? undefined : this.warmAlarm();await this.view.load();await alarm;this.renderedDistricts=this.world.districts;this.lastLoad={dataMs:data-start,simMs:sim-data,viewMs:loadMeasure('level:view',sim)-sim};if (speculative) { this.speculative = { id, seed: opts?.seed ?? 1 }; this.clock.pause(); } else { this.transition.update(.95, 'Preparing sound…'); const audio=performance.now();await this.audio.load();loadMeasure('level:audio',audio); this.ui.loaded(); const hud=performance.now(); await this.ui.prepareHud(); loadMeasure('level:hud',hud); }
        if (performanceScenario && performanceLevels[performanceScenario].spot) this.view.preset(performanceLevels[performanceScenario].spot);
        if (id === 'L9') this.world.missions?.begin();
        if (id === 'L10' && this.campaign?.cureResume?.cameraZoom !== undefined && !opts?.checkpoint) {
          this.view.advance(0); // Apply the restored held weapon's cap before restoring its zoom.
          this.view.view.zoom(Math.log(this.campaign.cureResume.cameraZoom / this.view.view.getState().targetZoom), true);
          this.view.advance(0);
        }
        if (id === 'L10' && this.campaign) { this.watchCampaign(); this.saveCampaign(); }
        if (!speculative) { this.view.unfreeze(); this.view.update(1); await this.view.renderer.finishWarmUp(); await transitionPaint(); loadMeasure(`transition:${id}:first-frame`, start); this.firstLevelFrame(id); }
      }catch(error){ console.error("Level load failed", error); if (!speculative) this.transition.fail(); this.view.unfreeze(); this.view.missionHidden = false; throw error; }
      finally{this.loading=false;this.ticker.reset();}
    });this.levelQueue=load.catch(()=>{});return load;
  }
  private firstLevelFrame(id: string): void {
    if (this.completedAt?.target === id) loadMeasure(`transition:${id}:complete-to-first-frame`, this.completedAt.at);
    this.completedAt = null; this.transition.finish();
    this.telemetry?.levelLoaded(this.levelStart ? { id: this.levelStart.id, seed: this.levelStart.seed, tier: this.levelStart.tier, campaign: this.levelStart.campaign } : null);
  }
  private noteLevelStart(id: string, opts?: { seed?: number; tier?: Tier; source?: unknown; setup?: (world: SimWorld) => void; record?: boolean }, perf = false): void {
    // Scene Lab / test setups are not player runs; the campaign handover's own setup (`record`) is, and a restart repeats it.
    this.levelStart = !perf && !opts?.source && (!opts?.setup || opts.record) && missionIds.includes(id as MissionId) ? { id, seed: opts?.seed, tier: opts?.tier, campaign: this.campaign ? structuredClone(this.campaign) : null, setup: opts?.record ? opts.setup : undefined } : null;
  }
  get canRestartLevel(): boolean { return this.levelStart !== null && !this.loading; }
  /** Restart the current level from its very beginning: same level, campaign state and options as at level start (a seedless level draws a new run seed). */
  restartLevel(): Promise<void> {
    const start = this.levelStart; if (!start) return Promise.reject(new Error('No level to restart'));
    this.telemetry?.restarting();
    if (start.campaign) this.campaign = structuredClone(start.campaign);
    if (start.id === 'L10' && this.campaign) delete this.campaign.cureResume;
    return this.loadLevel(start.id, { seed: start.seed, tier: start.tier, setup: start.setup, record: !!start.setup });
  }
  async startCampaign(character:SurvivorVariant):Promise<void> {
    this.campaign=newCampaign(character,Number(this.params.get('seed')??1));this.campaign.settings={...this.audio.settings};this.saveCampaign();await this.loadLevel('L1');
  }
  /** Late levels hand over directly: the next level when it exists, else the credits. */
  private async handOver(finished: number): Promise<void> {
    const save = this.campaign, next = nextLevelAfter(finished);
    if (!save) return;
    if (next && compositions[`L${next}`]) await this.continueCampaign(save, next);
    else this.campaignUI.credits(save);
  }
  async continueCampaign(save:CampaignSave,level?:Level):Promise<void> {
    const fromL4 = this.world.missions?.def.id === 'L4' && this.world.missions.state.phase === 'progression';
    this.campaign=structuredClone(save);
    if(save.pending){completePending(this.campaign);this.saveCampaign();}
    // ?debug=1 starts locked levels from the level list (PO #76); the save's progress is not changed by it.
    if(level&&level>save.unlockedLevel&&!['1','true'].includes(this.params.get('debug')??''))throw new Error('Level is locked');
    const settings = { ...save.settings, quality: save.settings.quality === 'auto' ? matchMedia('(pointer:coarse)').matches ? 'low' as const : 'high' as const : save.settings.quality };
    this.view.settings(settings);this.audio.set(save.settings);
    // Settings can save the previous live world: clear its resume only after those updates.
    // An explicit level is a whole-level restart; the menu's Resume action omits it.
    if (level !== undefined) { delete this.campaign.cureResume; delete this.campaign.l9Crash; }
    await this.loadLevel(`L${level??save.unlockedLevel}`, fromL4 ? { setup: world => {
      // A fresh handover equips the carried firearm; menu Resume keeps its loadout selection.
      if (world.scenario === 'L5' && world.combat) world.combat.runner.loadout.state.selectedSide = 'RIGHT';
    }, record: true } : undefined);
    this.view.settings(settings);
  }
  applyCampaign():void {if(this.campaign&&this.world.player){applyCampaign(this.world,this.campaign);this.view.update(1);}}
  saveCampaign():boolean {
    if(!this.campaign)return false;
    if (this.world.scenario === 'L9' && this.world.missions?.l9 && !this.campaign.crossingHandover) this.campaign.l9Crash = this.world.missions.l9.save();
    if (this.world.scenario === 'L10' && this.campaign.unlockedLevel === 10 && this.campaign.crossingHandover && this.world.missions?.state.checkpoint) {
      const live = this.world.progression?.campaign;
      if (live) { this.campaign.ownedActions = [...live.ownedActions]; this.campaign.racks = structuredClone(live.racks); this.campaign.world = structuredClone(live.world); }
      this.campaign.cureResume = { ...this.world.missions.saveResume(), cameraZoom: this.view.view.getState().targetZoom };
    }
    if(this.world.progression?.campaign){this.world.progression.campaign=structuredClone(this.campaign);}
    return this.saves.write(this.campaign);
  }
  campaignSettings(patch:CampaignSettings):void {if(this.campaign){Object.assign(this.campaign.settings,patch);this.saveCampaign();}}
  private watchCampaign():void {
    const save=this.campaign!;
    this.world.events.on('level.completed',event=>{
      if(event.type!=='level.completed'||!/^L(?:[1-9]|10)$/.test(event.id))return;
      if (event.id === 'L8' && this.world.missions?.l8) { const transport = this.world.missions.l8.transferOrNull(); if (transport) save.transport = transport; }
      completeCampaignLevel(save,Number(event.id.slice(1)) as Level,event.result,this.world);
      this.saveCampaign();
      const next = Number(event.id.slice(1)) + 1;
      this.completedAt = compositions[`L${next}`] ? { target: `L${next}`, at: performance.now() } : null;
      if (compositions[`L${next}`]) void prefetchLevel(`L${next}`, 4, this.quality.tier);
    });
    this.world.events.on('checkpoint.set', () => { if (this.world.scenario === 'L10') this.saveCampaign(); });
    this.world.events.on('checkpoint.restored', () => {
      if (this.world.scenario === 'L7' && this.world.progression?.campaign) {
        const live = this.world.progression.campaign;
        save.ownedActions = [...live.ownedActions]; save.racks = structuredClone(live.racks);
        this.saveCampaign();
      } else if (this.world.scenario === 'L10') this.saveCampaign();
    });
    this.world.events.on('mission.signal', event => { if (event.type === 'mission.signal' && (event.name.startsWith('l9.') || event.name === 'cure-released' || event.name.startsWith('epilogue-'))) this.saveCampaign(); });
    this.world.events.on('combat.attack',event=>{if(event.type==='combat.attack')save.usage[event.actionId]=(save.usage[event.actionId]??0)+1;});
    this.world.events.on('pickup.collected',event=>{if(event.type==='pickup.collected'&&'actionId' in event&&!save.ownedActions.includes(event.actionId))save.ownedActions.push(event.actionId);});
  }
  /** Queue one presentation rebuild when a mission script changes decay. */
  private refreshView(): Promise<void> {
    if (this.loading || this.renderedDistricts === this.world.districts) return this.levelQueue;
    if (this.view.switchPreparedDistrict()) { this.renderedDistricts = this.world.districts; return this.levelQueue; }
    this.loading=true;
    const refresh=this.levelQueue.then(async()=>{
      try { await this.view.load(); this.renderedDistricts=this.world.districts; this.audio.refreshAcoustics(); }
      finally { this.loading=false; this.ticker.reset(); }
    });
    this.levelQueue=refresh.catch(()=>{});return refresh;
  }
  async step(ticks: number): Promise<void> {
    if (!Number.isSafeInteger(ticks) || ticks < 0) throw new RangeError('Ticks must be a nonnegative integer');
    await this.levelQueue;
    if (!this.clock.paused) throw new Error('step requires pause()');
    if (!this.world.scenario) throw new Error('step requires a loaded scenario');
    for (let i = 0; i < ticks; i++) this.simTick();
    await this.refreshView(); this.inspect?.update(0); this.view.update(1); this.ui.update();
  }
  private wasDead = false;
  private simTick(): void {
    this.input.setDriving(this.world.vehicles?.active != null);
    this.input.setMountedGun(this.world.mountedGun?.mounted === true);
    const mission = this.world.missions, at = this.world.entities.get(1)?.transform;
    const missionInteract = !!mission && !!at && mission.def.steps.some(step => step.type === 'interact' && mission.state.steps[step.id].status === 'active' && Math.hypot(at.x - mission.def.anchors[step.anchor].x, at.z - mission.def.anchors[step.anchor].z) <= mission.def.anchors[step.anchor].radius);
    const gun = this.world.mountedGun;
    const gunInteract = !!gun && (gun.mounted || gun.canMount());
    // Retained campaign weapons use Pickups' stand-to-interact hold rather than
    // an Interactable entity. Offer the same action on touch within its 1.5 m reach.
    let pickupInteract = false;
    if (at && this.input.scheme === 'touch') for (const e of this.world.entities.iterate()) {
      const pickup = e.pickup;
      if (pickup && 'actionId' in pickup && pickup.armed && pickup.interactTicks && Math.hypot(at.x - e.transform.x, at.z - e.transform.z) <= 1.5) { pickupInteract = true; break; }
    }
    this.input.touch.setInteractable(this.world.vehicles?.canInteract() === true || this.world.interactables?.activeId != null || missionInteract || gunInteract || pickupInteract);
    const player = this.world.entities.get(1)?.transform;
    // PO: after a respawn, held buttons/targets/modifiers from the fight before death must not carry over.
    const dead = this.world.entities.get(1)?.survivor?.diedAt != null;
    if (this.wasDead && !dead) { this.input.release(); this.world.controls.reset(); }
    this.wasDead = dead;
    if (this.driver) { const frame = this.driver.sample(); this.input.tap?.(frame, 'keyboard'); this.world.applyInput(frame, 'keyboard'); }
    else if (this.inspect?.enabled) this.world.clearInput();
    else if (player) {
      this.input.cursor.setGroundHeight(this.world.districts?.groundHeight(player.x, player.z) ?? 0);
      const objective = markerAnchor(this.world.missions);
      this.input.objectiveRings = this.world.missions?.state.phase === 'playing'
        ? [...(objective ? [objective] : []), ...searchAnchors(this.world.missions)].map(a => ({ ...a, y: this.world.districts?.groundHeight(a.x, a.z) ?? a.y ?? 0 })) : [];
      const frame = this.input.sample(player, 1 / 60, this.world.entities.iterate());
      if (frame.pause && this.ui.enabled) { this.ui.pause(); return; }
      this.world.applyInput(frame, this.input.feed?.scheme ?? this.input.scheme);
    }
    if (this.world.infected) {
      // The director sees the tick pose of the follow rig, never a render-rate interpolated one and never presentation kicks
      // (pull/shake/roll): spawns must be a function of the recorded inputs alone (telemetry replays).
      const sim = this.view.view.simCamera;
      this.spawnFrustum.multiplyMatrices(sim.projectionMatrix, sim.matrixWorldInverse);
      this.world.infected.director.setFrustum(this.spawnFrustum.elements, sim.position);
    }
    const simStart = performance.now(); this.world.update(); const simDt = performance.now() - simStart; this.simWorldMs += simDt;
    this.simTickMs = Math.max(this.simTickMs, simDt);
    if (this.ui.enabled) this.ui.hud.onboarding.observe(this.world.inputFrame);
    this.view.advance(1 / 60);
  }
  async screenshotReady(): Promise<void> {
    await this.levelQueue; await this.refreshView();
    await this.view.synchronizeInteractions();
    await this.view.ready();
    for (let i = 0; i < 2; i++) { await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); this.view.update(this.clock.paused ? 1 : this.clock.alpha); }
  }
  /** Last-frame counters. With `?profile`, `profile` groups submitted geometry by
   * crowd/buildings/props/other and non-view passes (shadows plus fullscreen FX).
   * CPU timers cover presentation updates and renderer submission/driver waits;
   * they are not GPU timer queries. Without profiling, the extra timers stay zero.
   * `infected.liveCount` is the director cap count (including reserved recoveries),
   * while `infected.count` also includes settled bodies still in the active pool.
   * `firstLiveId` and L4 beat counters avoid full debug snapshots in frame probes. */
  perf() {
    const info = this.view.renderer.info, l4 = this.world.missions?.state.l4;
    return { l4: l4 ? { turnAt: l4.turnAt, tankShots: l4.tankShots, lineBreakAt: l4.lineBreakAt } : null, chunkResidency: this.world.chunks?.stats() ?? null, terrain: this.view.terrainPerf(), infected: this.world.infected ? { count: this.world.infected.active.length, liveCount: this.world.infected.director.count, firstLiveId: this.world.infected.active.find(e => e.health.current > 0)?.id ?? null, available: this.world.infected.pool.length } : null, effects: this.view.effectPerf(), nodeBuildMaterials: { ...this.view.renderer.nodeBuildMaterials }, crowdPreparation: { ...civilianBakeStats }, nodeBuilds: this.view.renderer.nodeBuilds, profile: this.view.renderer.profile, profileAssets: this.view.renderer.profileAssets, updateCpuMs: this.view.updateCpuMs, renderCpuMs: this.view.renderCpuMs, propUploads: this.view.propUploads, awakeProps: this.world.props?.items.filter(p => p.awake).length ?? 0, fps: this.frameMs ? 1000 / this.frameMs : 0, frameMs: this.frameMs, simMs: this.simMs, simTicks: this.simTicks, simWorldMs: this.simWorldMs, simTickMs: this.simTickMs, uiMs: this.ui.updateMs, drawCalls: info.render.drawCalls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, entities: this.world.entities.size, backend: this.view.renderer.selectedBackend,loadTiming:this.lastLoad, quality: this.quality.snapshot(), renderedFrames: this.view.renderedFrames, contextLost: this.view.contextLost, paused: this.clock.paused, heapBytes: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null, lighting: this.view.lightingPerf() };
  }
  /** Debug-only synthetic GPU cost. It changes the quality observation, never sim time. */
  simulateFrameCost(ms: number): void { if (!Number.isFinite(ms) || ms < 0) throw new RangeError('Invalid frame cost'); this.simulatedFrameMs = ms; }
  setQuality(setting: QualitySetting): void { this.quality.set(setting); }
  private applyQuality(): void {
    this.view.setQuality(this.quality.tier); this.audio.graph.setTier(this.quality.tier);
    this.world.chunks?.setQuality(this.quality.tier);
    if (this.world.districts) this.world.npcs?.setQuality(this.quality.tier);
    // The fixed 200-actor benchmark keeps its load on both render tiers.
    if (this.world.infected) this.world.infected.director.setTier(this.world.scenario === 'perf-horde-200' ? 'high' : this.quality.tier);
  }
  private readonly visibility = (): void => { if (document.hidden) { this.clock.pause(); this.input.clear(); this.world.clearInput(); this.ticker.reset(); } };
  private readonly contextLost = (event: Event): void => { event.preventDefault(); this.view.contextLost = true; this.view.retireLostRenderer(); this.clock.pause(); this.input.clear(); this.world.clearInput(); };
  private readonly contextRestored = (): void => {
    const restore = this.levelQueue.then(async () => { this.loading = true; try { await this.view.restoreContext(); this.restoredWhilePaused = true; } finally { this.loading = false; this.clock.pause(); this.ticker.reset(); } });
    this.levelQueue = restore.catch(error => console.error(error));
  };
  dispose(): void { this.inspect?.dispose(); if (this.driver instanceof LevelOneBot) this.driver.dispose(); this.campaignUI?.dispose(); this.ui.dispose(); this.transition.dispose(); document.removeEventListener('visibilitychange', this.visibility); this.view.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost); this.view.renderer.domElement.removeEventListener('webglcontextrestored', this.contextRestored); this.overlay?.dispose(); this.quality.dispose(); this.ticker.dispose(); this.clock.dispose(); this.services.dispose(); }
}
