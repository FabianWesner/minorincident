import { mkdirSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
const session = new SceneSession({ backend: 'webgl2', tier: 'high', seed: 32, query: { ui: '1' } });
mkdirSync('docs/reports/s177-rackkeys', { recursive: true });
try {
  await session.open(); await session.page.evaluate('globalThis.__name = fn => fn');
  const info = await session.page.evaluate(async () => {
    const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
    await a.loadLevel('L10', { seed: 32 }); a.pause(); a.cheats.god(true); a.missions.begin();
    const m = game.world.missions!;
    for (let i = 0; i < 30 && m.state.steps.research.status !== 'active'; i++) m.completeObjective();
    if (m.state.steps.research.status !== 'active') throw new Error('research not active');
    a.teleport(1, { x: 2701, z: 66 }); await a.step(1); await a.step(3400);
    a.teleport(1, { x: 2706, z: 66 }); await a.step(300); game.campaignUI.hide(); game.ui.show(null); game.ui.update(); await a.screenshotReady(); game.campaignUI.hide(); game.ui.hud.root.dataset.sceneHud = ''; game.ui.update();
    return { carried: m.state.states['cure-carried'], rack: game.world.combat!.runner.loadout.activeEntries().map(e => e.id), owned: game.world.progression?.campaign?.ownedActions, phase: m.state.phase, cinematic: m.state.cinematic, storyLock: game.world.storyLock, ui: document.body.dataset.uiScreen, hudVisible: getComputedStyle(document.querySelector('[data-testid=weapon-rack]')!).visibility === 'visible', backend: a.perf().backend };
  });
  console.log(JSON.stringify({ info, errors: session.errors }));
  if (!info.carried || !info.hudVisible || info.rack.length !== 10 || session.errors.length) throw new Error('Hangar rack fixture did not reach expected state');
  await session.page.screenshot({ path: 'docs/reports/s177-rackkeys/rack-l10.jpg', type: 'jpeg', quality: 90 });
} finally { await session.close(); stopServer(); }
