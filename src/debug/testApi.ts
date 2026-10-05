import type { ActionState, GearTier, SurvivorVariant } from '../data/survivor';
import { Vector3 } from 'three';
import type { Action, BindingMap } from '../data/bindings';
import type { Recording } from '../input/Recorder';
import type { Game } from '../Game';
import type { EntityFilter, EntitySnapshot, GameEvent, GameStateSnapshot, InputFrame } from '../sim/world/types';

export type ProgressionPreset = Record<string, unknown>;
export type Settings = Parameters<Game['view']['settings']>[0];
export interface BotStatus { running: boolean; policy: string | null }

/** Version 1.3: E10 composition/decay snapshots and district photo spots. Future-epic methods fail explicitly, never silently. */
export interface SSTestApi {
  version: string;
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
  spawn(defId: string, pos: { x: number; z: number }, opts?: object): number;
  teleport(entityId: number | 'player', pos: { x: number; z: number }): void;
  /** E04: cosmetic selection and sim entry points; weapon and mission resolution remain separate. */
  survivor: { select(variant: SurvivorVariant, tier?: GearTier): void; damage(amount: number): number; act(action: ActionState): void; checkpoint(pos: { x: number; y: number; z: number }): void };
  setLoadout(left: string[], right: string[]): void;
  cheats: { god(on: boolean): void; infiniteCharges(on: boolean): void; killAll(): void; completeObjective(id?: string): void };
  bot: { start(policy?: 'complete' | 'newbie' | 'idle' | 'aggressive'): void; stop(): void; status(): BotStatus };
  /** E02: scenario photo spots, follow, bounded shake, cinematic blend, and NDC world projection. */
  camera: { preset(name: string): void; follow(): void; shake(intensity: number): void; project(x: number, y: number, z: number): number[]; cinematic(pose: import('../render/View').CameraPose): void };
  /** E02 presentation patch: cameraShake, bloom, cheapDof, timeOfDay; idPass/occludersVisible are test probes. */
  settings: { set(patch: Partial<Settings>): void };
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
    version: '1.3.0', ready,
    pause: () => game.clock.pause(), resume: () => game.clock.resume(),
    step: (ticks) => game.step(ticks), setTimeScale: (scale) => game.clock.setTimeScale(scale), tick: () => game.world.tick,
    loadLevel: (id, opts) => {
      if(opts?.checkpoint)pending('E12','loadLevel.checkpoint');
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
    spawn: () => pending('E07', 'spawn'),
    teleport: (id, pos) => {
      if (!Number.isFinite(pos.x) || !Number.isFinite(pos.z)) throw new RangeError('Position must be finite');
      const player = game.world.entities.get(id === 'player' ? 1 : id);
      if (!player || player.id !== 1) throw new Error(`Unknown entity: ${id}`);
      Object.assign(player.transform, pos);
      game.world.previousPlayer = { ...player.transform };
      game.world.physics.playerBody!.setTranslation(player.transform, true);
      game.world.spatial.set(player.id, pos.x, pos.z);
      game.view.update(1);
    },
    survivor: {
      select: (variant, tier = 0) => { if (!game.world.player) throw new Error('Load a survivor scenario first'); game.world.player.select(variant, tier); game.view.update(1); },
      damage: (amount) => { if (!game.world.player) throw new Error('Load a survivor scenario first'); const taken = game.world.player.damage(amount, game.world.tick); game.view.update(1); return taken; },
      act: (action) => { if (!game.world.player) throw new Error('Load a survivor scenario first'); game.world.player.act(action, game.world.tick); game.view.update(1); },
      checkpoint: (pos) => { if (!game.world.player) throw new Error('Load a survivor scenario first'); game.world.player.setCheckpoint(pos); },
    },
    setLoadout: () => pending('E05', 'setLoadout'),
    cheats: { god: () => pending('E05', 'cheats.god'), infiniteCharges: () => pending('E05', 'cheats.infiniteCharges'), killAll: () => pending('E07', 'cheats.killAll'), completeObjective: () => pending('E12', 'cheats.completeObjective') },
    bot: { start: () => pending('E19', 'bot.start'), stop: () => pending('E19', 'bot.stop'), status: () => pending('E19', 'bot.status') },
    camera: { preset: (name) => game.view.preset(name), follow: () => game.view.view.follow(), shake: (intensity) => game.view.view.shake(intensity), project: (x, y, z) => game.view.project(x, y, z), cinematic: (pose) => game.view.view.cinematic(pose) },
    settings: { set: (patch) => game.view.settings(patch) },
    perf: () => game.perf(), screenshotReady: () => game.screenshotReady(),
  };
  window.__SS__ = api; return api;
}
