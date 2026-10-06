import type { MusicState } from './MusicDirector';

interface Deck { media: HTMLAudioElement; source: MediaElementAudioSourceNode; gain: GainNode; retire: number; }
/** Long recordings stay in the browser's streaming media cache, never decodeAudioData at boot.
 * All decks feed the existing music bus, so twist silence, ducking, mono and limiting still apply.
 * Keep the outgoing recording audible until its replacement actually starts, then fade on a bar.
 */
export class StreamedMusic {
    private readonly decks = new Map<MusicState, Deck>();
    private generation = 0;
    private suspended = false;
    private requested: MusicState | null = null;
    private target: { state: MusicState; requested: number; epoch: number; bar: number } | null = null;
    state: MusicState | null = null;
    readonly errors: string[] = [];
    readonly transitions: { state: MusicState; requested: number; time: number }[] = [];
    constructor(private readonly context: AudioContext, private readonly bus: AudioNode) {}
    private deck(state: MusicState): Deck {
        let deck = this.decks.get(state);
        if (deck) return deck;
        const media = new Audio();
        media.preload = 'none';
        media.loop = true;
        const format = media.canPlayType('audio/webm; codecs="opus"') ? 'webm' : 'm4a';
        media.src = `/assets/audio/score-${state}.${format}`;
        const source = this.context.createMediaElementSource(media), gain = this.context.createGain();
        gain.gain.value = 0;
        source.connect(gain).connect(this.bus);
        deck = { media, source, gain, retire: Infinity };
        this.decks.set(state, deck);
        return deck;
    }
    async transition(state: MusicState, requested: number, epoch: number, bar: number): Promise<void> {
        this.target = { state, requested, epoch, bar };
        if (state === this.requested || this.suspended) return;
        this.requested = state;
        const generation = ++this.generation, incoming = this.deck(state);
        incoming.retire = Infinity;
        try { await incoming.media.play(); }
        catch {
            if (generation === this.generation) {
                this.requested = null;
                this.errors.push(`Music playback failed: ${state}`);
            }
            return;
        }
        if (generation !== this.generation || this.suspended) {
            if (this.requested !== state) incoming.media.pause();
            return;
        }
        const now = this.context.currentTime;
        const at = epoch + Math.ceil((Math.max(now, requested) - epoch) / bar) * bar;
        for (const [key, deck] of this.decks) {
            const gain = deck.gain.gain;
            gain.cancelAndHoldAtTime(now);
            gain.setValueAtTime(gain.value, at);
            // Source normalized to -18 LUFS. Master is +6 dB; this trim preserves headroom.
            gain.linearRampToValueAtTime(key === state ? 0.5 : 0, at + 2);
            deck.retire = key === state ? Infinity : at + 2;
        }
        this.state = state;
        this.transitions.push({ state, requested, time: at });
    }
    update(): void {
        for (const deck of this.decks.values())
            if (deck.retire <= this.context.currentTime) { deck.media.pause(); deck.retire = Infinity; }
    }
    get voices(): number { return [...this.decks.values()].filter(deck => !deck.media.paused).length; }
    pause(): void {
        this.suspended = true;
        ++this.generation;
        this.requested = null;
        for (const deck of this.decks.values()) deck.media.pause();
    }
    async resume(): Promise<void> {
        this.suspended = false;
        // Restore both sides of a frozen crossfade, preserving their playback positions.
        const generation = this.generation;
        for (const [state, deck] of this.decks)
            if (state === this.state || deck.retire < Infinity) {
                try { await deck.media.play(); } catch { /* A later gesture retries playback. */ }
                if (generation !== this.generation || this.suspended) deck.media.pause();
            }
        if (generation !== this.generation || this.suspended) return;
        this.requested = this.state;
        // A blur can interrupt the first play() before it has become the active state.
        // Keep the last musical request so returning focus can retry that incoming deck.
        const target = this.target;
        if (target && target.state !== this.state)
            await this.transition(target.state, target.requested, target.epoch, target.bar);
    }
    snapshot() { return { state: this.state, transitions: [...this.transitions], decks: [...this.decks].map(([state, d]) => ({ state, paused: d.media.paused, position: d.media.currentTime, gain: d.gain.gain.value })) }; }
    reset(): void {
        ++this.generation;
        // Keep at most four cached decks across world loads. Removing src aborts an
        // in-flight range request and discards a usable recording on every reload.
        for (const deck of this.decks.values()) {
            deck.media.pause(); deck.media.currentTime = 0; deck.retire = Infinity;
            deck.gain.gain.cancelScheduledValues(0); deck.gain.gain.value = 0;
        }
        this.state = null; this.requested = null; this.target = null; this.errors.length = 0; this.transitions.length = 0;
    }
    dispose(): void {
        this.reset();
        for (const deck of this.decks.values()) { deck.source.disconnect(); deck.gain.disconnect(); }
        this.decks.clear();
    }
}
