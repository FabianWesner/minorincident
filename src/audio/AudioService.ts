import { AudioEventMapper } from './AudioEventMapper';
import { isMega } from '../data/megaPresentation';
import type { Lifecycle } from '../core/Lifecycle';
import type { SimWorld } from '../sim/world/SimWorld';
import type { GameEvent } from '../sim/world/types';
import type { SoundPosition } from '../data/audioEvents';
import { audioCues, eventCues, ambienceTiers, musicLayers, pickupFanfare, stemBank } from '../data/audioCues';
import { AudioGraph, type GraphVoice, type PlayOptions } from './AudioGraph';
import { AudioRegistry } from './AudioRegistry';
import { fromDistricts, surfaceAt, zoneAt, dbGain } from './acoustics';
import { MusicDirector, type MusicIntensity, type MusicTransition } from './MusicDirector';
import { HordeClusters, type HordePoint } from './HordeClusters';
import { AmbienceSchedule } from './AmbienceSchedule';
import { StreamedMusic, scoredLevels } from './StreamedMusic';
import { l5MusicReady, storyMusic } from '../data/musicBeats';
import { isMusicThreat } from './MusicThreat';
import { l5 } from '../data/l5';
import { L1ArcDirector } from './L1Arc';
import { BaseAlarm } from './BaseAlarm';
import { BusRadio } from './BusRadio';
import { l4 } from '../data/l4';
export interface AudioSettings {
    muted: boolean;
    captions: boolean;
    noiseRings: boolean;
    mono: boolean;
    haptics: boolean;
    tinnitus: boolean;
    gore: 'Off' | 'Reduced' | 'Full';
}
export interface CueLog {
    cue: string;
    time: number;
    tick: number;
    sourceId?: number;
    position?: SoundPosition;
    gain: number;
    rate: number;
    voice: number;
    variant: string;
    lowpass: number;
}
interface AudioHost {
    readyForBackground?(): boolean;
    settingsChanged?(patch:Partial<AudioSettings>):void;
    pause(): void;
    resume(): void;
    release(): void;
    offscreen(position: SoundPosition): boolean;
    project(position: SoundPosition): {
        x: number;
        y: number;
    };
}
/** E16 ownership: one context/graph for the game, rebind after sim resets, no simulation decisions.
 * Background behavior ports Bruno setMute, extending it to suspend/pagehide/freeze/interrupted. */
export class AudioService implements Lifecycle {
    readonly settings: AudioSettings = { muted: false, captions: false, noiseRings: false, mono: false, haptics: true, tinnitus: true, gore: 'Full' };
    private readonly eventMapper: AudioEventMapper;
    readonly context: AudioContext;
    readonly graph: AudioGraph;
    readonly registry: AudioRegistry;
    readonly score: StreamedMusic;
    readonly log: CueLog[] = [];
    readonly horde = new HordeClusters();
    music = new MusicDirector('L1');
    readonly captions: {
        text: string;
        expires: number;
    }[] = [];
    private readonly unsubscribers: (() => void)[] = [];
    private readonly loops = new Map<string, GraphVoice>();
    /** L4 military base alarm at the first turn (PO 2026-10-12). */
    readonly alarm: BaseAlarm;
    /** L4 in-bus radio (PO 2026-10-12). */
    readonly radio: BusRadio;
    private readonly individualVocals = new Map<number, GraphVoice>();
    private readonly stemVoices = new Map<string, GraphVoice>();
    private metroAmbientAt = -600;
    private readonly footsteps = new Map<number, {
        x: number;
        z: number;
        distance: number;
    }>();
    private readonly points: HordePoint[] = [];
    private readonly pointPool: HordePoint[] = [];
    private ambience = new AmbienceSchedule(0, 1);
    arc: L1ArcDirector | null = null;
    private generation = 0;
    private level = 'L1';
    private tier = 0;
    private loaded = false;
    private unlocked = false;
    private focused = true;
    private pageAway = false;
    private frozen = false;
    private interrupted = false;
    private background = false;
    private disposed = false;
    private musicEpoch = 0;
    private started = false;
    private starting = false;
    private quietMusicUntil = 0;
    private lastPeakStinger = -Infinity;
    private scheduledTransition: MusicTransition | null = null;
    /** E23: ambience until the first survivor is found, then the existing calm recording. */
    private l5Music = false;
    private readonly captionElement = document.createElement('output');
    private readonly captionStyle = document.createElement('style');
    private readonly ringElement = document.createElement('div');
    private readonly controls = document.createElement('details');
    private readonly pauseElement = document.createElement('div');
    private readonly rings: {
        position: SoundPosition;
        radius: number;
        expires: number;
        element: HTMLElement;
    }[] = [];
    constructor(private readonly world: SimWorld, private readonly host: AudioHost, params: URLSearchParams) {
        this.context = new AudioContext({ latencyHint: 'interactive' });
        // At most four streaming decks can overlap during rapid state changes.
        this.graph = new AudioGraph(this.context, params.get('quality') === 'low' || navigator.maxTouchPoints > 0 ? 'low' : 'high', params.get('audio') === 'muted', 4);
        this.registry = new AudioRegistry(this.context);
        this.alarm = new BaseAlarm(this.graph, text => this.caption(text, undefined, 4));
        // The score runs through its own trim node so the in-bus radio can lower it while it plays.
        const scoreTrim = this.context.createGain(); let trimTarget = 1; scoreTrim.connect(this.graph.buses.music);
        this.score = new StreamedMusic(this.context, scoreTrim);
        this.radio = new BusRadio(this.context, this.graph.buses.vehicles, (factor, time) => { if (factor !== trimTarget) { trimTarget = factor; scoreTrim.gain.setTargetAtTime(factor, time, 0.5); } });
        this.eventMapper = new AudioEventMapper({
            world, context: this.context, graph: this.graph, alarm: this.alarm, settings: this.settings,
            arc: () => this.arc,
            level: () => this.level,
            l5Music: () => this.l5Music,
            available: () => this.available(), offscreen: position => host.offscreen(position),
            play: (id, options, sourceId) => this.play(id, options, sourceId),
            loop: (key, id, options, sourceId) => this.loop(key, id, options, sourceId),
            stopLoop: key => this.stopLoop(key), caption: (text, position, duration) => this.caption(text, position, duration),
            ring: (position, radius) => this.ring(position, radius), haptic: kind => this.haptic(kind),
            musicIntensity: input => this.musicIntensity(input), stinger: (kind, level) => this.stinger(kind, level),
            pickupFanfare: actionId => this.pickupFanfare(actionId),
        });
        try {
            const stored = localStorage.getItem('minor-incident.audio');
            if (stored)
                this.set(JSON.parse(stored));
        }
        catch { /* Storage disabled or an older settings record. */ }
        this.graph.master.gain.value = 0;
    }
    async init(): Promise<void> {
        document.addEventListener('pointerdown', this.gesture);
        document.addEventListener('keydown', this.gesture);
        document.addEventListener('visibilitychange', this.visibility);
        window.addEventListener('blur', this.blur);
        window.addEventListener('focus', this.focus);
        window.addEventListener('pagehide', this.pagehide);
        window.addEventListener('pageshow', this.pageshow);
        document.addEventListener('freeze', this.freeze);
        document.addEventListener('resume', this.thaw);
        this.context.addEventListener('statechange', this.statechange);
        this.mount();
        await this.registry.prepare('L1', false);
        if (this.context.state === 'running' && !this.unlocked)
            await this.context.suspend();
        if (document.hidden || !document.hasFocus())
            await this.away();
    }
    /** Called after each sim load because EventBus.reset removes listeners. No retained old-world references. */
    async load(): Promise<void> {
        this.reset();
        if (!this.world.scenario)
            return;
        this.level = scoredLevels.has(this.world.scenario) ? this.world.scenario : 'L1';
        this.score.level = this.level;
        this.tier = this.world.districts?.composition.tier ?? 0;
        this.graph.map = fromDistricts(this.world.districts);
        this.registry.reset(this.world.seed);
        const generation = this.generation;
        await this.registry.prepare(this.level, false);
        if (this.level === 'L10' || this.world.megaPursuit) await Promise.all(['telegraph', 'music-L6'].map(bank => this.registry.load(bank)));
        // reset() or dispose() ran while the banks were loading: this world is gone, bind nothing.
        if (generation !== this.generation || this.disposed || !this.world.entities.get(1))
            return;
        this.loaded = true;
        this.musicEpoch = this.context.currentTime + 0.02;
        this.music = new MusicDirector(this.level, this.musicEpoch);
        this.ambience = new AmbienceSchedule(this.tier, this.world.seed, this.musicEpoch);
        this.arc = this.level === 'L1' ? new L1ArcDirector(this.world.seed, this.musicEpoch) : null;
        this.eventMapper.beginLevel();
        for (const type of Object.keys(eventCues) as GameEvent['type'][])
            this.unsubscribers.push(this.world.events.on(type, e => this.event(e), 10));
        this.graph.setListener(this.world.entities.get(1)!.transform);
        this.startBedsAndMusic();
        if (this.background)
            this.host.pause();
    }
    /** Decay rebuilds presentation/acoustics in the same world; keep mission cues and score. */
    refreshAcoustics(): void {
        this.graph.map = fromDistricts(this.world.districts);
        const tier = this.world.districts?.composition.tier ?? 0;
        if (tier === this.tier) return;
        this.tier = tier;
        this.ambience = new AmbienceSchedule(tier, this.world.seed, this.context.currentTime);
        const beds = new Set(ambienceTiers[tier].beds.map(id => `bed:${id}`));
        for (const key of this.loops.keys()) if (key.startsWith('bed:') && !beds.has(key)) this.stopLoop(key);
        for (const bed of ambienceTiers[tier].beds)
            this.loop(`bed:${bed}`, `bed.${bed}`, { gain: tier === 5 ? dbGain(-16) : 1 });
    }
    private get hasScore(): boolean { return scoredLevels.has(this.world.scenario ?? ''); }
    private mount(): void {
        this.captionElement.dataset.audioCaptions = '';
        this.captionElement.setAttribute('role', 'status');
        this.captionElement.setAttribute('aria-live', 'polite');
        this.captionElement.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);color:#fff;background:#182333eb;padding:10px;border-radius:8px;font:16px sans-serif;pointer-events:none;white-space:pre-line';
        this.captionElement.hidden = true;
        this.captionStyle.textContent = `[data-audio-captions]{bottom:max(104px,var(--mission-caption-bottom,0px));width:max-content;max-width:90vw;box-sizing:border-box}
            @media(pointer:coarse){[data-audio-captions]{bottom:max(168px,var(--mission-caption-bottom,0px))}}
            @media(pointer:coarse) and (orientation:landscape){[data-audio-captions]{bottom:max(12px,var(--mission-caption-bottom,0px));max-width:calc(100vw - 360px)}}`;
        document.head.append(this.captionStyle);
        this.ringElement.dataset.noiseRings = '';
        this.ringElement.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden';
        if (__QA_HOOKS__) {
            this.controls.hidden = !new URLSearchParams(location.search).has('debug');
            this.controls.dataset.audioControls = '';
            this.controls.style.cssText = 'position:fixed;top:96px;left:12px;background:#182333;color:white;padding:8px;font:14px sans-serif;max-width:250px';
            const summary = document.createElement('summary');
            summary.textContent = 'Sound';
            this.controls.append(summary);
            for (const [key, label] of [['muted', 'Mute'], ['captions', 'Sound captions'], ['noiseRings', 'Noise rings'], ['mono', 'Mono audio'], ['haptics', 'Haptics'], ['tinnitus', 'Tinnitus effect']] as const) {
                const row = document.createElement('label'), input = document.createElement('input');
                row.style.display = 'block';
                input.type = 'checkbox';
                input.name = key;
                input.checked = this.settings[key];
                input.addEventListener('change', () => this.set({ [key]: input.checked }));
                row.append(input, label);
                this.controls.append(row);
            }
            document.body.append(this.controls);
        }
        this.pauseElement.dataset.audioPause = '';
        this.pauseElement.hidden = true;
        this.pauseElement.style.cssText = 'position:fixed;inset:35% 20%;padding:24px;background:#182333ef;color:white;text-align:center;font:20px sans-serif;border-radius:12px';
        const text = document.createElement('p');
        text.textContent = 'Game paused';
        const button = document.createElement('button');
        button.textContent = 'Resume';
        button.addEventListener('click', () => {
            if (!this.background) {
                this.host.resume();
                this.pauseElement.hidden = true;
            }
        });
        this.pauseElement.append(text, button);
        document.body.append(this.ringElement, this.captionElement, this.pauseElement);
    }
    set(patch: Partial<AudioSettings>, persist = true): void {
        const accepted:Partial<AudioSettings>={};
        for(const key of ['muted','captions','noiseRings','mono','haptics','tinnitus']as const)if(typeof patch[key]==='boolean')accepted[key]=patch[key];
        if(patch.gore&&['Off','Reduced','Full'].includes(patch.gore))accepted.gore=patch.gore;
        if (persist) this.host.settingsChanged?.(accepted);
        for (const key of ['muted', 'captions', 'noiseRings', 'mono', 'haptics', 'tinnitus'] as const)
            if (typeof patch[key] === 'boolean')
                this.settings[key] = patch[key]!;
        if (patch.gore && ['Off', 'Reduced', 'Full'].includes(patch.gore))
            this.settings.gore = patch.gore;
        if (patch.mono !== undefined)
            this.graph.setMono(this.settings.mono);
        for (const input of this.controls.querySelectorAll<HTMLInputElement>('input'))
            input.checked = this.settings[input.name as keyof AudioSettings] === true;
        if (!this.settings.captions) {
            this.captions.length = 0;
            this.captionElement.hidden = true;
        }
        if (!this.settings.noiseRings)
            this.clearRings();
        try {
            if (persist) localStorage.setItem('minor-incident.audio', JSON.stringify(this.settings));
        }
        catch { /* Settings still work without persistence. */ }
        if (patch.tinnitus === false) {
            const f = this.graph.tinnitusFilter.frequency;
            f.cancelScheduledValues(this.context.currentTime);
            f.setValueAtTime(20000, this.context.currentTime);
            for (const v of this.graph.active.values())
                if (v.cue === 'tinnitus')
                    v.stop();
        }
        if (patch.muted === undefined)
            return;
        if (this.settings.muted) {
            this.score.pause(); this.radio.pause();
            this.graph.master.gain.cancelScheduledValues(0);
            this.graph.master.gain.value = 0;
            void this.context.suspend();
        }
        else if (this.unlocked && !this.background)
            void this.return();
    }
    private readonly gesture = (): void => {
        if (!document.hidden && document.hasFocus() && !this.pageAway && !this.frozen) {
            this.focused = true;
            this.interrupted = false;
        }
        void this.unlock();
    };
    async unlock(): Promise<void> {
        this.unlocked = true;
        if (this.context.state !== 'running' || this.background)
            await this.return();
        this.startBedsAndMusic();
    }
    private readonly visibility = (): void => {
        if (document.hidden)
            void this.away();
        else
            void this.return();
    };
    private readonly blur = (): void => { this.focused = false; void this.away(); };
    private readonly focus = (): void => { this.focused = true; this.interrupted = false; void this.return(); };
    private readonly pagehide = (): void => { this.pageAway = true; void this.away(); };
    private readonly pageshow = (): void => { this.pageAway = false; this.focused = document.hasFocus(); void this.return(); };
    private readonly freeze = (): void => { this.frozen = true; void this.away(); };
    private readonly thaw = (): void => { this.frozen = false; void this.return(); };
    private readonly statechange = (): void => {
        if ((this.context.state as string) === 'interrupted') {
            this.interrupted = true;
            void this.away();
        }
    };
    private async away(): Promise<void> {
        if (this.disposed)
            return;
        this.background = true;
        this.score.pause(); this.radio.pause();
        this.host.pause();
        this.host.release();
        this.pauseElement.hidden = false;
        const gain = this.graph.master.gain;
        // Remove the entire envelope: a suspended context cannot advance an old ramp.
        gain.cancelScheduledValues(0);
        gain.value = 0;
        for (const v of this.graph.active.values())
            if (!v.source.loop)
                v.stop();
        this.captions.length = 0;
        this.captionElement.hidden = true;
        this.clearRings();
        if (this.context.state !== 'closed')
            await this.context.suspend().catch(() => { });
    }
    private async return(): Promise<void> {
        if (this.disposed || document.hidden || !this.focused || this.pageAway || this.frozen || this.interrupted)
            return;
        this.background = false;
        if (!this.unlocked || this.settings.muted)
            return;
        try {
            await this.context.resume();
        }
        catch {
            return;
        }
        // A new blur may arrive while resume() is pending.
        if (this.background || this.settings.muted) {
            await this.away();
            return;
        }
        const t = this.context.currentTime;
        this.graph.master.gain.cancelScheduledValues(t);
        this.graph.master.gain.setValueAtTime(0, t);
        this.graph.master.gain.linearRampToValueAtTime(2, t + 0.3);
        await this.score.resume(); await this.radio.resume();
    }
    /** The L4 convoy bus plays its radio from the ride until the outbreak alarm (the first turn leaves the plaza phase). */
    private busRadio(): void {
        const s = this.world.missions?.state.l4, id = s?.convoyIds[l4.convoy.vehicles.findIndex(v => v.player)], bus = id === undefined ? undefined : this.world.entities.get(id), me = this.world.entities.get(1);
        this.radio.update(!!s && (s.phase === 'convoy' || s.phase === 'plaza'), !!s?.seated, bus && me ? Math.hypot(bus.transform.x - me.transform.x, bus.transform.z - me.transform.z) : Infinity);
    }
    private available(): boolean { return this.loaded && this.unlocked && !this.background && !this.settings.muted && this.context.state === 'running'; }
    play(id: string, options: PlayOptions = {}, sourceId?: number): GraphVoice | null {
        if (!this.available())
            return null;
        const t = options.time ?? this.context.currentTime, result = this.registry.get(id, t, `${id}:${sourceId ?? 0}`, options.loop);
        if (!result)
            return null;
        if (this.level === 'L5' && result.cue.bus === 'music' && !l5MusicReady(this.world.missions?.state)) return null;
        if (result.cue.bus === 'gore' && this.settings.gore === 'Off')
            return null;
        const gain = (options.gain ?? 1) * result.gain * (result.cue.bus === 'gore' && this.settings.gore === 'Reduced' ? 0.4 : 1);
        const v = this.graph.play(result.cue, result.buffer, { ...options, gain, rate: (options.rate ?? 1) * result.rate });
        if (!v)
            return null;
        this.log.push({ cue: id, variant: result.variant, time: t, tick: this.world.tick, sourceId, position: options.position ? { ...options.position } : undefined, gain: v.gain.gain.value, rate: v.source.playbackRate.value, lowpass: v.filter.frequency.value, voice: v.id });
        if (this.log.length > 10000)
            this.log.splice(0, 1000);
        if (result.cue.caption)
            this.caption(result.cue.caption, options.position, Math.min(4, result.cue.duration + 1));
        return v;
    }
    private readonly reloading = new WeakMap<object, number>();
    private loop(key: string, id: string, options: PlayOptions, sourceId?: number): GraphVoice | null {
        let voice = this.loops.get(key);
        if (voice?.stopped) {
            this.loops.delete(key);
            voice = undefined;
        }
        if (voice && voice.cue !== id) {
            voice.stop();
            this.loops.delete(key);
            voice = undefined;
        }
        if (!voice) {
            voice = this.play(id, { ...options, loop: true }, sourceId) ?? undefined;
            if (voice)
                this.loops.set(key, voice);
        }
        else {
            if (options.position && voice.position)
                Object.assign(voice.position, options.position);
            if (options.velocity)
                voice.velocity = { ...options.velocity };
            voice.baseGain = audioCues[id].gain * (options.gain ?? 1);
            voice.rate = options.rate ?? 1;
            if (!voice.position) { voice.gain.gain.setValueAtTime(voice.baseGain, this.context.currentTime); voice.source.playbackRate.setValueAtTime(voice.rate, this.context.currentTime); }
            if (options.lowpass !== undefined) voice.cutoff = options.lowpass;
            this.graph.updateEmitter(voice);
        }
        return voice ?? null;
    }
    private stopLoop(key: string): void { this.loops.get(key)?.stop(); this.loops.delete(key); }
    private caption(text: string, position?: SoundPosition, duration = 2): void {
        if (!this.settings.captions || !this.available())
            return;
        let direction = '';
        if (position) {
            const p = this.host.project(position);
            direction = p.x < 0.4 ? 'left' : p.x > 0.6 ? 'right' : p.y < 0.4 ? 'ahead' : 'behind';
        }
        this.captions.push({ text: `[${text}${direction ? `, ${direction}` : ''}]`, expires: this.context.currentTime + duration });
        if (this.captions.length > 4)
            this.captions.shift();
        this.showCaptions();
    }
    private showCaptions(): void { this.captionElement.textContent = this.captions.map(c => c.text).join('\n'); this.captionElement.hidden = !this.settings.captions || !this.captions.length; }
    private ring(position: SoundPosition, radius: number): void {
        if (!this.settings.noiseRings)
            return;
        const element = document.createElement('div');
        element.dataset.noiseRing = '';
        element.style.cssText = 'position:absolute;border:2px solid #ffd670;border-radius:50%;transform:translate(-50%,-50%);box-sizing:border-box';
        this.ringElement.append(element);
        this.rings.push({ position: { ...position, y: 0 }, radius, expires: this.context.currentTime + 0.8, element });
        this.updateRings();
    }
    private updateRings(): void {
        const t = this.context.currentTime;
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            if (t >= r.expires) {
                r.element.remove();
                this.rings.splice(i, 1);
                continue;
            }
            const p = this.host.project(r.position), edge = this.host.project({ x: r.position.x + r.radius, z: r.position.z - r.radius });
            const size = Math.abs(edge.x - p.x) * innerWidth * 2;
            r.element.style.left = `${p.x * innerWidth}px`;
            r.element.style.top = `${p.y * innerHeight}px`;
            r.element.style.width = `${size}px`;
            r.element.style.height = `${size * 0.5}px`;
            r.element.style.opacity = String((r.expires - t) / 0.8);
        }
    }
    private clearRings(): void {
        for (const r of this.rings)
            r.element.remove();
        this.rings.length = 0;
    }
    private haptic(kind: 'hit' | 'explosion' | 'crash'): void {
        if (this.settings.haptics && navigator.vibrate)
            navigator.vibrate(kind === 'explosion' ? [40, 30, 80] : kind === 'crash' ? [60, 20, 40] : 35);
    }
    private startBedsAndMusic(): void {
        if (!this.available() || this.started || this.starting || this.host.readyForBackground?.() === false)
            return;
        const bank = stemBank(this.level);
        if (!this.registry.buffers.has('ambience') || bank && !this.registry.buffers.has(bank)) {
            this.starting = true;
            const generation = this.generation;
            void Promise.all(['ambience', ...(bank ? [bank] : [])].map(category => this.registry.load(category))).then(() => {
                if (generation !== this.generation || this.disposed) return;
                this.starting = false; this.startBedsAndMusic();
            }).catch(error => { if (generation === this.generation) { this.starting = false; this.registry.errors.push(String(error)); } });
            return;
        }
        this.started = true;
        this.musicEpoch = this.context.currentTime + 0.02;
        this.music = new MusicDirector(this.level, this.musicEpoch);
        // Long recordings and unused SFX banks must not compete with the level download.
        const generation = this.generation;
        setTimeout(() => { if (generation === this.generation && !this.disposed) void this.registry.preloadLazy(); }, 300);
        if (this.hasScore && this.level !== 'L5') this.score.prepareDanger();
        if (this.hasScore && this.level !== 'L5') void this.score.transition('calm', this.musicEpoch, this.musicEpoch, this.music.bar);
        // L5 has no stems: no layered music exists in the silent city (the calm score starts after the first find, see l5Score).
        for (const layer of this.level === 'L5' || !stemBank(this.level) ? [] : musicLayers) {
            const v = this.play(`music.${this.level === 'L10' ? 'L6' : this.level}.${layer}`, { time: this.musicEpoch, gain: 0, rate: 1, loop: true });
            if (v)
                this.stemVoices.set(layer, v);
        }
        for (const bed of this.level === 'L6' ? ['hum'] : ambienceTiers[this.tier].beds)
            this.loop(`bed:${bed}`, `bed.${bed}`, { gain: this.tier === 5 ? dbGain(-16) : 1 });
    }
    /** L5 music follows saved survivor state, so retries and checkpoint restores obey the same rule. */
    private l5Score(): void {
        if (!this.started) return;
        if (!l5MusicReady(this.world.missions?.state)) {
            if (this.l5Music) {
                this.score.reset();
                for (const voice of this.graph.active.values()) if (audioCues[voice.cue]?.bus === 'music') voice.stop();
            }
            this.l5Music = false;
            return;
        }
        if (this.l5Music) { this.score.update(); return; }
        this.l5Music = true;
        // An event cue must start now, rather than waiting for the next musical bar.
        if (this.hasScore) void this.score.transition('calm', this.context.currentTime, this.musicEpoch, this.music.bar, true);
    }

    private musicIntensity(input: MusicIntensity): void {
        if (!this.started) return;
        if (this.level === 'L5') return;
        const t = this.context.currentTime;
        this.score.update();
        const story = storyMusic(this.level, this.world.missions?.state);
        const band = this.world.megaPursuit?.band();
        const minimum = Math.max(story.minimum, input.minimum ?? 0, band === 'near' ? .5 : band ? .25 : 0, input.phase === 'boss' ? .5 : input.phase === 'defend' || input.phase === 'timer' ? .25 : 0);
        this.music.update(t, { ...input, ...(input.danger !== undefined || story.minimum > 0 || band ? { minimum } : {}), incident: this.eventMapper.incident, complete: this.eventMapper.complete || input.complete || this.world.l7Departure?.cinematic || !!this.world.missions?.state.states['cure-released'] });
        // A dense fight escalates within the combat state (also when a story floor already holds it there).
        if (this.music.peak !== this.score.peak) {
            this.score.setPeak(this.music.peak);
            if (this.music.peak && t - this.lastPeakStinger > 20) { this.lastPeakStinger = t; this.stinger('elite', this.level); }
        }
        const transition = this.music.pending ?? this.music.transitions.at(-1) ?? { time: t, state: this.music.state, layers: this.music.layers };
        // A transient alert can cancel the first pending change before its bar.
        // Restore the committed state even when the director has no history yet.
        if (!this.scheduledTransition || transition.state !== this.scheduledTransition.state || transition.layers.join() !== this.scheduledTransition.layers.join()) {
            this.scheduledTransition = transition;
            if (this.hasScore) void this.score.transition(transition.state, transition.time, this.musicEpoch, this.music.bar, transition.immediate);
            for (const [layer, v] of this.stemVoices) {
                const at = Math.max(t, transition.time);
                v.gain.gain.cancelScheduledValues(at);
                v.gain.gain.setValueAtTime(v.gain.gain.value, at);
                // The recording carries the theme. Add filtered recorded rhythm/dread accents only.
                v.gain.gain.linearRampToValueAtTime(layer !== 'base' && transition.layers.includes(layer as typeof musicLayers[number]) ? audioCues[v.cue].gain * (this.music.peak ? 0.5 : 0.18) : 0, at + (transition.immediate ? 0.8 : 2));
            }
        }
    }
    private stinger(kind: string, level: string): void {
        if (this.level === 'L5' && !this.l5Music) return;
        const t = this.context.currentTime;
        if (kind === 'twist') {
            const at = this.graph.twist(t);
            this.quietMusicUntil = at;
            this.play('stinger.twist', { time: at });
        }
        else
            this.play(kind === 'extraction' && level === 'L1' ? 'l1.outro.sting' : kind === 'extraction' && level === 'L6' ? 'stinger.dawn' : `stinger.${kind === 'extraction' ? 'complete' : kind}`);
    }
    /** PO 10-13: a short per-weapon fanfare (data table pickupFanfareByAction), the score ducked under it. One shared key, so quick double pickups do not pile up. */
    private pickupFanfare(actionId: string): void {
        if (this.level === 'L5' && !this.l5Music) { this.play('ui.pickup'); return; }
        const id = `pickup.fanfare.${pickupFanfare(actionId)}`, voice = this.play(id, {}, 0);
        if (voice) this.graph.duckMusic(this.context.currentTime, Math.max(0.4, audioCues[id].duration - 0.6));
    }
    /** Event → cue adapter shared by producer events and lab tests. */
    event(event: GameEvent): void {
        if (event.type === 'sim.tick') this.update();
        else this.eventMapper.event(event);
    }
    update(): void {
        if (!this.available())
            return;
        this.eventMapper.advance();
        this.startBedsAndMusic();
        this.alarm.update(this.context.currentTime);
        this.busRadio();
        if (this.level === 'L5') this.l5Score();
        const player = this.world.entities.get(1);
        if (!player)
            return;
        const t = this.context.currentTime;
        const front = this.world.missions?.state.cureFront;
        if (front) this.loop('cure:ventilation', 'generator.idle', { position: { ...front.fronts[0], y: 2 }, gain: .55, lowpass: 1800 });
        else this.stopLoop('cure:ventilation');
        const weather = this.world.weather;
        if (weather) {
            this.graph.setWeather(weather.kind);
            if (weather.rain > 0) this.loop('weather:rain', 'weather.rain', { gain: weather.rain });
            else this.stopLoop('weather:rain');
            let nearest: { x: number; y: number; z: number } | null = null, distance = 15;
            if (weather.rain) for (const car of this.world.vehicles?.cars.values() ?? []) { const at = car.entity.transform, d = Math.hypot(at.x - player.transform.x, at.z - player.transform.z); if (d < distance) { distance = d; nearest = at; } }
            if (nearest) this.loop('weather:rain-metal', 'weather.rain-metal', { position: nearest, gain: weather.rain });
            else this.stopLoop('weather:rain-metal');
        }
        // Mounted minigun: the barrel whir follows the live spin, so spin-up and spin-down are heard (0.5 s up, 1.2 s down).
        const gun = this.world.mountedGun;
        if (gun && gun.gun.spin > 0.02) {
            const whir = this.loop('minigun:whir', 'weapon.minigun-whir', { position: gun.placement, gain: 0.3 + gun.gun.spin * 0.7 });
            if (whir) { whir.rate = 0.45 + gun.gun.spin * 1.35; whir.gain.gain.value = 0.15 + gun.gun.spin * 0.85; }
        }
        else this.stopLoop('minigun:whir');
        // Reload: the player's slot starts its reload this tick -> magazine sound (rifles, SMGs and MGs use the long rifle reload).
        for (const side of player.weapons ? [player.weapons.LEFT, player.weapons.RIGHT] : [])
            for (const slot of side.rack) {
                const was = this.reloading.get(slot) ?? 0;
                if (slot.reloadUntil && !was) this.play(/rifle|machine-gun|army-mg|smg/.test(slot.id) ? 'weapon.reload-rifle' : 'weapon.reload', { position: player.transform, gain: 0.8 }, 1);
                this.reloading.set(slot, slot.reloadUntil);
            }
        if (this.world.tick % 6 === 0) {
            const previous = this.world.previousPlayer;
            if (previous) {
                this.graph.listenerVelocity.x = (player.transform.x - previous.x) * 60;
                this.graph.listenerVelocity.z = (player.transform.z - previous.z) * 60;
            }
            this.graph.setListener(player.transform);
            for (const v of this.graph.active.values())
                this.graph.updateEmitter(v);
            for (const p of this.world.combat?.projectiles ?? [])
                if (p.attack.def.id === 'weapon.rocket-launcher')
                    this.loop(`rocket:${p.attack.id}`, 'weapon.rocket-whoosh', { position: p, velocity: { x: p.attack.aim.x * p.attack.def.projectile!.speed, z: p.attack.aim.z * p.attack.def.projectile!.speed } }, p.attack.id);
            for (const key of this.loops.keys())
                if (key.startsWith('rocket:') && !this.world.combat?.projectiles.some(p => key === `rocket:${p.attack.id}`))
                    this.stopLoop(key);
        }
        let alerted = 0, danger = t < this.eventMapper.attackMusicUntil;
        if (this.world.tick % 12 === 0) {
            this.points.length = 0;
            let index = 0;
            for (const e of this.world.entities.iterate())
                if (e.infected && !isMega(e) && e.health.current > 0) {
                    let p = this.pointPool[index];
                    if (!p) {
                        p = { id: 0, x: 0, z: 0 };
                        this.pointPool[index] = p;
                    }
                    index++;
                    p.id = e.id;
                    p.x = e.transform.x;
                    p.z = e.transform.z;
                    this.points.push(p);
                    if (isMusicThreat(e, player.transform, p => !this.host.offscreen(p), (a, b) => this.world.infected?.l1?.lineOfSight(a, b) ?? this.world.combat?.query.visible(a, b) ?? true)) {
                        danger = true; alerted++;
                    }
                }
            this.horde.update(this.points, player.transform);
            let audibleCount = 0;
            for (const c of this.horde.clusters)
                audibleCount += c.count;
            for (const c of this.horde.clusters)
                this.loop(`horde:${c.id}`, `horde.loop.${surfaceAt(this.graph.map, c)}`, { position: c, gain: this.horde.gain(audibleCount) }, c.id + 100000);
            for (const key of this.loops.keys())
                if (key.startsWith('horde:') && !this.horde.clusters.some(c => key === `horde:${c.id}`))
                    this.stopLoop(key);
            for (const [id, v] of this.individualVocals)
                if (v.stopped || !this.horde.nearby.some(p => p.id === id)) {
                    v.stop();
                    this.individualVocals.delete(id);
                }
            for (const p of this.horde.nearby)
                if (!this.individualVocals.has(p.id) && this.individualVocals.size < 4) {
                    const v = this.play('infected.vocal', { position: p }, p.id);
                    if (v)
                        this.individualVocals.set(p.id, v);
                }
            this.musicIntensity(this.eventMapper.externalIntensity ? { ...this.eventMapper.externalIntensity, ...(danger ? { danger: true } : {}) } : { alerted, danger });
        }
        for (const e of this.world.entities.iterate())
            if (e.survivor && e.health.current > 0) {
                const p = e.transform;
                let prev = this.footsteps.get(e.id);
                if (!prev) {
                    prev = { x: p.x, z: p.z, distance: 0 };
                    this.footsteps.set(e.id, prev);
                }
                const d = Math.hypot(p.x - prev.x, p.z - prev.z);
                prev.x = p.x;
                prev.z = p.z;
                if (d < 1)
                    prev.distance += d;
                if (prev.distance >= 0.85) {
                    prev.distance %= 0.85;
                    this.event({ type: 'footstep', tick: this.world.tick, sourceId: e.id, position: p, actor: 'survivor' });
                }
            }
        if (this.arc)
            this.updateArc(player.transform, t);
        const metro=this.world.missions?.state.l6;
        if(metro?.phase==='shelter'&&this.world.tick-this.metroAmbientAt>=600){this.metroAmbientAt=this.world.tick;this.play('dialogue.radio',{position:{x:-4,z:2},gain:.15,lowpass:1800});}
        const ambient = metro || this.arc && this.arc.phase !== 'calm' ? null : this.ambience.update(t);
        if (ambient)
            this.play(ambient.cue, { position: { x: player.transform.x + ambient.x, z: player.transform.z + ambient.z }, gain: this.level === 'L5' ? dbGain(l5.audio.quietDb) : 1 });
        let changed = false;
        for (let i = this.captions.length - 1; i >= 0; i--)
            if (this.captions[i].expires <= t) {
                this.captions.splice(i, 1);
                changed = true;
            }
        if (changed)
            this.showCaptions();
        if (this.rings.length)
            this.updateRings();
        this.graph.lowHealth(player.health.current / player.health.max < 0.25);
        if (player.health.current / player.health.max < 0.25 && t >= this.quietMusicUntil) {
            this.loop('heartbeat', 'stinger.low-hp', { gain: 0.3 });
        }
        else
            this.stopLoop('heartbeat');
    }
    /** L1 v2 sound arc: calm beds fade (-12 dB in 3 s) after the blast, chaos layer follows the infected count. */
    private updateArc(listener: SoundPosition, t: number): void {
        const arc = this.arc!, zone = zoneAt(this.graph.map, listener);
        const frame = arc.update(t, this.points.length, zone.startsWith('interior') && arc.phase === 'chaos');
        if (arc.phase !== 'calm') this.eventMapper.markIncident();
        const bedScale = frame.calmGain;
        this.loop('arc:chatter', 'l1.calm.chatter', { gain: bedScale });
        for (const bed of ambienceTiers[this.tier].beds) {
            const v = this.loops.get(`bed:${bed}`);
            if (v && !v.stopped) { v.baseGain = audioCues[v.cue].gain * (this.tier === 5 ? dbGain(-16) : 1) * bedScale; this.graph.updateEmitter(v); v.gain.gain.setValueAtTime(v.baseGain, t); }
        }
        const chatter = this.loops.get('arc:chatter');
        if (chatter) chatter.gain.gain.setValueAtTime(audioCues['l1.calm.chatter'].gain * bedScale, t);
        if (frame.chaosGain > 0.02) {
            const v = this.loop('arc:panic', 'l1.chaos.panic', { gain: frame.chaosGain });
            if (v) v.gain.gain.setValueAtTime(audioCues['l1.chaos.panic'].gain * frame.chaosGain, t);
        }
        else this.stopLoop('arc:panic');
        if (frame.muffled) this.loop('arc:hush', 'l1.interior.hush', {});
        else this.stopLoop('arc:hush');
        this.graph.ambienceFilter.frequency.setTargetAtTime(frame.muffled ? 900 : 20000, t, 0.3);
        if (frame.ringing) // Spec beat 5: ~1.2 s ringing + low-pass for everyone; the tinnitus setting only makes it longer/stronger.
            this.graph.tinnitus(t, this.settings.tinnitus);
        for (const p of frame.plays) {
            let position: SoundPosition | undefined;
            if (p.bearing !== undefined && p.distance !== undefined)
                position = { x: listener.x + Math.cos(p.bearing) * p.distance, z: listener.z + Math.sin(p.bearing) * p.distance };
            this.play(p.cue, { position, gain: p.gain, rate: p.rate, lowpass: p.lowpass });
            if (p.cue === 'l1.blast') this.haptic('explosion');
        }
    }
    snapshot() { return { state: this.context.state, unlocked: this.unlocked, background: this.background, muted: this.settings.muted, master: this.graph.master.gain.value, output: this.graph.output.gain.value, voices: this.graph.active.size + this.score.voices, voiceLimit: this.graph.limiter.limit, music: { level: this.level, story: storyMusic(this.level, this.world.missions?.state), state: this.music.state, streamed: this.score.snapshot(), radio: { level: this.radio.level, playing: this.radio.playing }, paused: this.context.state !== 'running', position: this.started ? Math.max(0, this.context.currentTime - this.musicEpoch) : 0, layers: this.music.layers, score: this.music.score, transitions: this.music.transitions }, buses: Object.fromEntries(Object.entries(this.graph.buses).map(([k, v]) => [k, v.gain.value])), errors: [...this.registry.errors, ...this.score.errors], cues: [...this.log], clusters: this.horde.clusters.map(c => ({ ...c })), captions: this.captions.map(c => c.text) }; }
    reset(): void {
        this.generation++;
        for (const off of this.unsubscribers)
            off();
        this.unsubscribers.length = 0;
        this.alarm.stop();
        this.graph.reset();
        this.score.reset(); this.radio.reset();
        this.loops.clear();
        this.stemVoices.clear();
        this.individualVocals.clear();
        this.metroAmbientAt=-600;this.footsteps.clear();
        this.log.length = 0;
        this.captions.length = 0;
        this.clearRings();
        this.captionElement.hidden = true;
        this.started = false;
        this.starting = false;
        this.loaded = false;
        this.scheduledTransition = null;
        this.eventMapper.reset();
        this.quietMusicUntil = 0;
        this.lastPeakStinger = -Infinity;
        this.l5Music = false;
    }
    dispose(): void { this.disposed = true; this.reset(); this.score.dispose(); this.radio.dispose(); document.removeEventListener('pointerdown', this.gesture); document.removeEventListener('keydown', this.gesture); document.removeEventListener('visibilitychange', this.visibility); window.removeEventListener('blur', this.blur); window.removeEventListener('focus', this.focus); window.removeEventListener('pagehide', this.pagehide); window.removeEventListener('pageshow', this.pageshow); document.removeEventListener('freeze', this.freeze); document.removeEventListener('resume', this.thaw); this.context.removeEventListener('statechange', this.statechange); this.graph.dispose(); void this.context.close(); this.captionElement.remove(); this.captionStyle.remove(); this.ringElement.remove(); this.controls.remove(); this.pauseElement.remove(); }
}
