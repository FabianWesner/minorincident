import { GameUI } from './ui/GameUI';
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
  readonly services = new Services();
  readonly world = this.services.add(new SimWorld());
  readonly clock: Clock;
  readonly view: GameView;
  readonly input: InputSystem;
  readonly audio: AudioService;
  readonly ui: GameUI;
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
    this.clock = new Clock(params.get('test') === '1' ? 20 : 5);
    this.view = this.services.add(new GameView(this.world, params));
    this.input = this.services.add(new InputSystem(this.view.renderer.domElement, this.view.camera));
    this.audio = this.services.add(new AudioService(this.world, {
      pause: () => { this.clock.pause(); this.ui?.pause(); }, resume: () => { this.ticker.reset(); this.clock.resume(); this.ui?.show(null); },
      release: () => { this.input.clear(); this.world.clearInput(); this.ticker.reset(); },
      offscreen: (p) => { const q = this.view.project(p.x, p.y ?? 0.7, p.z); return Math.abs(q[0]) > 1 || Math.abs(q[1]) > 1 || q[2] > 1; },
      project: (p) => { const q = this.view.project(p.x, p.y ?? 0, p.z); return { x: (q[0] + 1) / 2, y: (1 - q[1]) / 2 }; },
    }, params));
    this.ui = new GameUI(this);
  }
  async init(): Promise<void> {
    await this.services.init();
    await this.loadScenario(this.params.get('test') === '1' ? 'empty' : 'survivor', Number(this.params.get('seed') ?? 1));
    this.world.player?.select(this.params.get('survivor') === 'male' ? 'male' : 'female', 0);
    this.view.update(1);
    this.ui.init();
    this.ticker.events.on('frame', ({ seconds }) => {
      this.frameMs = seconds * 1000;
      if (!this.loading && this.renderedDistricts !== this.world.districts) this.refreshView();
      if (!this.loading) {
        if (!this.clock.paused) this.view.frame(seconds);
        const start = performance.now();
        this.clock.advance(seconds, () => this.simTick());
        this.simMs = performance.now() - start;
        if (!this.clock.paused) this.view.update(this.clock.alpha);
      }
      this.ui.update();
    });
    this.ticker.init();
  }
  /** Serialize native-world changes so overlapping API loads cannot leak resources. */
  loadScenario(name: string | null, seed = 1): Promise<void> {
    const load = this.levelQueue.then(async () => {
      this.loading = true;
      try {
        this.audio.reset(); this.ui.reset(); this.driver = null; this.input.reset(); this.view.reset(); this.world.reset(); this.clock.reset();
        if (name !== null) { this.world.loadScenario(name, seed); if (name === 'mission-sandbox') this.world.loadMission(missionSandbox()); await this.view.load(); }
        else this.view.update();
        this.renderedDistricts=this.world.districts;
        await this.audio.load(); this.ui.loaded();
      } finally { this.loading = false; this.ticker.reset(); }
    });
    this.levelQueue = load.catch(() => {}); return load;
  }
  /** E10 composition plus E12 mission briefing; checkpoints restore reached state or reconstruct an authored graph prefix. */
  loadLevel(id:string,opts?:{seed?:number;tier?:Tier;checkpoint?:string}):Promise<void>{
    const load=this.levelQueue.then(async()=>{
      this.loading=true;
      try{
        if(opts?.checkpoint && this.world.missions?.def.id === id) { this.world.missions.loadCheckpoint(opts.checkpoint); this.view.update(1); return; }
        const start=performance.now();
        const {composition,layouts}=await loadLayouts(id,opts?.tier,async(url)=>{const r=await fetch(url);if(!r.ok)throw new Error(`Layout request failed: ${url}`);return r.json();});
        const data=performance.now();
        const cosmetic=this.world.entities.get(1)?.survivor;
        this.audio.reset(); this.ui.reset(); this.driver = null; this.input.reset();this.view.reset();this.world.reset();this.clock.reset();this.world.loadComposition(composition,layouts,opts?.seed??1);
        if(cosmetic)this.world.player!.select(cosmetic.variant,cosmetic.gearTier);
        if(missionIds.includes(id as MissionId)) {
          this.world.combat = new Combat(this.world, { name:id,survivor:true,combat:true,ground:{width:100,depth:100},player:{...this.world.entities.get(1)!.transform} });
          const mission=this.world.loadMission(resolveCampaignMission(id as MissionId, this.world.districts!));
          if(opts?.checkpoint) mission.loadCheckpoint(opts.checkpoint);
        }
        const sim=performance.now();await this.view.load();this.renderedDistricts=this.world.districts;this.lastLoad={dataMs:data-start,simMs:sim-data,viewMs:performance.now()-sim};await this.audio.load(); this.ui.loaded();
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
    await this.refreshView(); this.view.update(1); this.ui.update();
  }
  private simTick(): void {
    this.input.setDriving(this.world.vehicles?.active != null);
    const player = this.world.entities.get(1)?.transform;
    if (this.driver) this.world.applyInput(this.driver.sample(), 'keyboard');
    else if (player) {
      const frame = this.input.sample(player);
      if (frame.pause && this.ui.enabled) { this.ui.pause(); return; }
      this.world.applyInput(frame, this.input.scheme);
    }
    if (this.world.infected) {
      this.view.camera.updateMatrixWorld();
      this.spawnFrustum.multiplyMatrices(this.view.camera.projectionMatrix, this.view.camera.matrixWorldInverse);
      this.world.infected.director.setFrustum(this.spawnFrustum.elements);
    }
    this.world.update();
    if (this.ui.enabled) this.ui.hud.onboarding.observe(this.world.inputFrame);
    this.view.advance(1 / 60);
  }
  async screenshotReady(): Promise<void> {
    await this.levelQueue; await this.refreshView();
    await this.view.synchronizeInteractions();
    await this.view.ready();
    for (let i = 0; i < 2; i++) { await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); this.view.update(this.clock.paused ? 1 : this.clock.alpha); }
  }
  perf(): { fps: number; frameMs: number; simMs: number; uiMs: number; drawCalls: number; triangles: number; geometries: number; textures: number; entities: number; backend: string; loadTiming:Game['lastLoad'] } {
    const info = this.view.renderer.info;
    return { fps: this.frameMs ? 1000 / this.frameMs : 0, frameMs: this.frameMs, simMs: this.simMs, uiMs: this.ui.updateMs, drawCalls: info.render.drawCalls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, entities: this.world.entities.size, backend: this.view.renderer.selectedBackend,loadTiming:this.lastLoad };
  }
  dispose(): void { this.ticker.dispose(); this.clock.dispose(); this.services.dispose(); this.ui.dispose(); }
}
