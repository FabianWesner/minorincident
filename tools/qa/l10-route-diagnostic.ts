import { writeFileSync } from 'node:fs';
import { loadLevel } from '../sim-runner/levels';
import { followTenFrustum } from '../sim-runner/l10';
import { LevelTenBot } from '../../src/debug/bot/LevelTenBot';
const w = await loadLevel('L10', 1, undefined, 0, { quality: 'low' });
const bot = new LevelTenBot(w), rows: unknown[] = [];
try {
  for (let i = 0; i < 120 * 60; i++) {
    followTenFrustum(w); const frame = bot.sample(); w.applyInput(frame, 'keyboard'); w.update();
    if (i % 120 === 0 || w.entities.get(1)!.health.current <= 0) {
      const p = w.entities.get(1)!, controller = w.physics.characterController!;
      const contacts = Array.from({ length: controller.numComputedCollisions() }, (_, n) => {
        const c = controller.computedCollision(n); return c ? { normal: c.normal1, collider: c.collider?.handle, position: c.collider?.translation() } : null;
      });
      const route = Reflect.get(Reflect.get(bot, 'walker'), 'route') as { goal: number; pathIndex: number; path: number[] };
      rows.push({ seconds: w.tick / 60, player: { ...p.transform, hp: p.health.current }, move: frame.move, waypoint: Reflect.get(bot, 'waypoint'), walker: { goal: route.goal, pathIndex: route.pathIndex, nodes: route.path.length }, active: w.missions!.def.steps.find(s => w.missions!.state.steps[s.id].status === 'active')?.id,
        contacts, body: w.solids.blockingBody(1)?.id, walls: w.infected!.nav.walls.filter(a => Math.abs(a.x - p.transform.x) < a.halfX + 3 && Math.abs(a.z - p.transform.z) < a.halfZ + 3) });
      if (p.health.current <= 0) break;
    }
  }
  writeFileSync('docs/reports/eg-l10-story/evidence/route-diagnostic.json', JSON.stringify(rows, null, 2));
  console.log('route diagnostic captured', rows.length, 'samples');
} finally { w.dispose(); }
