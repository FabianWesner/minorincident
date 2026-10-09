import { l4Route, l4RoutePose, l4ConvoyStations, l4 } from '../../src/data/l4';
/** Prints the L4 convoy route and the start/parked poses of every vehicle (authoring check): `npx tsx tools/l4/route.ts`. */
const r = l4Route();
console.log('length', r.length.toFixed(1), 'points', r.pts.length);
for (let s = 0; s <= r.length; s += 20) { const p = l4RoutePose(r, s); console.log(s.toFixed(0), p.x.toFixed(1), p.z.toFixed(1), (p.yaw * 180 / Math.PI).toFixed(0)); }
const st = l4ConvoyStations(r.length);
console.log('travel', st.travel.toFixed(1), 'm =', (st.travel / l4.convoy.speedMs).toFixed(1), 's at cruise');
for (const [i, v] of l4.convoy.vehicles.entries()) {
  const a = l4RoutePose(r, st.start[i]), b = l4RoutePose(r, st.end[i]);
  console.log(v.id.padEnd(8), 'start', a.x.toFixed(1), a.z.toFixed(1), 'end', b.x.toFixed(1), b.z.toFixed(1), (b.yaw * 180 / Math.PI).toFixed(0));
}
