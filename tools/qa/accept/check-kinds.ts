/**
 * Routing kinds for NOT CHECKED acceptance rows: which lane can measure the
 * remaining clauses. A row can need several kinds; every NOT CHECKED row gets
 * at least one so the open set can be scheduled as lanes.
 *  - browser-visual: rendered frames must be inspected by a person/vision model.
 *  - browser-input: real-input play in a browser, no image judgement.
 *  - perf-quiet-window: frame/load/timing budgets; orchestrator's quiet window.
 *  - PO: only the PO can judge (fun/feel/taste).
 */
export type CheckKind = 'browser-visual' | 'browser-input' | 'perf-quiet-window' | 'PO';
export const checkKindOrder: readonly CheckKind[] = ['browser-visual', 'browser-input', 'perf-quiet-window', 'PO'];

export interface CheckKindInput {
  id: string;
  /** Check codes column from level-acceptance.md, e.g. 'S, O'. */
  check: string;
  /** Curated next-check text (remainingChecks / baseline method). */
  remaining: string;
  /** Outstanding manual review clause, when the row's final clause is a judgement. */
  review?: { tag: 'O' | 'P'; instruction: string };
  /** completeNativeRows requirements still without a fresh PASS at both tiers. */
  unmet: { clause: string; policy: string }[];
}

/** Rows whose remaining work is a fixed lane kind, not derivable from clause text. */
const rowKinds: Record<string, CheckKind[]> = {
  // Global performance budgets: cold loads, handovers, frame and render/sim budgets.
  'G-01': ['perf-quiet-window'],
  'G-02': ['perf-quiet-window'],
  'G-03': ['perf-quiet-window'],
  'G-04': ['perf-quiet-window'],
  'G-05': ['perf-quiet-window'],
  // O rows whose whole criterion is a look judgement.
  'G-06': ['browser-visual'],
  'G-07': ['browser-visual'],
  // Waiting/pace feel needs a real player waiting; the duel verdict is PO taste.
  'G-13': ['browser-input', 'PO'],
  // Physical control traces; facing/aim feel is PO taste.
  'G-15': ['browser-input', 'PO'],
  // Scripted-perception probes driven from real play; no browser image judgement.
  'G-18': ['browser-input'],
  // Per-level run-out triggered during live action at the final objective.
  'G-20': ['browser-input'],
  // Mortal checkpoint death/retry exercises through the playtest session driver.
  'G-21': ['browser-input'],
  // Physical WASD/mouse playthroughs; console errors are not image judgements.
  'G-25': ['browser-input'],
  // L1's scripted accident window plus its blast-frame budget.
  'L1-05': ['perf-quiet-window'],
  // Riot-hit feel: visible chip/recoil inspection, a mortal continuous-fire duel, PO taste.
  'L4-11': ['browser-visual', 'browser-input', 'PO'],
  // L9 pit-stop repair is held-E real-input work; the handover census is a driven bridgehead check.
  'L9-13': ['browser-input'],
  'L9-18': ['browser-input'],
};

/** Policies that only a browser input lane can produce. */
const inputPolicies = /^(?:real-input|physical|controlled-physical|boarding-sweep|calm-population|production-handover|streaming-physical)/;
/** Clause text that is a look judgement on rendered output. */
const visualWords = /reviewed|visual|readab|contrast|silhouette|pixels?|captures?|frames?|strips?|night|stunning|glitch|proportions?|looks?|inspect/i;
/** Clause text that is a frame/load/timing budget needing the quiet window. */
const perfWords = /frame|load\b|p95|cold|handover|hitch|quiet window|worst of|ms\b|timing/i;
/** Next-check text that needs real-input play rather than pixels or timing. */
const inputWords = /real-input|physical|WASD|playthrough|console|Luna|driv(?:e|ing)|soft-lock|mortal|session\.ts|input/i;

export function deriveCheckKinds(input: CheckKindInput): CheckKind[] {
  const override = rowKinds[input.id];
  if (override) return [...override];
  const kinds = new Set<CheckKind>();
  if (/\bP\b/.test(input.check) || input.review?.tag === 'P') kinds.add('PO');
  if (/\bO\b/.test(input.check) || input.review?.tag === 'O') kinds.add('browser-visual');
  if (/\bL\b/.test(input.check)) kinds.add('browser-input');
  for (const requirement of input.unmet) {
    if (visualWords.test(requirement.clause)) kinds.add('browser-visual');
    else if (inputPolicies.test(requirement.policy)) kinds.add('browser-input');
    if (perfWords.test(requirement.clause)) kinds.add('perf-quiet-window');
  }
  if (!kinds.size) {
    if (perfWords.test(input.remaining)) kinds.add('perf-quiet-window');
    else if (visualWords.test(input.remaining)) kinds.add('browser-visual');
    else if (inputWords.test(input.remaining)) kinds.add('browser-input');
    else kinds.add('browser-input');
  }
  return checkKindOrder.filter(kind => kinds.has(kind));
}
