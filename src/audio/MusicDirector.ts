import { musicLevels, type musicLayers } from '../data/audioCues';
type Layer = typeof musicLayers[number];
export type MusicState = 'calm' | 'tension' | 'combat' | 'aftermath';
export interface MusicIntensity {
    alerted: number;
    /** Live encounter perception; supplied by AudioService, independent of horde intensity. */
    danger?: boolean;
    /** Per-level mission beat floor, independent of nearby threats. */
    minimum?: number;
    damage?: number;
    phase?: 'normal' | 'timer' | 'defend' | 'boss';
    vehicleSpeed?: number;
    incident?: boolean;
    complete?: boolean;
}
export interface MusicTransition {
    time: number;
    layers: Layer[];
    state: MusicState;
    immediate?: boolean;
}
/** Decisions are made on sim/audio time; the renderer schedules changes on the exact beat grid. */
export class MusicDirector {
    readonly bar: number;
    readonly transitions: MusicTransition[] = [];
    layers: Layer[] = ['base'];
    pending: MusicTransition | null = null;
    score = 0;
    state: MusicState = 'calm';
    private lastThreat = -Infinity;
    private engaged = false;
    private quietSince: number | null = null;
    constructor(readonly level: string, readonly epoch = 0) { this.bar = 240 / (musicLevels[level as keyof typeof musicLevels] ?? 120); }
    update(time: number, input: MusicIntensity): void {
        if (input.danger !== undefined || input.minimum !== undefined) {
            if (input.danger) this.lastThreat = time;
            const active = !input.complete && time - this.lastThreat < 7;
            this.score = input.complete ? 0 : Math.min(1, Math.max(active ? 0.5 : 0, input.minimum ?? 0, input.alerted / 20));
            const state: MusicState = input.complete ? 'aftermath' : this.score >= 0.5 ? 'combat' : this.score > 0 ? 'tension' : 'calm';
            const layers: Layer[] = this.score >= 0.75 ? ['base', 'pulse', 'drive', 'peak'] : this.score >= 0.5 ? ['base', 'pulse', 'drive'] : this.score > 0 ? ['base', 'pulse'] : ['base'];
            this.pending = null;
            if (state !== this.state || layers.join() !== this.layers.join()) {
                this.state = state; this.layers = layers;
                this.transitions.push({ time, state, layers, immediate: true });
            }
            return;
        }
        this.score = Math.min(1, input.alerted / 20 + (input.damage ?? 0) / 100 + (input.phase === 'boss' ? 0.5 : input.phase === 'defend' || input.phase === 'timer' ? 0.25 : 0) + Math.abs(input.vehicleSpeed ?? 0) / 60);
        if (this.score > 0) {
            this.engaged = true;
            this.quietSince = null;
        }
        else if (this.quietSince === null)
            this.quietSince = time;
        let desired: Layer[] = this.score >= 0.75 ? ['base', 'pulse', 'drive', 'peak'] : this.score >= 0.5 ? ['base', 'pulse', 'drive'] : this.score >= 0.2 ? ['base', 'pulse'] : ['base'];
        if (this.score === 0 && this.quietSince !== null && time - this.quietSince < 10)
            desired = this.layers;
        if (input.incident && !this.engaged && !input.complete) desired = ['base', 'pulse'];
        let state: MusicState = input.complete ? 'aftermath' : this.score >= 0.2 ? 'combat' : this.score > 0 || input.incident ? 'tension' : 'calm';
        if (this.engaged && this.score === 0)
            state = this.quietSince !== null && time - this.quietSince >= 10 ? 'aftermath' : this.state;
        if (input.complete) { state = 'aftermath'; desired = ['base']; }
        if (this.pending && time + 1e-6 >= this.pending.time) {
            this.layers = this.pending.layers;
            this.state = this.pending.state;
            this.transitions.push(this.pending);
            this.pending = null;
        }
        if ((desired.join() !== this.layers.join() || state !== this.state) && (!this.pending || desired.join() !== this.pending.layers.join() || state !== this.pending.state)) {
            const boundary = this.epoch + Math.ceil((time - this.epoch - 1e-6) / this.bar) * this.bar;
            this.pending = { time: boundary, layers: desired, state };
            if (boundary <= time + 1e-6) {
                this.layers = desired;
                this.state = state;
                this.transitions.push(this.pending);
                this.pending = null;
            }
        }
        else if (desired.join() === this.layers.join() && state === this.state)
            this.pending = null;
    }
}
