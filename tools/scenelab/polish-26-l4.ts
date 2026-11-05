import type { Game } from '../../src/Game';
import { SceneSession, stopServer, writeJson } from './session';

/** Matched L4 breach observation with actual keyboard/attack input and a per-second AI trace. */
const out = process.argv[2] ?? 'test-results/polish-26/l4-before';
const session = new SceneSession({ backend: 'webgl2', tier: process.argv[3] === 'high' ? 'high' : 'low' });
const seed = Number(process.argv[4] ?? 3), full = process.argv[5] === 'full';
const seconds = Number(process.argv[6] ?? 240);
try {
  await session.open();
  await session.page.evaluate(async ({ seed, full }) => {
    const a = window.__SS__!; await a.loadLevel('L4', { seed, ...(!full ? { checkpoint: 'turn' } : {}), progression: 'L4-default' });
    a.pause(); a.cheats.god(true);
    if (full) {
      a.bot.start('complete');
      for (let ticks = 0; ticks < 12000 && (a.missions.state()?.l4?.phase !== 'war'); ticks += 120) await a.step(120);
      a.bot.stop();
    }
    a.teleport('player', seed === 1 ? { x: -21.8, z: -5.1 } : { x: -29, z: 4 }); a.camera.follow(); a.camera.zoom(1.5);
    const g = (window.__SCENE__ as unknown as { game: Game }).game; g.ui.show(null);
  }, { seed, full });
  await session.page.keyboard.down('d'); await session.page.evaluate(() => window.__SS__!.step(45)); await session.page.keyboard.up('d');
  await session.page.mouse.move(350, 350); await session.page.keyboard.down('Space');
  await session.page.evaluate(() => window.__SS__!.step(120)); await session.page.keyboard.up('Space');
  if (seed === 1) await session.page.evaluate(() => window.__SS__!.teleport('player', { x: -21.8, z: -5.1 }));
  const samples = [];
  for (let second = 0; second <= seconds; second++) {
    const sample = await session.page.evaluate(() => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game;
      const a = window.__SS__!, entities = [...g.world.entities.iterate()];
      const nav = g.world.infected!.nav, player = a.getEntity(1)!.transform, cell = nav.cell(player.x, player.z);
      return { tick: g.world.tick, player: a.getEntity(1)!.transform, l4: g.world.missions!.state.l4,
        flow: { playerCell: cell, playerCellBlocked: !!nav.blocked[cell], nearest: nav.nearestCell(player.x, player.z) },
        enemies: entities.filter(e => e.infected && !e.hidden && e.health.current > 0).map(e => ({ id: e.id, at: { ...e.transform }, speed: e.motion?.speed ?? 0,
          archetype: e.archetype, state: e.infected!.state, attacking: e.combat?.attacking, emerging: !!e.emerging,
          scripted: e.infected!.scripted, breach: e.infected!.breachApproach, army: e.infected!.l4ArmyApproach,
          focus: e.infected!.l1?.focusId ?? e.infected!.heardTargetId, path: e.infected!.path.length, goal: e.infected!.goal,
          flowNext: nav.flowNext(nav.nearestCell(e.transform.x, e.transform.z, e.combat!.radius)),
          flowFrom: nav.nearestCell(e.transform.x, e.transform.z, e.combat!.radius),
          brain: e.infected!.l1?.mode, locomotion: e.locomotion, reaction: e.combat?.reaction })),
        corpses: entities.filter(e => e.corpse).length };
    });
    samples.push(sample);
    if ([30, 60, 90, 150, 180, 210, 240].includes(second)) {
      await session.page.evaluate(() => window.__SS__!.screenshotReady());
      await session.screenshot(`${out}/second-${second}.png`);
      writeJson(`${out}/trace.json`, samples); console.log(`L4 ${second}s: ${sample.enemies.length} live, ${sample.corpses} corpses`);
    }
    if (second < seconds) await session.page.evaluate(() => window.__SS__!.step(60));
  }
  writeJson(`${out}/trace.json`, samples); writeJson(`${out}/errors.json`, session.errors);
} finally { await session.close(); stopServer(); }
