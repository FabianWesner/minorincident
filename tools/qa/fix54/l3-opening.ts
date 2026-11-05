// fix54-l3 diagnostic: where is the L3 opening wave during its first two seconds, and why is it off frame?
// Usage: node --import tsx/esm tools/qa/fix54/l3-opening.ts low|high
import { loadL3, runL3 } from '../../sim-runner/l3Bots';
const tier = (process.argv[2] ?? 'high') as 'low' | 'high';
const { world, mission } = await loadL3(1, tier);
const s = () => mission.state.l3!;
const upd = world.update.bind(world);
const seen = new Set<number>();
let start = -1;
world.update = () => {
  upd();
  const st = s();
  if (!st.attackAt) return;
  const w0 = st.waves.filter(q => q.wave === 0);
  if (start < 0) {
    start = Math.min(...w0.map(q => q.at));
    console.log(`attack at ${(st.attackAt / 60).toFixed(2)} start=${(start / 60).toFixed(2)} schedule(s after start):`, w0.map(q => `${q.dir}:${((q.at - start) / 60).toFixed(2)}`).join(' '));
  }
  const t = world.tick - start;
  if (t > 150) return;
  for (const q of w0) {
    const e = q.id ? world.entities.get(q.id) : undefined;
    if (t <= 120 && e?.infected && e.health.current > 0 && !e.hidden && !e.pendingAdmission && world.infected!.director.inFrame(e.transform)) seen.add(q.id);
  }
  if (t % 15 === 0) {
    const p = world.entities.get(1)!.transform;
    const rows = w0.filter(q => q.id).map(q => { const e = world.entities.get(q.id)!; return `${q.dir[0]}${q.id}@${e.transform.x.toFixed(0)},${e.transform.z.toFixed(0)}${world.infected!.director.inFrame(e.transform) ? '*' : ''}${e.hidden ? 'H' : ''}${e.pendingAdmission ? 'P' : ''}${e.emerging ? 'E' : ''}${e.health.current <= 0 ? 'D' : ''}`; });
    const pending = w0.filter(q => !q.id && world.tick >= q.at).map(q => q.dir[0]).join('');
    console.log(`t+${(t / 60).toFixed(2)} P@${p.x.toFixed(1)},${p.z.toFixed(1)} admitted=${rows.length} due-unadmitted=[${pending}] visible=${seen.size} | ${rows.join(' ')}`);
  }
};
runL3(world, mission, 'complete', { maxSeconds: 60, god: false, stopWhen: () => start >= 0 && world.tick - start > 160 });
console.log('visible within 2 s:', seen.size, '/', s().waves.filter(q => q.wave === 0).length);
world.dispose();
