/** r27-visp2: kill each zoo animal inside the real L8 level (plain kill, rocket blast, gun kill) and capture the settled corpses.
 *   E2E_PORT=4897 SCENE_PORT=4898 npm run browser... -> sh tools/e2e-lock.sh tsx tools/qa/r27-zoo-corpses.ts <low|high> <webgl2|webgpu> <stage> [zoom]
 * Captures to test-results/r27/<stage>/L8-<tier>-<backend>/. */
import { mkdirSync } from 'node:fs';
import { preset } from '../../src/sim/progression/Campaign';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';

const tier = (process.argv[2] ?? 'low') as 'low' | 'high', backend = (process.argv[3] ?? 'webgpu') as Backend, stage = process.argv[4] ?? 'before';
const zooms = process.argv[5] ? [Number(process.argv[5])] : [1, 1.5];
const out = `test-results/r27/${stage}/L8-${tier}-${backend}`; mkdirSync(out, { recursive: true });
const session = new SceneSession({ tier, backend, query: { profile: '0', ui: '0' } });
try {
  await session.open(); await session.page.evaluate('window.__name = f => f');
  const save = preset('L8-default'); save.settings.quality = tier;
  await session.page.evaluate(async ({ tier, save }) => {
    const a = window.__SS__!; a.campaign.restore(save); await a.loadLevel('L8', { seed: 1 }); a.pause();
    a.settings.set({ quality: tier, cameraShake: false }); a.cheats.god(true); a.missions.begin(); a.camera.follow(); await a.step(60);
  }, { tier, save });
  if (process.env.R27_L10) {
    // L10 farm hide gap (883, 14): the roof cutaway of the farmhouse beside the route.
    const [px, pz] = process.env.R27_L10.split(',').map(Number);
    const save10 = preset('L10-default'); save10.settings.quality = tier;
    await session.page.evaluate(async ({ tier, save, px, pz, off }) => {
      const a = window.__SS__!; a.campaign.restore(save); await a.loadLevel('L10', { seed: 1 }); a.pause();
      a.settings.set({ quality: tier, cameraShake: false }); a.cheats.god(true); a.missions.begin(); a.camera.follow(); await a.step(30);
      a.teleport('player', { x: px, z: pz }); a.cheats.killAll(); await a.step(90); a.pause();
      if (off) a.settings.set({ seeThroughOff: true });
    }, { tier, save: save10, px, pz, off: !!process.env.R27_OFF });
    const near = await session.page.evaluate(async ({ px, pz }) => {
      const g = (window.__SCENE__ as unknown as { game: { world: { districts?: { districts: { layout: { placements: { id: string; assetId: string; position: number[] }[] } }[] } } } }).game;
      return g.world.districts?.districts.flatMap(d => d.layout.placements).filter(p => /^bld\./.test(p.assetId) && Math.hypot(p.position[0] - px, p.position[2] - pz) < 40).map(p => `${p.id} ${p.assetId} ${p.position.map(n => Math.round(n)).join(',')}`);
    }, { px, pz });
    console.log((near ?? []).join('\n'));
    if (process.env.R27_MATS) console.log((await session.page.evaluate(() => {
      const g = (window.__SCENE__ as unknown as { game: { view: { scene: { traverse(f: (n: Record<string, unknown>) => void): void } } } }).game;
      const rows = new Set<string>();
      g.view.scene.traverse(n => {
        if (!/cure-duplex/.test(String(n.name)) && !/cure-duplex/.test(String((n.parent as { name?: string } | undefined)?.name))) return;
        const m = n.material as { name?: string; side?: number; userData?: { seeThrough?: unknown } } | undefined;
        if (m) rows.add(`${n.name} mat=${m.name} side=${m.side} seeThrough=${String(m.userData?.seeThrough)} vis=${n.visible}`);
      });
      return [...rows].join('\n');
    })));
    for (const zoom of zooms) {
      await session.page.evaluate(async zoom => { const a = window.__SS__!; a.camera.follow(); a.camera.zoom(zoom); for (let i = 0; i < 4; i++) await a.step(10); await a.screenshotReady(); }, zoom);
      await session.page.screenshot({ path: `${out}/l10-z${zoom}.jpg`, type: 'jpeg', quality: 90 });
    }
    console.log('done', out, session.errors.slice(0, 5)); await session.close(); stopServer(); process.exit(0);
  }
  if (process.env.R27_CANOPY) {
    // L8 monkey arena: courier at the entry, the pack and some survivors under the crowns; captures at both zooms.
    await session.page.evaluate(async () => {
      const a = window.__SS__!; a.cheats.killAll(); a.teleport('player', { x: -2, z: 13 }); await a.step(60);
      const p = a.getEntity(1)!.transform as { x: number; z: number };
      for (let i = 0; i < 6; i++) { try { a.spawn('infected.monkey', { x: p.x - 3 - (i % 3) * 2.2, z: p.z - 2 + Math.floor(i / 3) * 4 }); } catch { /* blocked */ } }
      for (let i = 0; i < 4; i++) { try { a.npcs.civilian('civilian-man-a', { x: p.x - 2 - i * 1.6, z: p.z + 3 }); } catch { /* blocked */ } }
      await a.step(30); a.pause();
    });
    for (const zoom of zooms) {
      await session.page.evaluate(async zoom => { const a = window.__SS__!; a.camera.follow(); a.camera.zoom(zoom); for (let i = 0; i < 4; i++) await a.step(10); await a.screenshotReady(); }, zoom);
      await session.page.screenshot({ path: `${out}/canopy-z${zoom}.jpg`, type: 'jpeg', quality: 90 });
    }
    console.log('done', out, session.errors.slice(0, 5)); await session.close(); stopServer(); process.exit(0);
  }
  if (process.env.R27_ONE) {
    // One animal, killed in place: live fall then the settled frozen corpse, all in the real level.
    const kind = process.env.R27_ONE;
    await session.page.evaluate(async kind => {
      const a = window.__SS__!; a.cheats.killAll(); await a.step(30);
      const p = a.getEntity(1)!.transform as { x: number; z: number };
      a.spawn(`infected.${kind}`, { x: p.x + 2.2, z: p.z - 3.2 }); await a.step(30);
    }, kind);
    let at = 0;
    for (const wait of [0, 20, 40, 80, 200]) {
      await session.page.evaluate(async ({ wait, kill, zz }) => { const a = window.__SS__!; if (kill) a.cheats.killAll(); await a.step(wait); a.camera.follow(); a.camera.zoom(zz); await a.screenshotReady(); }, { zz: Number(process.env.R27_Z ?? 1.5), wait: wait - at, kill: wait === 0 });
      at = wait;
      await session.page.screenshot({ path: `${out}/one-${kind}-t${wait}.jpg`, type: 'jpeg', quality: 92 });
    }
    console.log('done', out, session.errors.slice(0, 5)); await session.close(); stopServer(); process.exit(0);
  }
  for (const mode of (process.env.R27_MODES ?? 'plain,blast').split(',')) {
    const species = mode === 'zebras' ? Array(8).fill('zebra') : ['zebra', 'lion', 'lioness', 'gorilla', 'elephant', 'monkey', 'flamingo'];
    await session.page.evaluate(async ({ species, mode }) => {
      const a = window.__SS__!; a.cheats.killAll(); await a.step(30);
      const p = a.getEntity(1)!.transform as { x: number; z: number };
      const ids: number[] = [];
      species.forEach((s, i) => { try { ids.push(a.spawn(`infected.${s}`, { x: p.x + 4 + (i % 4) * 3.6, z: p.z - 5 + Math.floor(i / 4) * 5 })); } catch { /* blocked */ } });
      await a.step(30);
      if (mode === 'blast') species.forEach((s, i) => a.explosions.blast('explosion.rocket', { x: p.x + 4 + (i % 4) * 3.6 + 1.2, z: p.z - 5 + Math.floor(i / 4) * 5 }));
      a.cheats.killAll(); await a.step(300);
    }, { species, mode });
    for (const zoom of zooms) {
      await session.page.evaluate(async zoom => { const a = window.__SS__!; a.camera.follow(); a.camera.zoom(zoom); for (let i = 0; i < 3; i++) await a.step(10); await a.screenshotReady(); }, zoom);
      await session.page.screenshot({ path: `${out}/${mode}-z${zoom}.jpg`, type: 'jpeg', quality: 90 });
    }
  }
  if (process.env.R27_DUMP) {
    // Which frozen pages are drawn, and does each have a surface (atlas) binding?
    const rows = await session.page.evaluate(async () => {
      const path = '/src/render/characters/crowdTexture.ts', mod = await import(/* @vite-ignore */path);
      const g = (window.__SCENE__ as unknown as { game: { view: { scene: { traverse(f: (n: { name: string; count?: number; geometry?: object }) => void): void } } } }).game;
      const out: string[] = [];
      g.view.scene.traverse(n => {
        const x = n as unknown as { userData?: { crowdAtlas?: { id: string; width: number } } };
        if (n.name.startsWith('corpses:')) { const b = mod.crowdSurfaceBindings.get(n.geometry); out.push(`${n.name} count=${n.count} bound=${!!b} atlas=${b?.textures?.[0]?.uuid?.slice(0, 8)} w=${b?.textures?.[0]?.image?.width}`); }
        else if (x.userData?.crowdAtlas && /zebra|lion|monkey/.test(n.name)) out.push(`batch ${n.name} lod=${(n.geometry as { userData?: { crowdLod?: string } } | undefined)?.userData?.crowdLod} atlas=${x.userData.crowdAtlas.id.slice(0, 8)} w=${x.userData.crowdAtlas.width}`);
      });
      return out;
    });
    console.log(rows.join('\n'));
  }
  console.log('done', out, session.errors.slice(0, 5));
} finally { await session.close(); stopServer(); }
