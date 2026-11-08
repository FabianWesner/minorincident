/** End-to-end diagnostic: unchanged production L8, no setup mutations or protected combat. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { LevelEightBot } from '../../src/debug/bot/LevelEightBot';
import { loadLevel } from './levels';
import { provenance } from '../qa/accept/probe';
const w = await loadLevel('L8', 1, undefined, 0, { quality: 'low' }), bot = new LevelEightBot(w, 'arena-tour');
const zoo = w.missions!.l8!, events: unknown[] = [];
w.events.on('mission.signal', e => { if (e.type === 'mission.signal' && e.name.startsWith('l8.arena.')) events.push({ tick: e.tick, name: e.name }); });
for (let n = 0; n < 1500 * 60 && !['result','progression'].includes(w.missions!.state.phase) && w.missions!.state.stats.deaths < 15; n++) {
  w.applyInput(bot.sample(), 'keyboard'); w.update();
  if (w.tick % 1800 === 0) console.log(JSON.stringify({ tick: w.tick, deaths: w.missions!.state.stats.deaths, at: w.entities.get(1)!.transform, arenas: zoo.state.arenas.map(a => ({ id: a.id, phase: a.phase, living: a.ids.filter(id => (w.entities.get(id)?.health.current ?? 0) > 0).length })) }));
}
const pass = zoo.state.arenas.every(a => a.phase === 3) && ['result', 'progression'].includes(w.missions!.state.phase) && w.solids.failures === 0;
mkdirSync('test-results/l8-tour', { recursive: true });
writeFileSync('test-results/l8-tour/low.json', JSON.stringify({ ...provenance(process.env.L8_BOSS_REVISION ?? 'working-tree'), pass, method: 'Production story and arena-tour bot with normal damage, no fixture changes or god mode.', tick: w.tick, phase: w.missions!.state.phase, stats: w.missions!.state.stats, arenas: zoo.state.arenas, events, collision: { failures: w.solids.failures, offenders: w.solids.offenders.slice(-10) } }, null, 2) + '\n');
console.log(JSON.stringify({ pass, tick: w.tick, deaths: w.missions!.state.stats.deaths, arenas: zoo.state.arenas.map(a => ({id:a.id,phase:a.phase})) }));
w.dispose(); if (!pass) process.exitCode = 1;
