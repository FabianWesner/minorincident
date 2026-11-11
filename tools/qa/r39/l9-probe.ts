// r39-markers native probe: L9 marker anchor vs the bridge trigger, APC held on the deck.
import { decodeSave } from '../../../src/sim/progression/Save';
import { loadLevel } from '../../sim-runner/levels';
import { markerAnchor } from '../../../src/sim/missions/markerAnchor';
import { readFixture } from '../fixture-io';
const f = readFixture(process.argv[2] ?? 'tests/fixtures/saves/qa/l9-before-rail-stall.json.gz');
const d = decodeSave(JSON.stringify(f.campaign)); if (d.status !== 'ok') throw new Error('decode');
const world = await loadLevel('L9', 1, d.save);
try {
  const m = world.missions!, l9 = m.l9!;
  console.log('marker', m.state.marker, JSON.stringify(markerAnchor(m)), 'evac', l9.driving.state.evacuationDone, 'text', l9.driving.text());
} finally { world.dispose(); }
