// Registry, anti-spam, distance fade and rate variation adapted from Bruno Simon Audio.js (MIT, 41046b5).
import { audioCues, audioFile, audioVariationPools, type AudioCue } from '../data/audioCues';
import { Rng } from '../core/Rng';
import { assetUrl } from '../assets/assetUrl';
/** Plain Web Audio loader (09 §9 escape hatch): Howler's private node graph would conflict with
 * our offline/live graph. Sprite metadata and native codec fallback stay in this small registry. */
export class AudioRegistry {
    private readonly loads = new Map<string, Promise<AudioBuffer>>();
    readonly buffers = new Map<string, AudioBuffer>();
    private readonly last = new Map<string, number>();
    private readonly lastVariant = new Map<string, number>();
    private rng = new Rng(1, 'audio-variants');
    readonly errors: string[] = [];
    constructor(private readonly context: BaseAudioContext, private readonly read: (url: string) => Promise<ArrayBuffer> = async (url) => { const r = await fetch(assetUrl(url)); if (!r.ok)
        throw new Error(`Audio request failed: ${url}`); return r.arrayBuffer(); }) { }
    load(category: string): Promise<AudioBuffer> {
        if (!this.loads.has(category))
            this.loads.set(category, (async () => {
                for (const format of ['webm', 'm4a'] as const)
                    try {
                        const bytes = await this.read(audioFile(category, format)), buffer = await this.context.decodeAudioData(bytes);
                        this.buffers.set(category, buffer);
                        return buffer;
                    }
                    catch (error) {
                        if (format === 'm4a')
                            throw error;
                    }
                throw new Error(`No supported audio format: ${category}`);
            })());
        return this.loads.get(category)!;
    }
    async prepare(level = 'L1', beds = true): Promise<void> { const categories = new Set(Object.values(audioCues).filter(c => c.initial && (beds || c.category !== 'ambience' && !c.category.startsWith('music-L')) || beds && c.category === `music-${level}`).map(c => c.category)); await Promise.all([...categories].map(c => this.load(c))); }
    /** Background load of the lazy banks (props, vehicles, dialogue) one after another, so they never compete with level start. */
    async preloadLazy(): Promise<void> { for (const category of new Set(Object.values(audioCues).filter(c => !c.initial && !c.category.startsWith('music-L')).map(c => c.category))) await this.load(category).catch(() => { }); }
    get(id: string, time: number, key = id, ignoreSpam = false): {
        cue: AudioCue;
        buffer: AudioBuffer;
        rate: number;
        gain: number;
        variant: string;
    } | null {
        const cue = audioCues[id];
        if (!cue) {
            this.errors.push(`Missing cue: ${id}`);
            return null;
        }
        const buffer = this.buffers.get(cue.category);
        if (!buffer) {
            // Banks outside the initial set load on first use; this play is skipped, the next one sounds.
            if (!this.loads.has(cue.category))
                this.load(cue.category).catch(() => { this.errors.push(`Unloaded cue: ${id}`); });
            return null;
        }
        if (!ignoreSpam && time - (this.last.get(key) ?? -Infinity) < cue.antiSpam)
            return null;
        this.last.set(key, time);
        const pool = audioVariationPools[id];
        let selected = cue;
        if (pool) {
            const previous = this.lastVariant.get(id);
            const draw = Math.floor(this.rng.next() * (pool.length - (previous === undefined ? 0 : 1)));
            const index = previous !== undefined && draw >= previous ? draw + 1 : draw;
            this.lastVariant.set(id, index);
            selected = audioCues[pool[index]];
        }
        return { cue: { ...selected, id }, buffer, variant: selected.id,
            // Telegraph levels are information: keep the authored +3dB offscreen relation exact.
            gain: pool && cue.bus !== 'telegraph' ? 10 ** ((this.rng.next() * 2 - 1) / 20) : 1,
            rate: 1 + (this.rng.next() - 0.5) * cue.rateSpread };
    }
    reset(seed: number): void { this.last.clear(); this.lastVariant.clear(); this.rng = new Rng(seed, 'audio-variants'); this.errors.length = 0; }
}
