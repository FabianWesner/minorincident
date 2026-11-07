/** Production-level EVAC passenger audit and capture matrix (headless). */
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from './session';
import type { Game } from '../../src/Game';
import { l3Dressing } from '../../src/levels/L3/layout';
import type { VehicleOccupant } from '../../src/render/characters/VehicleOccupant';

declare global { interface Window { __EVAC_GAME__?: Game } }
const tier = process.env.REVIEW_TIER === 'low' ? 'low' : 'high';
const backend = process.env.REVIEW_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
const negative = process.env.EVAC_NEGATIVE === '1';
const occluded = process.env.EVAC_OCCLUDED === '1';
const onlyL3 = process.env.REVIEW_LEVELS === 'L3';
const onlyL7 = process.env.REVIEW_LEVELS === 'L7';
const rosterSize = Number(process.env.REVIEW_ROSTER ?? 24);
const out = `test-results/r4-bus/${negative ? 'negative-' : occluded ? 'occluded-' : onlyL3 ? 'l3-recheck-' : onlyL7 ? `roster-${rosterSize}-` : ''}${backend}-${tier}`;
const session = new SceneSession({ tier, backend });
const receipt: unknown[] = [];
mkdirSync(out, { recursive: true });
async function load(level: string) {
  await session.page.evaluate(async ({ level, tier }) => {
    const api = window.__SS__!;
    api.settings.set({ quality: tier === 'low' ? 'low' : 'high' });
    await api.loadLevel(level, { seed: 1 }); api.pause();
    window.__EVAC_GAME__ = (window.__SCENE__ as unknown as { game: Game }).game;
    api.missions.begin(); api.pause(); api.cheats.god(true);
    await api.screenshotReady();
  }, { level, tier });
}
async function capture(name: string, at: number[], expected?: number, busId?: number) {
  for (const zoom of [.5, 1, 1.5]) {
    await session.page.evaluate(async ({ at, zoom }) => {
      const api = window.__SS__!, r = 19 * zoom, polar = Math.PI * .3;
      api.camera.follow();
      api.camera.zoom(zoom);
      api.camera.cinematic({ position: [at[0] + r * Math.sin(polar) / Math.SQRT2, at[1] + r * Math.cos(polar), at[2] + r * Math.sin(polar) / Math.SQRT2], target: at as [number, number, number] }, true);
      await api.screenshotReady();
    }, { at, zoom });
    if (negative && name === 'l4-bus0') await session.page.evaluate(() => {
      const assets = (window.__EVAC_GAME__!.view as unknown as { entityAssets: { updatePassengers(): void; passengers: Map<number, { visible: boolean }> } }).entityAssets;
      assets.updatePassengers = () => { for (const copy of assets.passengers.values()) copy.visible = false; };
    });
    if (occluded && expected === 1) await session.page.evaluate(() => {
      const game = window.__EVAC_GAME__!;
      const assets = (game.view as unknown as { entityAssets: { updatePassengers(): void; passengers: Map<number, { visible: boolean; pose(seat: unknown, wheel?: unknown, fit?: number): void }>; passengerSeats: Map<number, { position: { x: number; z: number } }> } }).entityAssets;
      const update = assets.updatePassengers.bind(assets);
      assets.updatePassengers = () => {
        update();
        for (const [id, copy] of assets.passengers) if (copy.visible) {
          const seat = assets.passengerSeats.get(id)!;
          const rows = Math.max(6, Math.ceil(game.world.l7Encounters!.state.roster.length / 4));
          seat.position.x = -4.25 + .5 * 7.37 / rows; seat.position.z = -.94; copy.pose(seat, undefined, .85);
        }
      };
    });
    await session.screenshot(`${out}/${name}-z${zoom}.png`);
    let passengerPixels: number | undefined;
    if (expected === 1) {
      // Same paused simulation frame, canvas only: UI pulses cannot count as
      // passenger pixels. Restore normal presentation before the next shot.
      const point = await session.page.evaluate(() => {
        const game = window.__EVAC_GAME__!;
        const assets = (game.view as unknown as { entityAssets: { passengers: Map<number, VehicleOccupant> } }).entityAssets;
        const copy = [...assets.passengers.values()].find(copy => copy.visible)!;
        const centre = copy.localToWorld(copy.position.clone().set(0, .25, 0));
        return game.view.project(centre.x, centre.y, centre.z);
      });
      const shown = PNG.sync.read(await session.page.locator('canvas').first().screenshot());
      await session.page.evaluate(() => {
        const assets = (window.__EVAC_GAME__!.view as unknown as { entityAssets: { updatePassengers(): void; restorePassengers?: () => void; passengers: Map<number, { visible: boolean }> } }).entityAssets;
        assets.restorePassengers = assets.updatePassengers;
        assets.updatePassengers = () => { for (const copy of assets.passengers.values()) copy.visible = false; };
      });
      await session.ready();
      const hidden = PNG.sync.read(await session.page.locator('canvas').first().screenshot());
      await session.page.evaluate(() => {
        const assets = (window.__EVAC_GAME__!.view as unknown as { entityAssets: { updatePassengers(): void; restorePassengers?: () => void } }).entityAssets;
        assets.updatePassengers = assets.restorePassengers!; delete assets.restorePassengers;
      });
      await session.ready();
      passengerPixels = 0;
      const screenX = (point[0] * .5 + .5) * shown.width, screenY = (.5 - point[1] * .5) * shown.height;
      for (let y = Math.max(0, Math.floor(screenY - 55 / zoom)); y < Math.min(shown.height, screenY + 55 / zoom); y++) for (let x = Math.max(0, Math.floor(screenX - 30 / zoom)); x < Math.min(shown.width, screenX + 30 / zoom); x++) {
        const i = (y * shown.width + x) * 4;
        // A 12/255 change includes the dark clothing in the night coach.
        if (Math.abs(shown.data[i] - hidden.data[i]) > 12 || Math.abs(shown.data[i + 1] - hidden.data[i + 1]) > 12 || Math.abs(shown.data[i + 2] - hidden.data[i + 2]) > 12) passengerPixels++;
      }
      assert.ok(passengerPixels >= 100 / zoom ** 2, `${name} z${zoom}: only ${passengerPixels} passenger pixels; passenger must be visible through the hull`);
    }
    const actual = await session.page.evaluate(busId => {
      const api = window.__SS__!, render = api.getState().render;
      const actor = render.entityAssets?.actors.find(a => a.id === busId);
      const props = (window.__EVAC_GAME__!.view as unknown as { l3Props?: { passengers: { visible: boolean }[] } }).l3Props;
      const assets = (window.__EVAC_GAME__!.view as unknown as { entityAssets?: { passengers: Map<number, { position: { x: number; z: number } }> } }).entityAssets;
      const passengerPositions = actor?.passengers.map(id => assets!.passengers.get(id)!.position);
      return { backend: api.perf().backend, quality: render.quality, passengers: actor?.passengers, passengerPositions, staticPassengers: props?.passengers.filter(p => p.visible).length, lod: actor?.lod, camera: render.camera, l7: api.getState().l7Departure, l4: api.missions.state()?.l4 };
    }, busId);
    if (name.startsWith('l3-')) assert.equal(actual.staticPassengers, 12, 'both L3 coaches retain six passengers');
    if (expected !== undefined) assert.equal(actual.passengers?.length, expected, `${name} z${zoom}: visible passenger copies`);
    assert.equal(actual.backend, backend === 'webgl2' ? 'webgl' : 'webgpu');
    assert.equal(actual.quality, tier);
    for (const seat of actual.passengerPositions ?? []) assert.ok(seat.x > -4.25 && seat.x < 3.12 && Math.abs(seat.z) < 1.1, 'passenger remains inside the cabin');
    receipt.push({ name, zoom, expected, busId, passengerPixels, actual });
    console.log(`${backend}/${tier} ${name} z${zoom} passengers=${actual.passengers?.length ?? 'static'}`);
  }
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ tier, backend, rows: receipt, errors: session.errors }, null, 2));
}
async function audit() {
  try {
    await session.open();
    session.page.on('framenavigated', frame => { if (frame === session.page.mainFrame()) console.log(`navigation: ${frame.url()}`); });
    if (!negative && !onlyL7) {
      await load('L3');
      const coaches = l3Dressing.filter(d => d.assetId === 'veh.evac-bus');
      for (const [index, coach] of coaches.entries()) {
        // Keep the courier in front of the subject: behind it, the normal
        // foreground-occlusion system legitimately cuts the coach out of the shot.
        await session.page.evaluate(async coach => { window.__SS__!.teleport('player', { x: coach.x + 6, z: coach.z + 5 }); await window.__SS__!.step(1); }, coach);
        await capture(`l3-bus${index}`, [coach.x, 1.4, coach.z]);
      }
    }
    if (onlyL3) return;
    if (!onlyL7) {
      await load('L4');
      const buses = await session.page.evaluate(() => {
        const game = window.__EVAC_GAME__!, s = game.world.missions!.state.l4!;
        return s.convoyIds.filter(id => game.world.entities.get(id)!.archetype === 'veh.evac-bus').map(id => ({ id, position: game.world.entities.get(id)!.transform, count: s.evacueeIds.length / 2 }));
      });
      for (const [index, bus] of buses.entries()) await capture(`l4-bus${index}`, [bus.position.x, 1.4, bus.position.z], bus.count, bus.id);
      await session.page.evaluate(async () => { const api = window.__SS__!; for (let i = 0; i < 45 && api.missions.state()?.l4?.seated; i++) { api.pause(); await api.step(60); } });
      for (const [index, bus] of buses.entries()) {
        const at = await session.page.evaluate(id => window.__EVAC_GAME__!.world.entities.get(id)!.transform, bus.id);
        await capture(`l4-unloaded${index}`, [at.x, 1.4, at.z], 0, bus.id);
      }
    }
    await load('L7');
    const l7 = await session.page.evaluate(rosterSize => {
      const w = window.__EVAC_GAME__!.world, d = w.l7Departure!.state;
      const base = w.entities.get(w.l7Encounters!.state.roster[0].id)!;
      for (let slot = w.l7Encounters!.state.roster.length; slot < rosterSize; slot++) {
        const id = w.npcs!.civilians.outbreak!.spawnPedestrian(base.transform, { model: base.appearance!.asset });
        const key = `capacity-${slot}`, entity = w.entities.get(id)!;
        entity.civilian!.survivor = { ...base.civilian!.survivor!, slot, key };
        w.l7Encounters!.state.roster.push({ id, key, injured: false, status: 'following', passed: false });
      }
      return { busId: d.busId, position: w.entities.get(d.busId)!.transform, roster: w.l7Encounters!.state.roster.map(r => r.id) };
    }, rosterSize);
    assert.equal(l7.roster.length, rosterSize);
    const at = [l7.position.x, 1.4, l7.position.z];
    await capture('l7-empty', at, 0, l7.busId);
    // Isolate the production boarding lifecycle at its authored queue: retain all
    // existing identities, move the real group to the queue and step the existing sim.
    await session.page.evaluate(() => {
      const w = window.__EVAC_GAME__!.world;
      for (const e of w.infected!.active) { e.hidden = true; e.health.current = 0; }
      window.__SS__!.teleport('player', { x: -70.5, z: 47.5 });
      for (const r of w.l7Encounters!.state.roster) {
        const e = w.entities.get(r.id)!;
        const slot = e.civilian!.survivor!.slot;
        window.__SS__!.teleport(e.id, { x: -68 + Math.floor(slot / 3) * .9, z: 46.7 + slot % 3 * .8 });
      }
    });
    for (const target of [1, 6, 12, rosterSize]) {
      const count = await session.page.evaluate(async target => {
        const api = window.__SS__!, w = window.__EVAC_GAME__!.world;
        for (let tick = 0; tick < 3600 && w.l7Departure!.state.boarded.length < target; tick++) { api.pause(); await api.step(1); }
        return w.l7Departure!.state.boarded.length;
      }, target);
      assert.equal(count, target, 'production boarding reaches requested count');
      await capture(`l7-boarded${target}`, at, target, l7.busId);
    }
    await session.page.evaluate(async () => { await window.__SS__!.step(90); });
    const moving = await session.page.evaluate(() => { const w = window.__EVAC_GAME__!.world; return { phase: w.l7Departure!.state.phase, at: w.entities.get(w.l7Departure!.state.busId)!.transform }; });
    assert.equal(moving.phase, 'departing');
    await session.screenshot(`${out}/l7-native-departure.png`);
    await capture('l7-departing', [moving.at.x, 1.4, moving.at.z], rosterSize, l7.busId);
    if (onlyL7) return;
    await load('L8');
    const l8 = await session.page.evaluate(() => { const w = window.__EVAC_GAME__!.world, id = w.missions!.l8!.state.busId; return { id, at: w.entities.get(id)!.transform, roster: w.missions!.l8!.state.roster.map(id => ({ id, hidden: w.entities.get(id)!.hidden })) }; });
    assert.ok(l8.roster.every(e => !e.hidden), 'L8 carried group has unloaded');
    await capture('l8-unloaded', [l8.at.x, 1.4, l8.at.z], 0, l8.id);
    assert.deepEqual(session.errors, []);
  } finally { writeFileSync(`${out}/receipt.json`, JSON.stringify({ tier, backend, rows: receipt, errors: session.errors }, null, 2)); await session.close(); stopServer(); }
}
await audit();
