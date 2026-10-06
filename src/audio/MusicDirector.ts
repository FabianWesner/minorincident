import { musicLevels, type musicLayers } from '../data/audioCues';
type Layer = typeof musicLayers[number];
export interface MusicIntensity {
    alerted: number;
    damage?: number;
    phase?: 'normal' | 'timer' | 'defend' | 'boss';
    vehicleSpeed?: number;
}
export interface MusicTransition {
    time: number;
    layers: Layer[];
}
/** Decisions are made on sim/audio time; the renderer schedules changes on the exact beat grid. */
export class MusicDirector {
    readonly bar: number;
    readonly transitions: MusicTransition[] = [];
    layers: Layer[] = ['base'];
    pending: MusicTransition | null = null;
    score = 0;
    private quietSince: number | null = null;
    constructor(readonly level: string, readonly epoch = 0) { this.bar = 240 / (musicLevels[level as keyof typeof musicLevels] ?? 120); }
    update(time: number, input: MusicIntensity): void {
        this.score = Math.min(1, input.alerted / 20 + (input.damage ?? 0) / 100 + (input.phase === 'boss' ? 0.5 : input.phase === 'defend' || input.phase === 'timer' ? 0.25 : 0) + Math.abs(input.vehicleSpeed ?? 0) / 60);
        if (this.score > 0) {
            this.quietSince = null;
        }
        else if (this.quietSince === null)
            this.quietSince = time;
        let desired: Layer[] = this.score >= 0.75 ? ['base', 'pulse', 'drive', 'peak'] : this.score >= 0.5 ? ['base', 'pulse', 'drive'] : this.score >= 0.2 ? ['base', 'pulse'] : ['base'];
        if (this.score === 0 && this.quietSince !== null && time - this.quietSince < 10)
            desired = this.layers;
        if (this.pending && time + 1e-6 >= this.pending.time) {
            this.layers = this.pending.layers;
            this.transitions.push(this.pending);
            this.pending = null;
        }
        if (desired.join() !== this.layers.join() && (!this.pending || desired.join() !== this.pending.layers.join())) {
            const boundary = this.epoch + Math.ceil((time - this.epoch - 1e-6) / this.bar) * this.bar;
            this.pending = { time: boundary, layers: desired };
            if (boundary <= time + 1e-6) {
                this.layers = desired;
                this.transitions.push(this.pending);
                this.pending = null;
            }
        }
        else if (desired.join() === this.layers.join())
            this.pending = null;
    }
}
