/** Check the live loading cover's animation, outside any timing window. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
const session = new SceneSession({ backend: 'webgl2', tier: 'high' });
try {
  await session.open();
  const result = await session.page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-testid=level-transition]')!;
    const status = document.querySelector<HTMLElement>('[data-testid=transition-status]')!;
    root.hidden = false;
    try { return { animationName: getComputedStyle(status, '::before').animationName, animations: root.getAnimations({ subtree: true }).map(a => a.playState) }; }
    finally { root.hidden = true; }
  });
  if (result.animationName !== 'level-loading' || !result.animations.includes('running')) throw Error(JSON.stringify(result));
  mkdirSync('test-results/l7-perf', { recursive: true }); writeFileSync('test-results/l7-perf/loading-style.json', JSON.stringify(result) + '\n'); console.log(result);
  if (session.errors.length) throw Error(session.errors.join('\n'));
} finally { await session.close(); stopServer(); }
