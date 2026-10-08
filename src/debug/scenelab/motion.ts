/** Scene Lab motion metrics, the same model-free contact rule as tools/playeranim/metrics.ts and tools/crowdfoot:
 * a foot is planted while its lowest sole point is within 1.2 cm of that actor's floor; while planted the grounded
 * point must not translate (slide) and the foot must not yaw (drift). Floor = the known ground height per frame, else the
 * lowest sole point of the window. `sinkMaxCm`: deepest sole point below the floor (feet through the ground). */
export interface FootSample { heel: number[]; toe: number[]; yaw: number }
/** `floor`: ground height under the actor when known (Scene Lab); otherwise the lowest sole point of the track is used. */
export interface MotionFrame { frame: number; clip?: string; feet: FootSample[]; torsoPitchDeg?: number; speed?: number; floor?: number }
export interface MotionSummary {
  frames: number; contacts: number; slideMaxCm: number; slideP95Cm: number | null; yawDriftMaxDeg: number; liftMaxCm: number; sinkMaxCm: number;
  torsoPitchMinDeg: number | null; torsoPitchMaxDeg: number | null; worstSlideFrame: number | null;
}
const percentile = (a: number[], p: number) => a.slice().sort((x, y) => x - y)[Math.floor((a.length - 1) * p)];
/** Clips whose feet legitimately leave the floor plane or are not standing (seated, knocked down, rising). */
export const unplantedClips = /death|knockdown|flung|get-up|crawl|collapse|rise|sit|stand-up|grabbed|bitten|down/;

export function summarizeMotion(frames: MotionFrame[], grounded = .012): MotionSummary {
  const used = frames.filter(f => f.feet.length && !(f.clip && unplantedClips.test(f.clip)));
  const pitches = frames.map(f => f.torsoPitchDeg).filter((v): v is number => v !== undefined && Number.isFinite(v));
  const base = { frames: frames.length, torsoPitchMinDeg: pitches.length ? Math.round(Math.min(...pitches) * 10) / 10 : null, torsoPitchMaxDeg: pitches.length ? Math.round(Math.max(...pitches) * 10) / 10 : null };
  if (!used.length) return { ...base, contacts: 0, slideMaxCm: 0, slideP95Cm: null, yawDriftMaxDeg: 0, liftMaxCm: 0, sinkMaxCm: 0, worstSlideFrame: null };
  const trackFloor = Math.min(...used.flatMap(f => f.feet.flatMap(c => [c.heel[1], c.toe[1]])));
  const floorOf = (f: MotionFrame) => f.floor ?? trackFloor;
  const slides: number[] = [], drifts: number[] = [];
  let lift = 0, sink = 0, worst = 0, worstFrame: number | null = null;
  const feet = Math.max(...used.map(f => f.feet.length));
  for (let i = 0; i < feet; i++) {
    let slide = 0, drift = 0, startYaw: number | undefined, previous: MotionFrame | undefined, started = 0;
    const close = () => { slides.push(slide); drifts.push(drift); if (slide > worst) { worst = slide; worstFrame = started; } slide = 0; drift = 0; startYaw = undefined; previous = undefined; };
    for (const f of used) {
      const c = f.feet[i]; if (!c) continue;
      const floor = floorOf(f), lowest = Math.min(c.heel[1], c.toe[1]); lift = Math.max(lift, lowest - floor); if (f.frame >= 3) sink = Math.max(sink, floor - lowest);   // frames 0-2 are the spawn settle
      if (lowest < floor + grounded) {
        if (startYaw === undefined) { startYaw = c.yaw; started = f.frame; }
        else if (previous) {
          const pc = previous.feet[i], toe = c.toe[1] < floor + grounded && pc.toe[1] < floorOf(previous) + grounded;
          const a = toe ? c.toe : c.heel, b = toe ? pc.toe : pc.heel;
          slide += Math.hypot(a[0] - b[0], a[2] - b[2]);
          drift = Math.max(drift, Math.abs(Math.atan2(Math.sin(c.yaw - startYaw), Math.cos(c.yaw - startYaw))) * 180 / Math.PI);
        }
        previous = f;
      } else if (startYaw !== undefined) close();
    }
    if (startYaw !== undefined) close();
  }
  return { ...base, contacts: slides.length, slideMaxCm: Math.round(Math.max(0, ...slides) * 1000) / 10, slideP95Cm: slides.length ? Math.round(percentile(slides, .95) * 1000) / 10 : null,
    yawDriftMaxDeg: Math.round(Math.max(0, ...drifts) * 10) / 10, liftMaxCm: Math.round(lift * 1000) / 10, sinkMaxCm: Math.round(sink * 1000) / 10, worstSlideFrame: worstFrame };
}
/** Signed torso pitch in degrees: hip→chest against vertical, positive leaning toward `forward` (x, z). */
export function torsoPitch(hip: number[], chest: number[], forward: number[]): number {
  const dx = chest[0] - hip[0], dy = chest[1] - hip[1], dz = chest[2] - hip[2], f = Math.hypot(forward[0], forward[2]) || 1;
  return Math.atan2((dx * forward[0] + dz * forward[2]) / f, dy) * 180 / Math.PI;
}
/** Foot yaw from its heel→toe vector, in the game's yaw convention (forward = (cos yaw, -sin yaw)). */
export const footYaw = (heel: number[], toe: number[]) => Math.atan2(-(toe[2] - heel[2]), toe[0] - heel[0]);
