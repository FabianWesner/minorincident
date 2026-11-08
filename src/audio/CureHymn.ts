/** Original major-key resolution of the procedural score's 0/4/7/9 motif, layered over the finale recording.
 * Nine continuous voices, no samples or downloads; the existing music bus owns mute, ducking and pause. */
export class CureHymn {
  private readonly voices: OscillatorNode[] = [];
  private readonly gains: GainNode[] = [];
  private readonly filters: BiquadFilterNode[] = [];
  private chord = -1;
  private readonly output: GainNode;
  constructor(private readonly context: AudioContext, bus: AudioNode) {
    this.output = context.createGain(); this.output.gain.value = 0; this.output.connect(bus);
    this.output.gain.linearRampToValueAtTime(.32, context.currentTime + 4);
    for (let n = 0; n < 9; n++) {
      const osc = context.createOscillator(), gain = context.createGain(), filter = context.createBiquadFilter();
      osc.type = n === 8 ? 'sawtooth' : 'triangle'; osc.detune.value = n % 2 ? -3 : 3;
      filter.type = n === 8 ? 'lowpass' : 'bandpass'; filter.frequency.value = n === 8 ? 1400 : n % 2 ? 850 : 1250; filter.Q.value = .6;
      gain.gain.value = n === 8 ? .13 : .11; osc.connect(filter).connect(gain).connect(this.output); osc.start();
      this.voices.push(osc); this.gains.push(gain); this.filters.push(filter);
    }
  }
  update(seconds: number): void {
    const chord = Math.floor(seconds / 8);
    if (chord === this.chord) return; this.chord = chord;
    const root = [0, 5, 7, 0][chord % 4], harmony = [0, 4, 7, 12], motif = [0, 4, 7, 9, 7, 4, 2, 0];
    this.voices.forEach((osc, i) => {
      const semitone = i === 8 ? motif[chord % motif.length] + 12 : root + harmony[Math.floor(i / 2)];
      osc.frequency.setTargetAtTime(130.8128 * 2 ** (semitone / 12), this.context.currentTime, .25);
    });
  }
  dispose(): void {
    for (const osc of this.voices) { osc.stop(); osc.disconnect(); }
    for (const gain of this.gains) gain.disconnect(); for (const filter of this.filters) filter.disconnect(); this.output.disconnect();
  }
}
