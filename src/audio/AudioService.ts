import { action } from '../data/actions/catalog';
import type { Lifecycle } from '../core/Lifecycle';
import type { SimWorld } from '../sim/world/SimWorld';
import type { GameEvent } from '../sim/world/types';
import type { SoundPosition } from '../data/audioEvents';
import { audioCues, noiseCues, eventCues, telegraphCues, ambienceTiers, musicLayers } from '../data/audioCues';
import { AudioGraph, type GraphVoice, type PlayOptions } from './AudioGraph';
import { AudioRegistry } from './AudioRegistry';
import { fromDistricts, surfaceAt, zoneAt, dbGain } from './acoustics';
import { MusicDirector, type MusicIntensity, type MusicTransition } from './MusicDirector';
import { HordeClusters, type HordePoint } from './HordeClusters';
import { AmbienceSchedule } from './AmbienceSchedule';
import { StreamedMusic } from './StreamedMusic';
import { storyMusic } from '../data/musicBeats';
import { isMusicThreat } from './MusicThreat';
import { l1v2 } from '../data/l1v2';
import { humanInfected } from '../data/infected';
import { L1ArcDirector, type ArcFrame } from './L1Arc';
/** Recorded infected voice cues (alert, hurt, death) are human performances: animals keep their own telegraphs. */
const voicedInfected = new Set(humanInfected.map(d => d.id));
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
    private readonly individualVocals = new Map<number, GraphVoice>();
    private readonly stemVoices = new Map<string, GraphVoice>();
    private readonly footsteps = new Map<number, {
        x: number;
        z: number;
        distance: number;
    }>();
    private readonly points: HordePoint[] = [];
    private readonly pointPool: HordePoint[] = [];
    private ambience = new AmbienceSchedule(0, 1);
    arc: L1ArcDirector | null = null;
    private arcFrame: ArcFrame | null = null;
    private generation = 0;
    private ambienceDuckUntil = 0;
    private readonly corgiWarnAt = new Map<string, number>();
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
    private attackMusicUntil = 0;
    private lastDamageTick = -1000;
    private lastDamage = 0;
    private scheduledTransition: MusicTransition | null = null;
    private externalIntensity: MusicIntensity | null = null;
    private vehicleSpeed = 0;
    private incident = false;
    private complete = false;
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
        this.score = new StreamedMusic(this.context, this.graph.buses.music);
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
        this.level = /^L[1-6]$/.test(this.world.scenario) ? this.world.scenario : 'L1';
        this.score.level = this.level;
        this.tier = this.world.districts?.composition.tier ?? 0;
        this.graph.map = fromDistricts(this.world.districts);
        this.registry.reset(this.world.seed);
        const generation = this.generation;
        await this.registry.prepare(this.level, false);
        // reset() or dispose() ran while the banks were loading: this world is gone, bind nothing.
        if (generation !== this.generation || this.disposed || !this.world.entities.get(1))
            return;
        this.loaded = true;
        this.musicEpoch = this.context.currentTime + 0.02;
        this.music = new MusicDirector(this.level, this.musicEpoch);
        this.ambience = new AmbienceSchedule(this.tier, this.world.seed, this.musicEpoch);
        this.arc = this.level === 'L1' ? new L1ArcDirector(this.world.seed, this.musicEpoch) : null;
        this.arcFrame = null;
        this.corgiWarnAt.clear();
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
    private get hasScore(): boolean { return /^L[1-6]$/.test(this.world.scenario ?? ''); }
    private mount(): void {
        this.captionElement.dataset.audioCaptions = '';
        this.captionElement.setAttribute('role', 'status');
        this.captionElement.setAttribute('aria-live', 'polite');
        this.captionElement.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);color:#fff;background:#182333eb;padding:10px;border-radius:8px;font:16px sans-serif;pointer-events:none;white-space:pre-line';
        this.captionElement.hidden = true;
        this.captionStyle.textContent = `[data-audio-captions]{bottom:104px;width:max-content;max-width:90vw;box-sizing:border-box}
            @media(pointer:coarse){[data-audio-captions]{bottom:168px}}
            @media(pointer:coarse) and (orientation:landscape){[data-audio-captions]{bottom:12px;max-width:calc(100vw - 360px)}}`;
        document.head.append(this.captionStyle);
        this.ringElement.dataset.noiseRings = '';
        this.ringElement.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden';
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
        document.body.append(this.ringElement, this.captionElement, this.controls, this.pauseElement);
    }
    set(patch: Partial<AudioSettings>): void {
        const accepted:Partial<AudioSettings>={};
        for(const key of ['muted','captions','noiseRings','mono','haptics','tinnitus']as const)if(typeof patch[key]==='boolean')accepted[key]=patch[key];
        if(patch.gore&&['Off','Reduced','Full'].includes(patch.gore))accepted.gore=patch.gore;
        this.host.settingsChanged?.(accepted);
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
            localStorage.setItem('minor-incident.audio', JSON.stringify(this.settings));
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
            this.score.pause();
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
        this.score.pause();
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
        await this.score.resume();
    }
    private available(): boolean { return this.loaded && this.unlocked && !this.background && !this.settings.muted && this.context.state === 'running'; }
    play(id: string, options: PlayOptions = {}, sourceId?: number): GraphVoice | null {
        if (!this.available())
            return null;
        const t = options.time ?? this.context.currentTime, result = this.registry.get(id, t, `${id}:${sourceId ?? 0}`, options.loop);
        if (!result)
            return null;
        if (result.cue.bus === 'gore' && this.settings.gore === 'Off')
            return null;
        const gain = (options.gain ?? 1) * result.gain * (result.cue.bus === 'gore' && this.settings.gore === 'Reduced' ? 0.4 : 1);
        const v = this.graph.play(result.cue, result.buffer, { ...options, gain, rate: (options.rate ?? 1) * result.rate });
        if (!v)
            return null;
        this.log.push({ cue: id, variant: result.variant, time: t, tick: this.world.tick, sourceId, position: options.position ? { ...options.position } : undefined, gain: v.gain.gain.value, rate: v.source.playbackRate.value, voice: v.id });
        if (this.log.length > 10000)
            this.log.splice(0, 1000);
        if (result.cue.caption)
            this.caption(result.cue.caption, options.position, Math.min(4, result.cue.duration + 1));
        return v;
    }
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
        this.captions.push({ text: `[${text}${direction ? ` — ${direction}` : ''}]`, expires: this.context.currentTime + duration });
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
        if (!this.registry.buffers.has('ambience') || !this.registry.buffers.has(`music-${this.level}`)) {
            this.starting = true;
            const generation = this.generation;
            void Promise.all(['ambience', `music-${this.level}`].map(category => this.registry.load(category))).then(() => {
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
        if (this.hasScore) this.score.prepareDanger();
        if (this.hasScore) void this.score.transition('calm', this.musicEpoch, this.musicEpoch, this.music.bar);
        for (const layer of musicLayers) {
            const v = this.play(`music.${this.level}.${layer}`, { time: this.musicEpoch, gain: 0, rate: 1, loop: true });
            if (v)
                this.stemVoices.set(layer, v);
        }
        for (const bed of ambienceTiers[this.tier].beds)
            this.loop(`bed:${bed}`, `bed.${bed}`, { gain: this.tier === 5 ? dbGain(-16) : 1 });
    }
    private musicIntensity(input: MusicIntensity): void {
        if (!this.started) return;
        const t = this.context.currentTime;
        this.score.update();
        const story = storyMusic(this.level, this.world.missions?.state);
        this.music.update(t, { ...input, ...(input.danger !== undefined || story.minimum > 0 ? { minimum: story.minimum } : {}), incident: this.incident, complete: this.complete });
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
                v.gain.gain.linearRampToValueAtTime(layer !== 'base' && transition.layers.includes(layer as typeof musicLayers[number]) ? audioCues[v.cue].gain * 0.18 : 0, at + (transition.immediate ? 0.8 : 2));
            }
        }
    }
    private stinger(kind: string, level: string): void {
        const t = this.context.currentTime;
        if (kind === 'twist') {
            const at = this.graph.twist(t);
            this.quietMusicUntil = at;
            this.play('stinger.twist', { time: at });
        }
        else
            this.play(kind === 'extraction' && level === 'L1' ? 'l1.outro.sting' : kind === 'extraction' && level === 'L6' ? 'stinger.dawn' : `stinger.${kind === 'extraction' ? 'complete' : kind}`);
    }
    /** Event → cue adapter. Real producer events and lab tests go through this identical path. */
    event(event: GameEvent): void {
        if (!this.available())
            return;
        const t = this.context.currentTime;
        const source = 'sourceId' in event ? event.sourceId : 'id' in event && typeof event.id === 'number' ? event.id : undefined;
        const entity = source === undefined ? undefined : this.world.entities.get(source);
        const position = 'position' in event ? event.position : entity?.transform;
        if (event.type.startsWith('l1.')) {
            this.arc?.event(event.type, t);
            return;
        }
        if (event.type === 'sim.tick') {
            this.update();
            return;
        }
        if (event.type === 'civilian.state') {
            if (event.state === 'bitten') this.play('civilian.scream', { position, gain: .4 }, source);
            if (event.state === 'down') this.play('bark.female.hurt', { position, gain: .4 }, source);
            if (event.state === 'rising') this.play('civilian.transform', { position, gain: .45 }, source);
            return; // One-shots only: keep the collapse quiet between state reactions.
        }
        if (event.type === 'telegraph') {
            const special = 'special' in event ? event.special : event.kind;
            const id = telegraphCues[entity?.archetype ?? ''] ?? telegraphCues[special] ?? telegraphCues[`infected.${special}`] ?? eventCues.telegraph;
            this.play(id, { position, offscreen: position ? this.host.offscreen(position) : false }, source);
            return;
        }
        if (event.type === 'noise') {
            const id = audioCues[`action.${event.actionId}`] ? `action.${event.actionId}` : noiseCues[event.kind as keyof typeof noiseCues] ?? `action.${event.actionId}`;
            this.play(id, { position: event.position, gain: event.loudness, offscreen: audioCues[id]?.bus === 'telegraph' && this.host.offscreen(event.position) }, source);
            const zone = zoneAt(this.graph.map, event.position);
            if (event.kind === 'ranged')
                this.play(`tail.${zone.startsWith('interior') || zone === 'tunnel' ? 'interior' : zone === 'park' || zone === 'suburb-open' ? 'open' : 'street'}`, { position: event.position }, source);
            if (source === 1)
                this.ring(event.position, event.radius);
            return;
        }
        if (event.type === 'combat.attack') {
            if (source === 1) {
                this.attackMusicUntil = t + 0.2;
                this.musicIntensity({ alerted: 0, danger: true });
            }
            if (!['ranged', 'throwable'].includes(action(event.actionId).category))
                this.play(`action.${event.actionId}`, { position, rate: event.style === 'roundhouse' ? .62 : event.actionId === 'weapon.bat' ? .8 : event.actionId === 'weapon.crowbar' ? .95 : event.actionId === 'weapon.machete' ? 1.3 : event.actionId === 'weapon.kick' ? .72 : 1.15 }, source);
            return;
        }
        if (event.type === 'footstep') {
            if (event.actor === 'infected')
                return;
            const surface = event.surface ?? surfaceAt(this.graph.map, event.position);
            this.play(`footstep.${event.actor}.${surface}`, { position: event.position }, source);
            return;
        }
        if (event.type === 'light.generator') {
            if (event.phase === 'stop')
                this.stopLoop(`generator:${source}`);
            else if (event.phase === 'idle')
                this.loop(`generator:${source}`, 'generator.idle', { position }, source);
            else
                this.play(`generator.${event.phase}`, { position }, source);
            return;
        }
        if (event.type === 'light.lamp') {
            if (event.phase === 'off' || event.phase === 'break')
                this.stopLoop(`lamp:${source}`);
            if (event.phase === 'hum')
                this.loop(`lamp:${source}`, 'lamp.hum', { position }, source);
            else if (event.phase !== 'off')
                this.play(`lamp.${event.phase}`, { position }, source);
            return;
        }
        if (event.type === 'light.power') {
            this.play(`lamp.power-${event.on ? 'on' : 'off'}`, { position }, source);
            return;
        }
        if (event.type === 'prop.impact') {
            this.play(`prop.${event.material}`, { position, gain: Math.min(2, Math.max(0.08, event.impulse / 20)) }, source);
            return;
        }
        if (event.type === 'prop.motion') {
            if (event.mode === 'stop') {
                this.stopLoop(`prop:${source}`);
            }
            else
                this.loop(`prop:${source}`, `prop.${event.mode}`, { position, gain: Math.min(1, event.speed / 3), rate: 0.7 + Math.min(1, event.speed / 8) }, source);
            return;
        }
        if (event.type === 'barricade.sound') {
            this.play(`prop.${event.phase === 'hit' ? 'creak' : event.phase}`, { position, rate: event.phase === 'hit' ? 1 + Math.max(0, 1 - event.hp / Math.max(1, event.maxHp)) * 0.7 : 1 }, source);
            return;
        }
        if (event.type === 'explosion.beat') {
            this.play(`explosion.${event.beat}`, { position, gain: { small: 0.5, medium: 0.75, large: 1, mega: 1.4 }[event.size] }, source);
            if (event.beat === 'crack') {
                this.haptic('explosion');
                if (event.size === 'mega' || event.size === 'large')
                    this.graph.duck('mega', t, 0.8);
                if (this.settings.tinnitus && position && Math.hypot(position.x - this.graph.listener.x, position.z - this.graph.listener.z) < 4) {
                    this.graph.tinnitus(t);
                    this.play('tinnitus');
                }
            }
            return;
        }
        if (event.type === 'vehicle.sound') {
            if (event.phase === 'stop') {
                this.vehicleSpeed = 0;
                for (const suffix of ['low', 'high', 'sputter', 'fire', 'tires'])
                    this.stopLoop(`vehicle:${source}:${suffix}`);
                this.stopLoop(`siren:${source}`);
                return;
            }
            if (event.phase === 'engine') {
                this.vehicleSpeed = event.speed;
                const rpm = Math.max(0, Math.min(1, event.rpm / 7000));
                this.loop(`vehicle:${source}:low`, 'vehicle.engine-low', { position, velocity: event.velocity, rate: 0.6 + rpm, gain: 1 - rpm }, source);
                this.loop(`vehicle:${source}:high`, 'vehicle.engine-high', { position, velocity: event.velocity, rate: 0.6 + rpm, gain: rpm }, source);
                if (event.health < 0.4)
                    this.loop(`vehicle:${source}:sputter`, 'vehicle.sputter', { position }, source);
                else
                    this.stopLoop(`vehicle:${source}:sputter`);
                if (event.health < 0.15)
                    this.loop(`vehicle:${source}:fire`, 'vehicle.fire', { position }, source);
                else
                    this.stopLoop(`vehicle:${source}:fire`);
                if (event.speed > 0.2)
                    this.loop(`vehicle:${source}:tires`, `footstep.tires.${event.surface ?? surfaceAt(this.graph.map, event.position)}`, { position, gain: Math.min(1, event.speed / 15) }, source);
                else
                    this.stopLoop(`vehicle:${source}:tires`);
            }
            else if (event.phase === 'siren')
                this.loop(`siren:${source}`, 'vehicle.siren', { position }, source);
            else {
                this.play(`vehicle.${event.phase}`, { position, gain: event.phase === 'crash' ? Math.min(2, (event.impulse ?? 20) / 20) : 1 }, source);
                if (event.phase === 'crash')
                    this.haptic('crash');
            }
            return;
        }
        if (event.type === 'diegetic') {
            const key = `diegetic:${source}`;
            if (event.stop) {
                this.stopLoop(key);
                return;
            }
            if (event.kind === 'emergency') {
                this.graph.duck('radio', t, 3);
                this.play('dialogue.radio', { position, lowpass: event.inCar ? 2400 : 20000 }, source);
                return;
            }
            const warped = event.level === 'L6' && ['jukebox', 'ice-cream'].includes(event.kind);
            this.loop(key, `diegetic.${event.kind}${warped ? '.warped' : ''}`, { position, lowpass: event.inCar ? 2400 : 20000, rate: warped ? 0.92 : 1 }, source);
            return;
        }
        if (event.type === 'dialogue' || event.type === 'dialogue.line') {
            const duration = 'duration' in event ? event.duration ?? 3 : 3;
            this.graph.duck('radio', t, duration);
            this.play('dialogue.radio', { position });
            this.caption(event.text, position, duration);
            return;
        }
        if (event.type === 'music.intensity') {
            this.externalIntensity = event;
            this.musicIntensity(event);
            return;
        }
        if (event.type === 'music.stinger') {
            this.stinger(event.kind, event.level);
            return;
        }
        if (event.type === 'corgi.warn') {
            // Stages come rate-limited from the sim (bark every l1v2.corgi.barkIntervalS); keep a matching audio-side floor.
            const stage = event.stage, gap = stage === 'bark' ? l1v2.corgi.barkIntervalS - 0.2 : 1, last = this.corgiWarnAt.get(stage) ?? -Infinity;
            if (t - last < gap)
                return;
            this.corgiWarnAt.set(stage, t);
            const [cue, gain, rate] = stage === 'bark' ? ['corgi.warning', 1, 1] : stage === 'growl' ? ['corgi.warning', 0.7, 0.62] : stage === 'stiffen' ? ['corgi.pant', 0.6, 0.8] : ['corgi.pant', 0.5, 1] as const;
            this.play(cue, { position, gain, rate }, source);
            return;
        }
        if (event.type === 'corgi.sound') {
            this.play(`corgi.${event.kind}`, { position }, source);
            return;
        }
        if (event.type === 'survivor.bark') {
            this.play(`bark.${event.variant}.${event.kind}`, { position }, source);
            return;
        }
        if (event.type === 'gore.sound') {
            this.play(`gore.${event.kind}`, { position });
            return;
        }
        if (event.type === 'player.damaged') {
            this.lastDamageTick = event.tick;
            this.lastDamage = event.amount;
            const p = this.world.entities.get(event.id);
            this.play(`bark.${p?.survivor?.variant ?? 'female'}.hurt`);
            if (event.amount >= 20)
                this.haptic('hit');
            return;
        }
        if (event.type === 'combat.exploded') {
            this.haptic('explosion');
            if (this.settings.tinnitus && position && Math.hypot(position.x - this.graph.listener.x, position.z - this.graph.listener.z) < 4) {
                this.play('tinnitus');
                this.graph.tinnitus();
            }
        }
        if (event.type === 'level.completed') {
            this.complete = true;
            this.musicIntensity({ alerted: 0 });
            this.stinger('extraction', event.id);
            return;
        }
        if (event.type === 'combat.hit' || event.type === 'combat.kill') {
            const target = this.world.entities.get(event.targetId);
            if (target?.faction === 'environment' || target?.vehicle) return;
            if (target?.infected && voicedInfected.has(target.archetype)) {
                if (event.type === 'combat.kill')
                    this.play('infected.death', { position: target.transform }, target.id);
                else if (event.amount > 0 && target.health.current > 0)
                    this.play('infected.hurt', { position: target.transform }, target.id);
            }
            if (event.type === 'combat.hit' && event.amount > 0 && event.damageType === 'melee') {
                const weapon = event.actionId.split('.').at(-1)!;
                const targetPosition = target?.transform ?? position;
                this.play(audioCues[`flesh.${weapon}`] ? `flesh.${weapon}` : 'flesh.fists', { position: targetPosition }, source);
                // Layered hit: transient (flesh) + body of the weapon + low thump, each with its own variation.
                const body = weapon === 'bat' ? 'wood' : /crowbar|machete/.test(weapon) ? 'metal' : 'punch', heavy = weapon === 'kick' || weapon === 'bat' || event.amount >= 20;
                this.play(`impact.body.${body}`, { position: targetPosition, gain: heavy ? 1 : 0.8 }, source);
                this.play('impact.thump', { position: targetPosition, gain: heavy ? 1 : 0.6 }, source);
                this.graph.buses.ambience.gain.setTargetAtTime(0.7, this.context.currentTime, 0.02);
                this.ambienceDuckUntil = this.context.currentTime + 0.5;
            }
        }
        if (event.type === 'infected.attack') {
            // Close individual vocals are bounded by the horde manager; a landed melee attack adds only the bite.
            if (event.amount > 0 && !['barricade', 'prop-throw', 'explode'].includes(event.special))
                this.play('infected.bite', { position: this.world.entities.get(event.targetId)?.transform ?? position }, source);
            return;
        }
        if (event.type === 'infected.groan' || event.type === 'infected.recovered') {
            const body = this.world.entities.get(event.sourceId);
            if (body && voicedInfected.has(body.archetype))
                this.play(eventCues[event.type], { position: body.transform, gain: event.type === 'infected.groan' ? 0.7 : 1 }, body.id);
            return;
        }
        if (event.type === 'ai.alerted') {
            // One shared anti-spam key: a gunshot that alerts a whole street yields a few snarls, not a wall.
            if (voicedInfected.has(this.world.entities.get(event.targetId)?.archetype ?? ''))
                this.play('infected.alert', { position: event.position });
            return;
        }
        if (event.type === 'objective.started' && event.id !== 'breakfast') {
            // L1 v2 opens with a calm morning: its objectives are not an incident until the arc leaves calm.
            if (!this.arc || this.arc.phase !== 'calm') this.incident = true;
            this.musicIntensity({ alerted: event.id === 'store-fight' ? 10 : 0 });
            if (event.id === 'escape') this.stinger('elite', this.level);
        }
        const id = eventCues[event.type];
        if (id !== 'ui.tick')
            this.play(id, { position }, source);
        if (event.type === 'pickup.collected')
            this.stinger('weapon', this.level);
    }
    update(): void {
        if (!this.available())
            return;
        if (this.ambienceDuckUntil && this.context.currentTime > this.ambienceDuckUntil) {
            this.ambienceDuckUntil = 0;
            this.graph.buses.ambience.gain.setTargetAtTime(1, this.context.currentTime, 0.25); // combat ducks ambience 3 dB, then it recovers
        }
        this.startBedsAndMusic();
        const player = this.world.entities.get(1);
        if (!player)
            return;
        const t = this.context.currentTime;
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
        let alerted = 0, danger = t < this.attackMusicUntil;
        if (this.world.tick % 12 === 0) {
            this.points.length = 0;
            let index = 0;
            for (const e of this.world.entities.iterate())
                if (e.infected && e.health.current > 0) {
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
            this.musicIntensity(this.externalIntensity ? { ...this.externalIntensity, ...(danger ? { danger: true } : {}) } : { alerted, danger });
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
        const ambient = this.arc && this.arc.phase !== 'calm' ? null : this.ambience.update(t);
        if (ambient)
            this.play(ambient.cue, { position: { x: player.transform.x + ambient.x, z: player.transform.z + ambient.z } });
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
        const frame = this.arcFrame = arc.update(t, this.points.length, zone.startsWith('interior') && arc.phase === 'chaos');
        if (arc.phase !== 'calm') this.incident = true;
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
    snapshot() { return { state: this.context.state, unlocked: this.unlocked, background: this.background, muted: this.settings.muted, master: this.graph.master.gain.value, output: this.graph.output.gain.value, voices: this.graph.active.size + this.score.voices, voiceLimit: this.graph.limiter.limit, music: { level: this.level, story: storyMusic(this.level, this.world.missions?.state), state: this.music.state, streamed: this.score.snapshot(), paused: this.context.state !== 'running', position: this.started ? Math.max(0, this.context.currentTime - this.musicEpoch) : 0, layers: this.music.layers, score: this.music.score, transitions: this.music.transitions }, buses: Object.fromEntries(Object.entries(this.graph.buses).map(([k, v]) => [k, v.gain.value])), errors: [...this.registry.errors, ...this.score.errors], cues: [...this.log], clusters: this.horde.clusters.map(c => ({ ...c })), captions: this.captions.map(c => c.text) }; }
    reset(): void {
        this.generation++;
        for (const off of this.unsubscribers)
            off();
        this.unsubscribers.length = 0;
        this.graph.reset();
        this.score.reset();
        this.loops.clear();
        this.stemVoices.clear();
        this.individualVocals.clear();
        this.footsteps.clear();
        this.log.length = 0;
        this.captions.length = 0;
        this.clearRings();
        this.captionElement.hidden = true;
        this.started = false;
        this.starting = false;
        this.loaded = false;
        this.scheduledTransition = null;
        this.externalIntensity = null;
        this.vehicleSpeed = 0;
        this.incident = false;
        this.complete = false;
        this.quietMusicUntil = 0;
        this.attackMusicUntil = 0;
    }
    dispose(): void { this.disposed = true; this.reset(); this.score.dispose(); document.removeEventListener('pointerdown', this.gesture); document.removeEventListener('keydown', this.gesture); document.removeEventListener('visibilitychange', this.visibility); window.removeEventListener('blur', this.blur); window.removeEventListener('focus', this.focus); window.removeEventListener('pagehide', this.pagehide); window.removeEventListener('pageshow', this.pageshow); document.removeEventListener('freeze', this.freeze); document.removeEventListener('resume', this.thaw); this.context.removeEventListener('statechange', this.statechange); this.graph.dispose(); void this.context.close(); this.captionElement.remove(); this.captionStyle.remove(); this.ringElement.remove(); this.controls.remove(); this.pauseElement.remove(); }
}
