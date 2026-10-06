import { missionControls } from '../sim/missions/controls';
import { Driver } from './bot/Driver';
import { runAudioL1Bot } from './audioBot';
import { renderAudio } from './audioHarness';
import type { ActionState, GearTier, SurvivorVariant } from '../data/survivor';
import { Vector3 } from 'three';
import type { Action, BindingMap } from '../data/bindings';
import type { Recording } from '../input/Recorder';
import type { Game } from '../Game';
import type { EntityFilter, EntitySnapshot, GameEvent, GameStateSnapshot, InputFrame } from '../sim/world/types';
import { deviceKinds, type DeviceKind, type DeviceOptions } from '../sim/interact/Interactables';
import { hazardKinds, destructibleKinds, type HazardKind, type DestructibleKind, type HazardOptions } from '../sim/interact/Hazards';
import { pickupKinds, type PickupKind } from '../sim/interact/Pickups';

export type ProgressionPreset = Record<string, unknown>;
export type Settings = Parameters<Game['view']['settings']>[0] & Partial<import('../audio/AudioService').AudioSettings> & { aimAssist?: import('../sim/combat/AimAssist').AimAssistSetting };
export interface BotStatus { running: boolean; policy: string | null }

/** Version 1.9: crowds, vehicles, interactions, missions, VFX and E16 audio probes. */
type WithoutTick<T> = T extends GameEvent ? Omit<T, 'tick'> : never;
export interface SSTestApi {
  version: string;
  /** E12 mission controls share the headless sim entry points; state is copied. */
  missions: ReturnType<typeof missionControls>;
  /** E08 authoring hooks use exactly the headless production NPC systems. */
  npcs: { civilian(role: string, pos: { x: number; z: number }, options?: Parameters<import('../sim/npc/Civilians').Civilians['spawn']>[2]): number; escort(pos: { x: number; z: number }, child?: boolean): number; grab(id: number, attackerId: number): boolean; courage(amount: number): void; quality(tier: 'high' | 'low'): void };
  ready: Promise<void>;
  pause(): void;
  resume(): void;
  step(ticks: number): Promise<void>;
  setTimeScale(scale: number): void;
  tick(): number;
  loadLevel(id: string, opts?: { seed?: number; checkpoint?: string; tier?: 0 | 1 | 2 | 3 | 4 | 5; progression?: ProgressionPreset }): Promise<void>;
  loadScenario(name: string, opts?: { seed?: number }): Promise<void>;
  /** Additive E01 harness hook: unload all scenario-owned sim and GPU resources. */
  unloadScenario(): Promise<void>;
  getState(): GameStateSnapshot & { districts?:ReturnType<import('../sim/world/DistrictWorld').DistrictWorld['getState']>|null; render: ReturnType<Game['view']['getState']> };
  getEntity(id: number): EntitySnapshot | null;
  query(filter: EntityFilter): EntitySnapshot[];
  events(sinceTick?: number): GameEvent[];
  input: {
    set(frame: Partial<InputFrame>): void; clear(): void;
    /** E03: physical binding map and validation message, also exposed by the Controls form. */
    bindings(): BindingMap; rebind(action: Action, code: string): { ok: boolean; message: string };
    /** Ground → client pixels using the current camera. Tests still send real device events. */
    project(pos: { x: number; z: number }): { x: number; y: number };
    /** Begin at scenario tick zero so seed + frames are sufficient for replay. */
    record(): void; stopRecording(): Recording; replay(data: Recording): Promise<void>;
  };
  /** E06 action IDs spawn pickups; E09 vehicle.* IDs spawn drivable vehicles. Infected options include hearing fixtures. */
  spawn(defId: string, pos: { x: number; z: number }, opts?: object): number;
  /** E11 authoring/debug hooks. Spawn opts are DeviceOptions/HazardOptions or {item:string}. */
  interact: { giveItem(id: string): void; refuel(id: number, seconds: number): void; barricade(id: number, on: boolean): void; hit(id: number, amount: number, type: import('../sim/combat/Damage').DamageEvent['type']): number };
  teleport(entityId: number | 'player', pos: { x: number; z: number }): void;
  /** E04: cosmetic selection and sim entry points; weapon and mission resolution remain separate. */
  survivor: { select(variant: SurvivorVariant, tier?: GearTier): void; damage(amount: number): number; act(action: ActionState): void; checkpoint(pos: { x: number; y: number; z: number }): void };
  setLoadout(left: string[], right: string[]): void;
  cheats: { god(on: boolean): void; infiniteCharges(on: boolean): void; killAll(): void; completeObjective(id?: string): void };
  bot: { start(policy?: 'complete' | 'newbie' | 'idle' | 'aggressive' | 'driver'): void; stop(): void; status(): BotStatus };
  /** E02: scenario photo spots, follow, bounded shake, cinematic blend, and NDC world projection. */
  camera: { preset(name: string): void; follow(): void; shake(intensity: number): void; project(x: number, y: number, z: number): number[]; cinematic(pose: import('../render/View').CameraPose): void };
  /** E02 presentation patch: cameraShake, bloom, cheapDof, timeOfDay; idPass/occludersVisible are test probes. */
  settings: { set(patch: Partial<Settings>): void };
  /** E15 render-only clock/event probes. stepRender never advances simulation or its RNG; the next render consumes the new time. */
  vfx: { stepRender(seconds: number): void; emit(event: Omit<Extract<GameEvent, { type: 'vfx.effect' }>, 'tick'> | WithoutTick<Extract<GameEvent, { type: 'telegraph' }>> | Omit<Extract<GameEvent, { type: 'attack.resolved' }>, 'tick'> | Omit<Extract<GameEvent, { type: 'vehicle.feedback' }>, 'tick'>): void };
  /** E16: graph active with output muted in test mode. emit() uses the production sim event bus.
   * render() returns a native OfflineAudioContext PCM WAV, for independent measurement. */
  audio: {
    unlock():Promise<void>;snapshot():ReturnType<Game['audio']['snapshot']>;
    play(id:string,options?:import('../audio/AudioGraph').PlayOptions,sourceId?:number):number|null;
    emit(event:GameEvent):void;clearLog():void;
    map(map:import('../audio/acoustics').AcousticMap):void;
    emitters():{id:number;cue:string;priority:number;gain:number;rate:number;cutoff:number;position:import('../data/audioEvents').SoundPosition|null;panner:string|null;loop:boolean}[];
    render(request:import('./audioHarness').AudioRenderRequest):Promise<import('./audioHarness').AudioRenderResult>;
    decode(format:'webm'|'m4a'):Promise<{id:string;frames:number}[]>;
    profile():{p50Ms:number;p95Ms:number;maxVoices:number;limit:number;ticks:number};
    l1Bot():Promise<Awaited<ReturnType<typeof runAudioL1Bot>>>;
    interrupt():Promise<void>;
  };
  perf(): ReturnType<Game['perf']>;
  screenshotReady(): Promise<void>;
}
declare global { interface Window { __SS__?: SSTestApi } }

export class NotImplemented extends Error {
  constructor(epic: string, method: string) { super(`NotImplemented ${epic}: ${method}`); this.name = 'NotImplemented'; }
}
function pending(epic: string, method: string): never { throw new NotImplemented(epic, method); }

/** Called only by the query-gated dynamic import in main.ts. */
export function installTestApi(game: Game, ready: Promise<void>): SSTestApi {
  const api: SSTestApi = {
    version: '1.9.0', ready, npcs: { civilian: (role, pos, opts) => game.world.npcs!.civilians.spawn(role, pos, opts), escort: (pos, child) => game.world.npcs!.escorts.spawn(pos, child), grab: (id, attacker) => game.world.npcs!.civilians.grab(id, attacker, true), courage: amount => { for (const e of game.world.entities.iterate()) if (e.companion) game.world.npcs!.companion.hit(e, amount); }, quality: tier => game.world.npcs!.setQuality(tier) }, missions: missionControls(game.world),
    pause: () => game.clock.pause(), resume: () => game.clock.resume(),
    step: (ticks) => game.step(ticks), setTimeScale: (scale) => game.clock.setTimeScale(scale), tick: () => game.world.tick,
    loadLevel: (id, opts) => {
      if(opts?.progression)pending('E13','loadLevel.progression');
      return game.loadLevel(id, opts);
    },
    loadScenario: (name, opts) => game.loadScenario(name, opts?.seed),
    unloadScenario: () => game.loadScenario(null),
    getState: () => ({ ...game.world.getState(), ...(game.world.districts?{districts:game.world.districts.getState()}:{}), render: game.view.getState() }), getEntity: (id) => game.world.getEntity(id),
    query: (filter) => game.world.query(filter), events: (since) => game.world.events.events(since),
    input: {
      set: (frame) => { game.world.setInput(frame); game.input.inject(frame); },
      clear: () => { game.input.clear(); game.world.clearInput(); },
      bindings: () => game.input.bindings.get(), rebind: (action, code) => game.input.rebind(action, code),
      project: (pos) => {
        game.view.camera.updateMatrixWorld();
        const point = new Vector3(pos.x, 0, pos.z).project(game.view.camera);
        const rect = game.view.renderer.domElement.getBoundingClientRect();
        return { x: rect.left + (point.x + 1) / 2 * rect.width, y: rect.top + (1 - point.y) / 2 * rect.height };
      },
      record: () => {
        if (!game.world.scenario || game.world.tick !== 0) throw new Error('Load and pause a scenario before recording at tick zero.');
        game.input.recorder.start({ level: game.world.scenario, seed: game.world.seed });
      },
      stopRecording: () => game.input.recorder.stop(),
      replay: async (data) => { await game.loadScenario(data.level, data.seed); game.clock.pause(); game.input.recorder.play(data); },
    },
    spawn: (id, pos, opts) => {
      if (id.startsWith('vehicle.')) { if (!game.world.vehicles) throw new Error('Load a survivor scenario'); const entityId = game.world.vehicles.spawn(id, pos); game.view.update(1); return entityId; }
      const [prefix, kind] = id.split('.');
      if (prefix === 'device' && (deviceKinds as readonly string[]).includes(kind) && game.world.interactables) return game.world.interactables.spawn(kind as DeviceKind, pos, opts as DeviceOptions);
      if (((prefix === 'hazard' && (hazardKinds as readonly string[]).includes(kind)) || (prefix === 'prop' && (destructibleKinds as readonly string[]).includes(kind))) && game.world.hazards) return game.world.hazards.spawn(kind as HazardKind | DestructibleKind, pos, opts as HazardOptions);
      if (prefix === 'pickup' && (pickupKinds as readonly string[]).includes(kind) && game.world.pickups) return game.world.pickups.spawn(kind as PickupKind, pos, (opts as { item?: string } | undefined)?.item);
      if (game.world.combat && (id.startsWith('weapon.') || id.startsWith('ability.'))) return game.world.combat.pickups.spawn(id, pos);
      if (game.world.infected) return game.world.infected.spawn(id, pos, opts);
      if (game.world.combat) return game.world.spawnDummy(id, pos, opts);
      throw new Error('Load an infected or combat scenario before spawning');
    },
    interact: {
      giveItem: id => game.world.interactables!.giveItem(id), refuel: (id, seconds) => game.world.interactables!.refuel(id, seconds),
      barricade: (id, on) => game.world.interactables!.barricade(id, on), hit: (id, amount, type) => game.world.hazards!.hit(id, amount, type),
    },
    teleport: (id,pos) => { missionControls(game.world).teleport(id,pos); game.view.update(1); },
    survivor: {
      select: (variant, tier = 0) => { if (!game.world.player) throw new Error('Load a survivor scenario first'); game.world.player.select(variant, tier); game.view.update(1); },
      damage: (amount) => { if (!game.world.player) throw new Error('Load a survivor scenario first'); const taken = game.world.player.damage(amount, game.world.tick); game.view.update(1); return taken; },
      act: (action) => { if (!game.world.player) throw new Error('Load a survivor scenario first'); game.world.player.act(action, game.world.tick); game.view.update(1); },
      checkpoint: (pos) => { if (!game.world.player) throw new Error('Load a survivor scenario first'); game.world.player.setCheckpoint(pos); },
    },
    setLoadout: (left, right) => { if (!game.world.combat) throw new Error('Load combat-arena before setting loadout'); game.world.combat.setLoadout(left, right); },
    cheats: { god: (on) => { if (game.world.combat) game.world.combat.damage.god = on; }, infiniteCharges: (on) => { if (game.world.combat) game.world.combat.runner.infiniteCharges = on; }, killAll: () => { if (game.world.infected) for (const e of game.world.infected.active) e.health.current = 0; }, completeObjective: (id) => { if (!game.world.missions) throw new Error('No mission loaded'); game.world.missions.completeObjective(id); game.view.update(1); } },
    bot: { start: (policy) => { if (policy !== 'driver' || game.world.scenario !== 'drive-course') pending('E19', 'bot.start'); game.driver = new Driver(game.world); }, stop: () => { game.driver = null; }, status: () => ({ running: !!game.driver && !game.driver.finished, policy: game.driver ? 'driver' : null }) },
    camera: { preset: (name) => game.view.preset(name), follow: () => game.view.view.follow(), shake: (intensity) => game.view.view.shake(intensity), project: (x, y, z) => game.view.project(x, y, z), cinematic: (pose) => game.view.view.cinematic(pose) },
    settings: { set: (patch) => { if (patch.aimAssist !== undefined) { if (!['Off', 'Low', 'Default', 'High'].includes(patch.aimAssist)) throw new RangeError('Invalid aim assist'); if (game.world.combat) game.world.combat.assist.setting = patch.aimAssist; } game.audio.set(patch); game.view.settings(patch); } },
    vfx: {
      stepRender: (seconds) => game.view.frame(seconds),
      emit: (event) => { game.world.events.emit({ ...event, tick: game.world.tick } as GameEvent); game.view.update(1); },
    },
    audio: {
      unlock:()=>game.audio.unlock(),snapshot:()=>game.audio.snapshot(),
      play:(id,opts,sourceId)=>game.audio.play(id,opts,sourceId)?.id??null,
      emit:event=>game.world.events.emit(event),clearLog:()=>{game.audio.log.length=0;},
      map:map=>{game.audio.graph.map=map;},
      emitters:()=>[...game.audio.graph.active.values()].map(v=>({id:v.id,cue:v.cue,priority:v.priority,gain:v.gain.gain.value,rate:v.source.playbackRate.value,cutoff:v.filter.frequency.value,position:v.position,panner:v.panner?.panningModel??null,loop:v.source.loop})),
      profile:()=>{
        const times:number[]=[];let maxVoices=0;
         for(let i=0;i<600;i++){const start=performance.now();game.world.update();game.view.frame(0);times.push(performance.now()-start);maxVoices=Math.max(maxVoices,game.audio.graph.active.size);}
        times.sort((a,b)=>a-b);return {p50Ms:times[300],p95Ms:times[570],maxVoices,limit:game.audio.graph.limiter.limit,ticks:600};
      },
      render:renderAudio,l1Bot:()=>runAudioL1Bot(game),
      decode:async format=>{
        const {audioCategories,audioCues,audioFile}=await import('../data/audioCues');
        const result=[];
        for(const category of audioCategories){const response=await fetch(audioFile(category,format));const buffer=await game.audio.context.decodeAudioData(await response.arrayBuffer());for(const cue of Object.values(audioCues))if(cue.category===category){if(buffer.duration+0.03<cue.offset+cue.duration)throw new Error(`Sprite decode truncated: ${cue.id}`);result.push({id:cue.id,frames:buffer.length});}}
        return result;
      },
      interrupt:async()=>{
        // Chromium cannot enter Safari's platform interruption state. Exercise the real handler with
        // only the browser-provided state accessor replaced; suspend still calls the native context.
        Object.defineProperty(game.audio.context,'state',{configurable:true,get:()=> 'interrupted'});
        game.audio.context.dispatchEvent(new Event('statechange'));
        delete (game.audio.context as unknown as {state?:string}).state;
        await new Promise<void>(resolve=>setTimeout(resolve,50));
      },
    },
    perf: () => game.perf(), screenshotReady: () => game.screenshotReady(),
  };
  window.__SS__ = api; return api;
}
