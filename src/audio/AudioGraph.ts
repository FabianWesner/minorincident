import { audioBuses, audioCues, type AudioBus, type AudioCue } from '../data/audioCues';
import type { SoundPosition } from '../data/audioEvents';
import { dbGain, dopplerRate, impulse, occlusions, reverbPresets, zoneAt, type AcousticMap, type ReverbPreset } from './acoustics';
import { VoiceLimiter } from './VoiceLimiter';
export interface PlayOptions {
    time?: number;
    position?: SoundPosition;
    velocity?: SoundPosition;
    gain?: number;
    rate?: number;
    offscreen?: boolean;
    loop?: boolean;
    priority?: number;
    lowpass?: number;
    zone?: ReverbPreset;
    dry?: boolean;
}
export interface GraphVoice {
    id: number;
    cue: string;
    priority: number;
    source: AudioBufferSourceNode;
    gain: GainNode;
    filter: BiquadFilterNode;
    panner: PannerNode | null;
    position: SoundPosition | null;
    velocity: SoundPosition | null;
    send: GainNode;
    rate: number;
    baseGain: number;
    cutoff: number;
    wet: number;
    stopped: boolean;
    end: number;
    stop(time?: number): void;
}
/** The same graph is used for live playback and OfflineAudioContext acceptance renders. */
/** Master ceiling about -1.4 dBFS: with the 4x oversampled shaper the true peak stays under -1 dBTP. */
const CEILING = 0.85;
export class AudioGraph {
    readonly limiter: VoiceLimiter;
    readonly buses = {} as Record<AudioBus, GainNode>;
    readonly master: GainNode;
    readonly output: GainNode;
    readonly compressor: DynamicsCompressorNode;
    readonly tinnitusFilter: BiquadFilterNode;
    readonly sfx: GainNode;
    readonly voice: GainNode;
    readonly musicGate: GainNode;
    readonly musicFilter: BiquadFilterNode;
    readonly ambienceFilter: BiquadFilterNode;
    private lowHp = false;
    readonly mono: GainNode;
    readonly stereo: GainNode;
    readonly zones: {
        preset: ReverbPreset;
        node: ConvolverNode;
        gain: GainNode;
    }[] = [];
    readonly active = new Map<number, GraphVoice>();
    readonly listener = { x: 0, y: 0.7, z: 0 };
    readonly listenerVelocity = { x: 0, z: 0 };
    map: AcousticMap = { buildings: [], zones: [], surfaces: [] };
    private sequence = 0;
    private readonly impulses = new Map<ReverbPreset, AudioBuffer>();
    private radioUntil = 0;
    private megaUntil = 0;
    constructor(readonly context: BaseAudioContext, public tier: 'high' | 'low' = 'high', mutedOutput = false, reservedVoices = 0) {
        this.limiter = new VoiceLimiter(tier, reservedVoices);
        this.master = context.createGain();
        this.master.gain.value = 2;
        this.output = context.createGain();
        this.output.gain.value = mutedOutput ? 0 : 1;
        this.tinnitusFilter = context.createBiquadFilter();
        this.tinnitusFilter.type = 'lowpass';
        this.tinnitusFilter.frequency.value = 20000;
        this.compressor = context.createDynamicsCompressor();
        this.compressor.threshold.value = -3;
        this.compressor.knee.value = 0;
        this.compressor.ratio.value = 20;
        this.compressor.attack.value = 0.002;
        this.compressor.release.value = 0.06;
        const ceiling = context.createWaveShaper(), curve = new Float32Array(2049);
        for (let i = 0; i < curve.length; i++)
            curve[i] = Math.max(-CEILING, Math.min(CEILING, (i / (curve.length - 1) * 2 - 1)));
        ceiling.curve = curve;
        ceiling.oversample = '4x';
        this.master.connect(this.tinnitusFilter).connect(this.compressor).connect(ceiling);
        this.stereo = context.createGain();
        this.mono = context.createGain();
        this.mono.gain.value = 0;
        ceiling.connect(this.stereo).connect(this.output);
        const splitter = context.createChannelSplitter(2), sum = context.createGain(), merge = context.createChannelMerger(2);
        sum.gain.value = 0.5;
        ceiling.connect(splitter);
        splitter.connect(sum, 0);
        splitter.connect(sum, 1);
        sum.connect(merge, 0, 0);
        sum.connect(merge, 0, 1);
        merge.connect(this.mono).connect(this.output);
        this.output.connect(context.destination);
        this.sfx = context.createGain();
        this.sfx.gain.value = dbGain(-2);
        this.sfx.connect(this.master);
        this.voice = context.createGain();
        this.voice.gain.value = dbGain(-1.5);
        this.voice.connect(this.master);
        this.musicGate = context.createGain();
        this.musicGate.connect(this.master);
        this.musicFilter = context.createBiquadFilter();
        this.ambienceFilter = context.createBiquadFilter();
        for (const filter of [this.musicFilter, this.ambienceFilter]) {
            filter.type = 'lowpass';
            filter.frequency.value = 20000;
        }
        this.musicFilter.connect(this.musicGate);
        this.ambienceFilter.connect(this.master);
        for (const bus of audioBuses) {
            const node = context.createGain();
            node.gain.value = 1;
            node.connect(bus === 'music' ? this.musicFilter : bus === 'ambience' ? this.ambienceFilter : bus === 'dialogue' || bus === 'barks' ? this.voice : ['weapons', 'impacts', 'vehicles', 'props', 'gore'].includes(bus) ? this.sfx : this.master);
            this.buses[bus] = node;
        }
        for (let i = 0; i < (tier === 'high' ? 2 : 1); i++) {
            const node = context.createConvolver(), gain = context.createGain();
            node.normalize = false;
            node.buffer = this.ir('street');
            gain.gain.value = i === 0 ? 1 : 0;
            node.connect(gain).connect(this.master);
            this.zones.push({ preset: 'street', node, gain });
        }
        this.setListener(this.listener);
    }
    /** Shared E18 quality hook; trim existing voices and switch convolution/panning in place. */
    setTier(tier: 'high' | 'low'): void {
        if (this.tier === tier) return;
        this.tier = tier; this.limiter.setTier(tier); this.impulses.clear();
        if (tier === 'low' && this.zones.length > 1) { const zone = this.zones.pop()!; zone.node.disconnect(); zone.gain.disconnect(); }
        if (tier === 'high' && this.zones.length < 2) {
            const node = this.context.createConvolver(), gain = this.context.createGain(); node.normalize = false; gain.gain.value = 0;
            node.connect(gain).connect(this.master); this.zones.push({ preset: 'street', node, gain });
        }
        for (const zone of this.zones) zone.node.buffer = this.ir(zone.preset);
        for (const voice of this.active.values()) {
            if (voice.panner) voice.panner.panningModel = tier === 'high' ? 'HRTF' : 'equalpower';
            voice.send.disconnect(); voice.send.connect(this.zones[0].node);
        }
    }
    private ir(preset: ReverbPreset): AudioBuffer {
        if (!this.impulses.has(preset))
            this.impulses.set(preset, impulse(this.context, preset, this.tier === 'low'));
        return this.impulses.get(preset)!;
    }
    setListener(p: SoundPosition, velocity?: SoundPosition): void {
        Object.assign(this.listener, p);
        if (velocity)
            Object.assign(this.listenerVelocity, velocity);
        const l = this.context.listener, t = this.context.currentTime;
        if (l.positionX) {
            l.positionX.setValueAtTime(p.x, t);
            l.positionY.setValueAtTime(p.y ?? 0.7, t);
            l.positionZ.setValueAtTime(p.z, t);
        }
        else
            l.setPosition(p.x, p.y ?? 0.7, p.z);
        // Isometric screen right points (+x,-z); front points (-x,-z).
        if (l.forwardX) {
            l.forwardX.value = -Math.SQRT1_2;
            l.forwardY.value = 0;
            l.forwardZ.value = -Math.SQRT1_2;
            l.upX.value = 0;
            l.upY.value = 1;
            l.upZ.value = 0;
        }
        else
            l.setOrientation(-Math.SQRT1_2, 0, -Math.SQRT1_2, 0, 1, 0);
    }
    lowHealth(on: boolean): void {
        if (this.lowHp === on)
            return;
        this.lowHp = on;
        for (const filter of [this.musicFilter, this.ambienceFilter])
            filter.frequency.setTargetAtTime(on ? 1400 : 20000, this.context.currentTime, 0.1);
    }
    setMono(on: boolean): void { const t = this.context.currentTime; this.mono.gain.setValueAtTime(on ? 1 : 0, t); this.stereo.gain.setValueAtTime(on ? 0 : 1, t); }
    private zone(preset: ReverbPreset, source: boolean, time: number): ConvolverNode {
        const slot = this.zones[source && this.tier === 'high' ? 1 : 0];
        if (slot.preset !== preset) {
            slot.gain.gain.cancelScheduledValues(time);
            slot.gain.gain.setValueAtTime(0, time);
            slot.node.buffer = this.ir(preset);
            slot.preset = preset;
            slot.gain.gain.linearRampToValueAtTime(1, time + 0.3);
        }
        else if (slot.gain.gain.value === 0)
            slot.gain.gain.setValueAtTime(1, time);
        return slot.node;
    }
    play(cue: AudioCue, buffer: AudioBuffer, options: PlayOptions = {}): GraphVoice | null {
        if (!this.limiter.canAdd(options.priority ?? cue.priority))
            return null;
        const t = options.time ?? this.context.currentTime, source = this.context.createBufferSource(), gain = this.context.createGain(), filter = this.context.createBiquadFilter(), send = this.context.createGain();
        source.buffer = buffer;
        source.loop = options.loop ?? cue.loop;
        source.loopStart = cue.offset;
        source.loopEnd = cue.offset + cue.duration;
        const boost = options.offscreen && options.position && Math.hypot(options.position.x - this.listener.x, options.position.z - this.listener.z) <= 25 ? dbGain(3) : 1;
        gain.gain.value = cue.gain * (options.gain ?? 1) * boost;
        filter.type = 'lowpass';
        filter.frequency.value = options.lowpass ?? 20000;
        filter.Q.value = 0.5;
        const panner = options.position ? this.context.createPanner() : null;
        source.connect(filter).connect(gain);
        if (panner) {
            panner.panningModel = this.tier === 'high' ? 'HRTF' : 'equalpower';
            panner.distanceModel = 'inverse';
            panner.refDistance = 4;
            panner.maxDistance = 120;
            panner.rolloffFactor = 1;
            gain.connect(panner).connect(this.buses[cue.bus]);
        }
        else
            gain.connect(this.buses[cue.bus]);
        const position = options.position ? { ...options.position } : null, velocity = options.velocity ? { ...options.velocity } : null;
        const voice: GraphVoice = { id: ++this.sequence, cue: cue.id, priority: options.priority ?? cue.priority, source, gain, filter, panner, position, velocity, send, rate: options.rate ?? 1, baseGain: gain.gain.value, cutoff: options.lowpass ?? 20000, wet: 0, stopped: false, end: source.loop ? Infinity : t + cue.duration / (options.rate ?? 1), stop: (when = this.context.currentTime) => {
                if (voice.stopped)
                    return;
                voice.stopped = true;
                try {
                    source.stop(when);
                }
                catch {
                    source.disconnect();
                    filter.disconnect();
                    gain.disconnect();
                    panner?.disconnect();
                    send.disconnect();
                }
                this.active.delete(voice.id);
                this.limiter.remove(voice.id);
            } };
        if (!this.limiter.add(voice, t))
            return null;
        this.active.set(voice.id, voice);
        source.onended = () => { voice.stopped = true; source.disconnect(); filter.disconnect(); gain.disconnect(); panner?.disconnect(); send.disconnect(); this.active.delete(voice.id); this.limiter.remove(voice.id); };
        source.playbackRate.value = voice.rate;
        source.playbackRate.setValueAtTime(voice.rate, t);
        if (position) {
            this.updateEmitter(voice, t, options.lowpass);
            if (!options.dry) {
                const listenerPreset = zoneAt(this.map, this.listener), preset = options.zone ?? zoneAt(this.map, position);
                voice.wet = reverbPresets[preset].wet;
                send.gain.value = voice.wet;
                this.duckSend(voice, t);
                (panner ?? gain).connect(send);
                send.connect(this.zone(preset, preset !== listenerPreset, t));
            }
        }
        if (source.loop)
            source.start(t, cue.offset);
        else
            source.start(t, cue.offset, cue.duration);
        return voice;
    }
    /** Offline scheduling releases ended voice accounting without cutting already-scheduled PCM. */
    retire(time: number): void {
        for (const v of this.active.values())
            if (v.end <= time) {
                this.active.delete(v.id);
                this.limiter.remove(v.id);
            }
    }
    updateEmitter(voice: GraphVoice, time = this.context.currentTime, lowpass?: number): void {
        const p = voice.position;
        if (!p || !voice.panner)
            return;
        const pan = voice.panner;
        pan.positionX.setValueAtTime(p.x, time);
        pan.positionY.setValueAtTime(p.y ?? 0.7, time);
        pan.positionZ.setValueAtTime(p.z, time);
        const distance = Math.hypot(p.x - this.listener.x, p.z - this.listener.z), walls = occlusions(this.map, p, this.listener), air = distance <= 20 ? 20000 : Math.max(1800, 20000 * 20 / distance);
        voice.filter.frequency.setValueAtTime(Math.min(lowpass ?? voice.cutoff, walls ? 1200 : air), time);
        // A shelf-shaped source has most energy below 1.2kHz, keeping wall loss close to authored -6dB.
        voice.gain.gain.setValueAtTime(voice.baseGain * dbGain(-6 * walls), time);
        const rate = voice.velocity ? dopplerRate(p, voice.velocity, this.listener, this.listenerVelocity) : 1;
        voice.source.playbackRate.setValueAtTime(voice.rate * rate, time);
    }
    private depth(bus: AudioBus, at: number): number {
        return (at < this.radioUntil && (bus === 'music' || bus === 'ambience') ? (bus === 'music' ? -8 : -6) : 0) + (at < this.megaUntil && bus !== 'telegraph' && bus !== 'dialogue' ? -12 : 0);
    }
    private duckSend(voice: GraphVoice, time: number): void {
        const gain = voice.send.gain, bus = audioCues[voice.cue].bus;
        gain.cancelScheduledValues(time);
        gain.setValueAtTime(voice.wet * dbGain(this.depth(bus, time)), time);
        for (const at of [this.radioUntil, this.megaUntil].filter(at => at > time).sort((a, b) => a - b))
            gain.setValueAtTime(voice.wet * dbGain(this.depth(bus, at + 1e-5)), at);
    }
    /** Dialogue and blast envelopes compose as dB offsets; an overlap cannot erase either duck. */
    duck(kind: 'radio' | 'mega', time = this.context.currentTime, duration = kind === 'radio' ? 3 : 0.8): void {
        if (kind === 'radio')
            this.radioUntil = Math.max(this.radioUntil, time + duration);
        else
            this.megaUntil = Math.max(this.megaUntil, time + duration);
        const end = time + duration;
        for (const bus of audioBuses) {
            const node = this.buses[bus];
            const depth = (at: number) => this.depth(bus, at);
            node.gain.cancelScheduledValues(time);
            node.gain.setValueAtTime(dbGain(depth(time)), time);
            const boundaries = [this.radioUntil, this.megaUntil, end].filter(at => at > time).sort((a, b) => a - b);
            for (const at of boundaries)
                node.gain.setValueAtTime(dbGain(depth(at + 1e-5)), at);
            for (const voice of this.active.values())
                if (audioCues[voice.cue].bus === bus) {
                    this.duckSend(voice, time);
                }
        }
    }
    /** Cut the score for a full second, then reopen it for the twist stinger. */
    twist(time = this.context.currentTime): number { this.musicGate.gain.cancelScheduledValues(time); this.musicGate.gain.setValueAtTime(0, time); this.musicGate.gain.setValueAtTime(1, time + 1.05); return time + 1.05; }
    tinnitus(time = this.context.currentTime, strong = true): void { const f = this.tinnitusFilter.frequency, hold = strong ? 1.5 : 1.2, ramp = strong ? 1 : 0.6; f.cancelScheduledValues(time); f.setValueAtTime(strong ? 1200 : 1800, time); f.setValueAtTime(strong ? 1200 : 1800, time + hold); f.exponentialRampToValueAtTime(20000, time + hold + ramp); }
    reset(): void {
        this.limiter.clear();
        this.lowHp = false;
        for (const filter of [this.musicFilter, this.ambienceFilter]) {
            filter.frequency.cancelScheduledValues(this.context.currentTime);
            filter.frequency.setValueAtTime(20000, this.context.currentTime);
        }
        this.radioUntil = 0;
        this.megaUntil = 0;
        const time = this.context.currentTime;
        for (const bus of audioBuses) {
            this.buses[bus].gain.cancelScheduledValues(time);
            this.buses[bus].gain.setValueAtTime(1, time);
        }
        this.musicGate.gain.cancelScheduledValues(time);
        this.musicGate.gain.setValueAtTime(1, time);
        this.tinnitusFilter.frequency.cancelScheduledValues(time);
        this.tinnitusFilter.frequency.setValueAtTime(20000, time);
    }
    dispose(): void {
        this.limiter.clear();
        this.master.disconnect();
        this.output.disconnect();
        for (const b of Object.values(this.buses))
            b.disconnect();
        for (const z of this.zones) {
            z.node.disconnect();
            z.gain.disconnect();
        }
    }
}
