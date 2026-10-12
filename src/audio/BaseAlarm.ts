import { l4 } from '../data/l4';
import type { AudioCue } from '../data/audioCues';
import type { GameEvent } from '../sim/world/types';
import type { AudioGraph, GraphVoice } from './AudioGraph';
import { klaxon } from './synthesis';

/**
 * The L4 military base alarm (PO 2026-10-12): starts on the first turn ("contact"), loops over the battle for `holdS` seconds, then fades
 * out under the fight music. Three positional loudspeaker voices plus one quiet non-positional bed, all through the normal graph (bus mix,
 * voice limiter, occlusion). A synthesised cue: it has no sprite entry, its buffer is built once from `klaxon`.
 */
export class BaseAlarm {
    readonly log: { cue: string; time: number; positional: boolean }[] = [];
    private voices: { voice: GraphVoice; base: number }[] = [];
    private startedAt = -1;
    private buffer: AudioBuffer | null = null;
    private readonly cue: AudioCue;
    constructor(private readonly graph: AudioGraph, private readonly caption: (text: string) => void = () => { }) {
        const a = l4.alarm;
        this.cue = { id: 'l4.klaxon', category: 'synth', offset: 0, duration: a.periodS, bus: 'telegraph', priority: 90, gain: 0.3, antiSpam: 0, rateSpread: 0, loop: true, caption: 'Base alarm sounding', frequency: a.lowHz, shape: 'tone', initial: false };
    }
    get active(): boolean { return this.voices.length > 0; }
    /** The contact event starts it; returns true when the event was the alarm trigger. */
    onEvent(event: GameEvent, time: number): boolean {
        if (event.type !== 'l4.firstTurn') return false;
        this.start(time);
        return true;
    }
    start(time: number): void {
        this.stop();
        const a = l4.alarm, ctx = this.graph.context;
        this.buffer ??= (() => {
            const data = klaxon(ctx.sampleRate, a.periodS, a.lowHz, a.highHz), buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
            buffer.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
            return buffer;
        })();
        this.startedAt = time;
        for (const [i, [x, z]] of a.speakers.entries()) {
            // A slightly different rate per speaker, so the loudspeakers beat against each other like real ones.
            const voice = this.graph.play(this.cue, this.buffer, { position: { x, y: 6, z }, gain: a.speakerGain, rate: 1 + i * 0.004, loop: true, time });
            if (voice) { this.voices.push({ voice, base: voice.baseGain }); this.log.push({ cue: this.cue.id, time, positional: true }); }
        }
        const bed = this.graph.play(this.cue, this.buffer, { gain: a.bedGain, loop: true, lowpass: 1500, time });
        if (bed) { this.voices.push({ voice: bed, base: bed.baseGain }); this.log.push({ cue: this.cue.id, time, positional: false }); }
        if (this.voices.length) this.caption(this.cue.caption!);
    }
    /** Level 1 until `holdS`, then a linear fade to silence over `fadeS`, then the voices are released. */
    level(time: number): number {
        if (this.startedAt < 0) return 0;
        const a = l4.alarm, t = time - this.startedAt;
        return t < a.holdS ? 1 : Math.max(0, 1 - (t - a.holdS) / a.fadeS);
    }
    update(time: number): void {
        if (!this.voices.length) return;
        const f = this.level(time);
        if (f <= 0) { this.stop(); return; }
        for (const { voice, base } of this.voices) {
            voice.baseGain = base * f;
            if (voice.position) this.graph.updateEmitter(voice, time);
            else voice.gain.gain.setValueAtTime(voice.baseGain, time);
        }
    }
    stop(): void {
        for (const { voice } of this.voices) voice.stop();
        this.voices = [];
        this.startedAt = -1;
    }
}
