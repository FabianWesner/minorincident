import { writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer } from '../../../../tools/scenelab/session';
const session = new SceneSession({ backend: 'webgl2', tier: 'high' });
try {
  await session.open(); await session.load(readSpec('tests/scenes/catalog/ui-night-l6-gate.json'));
  const rows = []; let previous = 0;
  for (const frame of [0, 1, 2, 30, 59, 60, 61, 62]) {
    if (frame > previous) await session.step(frame - previous); previous = frame;
    const data = await session.page.evaluate(() => {
      const a = window.__SS__!, s = a.getState(), l6 = a.missions.state()!.l6!;
      return { tick: s.tick, phase: l6.phase, abandonAt: l6.abandonAt, leader: [l6.leaderX, l6.leaderZ], gate: l6.gates[0], player: s.player!.transform,
        plan: window.__SCENE__!.actors.get('courier')?.plan,
        residents: l6.survivors.map(r => ({ key: r.key, status: r.status, at: a.getEntity(r.id)?.transform, hold: r.hold })) };
    });
    rows.push({ frame, ...data });
  }
  writeFileSync('docs/reports/merge-batch10/evidence/gate-staging-diagnostic.json', JSON.stringify(rows, null, 2));
  console.log(rows.map(r => ({ frame: r.frame, gate: r.gate, player: r.player, behind: r.residents.filter(v => v.status === 'following' && v.at && v.at.x <= 92).map(v => ({ key: v.key, at: v.at })) })));
} finally { await session.close(); stopServer(); }
