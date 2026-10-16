import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { action } from '../../../src/data/actions/catalog';
import { alphaDamageMultiplier, infectedDef, INFECTED_TOUGHNESS } from '../../../src/data/infected';

test('PO 2026-10-15 late-level traceability keeps the accepted shotgun and Mega contracts', () => {
  const plan = readFileSync('specs/91-test-plan.md', 'utf8');
  const row = (id: string) => plan.split('\n').find(line => line.startsWith(`| \`T-${id}\` |`))!;
  expect(row('E29-07')).toContain('2 close shotgun shells');
  const shells = Math.ceil(infectedDef('infected.alpha').hp * INFECTED_TOUGHNESS /
    (action('weapon.shotgun').damage * alphaDamageMultiplier('weapon.shotgun', 'bullet')));
  expect(shells).toBe(2);
  expect(row('E32-09')).toContain('same-size Mega Alpha');
  expect(row('E32-09')).not.toContain('≈2×');
  const quote = "The Mega Alpha shouldn't be bigger than the regular ALpha. Just look stronger and more freightinng.";
  expect(plan).toContain(quote);
  expect(readFileSync('specs/po-levels-9-10-2026-10-13.md', 'utf8')).toContain(quote);
});
