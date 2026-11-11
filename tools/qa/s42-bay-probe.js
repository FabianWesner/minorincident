// Read-only L9 bay state retained across the L10 handover.
window.__s42Bay = { samples: [], deaths: [], error: null };
let lastBayTick = -1;
let bayDead = false;
let lastBayFire = -1000;
const sampleBay = () => {
  try {
    const w = g.world, s = w.missions?.l9?.driving?.state;
    const player = w.entities.get(1);
    // Explicit opt-in QA fixture: normal hazard damage exercises death recovery.
    if (window.__s42BayFire && s?.evacuationAt != null && !s.evacuationDone && player?.health.current > 0 && window.__s42Bay.deaths.length < 2 && w.tick - lastBayFire >= 60) {
      lastBayFire = w.tick;
      w.hazards.spawn('fire', { x: player.transform.x, z: player.transform.z }, { duration: 5, radius: 1 });
    }
    if (s?.evacuationAt != null && player && player.health.current <= 0 && !bayDead) {
      window.__s42Bay.deaths.push({ tick: w.tick, x: player.transform.x, z: player.transform.z, evacuated: [...s.evacuated] });
      window.__s42Shot = { tick: w.tick, id: 1, move: 'bay.death', stage: String(window.__s42Bay.deaths.length) };
      bayDead = true;
    }
    if (player?.health.current > 0) bayDead = false;
    if (s?.evacuationAt != null && w.tick - lastBayTick >= 120) {
      lastBayTick = w.tick;
      const actor = id => {
        const e = w.entities.get(id);
        return e ? { id, x: e.transform.x, z: e.transform.z, hp: e.health.current, infected: !!e.infected, passengerOf: e.passengerOf, survivor: e.civilian?.survivor?.key, ally: e.civilian?.ally ? structuredClone(e.civilian.ally) : undefined } : { id, missing: true };
      };
      window.__s42Bay.samples.push({ tick: w.tick, done: s.evacuationDone, evacuated: [...s.evacuated], roster: s.roster.map(actor), guards: s.soldiers.map(actor) });
      if (window.__s42Bay.samples.length > 100) window.__s42Bay.samples.shift();
    }
  } catch (error) { window.__s42Bay.error = String(error); }
  requestAnimationFrame(sampleBay);
};
requestAnimationFrame(sampleBay);
