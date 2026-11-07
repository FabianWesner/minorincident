import { humanInfected } from '../../../src/data/infected.ts';
import { regularInfectedModels } from '../../../src/data/crowdAppearance.ts';
import { alphaLooks } from '../../../src/data/alphaLooks.ts';
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { PNG } from "pngjs";
import { Matrix4, Vector3, Triangle } from "three";
import { SceneSession, readSpec, stopServer } from "../../scenelab/session";
import { provenance } from "./probe";
import { loadLevel } from "../../sim-runner/levels";
const shared = new SceneSession({ backend: "webgl2", tier: process.argv[3] });
try {
  {
    const backend = process.argv[2] ?? "webgl2", tier = process.argv[3] ?? "low";
    if (!["webgl2", "webgpu"].includes(backend) || !["low", "high"].includes(tier)) throw new Error("Expected backend and quality");
    const reportSlug = process.env.QA_REPORT_SLUG ?? "fix51-r10g";
    const out = `test-results/${reportSlug}/G-11-${backend}-${tier}`;
    mkdirSync(out, { recursive: true });
    const session = shared;
    const rows = [], shots = [];
    try {
      if (!session.isOpen) await session.open();
      await session.load({
        name: "G-11-pickup-rings",
        ground: "asphalt",
        time: "L1",
        tier: 0,
        actors: [
          { id: "courier", kind: "courier", at: [-8, -3], loadout: ["weapon.handgun", "weapon.fists"], state: { run: [[-3, 0], [-8, -3], [-3, 0]] } },
          { id: "follower", kind: "pedestrian", at: [3, 3], look: { model: "npc.civilian-man-b.aftermath" }, state: { survivor: { slot: 0 } } }
        ],
        camera: { mode: "pose", position: [8, 11, 9], target: [0, 0, 0] },
        frames: 1
      });
      const setup = await session.page.evaluate(() => {
        const world = window.__SCENE__.game.world;
        const courierId = world.combat.pickups.spawn("weapon.handgun", { x: -3, z: 0 }, false, { retain: true, interactTicks: 60 });
        const survivorId = world.combat.pickups.spawn("weapon.handgun", { x: 3, z: 0 }, false, { survivorOnly: true });
        const ledger = { collections: [], maxAwayAfterCollection: 0, returned: false };
        window.__pickupRingLedger = ledger;
        world.events.on("pickup.collected", (e) => {
          if (e.type === "pickup.collected" && "pickupId" in e && [courierId, survivorId].includes(e.pickupId)) ledger.collections.push({ id: e.pickupId, tick: e.tick, source: e.sourceId });
        });
        world.events.on("sim.tick", () => {
          if (!ledger.collections.some((e) => e.id === courierId)) return;
          const player = world.entities.get(1).transform, d = Math.hypot(player.x + 3, player.z);
          ledger.maxAwayAfterCollection = Math.max(ledger.maxAwayAfterCollection, d);
          if (ledger.maxAwayAfterCollection > 4 && d < 0.6) ledger.returned = true;
        });
        return { courierId, survivorId };
      });
      async function capture(stage) {
        await session.ready();
        const data = await session.page.evaluate((setup2) => {
          const game = window.__SCENE__.game;
          const actions = game.view;
          const pickups = [{ id: setup2.courierId, at: { x: -3, z: 0 }, survivorOnly: false }, { id: setup2.survivorId, at: { x: 3, z: 0 }, survivorOnly: true }].map((item) => {
            const group = actions.actions.pickups.get(item.id), p = window.__SS__.camera.project(item.at.x, 0.02, item.at.z);
            return { ...item, present: !!game.world.entities.get(item.id), markerMeshes: group?.children.filter((c) => c.isMesh).length ?? 0, modelLoaded: !!group?.children.some((c) => c.name === "pickup-rest" && c.children.length), pixel: { x: (p[0] + 1) * 640, y: (1 - p[1]) * 360 } };
          });
          const render = window.__SS__.getState().render;
          return {
            backend: render.backend,
            quality: render.quality,
            pickups,
            player: { ...game.world.entities.get(1).transform },
            ledger: structuredClone(window.__pickupRingLedger),
            replacementAtCourierSpot: [...game.world.entities.iterate()].filter((e) => e.pickup && "actionId" in e.pickup && Math.hypot(e.transform.x + 3, e.transform.z) < 0.5).map((e) => e.id)
          };
        }, setup);
        const file = join(out, `${stage}.png`), buffer = await session.screenshot(file), png = PNG.sync.read(buffer);
        const pixels = data.pickups.map((p) => {
          let yellow = 0;
          for (let y = Math.max(0, Math.floor(p.pixel.y - 40)); y < Math.min(png.height, Math.ceil(p.pixel.y + 40)); y++) for (let x = Math.max(0, Math.floor(p.pixel.x - 40)); x < Math.min(png.width, Math.ceil(p.pixel.x + 40)); x++) {
            const i = (y * png.width + x) * 4, r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
            if (r > 150 && g > 100 && r >= g * 0.9 && b < g * 0.75) yellow++;
          }
          return { id: p.id, yellowPixels: yellow };
        });
        rows.push({ stage, ...data, pixels, file, sha256: createHash("sha256").update(buffer).digest("hex") });
        shots.push({ frame: shots.length, jpeg: buffer });
      }
      await capture("before");
      await session.step(480);
      await capture("after-revisit");
      await session.makeSheet(shots, `test-results/${reportSlug}/G-11-${backend}-${tier}.jpg`, 640, 380);
    } finally {
      writeFileSync(`docs/reports/${reportSlug}/G-11-${backend}-${tier}.json`, JSON.stringify({
        ...provenance(),
        scriptSha256: createHash("sha256").update(readFileSync(import.meta.filename)).digest("hex"),
        backend,
        tier,
        setup: "paired authored/survivor-only pickup renderer fixture and Scene Lab native run-input out-and-back route; no timing claim",
        rows,
        errors: session.errors
      }, null, 2) + "\n");
    }
    console.log(`${backend}/${tier}: pickup rings and revisit captured`);
  }
  {
    let pixels = function(buffer, bars) {
      const png = PNG.sync.read(buffer);
      return bars.map((bar) => {
        let teal = 0;
        for (let y = Math.max(0, Math.floor(bar.y - bar.height / 2)); y < Math.min(png.height, Math.ceil(bar.y + bar.height / 2)); y++) {
          for (let x = Math.max(0, Math.floor(bar.x - bar.width / 2)); x < Math.min(png.width, Math.ceil(bar.x + bar.width / 2)); x++) {
            const i = (y * png.width + x) * 4, r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
            if (g > 90 && g > r * 1.4 && b > r * 1.3 && Math.abs(g - b) < 70) teal++;
          }
        }
        return { ...bar, tealPixels: teal, pass: teal >= bar.width * bar.height * 0.3 };
      });
    };
    const backend = process.argv[2] ?? "webgl2";
    const tier = process.argv[3] ?? "low";
    if (!["webgl2", "webgpu"].includes(backend) || !["low", "high"].includes(tier)) throw new Error("Expected backend and quality");
    const reportSlug = process.env.QA_REPORT_SLUG ?? "fix51-r10g";
    const out = `test-results/${reportSlug}/G-12-${backend}-${tier}`;
    mkdirSync(out, { recursive: true });
    const session = shared;
    const rows = [], shots = [];
    let negative;
    try {
      const world = await loadLevel("L6", 1, void 0, 0, { quality: tier });
      const roster = [];
      try {
        for (const entry of world.missions.state.l6.survivors) {
          const model = world.entities.get(entry.id)?.civilian?.model;
          if (!model) throw new Error(`Missing actual survivor model: ${entry.key}`);
          roster.push({ key: entry.key, model });
        }
      } finally {
        world.dispose();
      }
      if (roster.length > 35) throw new Error("Authored roster exceeds fixture capacity");
      while (roster.length < 35) roster.push({ key: `l7-extra-${roster.length}`, model: roster.length % 2 ? "npc.civilian-man-b.aftermath" : "npc.civilian-woman-b.aftermath" });
      if (!session.isOpen) await session.open();
      for (const zoom of [1.5]) {
        const spec = {
          name: "G-12-followers",
          ground: "asphalt",
          time: "L6",
          tier: 6,
          actors: [{ id: "courier", kind: "courier", at: [-8, 6] }, ...Array.from({ length: 35 }, (_, i) => ({
            id: `follower-${i}`,
            kind: "pedestrian",
            at: [(i % 7 - 3) * 2, (Math.floor(i / 7) - 2) * 2],
            look: { model: roster[i].model },
            state: { survivor: { slot: i } }
          }))],
          camera: { mode: "game", target: [0, 0, 0], zoom },
          frames: 1
        };
        await session.load(spec);
        await session.step(1);
        await session.ready();
        const ids = await session.page.evaluate(() => [...window.__SCENE__.game.world.entities.iterate()].filter((e) => e.civilian?.survivor?.mode === "follow").map((e) => e.id).sort((a, b) => a - b));
        if (ids.length !== 35) throw new Error(`Fixture has ${ids.length} followers`);
        for (let count = 35; count >= 1; count--) {
          await session.ready();
          const state = await session.page.evaluate(() => {
            const render = window.__SS__.getState().render;
            return { bars: render.healthBars, backend: render.backend, quality: render.quality, zoom: render.camera.zoom };
          });
          const expected = ids.slice(0, count), rendered = state.bars?.bars ?? [];
          const missing = expected.filter((id) => !rendered.some((bar) => bar.id === id));
          let capture;
          if ([1, 5, 6, 35].includes(count)) {
            const file = join(out, `z${zoom}-n${count}.png`), buffer = await session.screenshot(file);
            const pixelRows = pixels(buffer, rendered);
            capture = { file, sha256: createHash("sha256").update(buffer).digest("hex"), pixelRows };
            shots.push({ frame: zoom * 100 + count, jpeg: buffer });
            if (backend === "webgl2" && tier === "low" && count === 35) {
              await session.page.evaluate(() => {
                const view = window.__SCENE__.game.view;
                view.probes.hide.bars = true;
              });
              try {
                const file2 = join(out, "hidden-bars-negative-control.png"), hidden = await session.screenshot(file2);
                negative = { file: file2, sha256: createHash("sha256").update(hidden).digest("hex"), pixelRows: pixels(hidden, rendered) };
              } finally {
                await session.page.evaluate(() => {
                  const view = window.__SCENE__.game.view;
                  view.probes.hide.bars = false;
                });
              }
            }
          }
          rows.push({ zoom, count, roster: roster.slice(0, count), runtime: state, expectedIds: expected, missing, capture });
          if (count > 1) await session.page.evaluate((id) => {
            const world2 = window.__SCENE__.game.world;
            world2.spatial.delete(id);
            world2.entities.remove(id);
          }, ids[count - 1]);
          await session.step(1);
        }
      }
      await session.makeSheet(shots, `test-results/${reportSlug}/G-12-${backend}-${tier}.jpg`, 640, 380);
    } finally {
      writeFileSync(`docs/reports/${reportSlug}/G-12-${backend}-${tier}.json`, JSON.stringify({ ...provenance(), scriptSha256: createHash("sha256").update(readFileSync(import.meta.filename)).digest("hex"), backend, tier, setup: "isolated production renderer; actual L6 survivor model roster plus L7 fallback models up to35; healthy follow mode; remove one fixture entity per group-size sample; no gameplay route or timing claim", rows, negative, errors: session.errors }, null, 2) + "\n");
    }
    console.log(`${backend}/${tier}: ${rows.length} group-size samples, ${shots.length} captures`);
  }
  {
    const backend = process.argv[2] ?? "webgl2", tier = process.argv[3] ?? "low";
    if (!["webgl2", "webgpu"].includes(backend) || !["low", "high"].includes(tier)) throw new Error("Expected backend and quality");
    const reportSlug = process.env.QA_REPORT_SLUG ?? "fix51-r10g";
    const out = `test-results/${reportSlug}/G-24-${backend}-${tier}`;
    mkdirSync(out, { recursive: true });
    const session = shared;
    const species = ["lion", "gorilla", "elephant", "zebra", "flamingo"];
    const kinds = ["infected.alpha", ...species.map((name) => `infected.${name}`)];
    const point = (i) => [Math.cos(i * Math.PI / 3) * 8, Math.sin(i * Math.PI / 3) * 8];
    const camera = { mode: "pose", position: [24, 30, 28], target: [0, 1, 0] };
    const rows = [], shots = [];
    try {
      if (!session.isOpen) await session.open();
      const spec = {
        name: "G-24-enemies",
        ground: "asphalt",
        time: "L8-zoo",
        tier: 0,
        actors: [{ id: "courier", kind: "courier", at: [0, 0] }, ...kinds.map((archetype, i) => ({ id: archetype, kind: "infected", archetype, at: point(i), state: "idle" }))],
        camera,
        frames: 1
      };
      await session.load(spec);
      await session.step(1);
      await session.ready();
      async function capture(stage, expected) {
        await session.ready();
        const data = await session.page.evaluate(() => {
          const world = window.__SCENE__.game.world, render = window.__SS__.getState().render;
          return {
            backend: render.backend,
            quality: render.quality,
            bars: render.healthBars,
            player: { ...world.entities.get(1).transform },
            actors: [...world.entities.iterate()].filter((e) => e.infected || e.civilian?.zooAnimal).map((e) => ({ id: e.id, archetype: e.archetype, faction: e.faction, health: { ...e.health }, at: { ...e.transform }, animal: e.civilian?.zooAnimal }))
          };
        });
        const file = join(out, `${stage}.png`), buffer = await session.screenshot(file), png = PNG.sync.read(buffer);
        const pixels = (data.bars?.bars ?? []).map((bar) => {
          let red = 0;
          for (let y = Math.max(0, Math.floor(bar.y - bar.height / 2)); y < Math.min(png.height, Math.ceil(bar.y + bar.height / 2)); y++) for (let x = Math.max(0, Math.floor(bar.x - bar.width / 2)); x < Math.min(png.width, Math.ceil(bar.x + bar.width / 2)); x++) {
            const i = (y * png.width + x) * 4, r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
            if (r > 130 && r > g * 1.6 && r > b * 1.5) red++;
          }
          return { ...bar, redPixels: red, pass: red >= bar.width * bar.height * bar.fraction * 0.3 };
        });
        rows.push({ stage, expected, ...data, countPass: data.bars?.count === expected, pixels, file, sha256: createHash("sha256").update(buffer).digest("hex") });
        shots.push({ frame: shots.length, jpeg: buffer });
      }
      await capture("near-healthy", 6);
      await session.page.evaluate((camera2) => {
        window.__SS__.teleport("player", { x: 100, z: 100 });
        window.__SCENE__.setCamera(camera2);
      }, camera);
      await capture("far-healthy", 0);
      await session.page.evaluate(() => {
        const world = window.__SCENE__.game.world;
        for (const e of world.entities.iterate()) if (e.infected) e.health.current = e.health.max / 2;
      });
      await capture("far-damaged", 6);
      await session.page.evaluate((camera2) => {
        window.__SS__.teleport("player", { x: 0, z: 0 });
        window.__SCENE__.setCamera(camera2);
        const world = window.__SCENE__.game.world;
        let attackId = 7e3;
        for (const e of [...world.entities.iterate()]) if (e.infected) world.combat.damage.apply({
          attackId: attackId++,
          actionId: "weapon.rocket-launcher",
          sourceId: 1,
          targetId: e.id,
          origin: e.transform,
          direction: { x: 1, z: 0 },
          base: 1e6,
          multiplier: 1,
          type: "explosive",
          knockback: 0,
          stagger: 0,
          direct: true,
          permanent: true
        });
      }, camera);
      await session.step(2);
      await capture("dead-near", 0);
      await session.load({ ...spec, name: "G-24-healthy-zoo", actors: [{ id: "courier", kind: "courier", at: [0, 0] }, ...species.map((name, i) => ({ id: name, kind: "animal", species: name, at: point(i), state: "idle" }))] });
      await session.step(1);
      await capture("healthy-zoo", 0);
      await session.makeSheet(shots, `test-results/${reportSlug}/G-24-${backend}-${tier}.jpg`, 640, 380);
    } finally {
      writeFileSync(`docs/reports/${reportSlug}/G-24-${backend}-${tier}.json`, JSON.stringify({
        ...provenance(),
        scriptSha256: createHash("sha256").update(readFileSync(import.meta.filename)).digest("hex"),
        backend,
        tier,
        setup: "production renderer fixture; actual Alpha and five zoo species; native lethal damage; healthy animals; fixed camera; no route or timing claim",
        rows,
        errors: session.errors
      }, null, 2) + "\n");
    }
    console.log(`${backend}/${tier}: ${rows.length} bar eligibility transitions captured`);
  }
  {
    let gripGap = function(c) {
      const matrix = new Matrix4().fromArray(c.matrix), p = c.positions, index = c.index, triangles = [];
      for (let t = 0; t < (index?.length ?? p.length / 3); t += 3) {
        const tri = new Triangle();
        for (const [k, v] of [[0, tri.a], [1, tri.b], [2, tri.c]]) v.fromArray(p, (index ? index[t + k] : t + k) * 3).applyMatrix4(matrix);
        triangles.push(tri);
      }
      let gap = Infinity, nearest = null;
      const point = new Vector3(), near = new Vector3(), center = new Vector3();
      for (let i = 0; i < c.hand.length; i += 3) {
        point.fromArray(c.hand, i);
        center.add(point);
        for (const tri of triangles) {
          tri.closestPointToPoint(point, near);
          const d = point.distanceTo(near);
          if (d < gap) {
            gap = d;
            nearest = [point.toArray(), near.toArray()];
          }
        }
      }
      return { prop: c.prop, entity: c.entity, gapM: gap, nearest, handVertices: c.hand.length / 3, propTriangles: triangles.length, handCenter: center.divideScalar(c.hand.length / 3).toArray() };
    };
    const row = "G-26";
    if (!["G-19", "G-26"].includes(row)) throw Error("Expected G-19|G-26");
    const cases = row === "G-19" ? [["tests/scenes/catalog/collision-placement-l1-shutter.json", [0, 12, 36]], ["tests/scenes/catalog/collision-placement-corgi-fence.json", [0, 60, 120]], ["tests/scenes/catalog/collision-placement-corgi-wreck.json", [0, 60, 120]], ["tests/scenes/l8-apc/companion.json", [0, 61, 120, 160, 220, 320]]] : [["specs/scenes/catalog/ped-sit-all.json", [300]], ["specs/scenes/catalog/ped-newchars-sit.json", [300]], ["specs/scenes/catalog/ped-water-flowerbed.json", [420]], ["specs/scenes/catalog/ped-zoo-staff.json", [60]], ["tests/scenes/catalog/ped-grip-coffee-standing.json", [60]]];
    const out = process.env.SWEEP_G_CAPTURE_OUT ?? `test-results/sweep-g/${row}-scenes`;
    mkdirSync(out, { recursive: true });
    const result = { ...provenance(), row, method: "Existing authored production SceneLab cases, no actor/geometry/grip/balance edits. Read-only renderer and geometry evidence. Explicit fixture setup and scripted scene inputs; no campaign route or performance claim.", cells: [], errors: [] };
    try {
      for (const tier of [process.argv[3]]) {
        const s = shared;
        try {
          if (!s.isOpen) await s.open();
          for (const [file, frames] of cases) {
            const spec = readSpec(file);
            try {
              await s.load(spec);
              let at = 0;
              for (const frame of frames) {
                await s.step(frame - at);
                at = frame;
                await s.ready();
                const cell = { tier, case: spec.name, frame, captures: [] };
                if (row === "G-19") for (const zoom of [0.5, 1.5]) {
                  await s.page.evaluate((z) => window.__SS__.camera.zoom(z), zoom);
                  const path = `${out}/${tier}-${spec.name}-f${frame}-z${zoom}.png`;
                  await s.screenshot(path);
                  cell.captures.push({ file: path, zoom, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") });
                }
                else {
                  const path = `${out}/${tier}-${spec.name}-scene.png`;
                  await s.screenshot(path);
                  cell.captures.push({ file: path, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") });
                  const contacts = await s.page.evaluate(() => window.__SCENE__.game.view.labProbes().heldProps.map((c) => ({ prop: c.prop, entity: c.entity, matrix: c.matrix.toArray(), hand: Array.from(c.hand), positions: Array.from(c.geometry.getAttribute("position").array), index: c.geometry.index ? Array.from(c.geometry.index.array) : null })));
                  cell.grips = contacts.map(gripGap);
                  for (const [i, grip] of cell.grips.entries()) {
                    if (!grip.handVertices) continue;
                    await s.page.evaluate((p) => window.__SCENE__.setCamera({ mode: "pose", target: p, position: [p[0] + 1.4, p[1] + 0.6, p[2] + 1.4] }), grip.handCenter);
                    const path2 = `${out}/${tier}-${spec.name}-grip${i}-${grip.prop}.png`;
                    await s.screenshot(path2);
                    cell.captures.push({ file: path2, entity: grip.entity, prop: grip.prop, sha256: createHash("sha256").update(readFileSync(path2)).digest("hex") });
                  }
                }
                cell.observation = await s.page.evaluate(() => {
                  const g = window.__SCENE__.game, w = g.world, render = g.view.getState();
                  return { tick: w.tick, quality: g.quality.snapshot().tier, backend: render.backend, healthBars: render.healthBars, accessories: render.accessories, corgis: [...w.entities.iterate()].filter((e) => e.companion).map((e) => ({ id: e.id, hp: e.health.current, maxHp: e.health.max, hidden: !!e.hidden, passengerOf: e.passengerOf ?? null, at: { ...e.transform } })), gates: w.missions ? { values: { ...w.missions.state.gates }, shutter: w.missions.def.gates["fire-shutter"] ? w.missions.def.anchors[w.missions.def.gates["fire-shutter"].anchor] : null, inside: w.missions.def.anchors["fire-bay-trigger"], player: { ...w.entities.get(1).transform } } : null };
                });
                const metrics = await s.metrics();
                cell.metrics = { actors: metrics.actors, collision: metrics.collision, bodies: metrics.bodies, doors: metrics.doors, shutter: metrics.shutter, log: metrics.log };
                result.cells.push(cell);
                console.log(row, tier, spec.name, frame);
              }
            } catch (error) {
              result.errors.push({ tier, case: spec.name, error: String(error) });
            }
          }
          result.errors.push(...s.errors);
        } finally {
        }
      }
    } finally {
      writeFileSync(process.env.SWEEP_G_RECEIPT_OUT ?? `docs/reports/sweep-g/${row}-scenes.json`, JSON.stringify(result, null, 2) + "\n");
    }
  }

{shared.options.tier='low';
/** Current low-quality moving strips. One pooled lease per four body identities. */
const manifest=JSON.parse(readFileSync('src/assets/manifest.json','utf8'));
const entries=[...new Map([...humanInfected.map(d=>({model:d.asset,archetype:d.id})),...regularInfectedModels.map(model=>({model,archetype:'infected.runner'})),...Object.values(alphaLooks).flatMap(models=>models.map(model=>({model,archetype:'infected.alpha'}))),...manifest.filter(d=>d.id.startsWith('npc.')&&d.crowdSkin&&!/kid|brother|corgi|dog|cat|crow|lion|gorilla|flamingo|zebra|elephant/.test(d.id)).map(d=>({model:d.id,archetype:'turned pedestrian'}))].map(e=>[e.model,e])).values()];
const offset=0,count=1,runnerOnly=process.env.SWEEP_G_L4_RUNNERS==='1',chosen=runnerOnly?regularInfectedModels.map(model=>({model,archetype:'infected.runner'})):entries.filter(e=>e.model==='npc.civilian-woman-b.aftermath'),batchName=runnerOnly?'runners':offset,out='test-results/final-g/G-17';mkdirSync(out,{recursive:true});
const receipt={...provenance(),offset,totalIdentities:entries.length,inventory:entries,method:'Low quality, production game camera atzoom1.5; normal wander/chase after explicit SceneLab pose setup. Eight frames15ticks apart per state. Courier hidden for wander; converted civilian bodies use actual instant-infection path. Read-only pose/travel metrics. No pose tuning.',cells:[],errors:[]};
const s=shared;
try{if(!s.isOpen)await s.open();for(const entry of chosen)for(const mode of ['wander','chase']){try{
 const ped=entry.model.startsWith('npc.'),courier={id:'courier',kind:'courier',at:mode==='wander'?[35,35]:[-12,0],...(mode==='chase'?{state:{run:[[-12,0],[30,0]]}}:{})};
 await s.load({name:`G-17-${entry.model}-${mode}`,seed:5,size:100,ground:'asphalt',time:'L3',trace:true,actors:[courier,ped?{id:'z',kind:'pedestrian',at:mode==='wander'?[0,0]:[-19,0],look:{model:entry.model},state:{infect:{instant:true}}}:{id:'z',kind:'infected',archetype:entry.archetype,at:mode==='wander'?[0,0]:[-19,0],look:{model:entry.model},state:mode==='chase'?{chase:'courier'}:'idle'}],camera:{mode:'follow',actor:'z',zoom:1.5},frames:0});
 if(!ped)await s.page.evaluate(model=>{const lab=window.__SCENE__,e=lab.game.world.entities.get(lab.actors.get('z').entity);delete e.appearance;e.infected.model=model;if(model.startsWith('inf.')&&['inf.common-worker','inf.jogger','inf.cashier','inf.delivery-driver','inf.suburban-mom','inf.bbq-dad','inf.bathrobe-neighbor'].includes(model)){lab.game.world.scenario='L4';e.infected.variant=model;}},entry.model);
 if(mode==='wander')await s.page.evaluate(()=>{const lab=window.__SCENE__,g=lab.game,e=g.world.entities.get(lab.actors.get('z').entity);g.world.entities.get(1).hidden=true;delete e.noiseTarget;delete e.infected.scripted;e.infected.state='idle';if(e.infected.l1){const b=e.infected.l1;b.mode='wander';b.targetId=0;b.hasGoal=false;b.pauseUntil=g.world.tick;delete b.focusId;delete b.focusUntil;}});
 await s.step(45);if(mode==='wander')for(let i=0;i<20;i++){const moving=await s.page.evaluate(()=>{const lab=window.__SCENE__,e=lab.game.world.entities.get(lab.actors.get('z').entity);return (e.motion?.speed??0)>.1;});if(moving)break;await s.step(15);}
 const captures=[];for(let frame=0;frame<8;frame++){await s.step(15);await s.ready();const file=`${out}/${entry.model}-${mode}-${frame}.jpg`;await s.page.screenshot({path:file,type:'jpeg',quality:85});captures.push({frame,file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')});}
 const metrics=await s.metrics();receipt.cells.push({entry,mode,actor:metrics.actors?.z,captures,identityMatched:metrics.actors?.z?.track?.at(-1)?.appearance?.model===entry.model});console.log(entry.model,mode);}catch(error){receipt.errors.push({entry,mode,error:String(error)});console.log('SETUP',entry.model,mode);}}
 receipt.errors.push(...s.errors);
}finally{writeFileSync('docs/reports/final-g/G-17-current.json',JSON.stringify(receipt,null,2)+'\n');}
}

{
/** Current production corpse fixtures; setup is authored, observations are read only. */

const out = 'test-results/final-g/G-14';
mkdirSync(out, { recursive: true });
const result = { ...provenance(), method: 'Authored permanent-corpse fixtures, native updates and renderer geometry bounds; no corpse placement or animation changes.', cells: [], errors: [] };
try {
  for (const tier of ['low', 'high']) {
    shared.options.tier=tier;const session=shared;
    try {
      if(!session.isOpen)await session.open();
      for (const [file, frames] of [
        ['tests/scenes/catalog/corpse-placement-pile.json', [180, 600]],
        ['tests/scenes/catalog/l4-corpses-persist.json', [120, 7320]],
      ]) {
        const spec = readSpec(file);
        await session.load(spec);
        let at = 0;
        for (const frame of frames) {
          await session.step(frame - at); at = frame;
          await session.ready();
          const sample = await session.page.evaluate(() => {
            const game = window.__SCENE__.game, world = game.world;
            return { tick: world.tick, corpses: [...world.entities.iterate()].filter(e => e.corpse).map(e => ({ id: e.id, at: { ...e.transform }, health: e.health.current })), layout: window.__SS__.debug.corpseLayout() };
          });
          const captures = [];
          for (const zoom of [.5, 1.5]) {
            await session.page.evaluate(async z => { const a = window.__SS__; a.camera.follow(); a.camera.zoom(z); await a.screenshotReady(); }, zoom);
            const path = `${out}/${tier}-${spec.name}-f${frame}-z${zoom}.png`;
            await session.screenshot(path);
            captures.push({ file: path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
          }
          result.cells.push({ tier, case: spec.name, frame, sample, metrics: await session.metrics(), captures });
          console.log(tier, spec.name, frame, sample.corpses.length);
        }
      }
      result.errors.push(...session.errors);
    } catch (error) { result.errors.push({ tier, error: String(error) }); }
    finally {  }
  }
} finally {  writeFileSync('docs/reports/final-g/G-14-scenes.json', JSON.stringify(result, null, 2) + '\n'); }
}
} finally {
  await shared.close();
  stopServer();
}
