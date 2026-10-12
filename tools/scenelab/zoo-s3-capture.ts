import { readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer } from './session';
const session = new SceneSession({ query: { ui: '1' } });
const before = process.argv.includes('--before');
const moveOnly = process.argv.find(arg => arg.startsWith('--move='))?.slice(7);
const phoneOnly = process.argv.includes('--phones');
const locomotionOnly = process.argv.includes('--locomotion');
const proofs: unknown[] = phoneOnly || moveOnly ? JSON.parse(readFileSync('docs/reports/zoo-s3/after-scenes.json', 'utf8')).filter((p: { name: string }) => phoneOnly ? !p.name.startsWith('phone-') : p.name !== moveOnly) : [];
try {
  await session.open();
  await session.page.addStyleTag({ content: '.menus,.pause-button{display:none!important}' });
  await session.page.evaluate(() => { document.body.dataset.uiScreen = 'game'; });
  const names = moveOnly ? [moveOnly] : phoneOnly ? [] : before || locomotionOnly ? ['locomotion'] : ['zebra-kick', 'zebra-stampede', 'flamingo-dive', 'locomotion'];
  for (const name of names) {
    await session.load(readSpec(`tests/scenes/zoo-s3/${name === 'locomotion' ? name : `qa-zoo-${name}`}.json`));
    const cells: {frame: number; jpeg: Buffer}[] = [];
    let previous = 0;
    for (const frame of [...new Set(name === 'locomotion' ? [0, 54, 60, 66, 90, 120, 171, 190] : [0, 1, name === 'zebra-stampede' ? 47 : 35, name === 'zebra-stampede' ? 48 : 36, 48, 60, 72, 84, 108, 180])].sort((a, b) => a - b)) {
      await session.step(frame - previous); previous = frame;
      cells.push({ frame, jpeg: await session.snapshot() });
    }
    const path = `docs/reports/zoo-s3/${before ? 'before' : 'after'}-${name}.jpg`;
    await session.makeSheet(cells, path, 480, 1000);
    proofs.push({ name, spec: readSpec(`tests/scenes/zoo-s3/${name === 'locomotion' ? name : `qa-zoo-${name}`}.json`), metrics: await session.metrics(), clipping: await session.clipping(), state: await session.describe(), errors: session.errors });
  }
  if (!before && !locomotionOnly && !moveOnly) {
    for (const [width, height] of [[390, 844], [844, 390]]) {
      await session.page.setViewportSize({ width, height });
      await session.page.addStyleTag({ content: '#hud,.hud{visibility:visible!important}' });
      await session.load(readSpec('tests/scenes/zoo-s3/qa-zoo-flamingo-dive.json'));
      await session.step(60); await session.screenshot(`docs/reports/zoo-s3/after-flamingo-phone-${width}.png`);
      proofs.push({ name: `phone-${width}`, state: await session.page.evaluate(() => window.__SS__!.getState().render) });
    }
  }
  writeFileSync(`docs/reports/zoo-s3/${before ? 'before' : 'after'}-scenes.json`, JSON.stringify(proofs) + '\n');
} finally { await session.close(); stopServer(); }
