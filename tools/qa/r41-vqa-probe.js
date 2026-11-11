// r41-vqa: light courier-drawn probe for r28-vqa-fixture-play --setup (a=__SS__, g=game).
// Every frame: first non-finite matrixWorld under the courier view (the b77-b79 invisible-courier symptom), courier
// object visibility, and (with window.__fireOn = true set before, e.g. `--setup "window.__fireOn=1; $(cat ...)"`)
// up to 6 small fire patches in front of the running courier from tick 300 so she takes real fire hits (logged QA setup).
// Pair with --watch "return window.__r41"
const w = window;
w.__r41 = { first: null, frames: 0, hidden: 0, fires: [], err: null, hurt: 0, minHp: 100 };
const chk = () => {
  try {
    const s = w.__r41, c = g.view.character, p = g.world.entities.get(1);
    s.frames++;
    if (c && p) {
      let bad = null;
      c.traverse(n => { if (bad) return; const e = n.matrixWorld.elements; for (let i = 0; i < 16; i++) if (!Number.isFinite(e[i])) { bad = (n.name || n.type); break; } });
      if (bad && !s.first) s.first = { tick: g.world.tick, node: bad, anim: p.survivor && p.survivor.animation, hp: p.health && p.health.current };
      if (!c.visible) s.hidden++;
      if (p.survivor && p.survivor.animation === 'hurt') s.hurt++;
      if (p.health) s.minHp = Math.min(s.minHp, Math.round(p.health.current));
      if (w.__fireOn && s.fires.length < 6 && g.world.tick >= 300 && g.world.tick % 200 === 0 && p.survivor && p.survivor.animation === 'run') {
        g.world.hazards.spawn('fire', { x: p.transform.x + p.survivor.velocity.x * .3, z: p.transform.z + p.survivor.velocity.z * .3 }, { duration: 3, radius: 2 });
        s.fires.push(g.world.tick);
      }
    }
  } catch (err) { w.__r41.err = String(err && err.stack || err).slice(0, 300); }
  requestAnimationFrame(chk);
};
requestAnimationFrame(chk);
return 'r41 probe installed';
