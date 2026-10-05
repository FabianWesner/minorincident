import { expect, test } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'vite';

test('T-E01-01 @E01 @E01-AC01 app and deployment scripts', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  expect(pkg.name).toBe('minor-incident');
  expect(pkg.dependencies).not.toHaveProperty('wrangler');
  expect(pkg.devDependencies).not.toHaveProperty('wrangler');
  expect(pkg.scripts.deploy).toBe('npm run build && npx --yes wrangler@4 pages deploy dist --project-name minor-incident');
  for (const command of ['dev', 'build', 'typecheck', 'lint', 'test:unit', 'test:sim', 'test:e2e', 'test:visual', 'test:perf', 'test:smoke', 'verify', 'sim', 'assets:validate', 'assets:turntable']) {
    expect(pkg.scripts[command]).toBeTypeOf('string');
  }
  expect(readFileSync('index.html', 'utf8')).toContain('<title>Minor Incident</title>');
});

test.skipIf(!existsSync('preview'))('T-E01-previews @E01 dev server serves optional preview pages', async () => {
  // Use another available port so the existing dev server on 3300 stays available.
  const server = await createServer({
    server: { port: 3302, strictPort: false },
    configLoader: 'runner',
    // This test requests HTML only; avoid background dependency scans during teardown.
    optimizeDeps: { entries: [], noDiscovery: true },
  });
  try {
    await server.listen();
    const url = server.resolvedUrls!.local[0];
    for (const name of readdirSync('preview').filter((name) => name.endsWith('.html'))) {
      const response = await fetch(`${url}preview/${name}`);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('/@vite/client');
      expect(html).toContain(readFileSync(`preview/${name}`, 'utf8').match(/<title>.*?<\/title>/)![0]);
    }
  } finally {
    await server.close();
  }
});

test('T-E01-notices @E01 Bruno adaptations retain the MIT notice and source mapping', () => {
  const notice = readFileSync('THIRD_PARTY_NOTICES.md', 'utf8');
  expect(notice).toContain('Copyright (c) 2025 Bruno Simon');
  expect(notice).toContain('Permission is hereby granted');
  function inspect(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) inspect(path);
      else if (entry.name.endsWith('.ts') && readFileSync(path, 'utf8').includes('Adapted from folio-2025 by Bruno Simon (MIT)')) expect(notice).toContain(path);
    }
  }
  inspect('src');
});
