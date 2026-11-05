import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { Pickups as WeaponPickups } from '../../../src/sim/combat/Pickups';
import { Pickups as ItemPickups } from '../../../src/sim/interact/Pickups';
import { pickupApproachFixture, pickupApproachPass } from './pickup-approach-fixture';
import { provenance } from './probe';

const normal = [];
for (const tier of ['low', 'high'] as const) {
  const cells = await pickupApproachFixture(tier);
  assert(pickupApproachPass(cells), `${tier} production pickup matrix failed`);
  normal.push({ tier, cells });
}
const faults = [];
for (const [name, prototype] of [['weapon approach disabled', WeaponPickups.prototype], ['medicine/item approach disabled', ItemPickups.prototype]] as const) {
  const original = prototype.update;
  try {
    prototype.update = () => {};
    const cells = await pickupApproachFixture('low');
    const detected = !pickupApproachPass(cells);
    assert(detected, `${name} was not detected`);
    faults.push({ name, detected, uncollected: cells.filter(cell => !cell.collected).map(cell => ({ kind: cell.kind, shelf: cell.shelf })) });
  } finally { prototype.update = original; }
}
writeFileSync('docs/reports/fix51-r10g/G-10-proof.json', JSON.stringify({ ...provenance(), normal, faults }, null, 2) + '\n');
console.log('G-10: 32 production cells PASS; both disabled transaction paths detected');
