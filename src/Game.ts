import { QualityControls } from './ui/QualityControls';
import { performanceLevels, installPerformanceLevel } from '../tests/fixtures/scenarios/performance';
import { Quality, type QualitySetting } from './core/Quality';
import { PerfOverlay } from './debug/performance/PerfOverlay';
import { Driver } from './debug/bot/Driver';
import { AudioService } from './audio/AudioService';
// Adapted from folio-2025 by Bruno Simon (MIT).
import { Matrix4 } from 'three';
import { missionSandbox } from '../tests/fixtures/scenarios/mission-sandbox';
import { missionIds, resolveCampaignMission, type MissionId } from './levels/missions';
import { Combat } from './sim/combat/Combat';
import { InputSystem } from './input/InputSystem';
import { Clock } from './core/Clock';
import { Services } from './core/Services';
import { Ticker } from './core/Ticker';
import { GameView } from './render/GameView';
import { loadLayouts } from './levels/layouts';
import type { Tier } from './levels/districts/types';
import { SimWorld } from './sim/world/SimWorld';

/** Injected composition root, with staged initialization adapted from Bruno Game.js. */
export class Game {
  readonly quality: Quality;
  private overlay: PerfOverlay | null = null;
  private qualityControls: QualityControls | null = null;
  private simulatedFrameMs = 0;
  private restoredWhilePaused = false;
  readonly services = new Services();
  readonly world = this.services.add(new SimWorld());
  readonly clock: Clock;
  readonly view: GameView;
  readonly input: InputSystem;
  readonly audio: AudioService;
  readonly ticker = new Ticker();
  lastLoad:{dataMs:number;simMs:number;viewMs:number}|null=null;
  driver: Driver | null = null;
  frameMs = 0;
  simMs = 0;
  private readonly spawnFrustum = new Matrix4();
  private loading = false;
  private renderedDistricts: SimWorld['districts'] = null;
  private levelQueue: Promise<void> = Promise.resolve();
  constructor(readonly params: URLSearchParams) {
    const requested = params.get('quality') ?? 'auto';
    if (!['auto', 'high', 'low'].includes(requested)) throw new RangeError('Invalid quality setting');
    this.quality = new Quality(requested as QualitySetting, { userAgent: navigator.userAgent, touchPoints: navigator.maxTouchPoints, coarsePointer: matchMedia('(pointer: coarse)').matches, memoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory });
    this.clock = new Clock(params.get('test') === '1' ? 20 : 5);
    this.view = this.services.add(new GameView(this.world, params, this.quality.tier));
    this.input = this.services.add(new InputSystem(this.view.renderer.domElement, this.view.camera));
    this.audio = this.services.add(new AudioService(this.world, {
      pause: () => this.clock.pause(), resume: () => { this.ticker.reset(); this.clock.resume(); },
      release: () => { this.input.clear(); this.world.clearInput(); this.ticker.reset(); },
      offscreen: (p) => { const q = this.view.project(p.x, p.y ?? 0.7, p.z); return Math.abs(q[0]) > 1 || Math.abs(q[1]) > 1 || q[2] > 1; },
      project: (p) => { const q = this.view.project(p.x, p.y ?? 0, p.z); return { x: (q[0] + 1) / 2, y: (1 - q[1]) / 2 }; },
    }, params));
    this.audio.graph.setTier(this.quality.tier);
    this.quality.onChange(() => this.applyQuality());
    this.view.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    this.view.renderer.domElement.addEventListener('webglcontextrestored', this.contextRestored);
    document.addEventListener('visibilitychange', this.visibility);
  }
  async init(): Promise<void> {
    await this.services.init();
    await this.loadScenario(this.params.get('test') === '1' ? 'empty' : 'survivor', Number(this.params.get('seed') ?? 1));
    this.world.player?.select(this.params.get('survivor') === 'male' ? 'male' : 'female', 0);
    this.view.update(1);
    this.ticker.events.on('frame', ({ seconds }) => {
      this.frameMs = seconds * 1000;
      if (!this.loading && this.renderedDistricts !== this.world.districts) this.refreshView();
      if (!this.loading && !this.view.contextLost) {
        if (document.hidden) this.clock.pause();
        if (!this.clock.paused) this.quality.observe(Math.max(this.frameMs, this.simulatedFrameMs), seconds, Boolean(this.world.missions?.state.cinematic));
        if (!this.clock.paused) this.view.frame(seconds);
        const start = performance.now();
        this.clock.advance(seconds, () => this.simTick());
        this.simMs = performance.now() - start;
        if (!this.clock.paused || this.restoredWhilePaused) this.view.update(this.clock.paused ? 1 : this.clock.alpha);
      }
      this.overlay?.update(seconds);
    });
    this.qualityControls = new QualityControls(this.quality, setting => this.setQuality(setting));
    if (this.params.has('perf')) this.overlay = new PerfOverlay(this);
    this.ticker.init();
  }
  /** Serialize native-world changes so overlapping API loads cannot leak resources. */
  loadScenario(name: string | null, seed = 1): Promise<void> {
    if (name && performanceLevels[name]) return this.loadLevel(performanceLevels[name].level, { seed }, name);
    const load = this.levelQueue.then(async () => {
      this.loading = true; this.restoredWhilePaused = false;
      try {
        this.audio.reset(); this.driver = null; this.input.reset(); this.view.reset(); this.world.reset(); this.clock.reset();
        if (name !== null) { this.world.loadScenario(name, seed); this.quality.startLevel(); this.applyQuality(); if (name === 'mission-sandbox') this.world.loadMission(missionSandbox()); await this.view.load(); }
        else this.view.update();
        this.renderedDistricts=this.world.districts;
        await this.audio.load();
      } finally { this.loading = false; this.ticker.reset(); }
    });
    this.levelQueue = load.catch(() => {}); return load;
  }
  /** E10 composition plus E12 mission briefing; checkpoints restore reached state or reconstruct an authored graph prefix. */
  loadLevel(id:string,opts?:{seed?:number;tier?:Tier;checkpoint?:string}, performanceScenario?: string):Promise<void>{
    const load=this.levelQueue.then(async()=>{
      this.loading=true; this.restoredWhilePaused = false;
      try{
        if(opts?.checkpoint && this.world.missions?.def.id === id) { this.world.missions.loadCheckpoint(opts.checkpoint); this.view.update(1); return; }
        const start=performance.now();
        const {composition,layouts}=await loadLayouts(id,opts?.tier,async(url)=>{const r=await fetch(url);if(!r.ok)throw new Error(`Layout request failed: ${url}`);return r.json();});
        const data=performance.now();
        const cosmetic=this.world.entities.get(1)?.survivor;
        this.audio.reset(); this.driver = null; this.input.reset();this.view.reset();this.world.reset();this.clock.reset();this.world.loadComposition(composition,layouts,opts?.seed??1);
        if(cosmetic)this.world.player!.select(cosmetic.variant,cosmetic.gearTier);
        if(missionIds.includes(id as MissionId)) {
          this.world.combat = new Combat(this.world, { name:id,survivor:true,combat:true,ground:{width:100,depth:100},player:{...this.world.entities.get(1)!.transform} });
          const mission=this.world.loadMission(resolveCampaignMission(id as MissionId, this.world.districts!));
          if(opts?.checkpoint) mission.loadCheckpoint(opts.checkpoint);
        }
        this.quality.startLevel();this.applyQuality();
        if (performanceScenario) installPerformanceLevel(this.world, this.quality.tier, performanceScenario);
        const sim=performance.now();await this.view.load();this.renderedDistricts=this.world.districts;this.lastLoad={dataMs:data-start,simMs:sim-data,viewMs:performance.now()-sim};await this.audio.load();
        if (performanceScenario) this.view.preset(performanceLevels[performanceScenario].spot);
      }finally{this.loading=false;this.ticker.reset();}
    });this.levelQueue=load.catch(()=>{});return load;
  }
  /** Queue one presentation rebuild when a mission script changes decay. */
  private refreshView(): Promise<void> {
    if (this.loading || this.renderedDistricts === this.world.districts) return this.levelQueue;
    this.loading=true;
    const refresh=this.levelQueue.then(async()=>{
      try { await this.view.load(); this.renderedDistricts=this.world.districts; await this.audio.load(); }
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
    await this.refreshView(); this.view.update(1);
  }
  private simTick(): void {
    this.input.setDriving(this.world.vehicles?.active != null);
    const player = this.world.entities.get(1)?.transform;
    if (this.driver) this.world.applyInput(this.driver.sample(), 'keyboard');
    else if (player) this.world.applyInput(this.input.sample(player), this.input.scheme);
    if (this.world.infected) {
      this.view.camera.updateMatrixWorld();
      this.spawnFrustum.multiplyMatrices(this.view.camera.projectionMatrix, this.view.camera.matrixWorldInverse);
      this.world.infected.director.setFrustum(this.spawnFrustum.elements);
    }
    this.world.update();
    this.view.advance(1 / 60);
  }
  async screenshotReady(): Promise<void> {
    await this.levelQueue; await this.refreshView();
    await this.view.synchronizeInteractions();
    await this.view.ready();
    for (let i = 0; i < 2; i++) { await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); this.view.update(this.clock.paused ? 1 : this.clock.alpha); }
  }
  perf() {
    const info = this.view.renderer.info;
    return { fps: this.frameMs ? 1000 / this.frameMs : 0, frameMs: this.frameMs, simMs: this.simMs, drawCalls: info.render.drawCalls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, entities: this.world.entities.size, backend: this.view.renderer.selectedBackend,loadTiming:this.lastLoad, quality: this.quality.snapshot(), renderedFrames: this.view.renderedFrames, contextLost: this.view.contextLost, paused: this.clock.paused, heapBytes: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null };
  }
  /** Debug-only synthetic GPU cost. It changes the quality observation, never sim time. */
  simulateFrameCost(ms: number): void { if (!Number.isFinite(ms) || ms < 0) throw new RangeError('Invalid frame cost'); this.simulatedFrameMs = ms; }
  setQuality(setting: QualitySetting): void { this.quality.set(setting); if (this.qualityControls) this.qualityControls.select.value = setting; }
  private applyQuality(): void {
    this.view.setQuality(this.quality.tier); this.audio.graph.setTier(this.quality.tier);
    if (this.world.infected) this.world.infected.director.setTier(this.quality.tier);
  }
  private readonly visibility = (): void => { if (document.hidden) { this.clock.pause(); this.input.clear(); this.world.clearInput(); this.ticker.reset(); } };
  private readonly contextLost = (event: Event): void => { event.preventDefault(); this.view.contextLost = true; this.view.retireLostRenderer(); this.clock.pause(); this.input.clear(); this.world.clearInput(); };
  private readonly contextRestored = (): void => {
    const restore = this.levelQueue.then(async () => { this.loading = true; try { await this.view.restoreContext(); this.restoredWhilePaused = true; } finally { this.loading = false; this.clock.pause(); this.ticker.reset(); } });
    this.levelQueue = restore.catch(error => console.error(error));
  };
  dispose(): void { document.removeEventListener('visibilitychange', this.visibility); this.view.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost); this.view.renderer.domElement.removeEventListener('webglcontextrestored', this.contextRestored); this.overlay?.dispose(); this.qualityControls?.dispose(); this.quality.dispose(); this.ticker.dispose(); this.clock.dispose(); this.services.dispose(); }
}
