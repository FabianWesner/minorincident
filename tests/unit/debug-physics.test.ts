import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('PO #32 debug-info links leave physics wireframes off; physics is explicit', () => {
  const view = readFileSync('src/render/GameView.ts', 'utf8');
  expect(view).toContain("if (__QA_HOOKS__ && this.params.get('debug') === 'physics') {");
  for (const query of ['', 'debug', 'debug=true', 'debug=physics']) {
    const params = new URLSearchParams(query);
    expect(params.get('debug') === 'physics').toBe(query === 'debug=physics');
  }
  expect(view).toContain("this.actions.showCone = __QA_HOOKS__ && (this.params.has('debug')");
});
