// Read-only admission check; ignores the population already active at fixture load.
window.__s42Pop = { total: 0, onScreen: [], error: null };
const admitted = new Set(g.world.infected.active.map(e => e.id));
const samplePop = () => {
  try {
    const w = g.world;
    for (const e of w.infected?.active ?? []) {
      if (admitted.has(e.id) || e.health.current <= 0) continue;
      admitted.add(e.id); window.__s42Pop.total++;
      if (!w.infected.director.offscreen(e.transform, .6)) {
        const event = { tick: w.tick, id: e.id, kind: e.archetype, x: e.transform.x, z: e.transform.z };
        window.__s42Pop.onScreen.push(event);
        if (window.__s42Pop.onScreen.length <= 20) window.__s42Shot = { tick: w.tick, id: e.id, move: 'admission', stage: e.archetype };
      }
    }
  } catch (error) { window.__s42Pop.error = String(error); }
  requestAnimationFrame(samplePop);
};
requestAnimationFrame(samplePop);
