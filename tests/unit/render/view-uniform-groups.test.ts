import { expect, test } from 'vitest';
import { renderGroup } from 'three/tsl';
import { seeThrough } from '../../../src/render/SeeThrough';
import { LightField } from '../../../src/render/LightField';
import { windPhase } from '../../../src/render/Grass';

test('view cutaway, practical-light sampling and wind values share the existing per-render uniform scope', () => {
  const field = new LightField();
  for (const node of [...Object.values(seeThrough), field.center, field.extent, field.strength, field.enabled, windPhase()]) expect(node.groupNode).toBe(renderGroup);
  field.dispose();
});
