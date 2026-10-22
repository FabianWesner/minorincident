import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { expect, test } from 'vitest';

const text = readFileSync('src/render/PaletteMaterial.ts', 'utf8');
const source = ts.createSourceFile('PaletteMaterial.ts', text, ts.ScriptTarget.Latest, true);
for (const [condition, work] of [
  ['look.glowAmount.greaterThan(0)', 'const glowDir'],
  ['lighting.subwayDarkness.greaterThan(0)', 'const offset'],
  ['look.hazeAmount.greaterThan(0)', 'const low'],
  ['look.groundBreakup.greaterThan(0).and(normalWorld.y.greaterThan(.7))', 'const breakup'],
] as const) {
  test(`PO #98 zero-contribution ${condition} stage keeps its original work inside the branch`, () => {
    const bodies: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.expression.getText(source) === 'If' && node.arguments[0]?.getText(source) === condition)
        bodies.push(node.arguments[1].getText(source));
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(bodies).toHaveLength(1); expect(bodies[0]).toContain(work);
  });
}
