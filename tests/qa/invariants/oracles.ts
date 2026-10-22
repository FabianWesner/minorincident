/** Shared predicates used by live probes and broken-fixture tests, so a green fixture suite cannot mask a dead check. */
export const oracle = {
  accessory: (fit: { attach: string; offset: number[]; tolerance: number }) => fit.attach !== 'head' || fit.offset.some(n => !Number.isFinite(n) || Math.abs(n) > fit.tolerance),
  seat: (state: { sitting: boolean; hasSeat: boolean; supported: boolean }) => state.sitting && (!state.hasSeat || !state.supported),
  actor: (state: { inScriptedScene: boolean; exists: boolean; hidden: boolean }) => state.inScriptedScene && (!state.exists || state.hidden),
  vehicle: (overlapsSolid: boolean) => overlapsSolid,
  wave: (state: { authored: number; spawned: number }) => state.authored !== state.spawned,
  objective: (state: { markerVisible: boolean; visibleAtMs: number }) => !state.markerVisible || !Number.isFinite(state.visibleAtMs) || state.visibleAtMs > 2000,
  ground: (state: { drawnY: number; simY: number }) => !Number.isFinite(state.drawnY) || !Number.isFinite(state.simY) || Math.abs(state.drawnY - state.simY) > .2,
  load: (state: { candidateMs: number; baselineMs: number }) => !Number.isFinite(state.candidateMs) || !Number.isFinite(state.baselineMs) || state.candidateMs <= 0 || state.baselineMs <= 0 || state.candidateMs > state.baselineMs + Math.min(1000, state.baselineMs * .1),
};

export function obbHitsAabb(cx: number, cz: number, yaw: number, hx: number, hz: number, y0: number, y1: number, box: { min: number[]; max: number[] }): boolean {
  if (![cx, cz, yaw, hx, hz, y0, y1, ...box.min, ...box.max].every(Number.isFinite)) throw new Error('vehicle invariant: non-finite OBB/solid geometry');
  if (y1 <= box.min[1] || y0 >= box.max[1]) return false;
  const bx = (box.min[0] + box.max[0]) / 2, bz = (box.min[2] + box.max[2]) / 2;
  const ax = (box.max[0] - box.min[0]) / 2, az = (box.max[2] - box.min[2]) / 2;
  const dx = bx - cx, dz = bz - cz, c = Math.cos(yaw), s = Math.sin(yaw);
  return Math.abs(dx * c - dz * s) <= hx + ax * Math.abs(c) + az * Math.abs(s)
    && Math.abs(dx * s + dz * c) <= hz + ax * Math.abs(s) + az * Math.abs(c)
    && Math.abs(dx) <= ax + hx * Math.abs(c) + hz * Math.abs(s)
    && Math.abs(dz) <= az + hx * Math.abs(s) + hz * Math.abs(c);
}
