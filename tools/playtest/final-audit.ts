import type { Game } from '../../src/Game';

/** Diagnostic observer only. Its records never feed the input driver's decisions. */
export function installFinalAudit(): void {
  const target = window as unknown as { __finalE2eAudit: unknown[]; __SCENE__?: { game: Game } };
  target.__finalE2eAudit = [];
  let previous = '', loadStarted = 0, wasLoading = false, wasBegin = false;
  const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const visible = (e: HTMLElement | null) => !!e && !e.hidden && e.offsetParent !== null;
  const sample = () => {
    const g = target.__SCENE__?.game, m = g?.world.missions;
    if (!g || !m) return;
    const now = performance.now(), loading = visible(q('level-transition')) || visible(q('menu-loading'));
    const begin = !loading && visible(q('mission-button')) && q('mission-button')!.textContent === 'Begin mission';
    if (loading && !wasLoading) loadStarted = now;
    const text = visible(q('objective-text')) ? q('objective-text')!.textContent : q('mission-tracker')?.textContent;
    const subtitle = visible(q('mission-subtitle')) ? q('mission-subtitle')!.textContent : '';
    const storyBubble = visible(q('story-bubble')) ? q('story-bubble')!.textContent : '';
    const key = JSON.stringify([g.world.scenario, m.state.phase, loading, begin, text?.replace(/[\d.]+\s*m\b/g, '#m'), subtitle, storyBubble]);
    if (key !== previous || begin && !wasBegin) {
      const state = window.__SS__!.missions.state();
      const entities = [...g.world.entities.iterate()];
      const people = entities.filter(e => e.id !== 1 && !e.companion && (e.escort || e.civilian || e.faction === 'survivor'));
      const player = window.__SS__!.getEntity(1);
      target.__finalE2eAudit.push({ at: now, level: g.world.scenario, tick: g.world.tick, phase: m.state.phase, loading,
        begin, loadToBeginMs: begin && !wasBegin && loadStarted ? now - loadStarted : null,
        transition: { title: q('transition-title')?.textContent, story: q('transition-story')?.textContent, status: q('transition-status')?.textContent },
        objective: text, subtitle, storyBubble, prompt: visible(q('interaction-ring')) ? q('interaction-ring')!.textContent : '',
        panel: visible(q('mission-panel')) ? q('mission-panel')!.innerText : '',
        rack: player?.weapons, player: player?.transform,
        stats: state?.stats, result: state?.result,
        people: people.map(e => ({ id: e.id, name: e.civilian?.survivor?.key, hp: e.health.current, hidden: !!e.hidden, faction: e.faction })),
        corgis: entities.filter(e => e.companion).map(e => ({ id: e.id, hp: e.health.current, hidden: !!e.hidden, state: e.companion?.state })),
        campaign: (m.state.phase === 'result' || begin && !wasBegin) ? window.__SS__!.campaign.state() : undefined,
      });
      previous = key;
    }
    wasLoading = loading; wasBegin = begin;
  };
  setInterval(sample, 50);
}
