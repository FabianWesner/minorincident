/** Actual unprotected survivor contact/bite clocks under the unchanged evade policy. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { LevelFiveBot } from '../../src/debug/bot/LevelFiveBot';
import { preset } from '../../src/sim/progression/Campaign';
import { storyProtected } from '../../src/sim/npc/storyProtection';
import { stateHash } from '../../src/sim/world/stateHash';
import { loadLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';
const identity = provenance(), rows = [];
for (const tier of ['low', 'high'] as const) {
  const campaign = preset('L5-default'); campaign.settings.quality = tier;
  const events: unknown[] = [], episodes: { source: number; target: number; start: number; last: number; ticks: number; distance: number; mode: string; targetId: number; biteAt?: number; grabbedAt?: number }[] = [];
  const active = new Map<string, typeof episodes[number]>();
  const recentHits = new Map<number, number>();
  const world = await loadLevel('L5', 1, campaign, 0, { quality: tier, beforeBegin: w => {
    w.events.on('combat.hit', e => { if (e.type === 'combat.hit') recentHits.set(e.targetId, w.tick); });
    for (const type of ['outbreak.bite', 'civilian.grabbed', 'civilian.saved', 'player.died', 'l5.found', 'l5.lost'] as const) w.events.on(type, e => {
      events.push(structuredClone(e));
      if (e.type === 'outbreak.bite' || e.type === 'civilian.grabbed') {
        const ep = active.get(`${e.sourceId}:${e.targetId}`);
        if (ep) { if (e.type === 'outbreak.bite') ep.biteAt = w.tick; else ep.grabbedAt = w.tick; }
      }
    });
    w.events.on('sim.tick', () => {
      const seen = new Set<string>();
      for (const r of w.missions!.state.l5!.survivors) {
        const victim = w.entities.get(r.id);
        if (!victim?.civilian || r.status !== 'following' || storyProtected(w, victim) || victim.hidden || victim.health.current <= 0 || victim.infection) continue;
        for (const a of w.infected!.active) {
          const brain = a.infected?.l1;
          if (!brain || a.health.current <= 0 || a.hidden || a.pendingAdmission || a.infectionRise || a.attachedTo !== undefined || a.corpse || w.tick - (recentHits.get(a.id) ?? -999) <= 90 || (a.combat?.staggerUntil ?? 0) > w.tick) continue;
          if (brain.targetId !== victim.id || !['chase', 'bite'].includes(brain.mode)) continue;
          const distance = Math.hypot(a.transform.x - victim.transform.x, a.transform.z - victim.transform.z);
          const reach = (a.combat?.radius ?? .35) + (victim.combat?.radius ?? .35) + .3;
          if (distance > reach + 1e-6 || !w.infected!.l1!.lineOfSight(a.transform, victim.transform)) continue;
          const key = `${a.id}:${victim.id}`; seen.add(key);
          let ep = active.get(key);
          if (!ep || ep.last + 1 !== w.tick) { ep = { source: a.id, target: victim.id, start: w.tick, last: w.tick, ticks: 0, distance, mode: brain.mode, targetId: brain.targetId }; episodes.push(ep); active.set(key, ep); }
          ep.last = w.tick; ep.ticks++; ep.distance = Math.max(ep.distance, distance);
        }
      }
      for (const key of active.keys()) if (!seen.has(key)) active.delete(key);
    }, 8);
  } });
  try {
    const bot = new LevelFiveBot(world, 'evade-only');
    for (let i = 0; i < 1200 * 60 && !bot.finished; i++) { world.applyInput(bot.sample(), 'keyboard'); world.update(); }
    const result = world.missions!.state.result;
    rows.push({ tier, policy: 'evade-only', observationBudgetSeconds: 1200, completed: !!result, result: result ? { rescued: result.rescued, survivors: result.survivors } : null, deaths: world.missions!.state.stats.deaths, finalHash: stateHash(world.getState()), bot: bot.debug(), player: { ...world.entities.get(1)!.transform }, roster: structuredClone(world.missions!.state.l5!.survivors), events, episodes });
    console.log(tier, !!result, result?.rescued, episodes.length, Math.max(0, ...episodes.map(e => e.ticks)));
  } finally { world.dispose(); }
  const canonical = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L5-${tier}-complete.json`, 'utf8')); assert.equal(canonical.sourceHash, identity.sourceHash);
  writeFileSync('docs/reports/sweep-b/L5-contact.json.gz', gzipSync(JSON.stringify({ ...identity, producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-l5-contact.ts')).digest('hex'), method: 'Unchanged mortal LevelFiveBot evade-only for up to1200simseconds. Every-tick following survivor contact after actual story protection ends; production body-radius contact boundary and actual L1 sight/target used. Only continuously eligible, visible, living, nonstaggered same-target pairs count; exclude90ticks after source combat hits. Actual grab/bite events attached, no deadline inferred from a timeout. No game/input/health mutation.', rows })));
}
