import type { Game } from '../Game';
import type { InputFrame } from '../input/InputFrame';
import type { CampaignSave } from '../sim/progression/Campaign';
import type { Tier } from '../levels/districts/types';
import { stateHash, canonicalJson } from '../sim/world/stateHash';
import { fnv1a } from '../core/Rng';
import { decodeLog, phaseCommands, schemes, tierNames, type DecodedLog } from './codec';
import { RunProbe, type ReplaySummary } from './probe';
import type { Telemetry } from './Telemetry';

const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), c => c.charCodeAt(0));
const toBase64 = (bytes: Uint8Array): string => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };

/**
 * Plays a recorded input log through the real Game: the same level, campaign, seed and quality, then the recorded frame for
 * every fixed tick, with the between-tick commands (mission begin/restore/continue, zoom, quality tier, viewport) applied at
 * the sample where they happened. Runs in the page (test API); tools/replay/play.ts drives it.
 */
export class ReplayRun {
  readonly probe = new RunProbe();
  private index = 0; private command = 0; private cursor = 0;
  private readonly frames: InputFrame[];
  private readonly feed = { scheme: 'mouse-only' as (typeof schemes)[number], next: (): InputFrame | null => { const i = this.cursor++; this.feed.scheme = schemes[this.log.schemes[i]] ?? 'mouse-only'; return this.frames[i] ?? null; } };
  private constructor(private readonly game: Game, readonly log: DecodedLog) { this.frames = log.frames; }
  get sample(): number { return this.index; }
  get done(): boolean { return this.index >= this.log.samples; }
  get meta(): Record<string, unknown> { return this.log.meta ?? {}; }

  static async start(game: Game, chunks: string[]): Promise<ReplayRun> {
    const log = decodeLog(chunks.map(fromBase64)), meta = log.meta;
    if (!meta || typeof meta.level !== 'string') throw new Error('Replay has no metadata');
    const run = new ReplayRun(game, log);
    game.clock.pause();
    game.campaign = meta.campaign ? structuredClone(meta.campaign as CampaignSave) : null;
    if (meta.quality === 'high' || meta.quality === 'low') game.setQuality(meta.quality);
    await game.loadLevel(meta.level, { seed: Number(meta.seed), tier: (meta.tier ?? undefined) as Tier | undefined });
    game.clock.pause();
    const [w, h] = (meta.viewport as number[] | undefined) ?? [];
    if (w && h) game.view.view.resize(w, h);
    // Older logs started at the former level default. New handovers retain player zoom.
    const zoom = typeof meta.cameraZoom === 'number' && Number.isFinite(meta.cameraZoom) && meta.cameraZoom > 0 ? meta.cameraZoom : game.world.scenario === 'L10' ? game.campaign?.cureResume?.cameraZoom ?? 1 : 1;
    game.view.view.zoom(Math.log(zoom / game.view.view.getState().targetZoom), true); game.view.advance(0);
    game.input.feed = run.feed;
    run.probe.attach(game.world);
    return run;
  }

  private apply(kind: string, value: number): void {
    const { game } = this, mission = game.world.missions;
    if (kind === 'zoom') game.view.view.zoom(value);
    else if (kind === 'tier') game.setQuality(tierNames[value]);
    else if (kind === 'view') game.view.view.resize(Math.floor(value / 65536), value % 65536);
    else if (kind === 'phase' && mission) {
      const name = phaseCommands[value];
      if (name === 'begin' && mission.state.phase === 'briefing') mission.begin();
      else if (name === 'restore' && mission.state.phase === 'retry') mission.restore();
      else if (name === 'continue' && mission.state.phase === 'result') mission.continue();
      game.ticker.reset(); game.view.update(1);
    }
  }

  /** Feed samples until `until` (exclusive), stepping at most `block` ticks at a time. */
  async advance(until: number, block = 8): Promise<void> {
    const { game, log } = this, uiPauses = this.meta.ui === true, total = log.samples, end = Math.min(until, total);
    while (this.index < end) {
      while (this.command < log.commands.length && log.commands[this.command].at <= this.index) { const c = log.commands[this.command++]; this.apply(c.kind, c.value); }
      // The live game turns a pause frame into the pause menu instead of a tick; the sample is consumed but nothing runs.
      if (uiPauses && this.frames[this.index].pause) { this.cursor++; this.index++; continue; }
      let stop = Math.min(end, this.index + block, this.command < log.commands.length ? log.commands[this.command].at : Infinity);
      if (stop <= this.index) stop = this.index + 1;
      if (uiPauses) for (let j = this.index + 1; j < stop; j++) if (this.frames[j].pause) { stop = j; break; }
      this.cursor = this.index;
      await game.step(stop - this.index);
      this.index = stop;
    }
  }

  summary(): ReplaySummary {
    const { game, probe } = this, world = game.world;
    return {
      level: String(this.meta.level), seed: Number(this.meta.seed), build: typeof this.meta.build === 'string' ? this.meta.build : null,
      samples: this.index, ticks: world.tick, endPhase: world.missions?.state.phase ?? null,
      deaths: probe.deaths.map(d => ({ ...d, x: Math.round(d.x * 100) / 100, z: Math.round(d.z * 100) / 100 })), objectives: probe.objectives, checkpoints: probe.checkpoints, pickups: probe.pickups,
      completed: probe.completed, distance: probe.distance(), stalls: probe.stalls(), stateHash: stateHash(world.getState()),
    };
  }
  dispose(): void { this.probe.detach(); this.game.input.feed = null; }
}

/** Per-part hashes of the canonical state: when two runs differ, this says which subsystem diverged first. */
function diagnose(game: Game) {
  const state = game.world.getState() as unknown as Record<string, unknown>, h = (v: unknown): string => fnv1a(canonicalJson(v) ?? 'undefined').toString(16);
  const parts: Record<string, string> = {};
  for (const key of ['mission', 'progression', 'rng', 'controls', 'combat', 'interactions', 'props']) parts[key] = h(state[key]);
  const entities: Record<string, string> = {};
  for (const e of state.entities as { id: number; archetype: string }[]) entities[`${e.id}:${e.archetype}`] = h(e);
  return { parts, entities, tick: state.tick };
}

/** The test-API surface (window.__SS__.replay). */
export function replayApi(game: Game) {
  let run: ReplayRun | null = null;
  const telemetry = (): Telemetry | null => game.telemetry as Telemetry | null;
  return {
    /** True once `?telemetry=record` has installed the recorder. */
    ready: (): boolean => telemetry() !== null,
    /** Per-part state hashes: when two runs differ this says which subsystem diverged. */
    diagnose: () => diagnose(game),
    /** Record mode: path/event probe of the attempt being played (the recording side of a determinism check). */
    live: () => { const p = telemetry()?.probe; return p ? { path: p.path.slice(), deaths: p.deaths, objectives: p.objectives, completed: p.completed, ticks: p.ticks, tick: game.world.tick, stateHash: stateHash(game.world.getState()) } : null; },
    /** End the attempt and return the raw (ungzipped) chunks, base64. */
    recorded: (): { chunks: string[]; samples: number } | null => {
      const t = telemetry(); if (!t) return null;
      const samples = t.recorder.samples; t.finish('close');
      return { chunks: t.recorder.kept.map(c => toBase64(c.bytes)), samples };
    },
    start: async (chunks: string[]) => { run?.dispose(); run = await ReplayRun.start(game, chunks); return { samples: run.log.samples, commands: run.log.commands.length, meta: run.meta }; },
    advance: async (until: number, block?: number) => { await run!.advance(until, block); return { sample: run!.sample, tick: game.world.tick, done: run!.done }; },
    summary: (): ReplaySummary & { path: number[] } => ({ ...run!.summary(), path: run!.probe.path.slice() }),
  };
}
