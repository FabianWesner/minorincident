import { expect, test } from 'vitest';
import ts from 'typescript';
import { ESLint } from 'eslint';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(`${dir}/${entry.name}`) : entry.name.endsWith('.ts') ? [`${dir}/${entry.name}`] : []);
}

test('T-E01-03 @E01 @E01-AC03 sim transitive import graph has no renderer or DOM dependencies', () => {
  const seen = new Set<string>();
  const mathClasses = new Set(['Vector2', 'Vector3', 'Quaternion', 'Euler', 'Matrix3', 'Matrix4', 'Box3', 'Sphere', 'Ray', 'MathUtils']);
  function visit(file: string): void {
    file = resolve(file); if (seen.has(file)) return; seen.add(file);
    expect(file).not.toMatch(/\/src\/(render|ui|debug)\//);
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function walk(node: ts.Node): void {
      let path: string | undefined;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) path = node.moduleSpecifier.text;
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) path = node.arguments[0].text;
      if (path) {
        if (path.startsWith('.')) visit(resolve(dirname(file), path.endsWith('.ts') ? path : `${path}.ts`));
        else if (path === 'three') {
          expect(ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)).toBeTruthy();
          if (ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
            for (const item of node.importClause.namedBindings.elements) expect(mathClasses.has((item.propertyName ?? item.name).text)).toBe(true);
          }
        } else expect(path).toBe('@dimforge/rapier3d-compat');
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
  }
  files('src/sim').forEach(visit);
  expect(seen.size).toBeGreaterThan(5);
});

test('T-E01-03b @E01 @E01-AC03 lint rejects unseeded randomness, DOM and renderer imports', async () => {
  const eslint = new ESLint();
  for (const code of ['Math.random();', 'window.alert("x");', 'document.title;', 'import "three/webgpu";', 'import "../render/View";']) {
    const [result] = await eslint.lintText(code, { filePath: 'src/sim/probe.ts' });
    expect(result.errorCount, code).toBeGreaterThan(0);
  }
});
