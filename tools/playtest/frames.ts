export interface FrameState {
  at: number; level: string | null; tick: number; phase: string | null; loading: boolean; x: number; z: number;
}
export interface LongFrame extends FrameState { ms: number; playMs: number }

/** Clip an interval to the time after the loading card actually closed. */
export function frameInterval(previous: FrameState, current: FrameState, playableSince: number | null): LongFrame {
  const ms = current.at - previous.at;
  const playMs = current.phase === 'playing' && !current.loading && playableSince !== null
    ? Math.max(0, current.at - Math.max(previous.at, playableSince)) : 0;
  return { ...current, ms, playMs };
}

/** Serialized into the browser by the playtest driver; no imported runtime state. */
export function installFrameProbe(interval: typeof frameInterval): void {
  const root = window as unknown as { __name: (f: unknown) => unknown; __playtestFrames: LongFrame[]; __SCENE__?: { game: { loading: boolean; world: { scenario: string | null; tick: number; missions?: { state: { phase: string } }; entities: { get(id: number): { transform: { x: number; z: number } } | undefined } } } } };
  root.__name = f => f; root.__playtestFrames = [];
  const state = (at: number): FrameState => {
    const g = root.__SCENE__?.game, p = g?.world.entities.get(1)?.transform;
    const card = document.querySelector<HTMLElement>('[data-testid=level-transition]');
    return { at, level: g?.world.scenario ?? null, tick: g?.world.tick ?? -1, phase: g?.world.missions?.state.phase ?? null, loading: !g || g.loading || !!(card && !card.hidden), x: p?.x ?? 0, z: p?.z ?? 0 };
  };
  let previous: FrameState | undefined, playableSince: number | null = null, level: string | null = null;
  const boundary = (s: FrameState) => {
    if (s.loading || s.phase !== 'playing' || s.level !== level) playableSince = null;
    if (!s.loading && s.phase === 'playing') playableSince ??= s.at;
    level = s.level;
  };
  // Mutation delivery runs when the loading card hides, before the next RAF.
  // It preserves the first playable interval without counting the load itself.
  new MutationObserver(() => boundary(state(performance.now()))).observe(document, { subtree: true, attributes: true, attributeFilter: ['hidden'], childList: true });
  const frame = (now: number) => {
    const current = state(now); boundary(current);
    if (previous && now - previous.at > 200) root.__playtestFrames.push(interval(previous, current, playableSince));
    previous = current; requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
