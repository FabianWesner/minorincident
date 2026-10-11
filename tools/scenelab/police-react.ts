import { resolve } from 'node:path';
import { SceneSession, readSpec, stopServer, writeJson } from './session';
import { runSpec } from './run';

/** Headless reaction evidence and contact sheets; run through tools/e2e-lock.sh. */
const session = new SceneSession();
try {
  await session.open();
  for (const name of ['behind', 'rush', 'grab-alone', 'grab', 'carry-0', 'carry-1', 'bitten']) {
    const spec = readSpec(resolve(`docs/scenes/police-react/${name}.json`));
    const out = resolve(`test-results/police-react/${name}`);
    const captures = await runSpec(session, spec, { out });
    const evidence = await session.page.evaluate(() => {
      const api = window.__SS__!;
      return { actors: window.__SCENE__!.describe().actors, events: api.events(0).filter(e => e.type === 'ally.attack' || e.type === 'civilian.grabbed' || e.type === 'civilian.saved' || e.type === 'outbreak.bite') };
    });
    const reactions = evidence.actors.filter(a => a.id.startsWith('officer') || a.id === 'helper').map(actor => {
      const attacks = evidence.events.filter(e => e.type === 'ally.attack' && e.sourceId === actor.entity);
      return { actor: actor.id, firstAttack: attacks[0]?.tick ?? -1, attacks: attacks.length };
    });
    const combat = !name.startsWith('carry') && name !== 'bitten';
    const pass = captures.pass && (combat ? reactions.every(r => r.firstAttack >= 0 && r.firstAttack <= 24) : name.startsWith('carry') ? reactions.every(r => r.firstAttack >= 210 && r.firstAttack <= 234) : true);
    writeJson(`${out}/reaction.json`, { pass, reactions, ...evidence });
    console.log(JSON.stringify({ name, pass, reactions }));
    if (!pass) process.exitCode = 1;
  }
} catch (error) {
  console.log(JSON.stringify({ pass: false, error: String(error), consoleErrors: session.errors }));
  process.exitCode = 1;
} finally { await session.close(); stopServer(); }
