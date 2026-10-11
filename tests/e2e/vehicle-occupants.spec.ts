import { boot, expect, test } from './fixtures';

for (const model of ['sedan', 'pickup', 'suv', 'police', 'ambulance', 'school-bus', 'fire-engine']) test(`PKG-13 @E09-AC02 @E09-AC10 ${model} draws the selected courier once and removes the driver on exit`, async ({ page }) => {
  await boot(page);
  {
    const state = await page.evaluate(async model => {
      const a = window.__SS__!; await a.loadScenario('survivor'); a.pause();
      const id = a.spawn(`vehicle.${model}`, { x: 0, z: 0 }); a.teleport('player', { x: .2, z: 2 });
      a.survivor.select('male'); a.input.set({ interact: true }); await a.step(1); a.input.clear(); await a.step(60); await a.screenshotReady();
      return { id, state: a.getState() };
    }, model);
    expect(state.state.player!.hidden, model).toBe(true);
    const car = state.state.render.vehicles.find(v => v.id === state.id)!;
    if ('occupants' in car) for (const gap of car.occupants[0].handGapM) expect(gap, model).toBeLessThan(.05);
    expect('occupants' in car ? car.occupants : [], model).toMatchObject([{ actorId: 1, asset: 'char.courier-male', seated: true }]);
    await page.evaluate(async () => { const a = window.__SS__!; a.survivor.select('female'); await a.screenshotReady(); });
    const selected = await page.evaluate(() => window.__SS__!.getState());
    const female = selected.render.vehicles.find(v => v.id === state.id)!;
    expect('occupants' in female ? female.occupants : []).toMatchObject([{ actorId: 1, asset: 'char.courier-female' }]);
    if ('occupants' in female) for (const gap of female.occupants[0].handGapM) expect(gap, `${model} female`).toBeLessThan(.05);
    await page.evaluate(async () => { const a = window.__SS__!; a.input.set({ interact: true }); await a.step(1); a.input.clear(); await a.screenshotReady(); });
    const exited = await page.evaluate(() => window.__SS__!.getState());
    expect(exited.player!.hidden).toBe(false);
    const empty = exited.render.vehicles.find(v => v.id === state.id)!;
    expect('occupants' in empty ? empty.occupants : []).toEqual([]);
  }
});

test('PKG-14 @E20-AC05 @E20-AC06 actual L2 crew seats follow hidden actors and all exit on arrival', async ({ page }) => {
  await boot(page);
  const ride = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L2'); a.pause(); a.missions.begin();
    a.missions.completeObjective('axe'); a.missions.completeObjective('calm'); a.missions.completeObjective('board'); await a.step(170); await a.screenshotReady(); return a.getState();
  });
  const l2 = ('l2' in ride.mission! ? ride.mission.l2 : undefined)!;
  expect(l2.seated).toBe(true); expect(ride.player!.hidden).toBe(true);
  const truck = ride.render.vehicles.find(v => v.id === l2.truckId)!;
  const occupants = 'occupants' in truck ? truck.occupants : [];
  expect(occupants.map(o => o.actorId).sort((a,b) => a-b)).toEqual([1, ...l2.crewIds].sort((a,b) => a-b));
  expect(new Set(occupants.map(o => o.position.join(','))).size).toBe(7);
  const arrived = await page.evaluate(async () => {
    const a=window.__SS__!;
    while (!a.missions.state()!.l2!.arrivedAt) await a.step(60);
    await a.step(60); await a.screenshotReady(); return a.getState();
  });
  expect(arrived.player!.hidden).toBe(false);
  const exit = await page.evaluate(() => window.__SS__!.events().find(e => e.type === 'vehicle.exited' && e.targetId === 1));
  expect(exit!.tick - ('l2' in arrived.mission! ? arrived.mission.l2!.arrivedAt : Infinity)).toBeLessThanOrEqual(30);
  const end = ('l2' in arrived.mission! ? arrived.mission.l2 : undefined)!; expect(end.crewExitAt-end.arrivedAt).toBeLessThanOrEqual(240);
  for (const id of end.crewIds) expect(arrived.entities.find(e=>e.id===id)!.hidden).toBe(false);
  const empty = arrived.render.vehicles.find(v=>v.id===end.truckId)!;
  expect('occupants' in empty ? empty.occupants : []).toEqual([]);
});
