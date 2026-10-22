import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { expect, test } from 'vitest';

const text = readFileSync('src/render/PaletteMaterial.ts', 'utf8');
const source = ts.createSourceFile('PaletteMaterial.ts', text, ts.ScriptTarget.Latest, true);
for (const [strength, work] of [['look.glowAmount', 'const glowDir'], ['lighting.subwayDarkness', 'const offset']] as const) {
  test(`PO #98 inactive ${strength} stage keeps its original work inside a uniform branch`, () => {
    const bodies: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.expression.getText(source) === 'If' && node.arguments[0]?.getText(source) === `${strength}.greaterThan(0)`)
        bodies.push(node.arguments[1].getText(source));
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(bodies).toHaveLength(1); expect(bodies[0]).toContain(work);
  });
}
