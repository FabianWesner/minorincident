import type { Game } from '../Game';
import type { InputFrame, Scheme } from '../input/InputFrame';
import { EventClient, classifyDevice, uuid, viewportBucket, batchLimits, type TelemetryContext, type Transport } from './client';
import { ReplayRecorder, type ChunkTransport, type ReplayOutcome } from './replay';
import { gzip } from './gzip';
import { phaseCommands, tierNames } from './codec';
import type { LevelStartInfo, TelemetrySink } from './sink';
import { RunProbe } from './probe';

declare const __BUILD_COMMIT__: string;
export type TelemetryMode = 'live' | 'record';
const playerKey = 'mi.pid';

/** Ring of recent frame/sim times, summarised once a minute; fixed buffers, no per-frame allocation. */
class PerfWindow {
  private readonly frame = new Float32Array(3600); private readonly sim = new Float32Array(3600); private readonly scratch = new Float32Array(3600);
  private count = 0; drawCalls = 0;
  add(frameMs: number, simMs: number): void { const i = this.count++ % this.frame.length; this.frame[i] = frameMs; this.sim[i] = simMs; }
  get samples(): number { return Math.min(this.count, this.frame.length); }
  private pct(source: Float32Array, p: number): number {
    const n = this.samples; this.scratch.set(source.subarray(0, n)); const view = this.scratch.subarray(0, n); view.sort();
    return view[Math.min(n - 1, Math.floor(n * p))];
  }
  summary(): { p50: number; p95: number; sim: number; dc: number; n: number } | null {
    const n = this.samples; if (n < 30) return null;
    const out = { p50: this.pct(this.frame, .5), p95: this.pct(this.frame, .95), sim: this.pct(this.sim, .5), dc: this.drawCalls, n };
    this.count = 0; return out;
  }
}

export interface TelemetryOptions { mode: TelemetryMode; transport: Transport & ChunkTransport; now?: () => number; intervalMs?: number; storage?: Pick<Storage, 'getItem' | 'setItem'> | null; chunkBytes?: number }

export class Telemetry implements TelemetrySink {
  readonly client: EventClient;
  readonly recorder: ReplayRecorder;
  /** Record mode only: path and mission events of the current attempt, from tick 0, for determinism checks. */
  probe: RunProbe | null = null;
  private readonly perf = new PerfWindow();
  private attempt: { id: string; level: string; startTick: number; deaths: number; seed: number } | null = null;
  private stopWorld: (() => void) | null = null;
  private lastCause = 'unknown';
  private prevPhase: string | undefined;
  private minute = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private ended = false;
  private disposers: (() => void)[] = [];
  readonly sessionId = uuid();
  readonly playerId: string;

  constructor(private readonly game: Game, private readonly options: TelemetryOptions) {
    this.playerId = playerId(options.storage === undefined ? safeStorage() : options.storage);
    const build = typeof __BUILD_COMMIT__ === 'undefined' ? 'dev' : __BUILD_COMMIT__.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 40) || 'dev';
    const context = (): TelemetryContext => ({
      d: classifyDevice({ userAgent: navigator.userAgent, touchPoints: navigator.maxTouchPoints, coarse: matchMedia('(pointer: coarse)').matches, shortSide: Math.min(screen.width, screen.height) }),
      q: game.quality.tier, b: game.view.renderer.selectedBackend, v: build, vp: viewportBucket(innerWidth, innerHeight),
      ...(game.params.has('debug') ? { dbg: true as const } : {}),
    });
    const transport: Transport & ChunkTransport = options.mode === 'live' ? options.transport : { send: async () => 'ok', post: async () => 'ok' };
    this.client = new EventClient({ playerId: this.playerId, sessionId: this.sessionId, context, transport, now: options.now });
    this.recorder = new ReplayRecorder({ playerId: this.playerId, sessionId: this.sessionId, build }, transport, gzip, { keep: options.mode === 'record', chunkBytes: options.chunkBytes });
    game.input.tap = this.sample;
    this.client.push('session_start', game.params.has('debug') ? { d: { debug: true } } : {});
    this.listen(window, 'pagehide', this.pageHide);
    this.listen(window, 'resize', this.resize);
    this.listen(document, 'visibilitychange', this.visibility);
    game.quality.onChange(tier => { if (this.recorder.active) this.recorder.command('tier', tierNames.indexOf(tier)); });
    this.disposers.push(game.ticker.events.on('frame', ({ seconds }) => { if (!game.clock.paused && !document.hidden && seconds > 0 && seconds < 1) this.perf.add(seconds * 1000, game.simMs); }));
    if (options.mode === 'live') {
      this.timer = setInterval(this.beat, options.intervalMs ?? batchLimits.intervalMs);
      setTimeout(() => void this.client.flush(), 4000);
    }
  }
  private listen(target: EventTarget, type: string, handler: () => void): void { target.addEventListener(type, handler); this.disposers.push(() => target.removeEventListener(type, handler)); }
  private get world() { return this.game.world; }

  // ---- session ----
  private readonly beat = (): void => {
    if (document.hidden) return;
    this.client.push('heartbeat');
    this.perf.drawCalls = this.game.view.renderer.info.render.drawCalls;
    if (++this.minute % 2 === 0) { const s = this.perf.summary(); if (s) this.client.push('perf', { d: { p50: round(s.p50), p95: round(s.p95), sim: round(s.sim), dc: s.dc, n: s.n } }); }
    this.recorder.cut(this.world.tick);
    void this.client.flush();
  };
  private readonly visibility = (): void => {
    this.client.setVisible(!document.hidden);
    if (document.hidden) { this.recorder.cut(this.world.tick); void this.client.flush(true); }
  };
  private readonly resize = (): void => { if (this.recorder.active) this.recorder.command('view', innerWidth * 65536 + innerHeight); };
  private readonly pageHide = (): void => { this.finish('close'); };
  /** Last-gasp flush (also called by tests). */
  finish(why: ReplayOutcome): void {
    if (this.attempt) { this.client.push('quit', { l: this.attempt.level, k: this.world.tick, ...this.where(), d: { why, attempt: this.attempt.id } }); this.endAttempt(why); }
    if (!this.ended) { this.ended = true; this.client.push('session_end'); }
    void this.client.flush(true);
  }
  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    for (const d of this.disposers) d();
    this.stopWorld?.(); this.game.input.tap = null;
  }

  // ---- levels ----
  private where(): { x?: number; z?: number } { const t = this.world.entities.get(1)?.transform; return t ? { x: round(t.x), z: round(t.z) } : {}; }
  private endAttempt(outcome: ReplayOutcome): void {
    if (!this.attempt) return;
    this.recorder.end(outcome, this.world.tick - this.attempt.startTick); this.attempt = null;
  }
  levelLoaded(start: LevelStartInfo | null): void {
    this.stopWorld?.(); this.stopWorld = null;
    if (this.attempt) { this.client.push('quit', { l: this.attempt.level, k: this.world.tick, ...this.where(), d: { why: 'next', attempt: this.attempt.id } }); this.endAttempt('next'); }
    const mission = this.world.missions;
    if (!start || !mission) return;
    const id = uuid(), world = this.world, tier = this.game.quality.tier;
    this.attempt = { id, level: start.id, startTick: world.tick, deaths: 0, seed: world.seed };
    this.client.push('level_start', { l: start.id, k: 0, d: { seed: world.seed, tier, attempt: id } });
    this.prevPhase = mission.state.phase; this.lastCause = 'unknown';
    if (this.options.mode === 'record') { this.probe?.detach(); this.probe = new RunProbe(); this.probe.attach(world); }
    try {
      this.recorder.begin(start.id, {
        seed: world.seed, tier: start.tier ?? null, campaign: start.campaign, quality: tier, qualityParam: this.game.params.get('quality'),
        viewport: [innerWidth, innerHeight], coarse: matchMedia('(pointer: coarse)').matches, ui: this.game.ui.enabled, phase: this.prevPhase,
      }, id);
    } catch (error) { console.warn('Replay recording disabled for this attempt', error); }
    const events = world.events, stops: (() => void)[] = [];
    stops.push(events.on('infected.attack', e => { if (e.type === 'infected.attack' && e.targetId === 1) this.lastCause = world.entities.get(e.sourceId)?.archetype ?? 'infected'; }));
    stops.push(events.on('combat.hit', e => { if (e.type === 'combat.hit' && e.targetId === 1) this.lastCause = world.entities.get(e.sourceId)?.archetype ?? e.cause ?? e.damageType ?? 'unknown'; }));
    stops.push(events.on('explosion', () => { this.lastCause = 'explosion'; }));
    stops.push(events.on('player.died', e => {
      if (e.type !== 'player.died' || !this.attempt) return; this.attempt.deaths++;
      this.client.push('death', { l: this.attempt.level, k: world.tick, ...this.where(), d: { cause: String(this.lastCause).slice(0, 38).replace(/[^\w .:/-]/g, '_'), attempt: this.attempt.id } });
    }));
    stops.push(events.on('checkpoint.set', e => { if (e.type === 'checkpoint.set' && this.attempt) this.client.push('checkpoint', { l: this.attempt.level, k: world.tick, d: { id: e.id.slice(0, 38).replace(/[^\w .:/-]/g, '_'), attempt: this.attempt.id } }); }));
    stops.push(events.on('pickup.collected', e => { if (e.type === 'pickup.collected' && 'actionId' in e && this.attempt) this.client.push('weapon_pickup', { l: this.attempt.level, k: world.tick, ...this.where(), d: { id: e.actionId.slice(0, 38), attempt: this.attempt.id } }); }));
    stops.push(events.on('level.completed', e => {
      if (e.type !== 'level.completed' || !this.attempt) return;
      const r = e.result, attempt = this.attempt;
      this.client.push('level_complete', { l: attempt.level, k: world.tick, d: { attempt: attempt.id, secs: round(r.time), deaths: r.deaths, kills: r.kills, damage: Math.round(r.damage) } });
      this.endAttempt('complete'); void this.client.flush();
    }));
    this.stopWorld = () => { for (const stop of stops) stop(); };
  }
  restarting(): void {
    if (!this.attempt) return;
    this.client.push('level_restart', { l: this.attempt.level, k: this.world.tick, ...this.where(), d: { attempt: this.attempt.id } });
    this.endAttempt('restart');
  }
  home(): void {
    if (!this.attempt) return;
    this.client.push('quit', { l: this.attempt.level, k: this.world.tick, ...this.where(), d: { why: 'home', attempt: this.attempt.id } });
    this.endAttempt('home'); void this.client.flush();
  }
  scenarioUnloaded(): void { this.stopWorld?.(); this.stopWorld = null; this.attempt = null; if (this.recorder.active) this.recorder.end('home', 0); }
  zoom(delta: number): void { if (this.recorder.active) this.recorder.command('zoom', delta); }

  // ---- per-tick input tap (called by InputSystem.sample for every fixed tick the sim consumes) ----
  private readonly sample = (frame: InputFrame, scheme: Scheme): void => {
    if (!this.recorder.active) return;
    const phase = this.world.missions?.state.phase;
    if (phase !== this.prevPhase) {
      const was = this.prevPhase;
      if (was === 'briefing') this.recorder.command('phase', phaseCommands.indexOf('begin'));
      else if (was === 'retry') this.recorder.command('phase', phaseCommands.indexOf('restore'));
      else if (was === 'result') this.recorder.command('phase', phaseCommands.indexOf('continue'));
      this.prevPhase = phase;
    }
    this.recorder.sample(frame, scheme);
  };
}
const round = (v: number): number => Math.round(v * 100) / 100;
function safeStorage(): Storage | null { try { return localStorage; } catch { return null; } }
function playerId(storage: Pick<Storage, 'getItem' | 'setItem'> | null): string {
  try {
    const existing = storage?.getItem(playerKey);
    if (existing && /^[0-9a-f-]{36}$/.test(existing)) return existing;
    const fresh = uuid(); storage?.setItem(playerKey, fresh); return fresh;
  } catch { return uuid(); }
}
