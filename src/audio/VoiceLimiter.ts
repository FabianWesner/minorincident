export interface PriorityVoice {
    id: number;
    priority: number;
    stop(time?: number): void;
}
/** Stable oldest-first tie break. Rejects low-priority arrivals without interrupting important cues. */
export class VoiceLimiter {
    readonly voices = new Map<number, PriorityVoice>();
    limit: number;
    constructor(tier: 'high' | 'low', private readonly reserved = 0) { this.limit = tier === 'high' ? 32 : 16; }
    private get capacity(): number { return this.limit - this.reserved; }
    private lowest(): PriorityVoice | undefined {
        let victim: PriorityVoice | undefined;
        for (const voice of this.voices.values())
            if (!victim || voice.priority < victim.priority)
                victim = voice;
        return victim;
    }
    canAdd(priority: number): boolean { return this.voices.size < this.capacity || priority > this.lowest()!.priority; }
    add(voice: PriorityVoice, time?: number): boolean {
        if (this.voices.size >= this.capacity) {
            const victim = this.lowest()!;
            if (voice.priority <= victim.priority) {
                voice.stop();
                return false;
            }
            this.remove(victim.id);
            victim.stop(time);
        }
        this.voices.set(voice.id, voice);
        return true;
    }
    remove(id: number): void { this.voices.delete(id); }
    setTier(tier: 'high' | 'low'): void {
        this.limit = tier === 'high' ? 32 : 16;
        while (this.voices.size > this.capacity) {
            const v = this.lowest()!;
            this.remove(v.id);
            v.stop();
        }
    }
    clear(): void {
        for (const voice of this.voices.values())
            voice.stop();
        this.voices.clear();
    }
}
