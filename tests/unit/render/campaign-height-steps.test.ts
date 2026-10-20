import { expect, test } from 'vitest';
import { auditHeightSteps } from '../../../tools/qa/height-steps';

test('every campaign height step has rendered retaining geometry within 0.3 m', async () => {
  const results = await auditHeightSteps();
  expect(results.map(r => r.level)).toEqual(Array.from({ length: 10 }, (_, i) => `L${i + 1}`));
  for (const row of results) {
    expect(row.missing, `${row.level}: ${row.missingMetres} m of unedged walking boundary`).toEqual([]);
    expect(row.missingMetres).toBe(0);
  }
}, 180_000);
