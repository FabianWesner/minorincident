import { assetUrl } from '../assets/assetUrl';
import { l4 } from '../data/l4';

/**
 * The L4 evacuation-bus radio (PO 2026-10-12: "maybe even music"). Diegetic: a licensed recording that is already part of the score set
 * (`score-calm-L1`, Kevin MacLeod "Jazz Brunch", CC-BY 4.0, see public/assets/audio/LICENSES.md) streamed through a band-pass "radio
 * speaker" filter at low volume, slightly more muffled than the adaptive score. Inside the bus it sits close; after the stop it plays on
 * from the parked bus and fades with distance. It fades out when the outbreak alarm starts (`wanted` goes false) and the adaptive score
 * is trimmed while it plays, so the two never fight. Everything goes through the existing `vehicles` bus (mixer and master apply).
 */
export class BusRadio {
    private media: HTMLAudioElement | null = null;
    private readonly gain: GainNode;
    private readonly high: BiquadFilterNode;
    private readonly low: BiquadFilterNode;
    private suspended = false;
    private lastTime = 0;
    /** Last applied output level 0..1 (observable by tests). */
    level = 0;
    constructor(private readonly context: AudioContext, bus: AudioNode, private readonly trimScore: (factor: number, time: number) => void) {
        this.gain = context.createGain(); this.gain.gain.value = 0;
        this.high = context.createBiquadFilter(); this.high.type = 'highpass'; this.high.frequency.value = 280;
        this.low = context.createBiquadFilter(); this.low.type = 'lowpass'; this.low.frequency.value = 3000;
        this.high.connect(this.low).connect(this.gain).connect(bus);
    }
    private ensure(): HTMLAudioElement {
        if (this.media) return this.media;
        const media = new Audio();
        media.preload = 'auto'; media.loop = true;
        media.src = assetUrl(`/assets/audio/score-calm-L1.${media.canPlayType('audio/webm; codecs="opus"') ? 'webm' : 'm4a'}`);
        this.context.createMediaElementSource(media).connect(this.high);
        return this.media = media;
    }
    /** `cab`: the player sits in the bus; otherwise `distance` is the metres to the parked bus. */
    update(wanted: boolean, cab: boolean, distance: number): void {
        const r = l4.radio, now = this.context.currentTime;
        const target = !wanted ? 0 : cab ? r.gain : r.gain * Math.max(0, 1 - distance / r.rangeM) ** 2;
        if (wanted && !this.suspended && (!this.media || this.media.paused)) void this.ensure().play().catch(() => { /* a later gesture retries */ });
        const tc = wanted ? 0.3 : r.fadeS / 3, dt = Math.max(0, now - this.lastTime);
        this.lastTime = now; this.level = target + (this.level - target) * Math.exp(-dt / tc);
        if (!wanted && this.media && !this.media.paused && this.level < 0.002) this.media.pause();
        this.gain.gain.setTargetAtTime(target, now, tc);
        this.low.frequency.setTargetAtTime(cab ? r.cabHz : r.openHz, now, 0.3);
        this.trimScore(wanted ? r.scoreTrim : 1, now);
    }
    get playing(): boolean { return !!this.media && !this.media.paused; }
    pause(): void { this.suspended = true; this.media?.pause(); }
    async resume(): Promise<void> { this.suspended = false; }
    reset(): void {
        this.level = 0; this.gain.gain.cancelScheduledValues(0); this.gain.gain.value = 0;
        if (this.media) { this.media.pause(); this.media.currentTime = 0; }
        this.trimScore(1, this.context.currentTime);
    }
    dispose(): void { this.reset(); this.media?.removeAttribute('src'); this.gain.disconnect(); this.high.disconnect(); this.low.disconnect(); this.media = null; }
}
