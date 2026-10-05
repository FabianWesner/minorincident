import type { Game } from '../Game';
import type { EntityFilter, EntitySnapshot, GameEvent, GameStateSnapshot, InputFrame } from '../sim/world/types';

export type ProgressionPreset = Record<string, unknown>;
export type Settings = Parameters<Game['view']['settings']>[0];
export interface BotStatus { running: boolean; policy: string | null }

/** Version 1 foundation API. Future-epic methods fail explicitly, never silently. */
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
  getState(): GameStateSnapshot & { render: ReturnType<Game['view']['getState']> };
  getEntity(id: number): EntitySnapshot | null;
  query(filter: EntityFilter): EntitySnapshot[];
  events(sinceTick?: number): GameEvent[];
  input: { set(frame: Partial<InputFrame>): void; clear(): void };
  spawn(defId: string, pos: { x: number; z: number }, opts?: object): number;
  teleport(entityId: number | 'player', pos: { x: number; z: number }): void;
  setLoadout(left: string[], right: string[]): void;
  cheats: { god(on: boolean): void; infiniteCharges(on: boolean): void; killAll(): void; completeObjective(id?: string): void };
  bot: { start(policy?: 'complete' | 'newbie' | 'idle' | 'aggressive'): void; stop(): void; status(): BotStatus };
  camera: { preset(name: string): void; follow(): void; shake(intensity: number): void; project(x: number, y: number, z: number): number[]; cinematic(pose: import('../render/View').CameraPose): void };
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
    version: '1.0.0', ready,
    pause: () => game.clock.pause(), resume: () => game.clock.resume(),
    step: (ticks) => game.step(ticks), setTimeScale: (scale) => game.clock.setTimeScale(scale), tick: () => game.world.tick,
    loadLevel: async () => pending('E12', 'loadLevel'),
    loadScenario: (name, opts) => game.loadScenario(name, opts?.seed),
    unloadScenario: () => game.loadScenario(null),
    getState: () => ({ ...game.world.getState(), render: game.view.getState() }), getEntity: (id) => game.world.getEntity(id),
    query: (filter) => game.world.query(filter), events: (since) => game.world.events.events(since),
    input: { set: (frame) => game.world.setInput(frame), clear: () => game.world.clearInput() },
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
    setLoadout: () => pending('E05', 'setLoadout'),
    cheats: { god: () => pending('E05', 'cheats.god'), infiniteCharges: () => pending('E05', 'cheats.infiniteCharges'), killAll: () => pending('E07', 'cheats.killAll'), completeObjective: () => pending('E12', 'cheats.completeObjective') },
    bot: { start: () => pending('E19', 'bot.start'), stop: () => pending('E19', 'bot.stop'), status: () => pending('E19', 'bot.status') },
    camera: { preset: (name) => game.view.preset(name), follow: () => game.view.view.follow(), shake: (intensity) => game.view.view.shake(intensity), project: (x, y, z) => game.view.project(x, y, z), cinematic: (pose) => game.view.view.cinematic(pose) },
    settings: { set: (patch) => game.view.settings(patch) },
    perf: () => game.perf(), screenshotReady: () => game.screenshotReady(),
  };
  window.__SS__ = api; return api;
}
