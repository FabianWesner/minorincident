import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('PO #32 debug-info links leave physics wireframes off; physics is explicit', () => {
  const view = readFileSync('src/render/GameView.ts', 'utf8');
  const condition = view.match(/if \((this\.params\.get\('debug'\) === 'physics')\) \{\s*this\.wireframe = new PhysicsWireframe/);
  expect(condition).not.toBeNull();
  for (const query of ['', 'debug', 'debug=true', 'debug=physics']) {
    const params = new URLSearchParams(query);
    expect(params.get('debug') === 'physics').toBe(query === 'debug=physics');
  }
  expect(view).toContain("this.actions.showCone = this.params.has('debug')");
});
