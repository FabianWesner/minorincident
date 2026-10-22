/** Shared predicates used by live probes and broken-fixture tests, so a green fixture suite cannot mask a dead check. */
export const oracle = {
  accessory: (fit: { attach: string; offset: number[]; tolerance: number }) => fit.attach !== 'head' || fit.offset.some(n => !Number.isFinite(n) || Math.abs(n) > fit.tolerance),
  seat: (state: { sitting: boolean; hasSeat: boolean; supported: boolean }) => state.sitting && (!state.hasSeat || !state.supported),
  actor: (state: { inScriptedScene: boolean; exists: boolean; hidden: boolean }) => state.inScriptedScene && (!state.exists || state.hidden),
  vehicle: (overlapsSolid: boolean) => overlapsSolid,
  wave: (state: { authored: number; spawned: number }) => state.authored !== state.spawned,
  objective: (state: { markerVisible: boolean; visibleAtMs: number }) => !state.markerVisible || state.visibleAtMs > 2000,
  ground: (state: { drawnY: number; simY: number }) => Math.abs(state.drawnY - state.simY) > .2,
  load: (state: { candidateMs: number; baselineMs: number }) => state.candidateMs > state.baselineMs + Math.min(1000, state.baselineMs * .1),
};
