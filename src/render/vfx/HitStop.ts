/** Fixed render-time history: 50 ms melee freeze; cancel at eight hits in 200 ms. */
export class HitStop {
  private readonly hits = new Float64Array(32).fill(-Infinity);
  private cursor = 0;
  until = 0;
  started = 0;
  suppressed = 0;
  hit(now: number): void {
    this.hits[this.cursor++ % this.hits.length] = now;
    let recent = 0;
    for (const time of this.hits) if (now - time <= 0.2 + 1e-9) recent++;
    if (recent >= 8) { this.until = now; this.suppressed++; }
    else { this.started = now; this.until = now + 0.05; }
  }
  active(now: number): boolean { return now + 1e-9 < this.until; }
  reset(): void { this.hits.fill(-Infinity); this.cursor = this.until = this.started = this.suppressed = 0; }
}
