/** L2-05: actual exposed identities throughout the native closed-door forcing beat. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { loadLevel } from '../sim-runner/levels';
import { LevelTwoBot } from '../../src/debug/bot/LevelTwoBot';
import { provenance } from './accept/probe';

const runs = [];
for (const tier of ['low', 'high'] as const) {
  const world = await loadLevel('L2', 1, undefined, 0, { quality: tier });
  try {
    const bot = new LevelTwoBot(world, 'no-axe', 'side');
    const frames = [];
    let firstOut: number | null = null;
    for (let i = 0; i < 150 * 60; i++) {
      world.applyInput(bot.sample(), 'keyboard'); world.update();
      const state = world.missions!.state.l2!;
      if (state.phase === 'doors' || state.doorsOpenAt && world.tick <= state.doorsOpenAt + 60) {
        const actors = state.trappedIds.map(id => {
          const e = world.entities.get(id)!;
          return { id, hidden: !!e.hidden, pending: !!e.pendingAdmission, at: { ...e.transform }, clip: e.civilian?.story?.clip ?? null };
        });
        if (state.doorsOpenAt && firstOut === null && actors.some(e => !e.hidden && !e.pending && (e.at.x >= -51 || e.at.z >= -37.3))) firstOut = world.tick;
        frames.push({ tick: world.tick, doorsOpenAt: state.doorsOpenAt, phase: state.phase, actors });
      }
      if (state.doorsOpenAt && world.tick >= state.doorsOpenAt + 60) break;
    }
    const state = world.missions!.state.l2!, closed = frames.filter(frame => !frame.doorsOpenAt);
    const expected = tier === 'low' ? 20 : 30;
    const summary = { tier, expected, identities: state.trappedIds.length, closedTicks: closed.length,
      minExposed: closed.length ? Math.min(...closed.map(frame => frame.actors.filter(e => !e.hidden && !e.pending).length)) : 0,
      minInside: closed.length ? Math.min(...closed.map(frame => frame.actors.filter(e => !e.hidden && !e.pending && e.at.x >= -59.45 && e.at.x <= -51.75 && e.at.z >= -46.35 && e.at.z <= -38.05).length)) : 0,
      panicClips: [...new Set(closed.flatMap(frame => frame.actors.map(e => e.clip)))], doorsOpenAt: state.doorsOpenAt,
      firstOut, firstOutSeconds: firstOut === null ? null : (firstOut - state.doorsOpenAt) / 60 };
    runs.push({ ...summary, frames }); console.log(JSON.stringify(summary));
  } finally { world.dispose(); }
}
writeFileSync(process.env.TRAPPED_PANIC_OUT ?? 'docs/reports/fix60-a/L2-05-native.json.gz', gzipSync(JSON.stringify({ ...provenance(), method: 'Ordinary no-axe native InputFrames; every forcing tick and actual first whole-body exit; no teleport, spawn, invulnerability or objective skip.', runs })));
assert(runs.every(run => run.closedTicks > 60 && run.identities === run.expected && run.minExposed === run.expected && run.minInside === run.expected && run.firstOutSeconds !== null && run.firstOutSeconds <= 1));
