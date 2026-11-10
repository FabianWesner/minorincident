import { loadL5 } from '../sim-runner/l5Bots';
const { mission } = await loadL5(1);
for (const [k, v] of Object.entries(mission.def.anchors)) if (/^l5-(out|ring|brace|metro|plaza)/.test(k)) console.log(k, v.x.toFixed(1), v.z.toFixed(1), v.radius);
