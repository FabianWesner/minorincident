// Registry, anti-spam, distance fade and rate variation adapted from Bruno Simon Audio.js (MIT, 41046b5).
import { audioCues, audioFile, type AudioCue } from '../data/audioCues';
import { Rng } from '../core/Rng';
/** Plain Web Audio loader (09 §9 escape hatch): Howler's private node graph would conflict with
 * our offline/live graph. Sprite metadata and native codec fallback stay in this small registry. */
export class AudioRegistry {
    private readonly loads = new Map<string, Promise<AudioBuffer>>();
    readonly buffers = new Map<string, AudioBuffer>();
    private readonly last = new Map<string, number>();
    private rng = new Rng(1, 'audio-variants');
    readonly errors: string[] = [];
    constructor(private readonly context: BaseAudioContext, private readonly read: (url: string) => Promise<ArrayBuffer> = async (url) => { const r = await fetch(url); if (!r.ok)
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
    async prepare(level = 'L1'): Promise<void> { const categories = new Set(Object.values(audioCues).filter(c => c.initial || c.category === `music-${level}`).map(c => c.category)); await Promise.all([...categories].map(c => this.load(c))); }
    get(id: string, time: number, key = id, ignoreSpam = false): {
        cue: AudioCue;
        buffer: AudioBuffer;
        rate: number;
    } | null {
        const cue = audioCues[id];
        if (!cue) {
            this.errors.push(`Missing cue: ${id}`);
            return null;
        }
        const buffer = this.buffers.get(cue.category);
        if (!buffer) {
            this.errors.push(`Unloaded cue: ${id}`);
            return null;
        }
        if (!ignoreSpam && time - (this.last.get(key) ?? -Infinity) < cue.antiSpam)
            return null;
        this.last.set(key, time);
        return { cue, buffer, rate: 1 + (this.rng.next() - 0.5) * cue.rateSpread };
    }
    reset(seed: number): void { this.last.clear(); this.rng = new Rng(seed, 'audio-variants'); this.errors.length = 0; }
}
