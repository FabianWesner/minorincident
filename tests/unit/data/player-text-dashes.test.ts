import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';

/** PO 2026-10-15: "Make sure we don't have em-dashes". Every string literal in the sources that hold player-facing text
 * (dialogue, objectives, captions, HUD, menus, tutorial, loading cards, credits, input hints) must be free of em dashes
 * and of en dashes used as dashes. Comments are not player text and are ignored. */
const roots = ['src/data', 'src/ui', 'src/levels', 'src/sim/missions', 'src/audio', 'src/input', 'src/Game.ts'];
const files = (path: string): string[] => statSync(path).isDirectory() ? readdirSync(path).flatMap(name => files(join(path, name))) : path.endsWith('.ts') ? [path] : [];
const dash = (text: string) => text.includes('—') || /(^|\s)–(\s|$)/.test(text);

test('player-facing text sources contain no em dashes or en dashes used as dashes', () => {
  const offenders: string[] = [];
  const scanned = roots.flatMap(files);
  expect(scanned.length).toBeGreaterThan(100);
  for (const file of scanned) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        if (dash(node.text)) offenders.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${JSON.stringify(node.text)}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  for (const file of ['index.html', 'public/site.webmanifest']) {
    const text = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    if (dash(text)) offenders.push(file);
  }
  expect(offenders).toEqual([]);
});

test('the dash guard catches em dashes and spaced en dashes but keeps numeric ranges and hyphens', () => {
  expect(dash('Doors coming open — go!')).toBe(true);
  expect(dash('Hold on – almost there')).toBe(true);
  expect(dash('Seeded 20–35 s interval')).toBe(false);
  expect(dash('thirty-plus civilians')).toBe(false);
});
