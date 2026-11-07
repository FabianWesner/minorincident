/** Release blocker reproductions: production authored scenes and read-only renderer telemetry. */
import { Matrix4, Triangle, Vector3 } from 'three';
import { PNG } from 'pngjs';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer } from '../scenelab/session.ts';
import { measureCourierShare } from '../scenelab/run.ts';
import { provenance } from './accept/probe.ts';
const [row = 'G14', stage = 'before', tier = 'low'] = process.argv.slice(2);
const out = `test-results/blk-v/${stage}/${row}-${tier}`;
mkdirSync(out, { recursive: true });
const result = { ...provenance(), row, stage, tier, captures: [], samples: [], errors: [] };
const session = new SceneSession({ tier, backend: process.env.BACKEND ?? 'webgl2' });
async function capture(label) {
  if (stage === 'grips') return;
  const file = `${out}/${label}.png`;
  const bytes = await session.screenshot(file);
  result.captures.push({ file, sha256: createHash('sha256').update(bytes).digest('hex') });
}

async function gripAudit() {
  const contacts = await session.page.evaluate(() => window.__SCENE__.game.view.labProbes().heldProps.map(c => ({entity:c.entity,prop:c.prop,hand:Array.from(c.hand),matrix:c.matrix.toArray(),positions:Array.from(c.geometry.getAttribute('position').array),indices:Array.from(c.geometry.index.array)})));
  return contacts.map(c => {
    const matrix=new Matrix4().fromArray(c.matrix),point=new Vector3(),nearest=new Vector3(),triangle=new Triangle(),positions=c.positions;
    let gap=Infinity;
    for(let t=0;t<c.indices.length;t+=3) {
      triangle.a.fromArray(positions,c.indices[t]*3).applyMatrix4(matrix);triangle.b.fromArray(positions,c.indices[t+1]*3).applyMatrix4(matrix);triangle.c.fromArray(positions,c.indices[t+2]*3).applyMatrix4(matrix);
      for(let i=0;i<c.hand.length;i+=3) {point.fromArray(c.hand,i);triangle.closestPointToPoint(point,nearest);gap=Math.min(gap,point.distanceTo(nearest));}
    }
    return {entity:c.entity,prop:c.prop,gapM:gap};
  });
}

async function skinAudit() {
  return session.page.evaluate(async () => {
    const {premultiplyRow,skinnedVertexMatrix} = await import('/src/render/characters/skinnedCrowd.ts');
    const g = window.__SCENE__.game, rows = [];
    for (const batch of g.view.labProbes().npcs.civilians.batches) {
      const mesh=batch.mesh;
      if (!mesh?.count) continue;
      const geometry=mesh.geometry,p=geometry.getAttribute('position'),q=geometry.getAttribute('_gripPosition'),parts=geometry.getAttribute('_parts'),skin=geometry.getAttribute('_skin'),index=geometry.index;
      for(let instance=0;instance<mesh.count;instance++) {
        const frame=batch.overlay.getW(instance),blend=batch.tint.getW(instance),pose=batch.poses.pose(frame,Math.floor(blend/2),blend%2),premultiplied=new Float32Array(pose.length),m=new Float32Array(16),vertices=[];
        premultiplyRow(pose,premultiplied,batch.bakedClip.binds,0,batch.bakedClip.parts.length,0);
        const grip=batch.overlay.getZ(instance)<0;
        for(let i=0;i<p.count;i++) { const source=grip&&parts.getX(i)!==3?q:p,x=source.getX(i),y=source.getY(i),z=source.getZ(i);skinnedVertexMatrix(batch.bakedClip,0,parts,skin,i,m,premultiplied);vertices.push([m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]]); }
        const worst=[];
        for(let t=0;t<(index?.count??p.count);t+=3)for(let side=0;side<3;side++) {
          const a=index?index.getX(t+side):t+side,b=index?index.getX(t+(side+1)%3):t+(side+1)%3;
          const rest=Math.hypot(p.getX(a)-p.getX(b),p.getY(a)-p.getY(b),p.getZ(a)-p.getZ(b));if(rest<.005)continue;
          const posed=Math.hypot(...vertices[a].map((v,k)=>v-vertices[b][k]));
          if(posed/rest>2)worst.push({ratio:posed/rest,rest,posed,parts:[batch.bakedClip.parts[parts.getX(a)],batch.bakedClip.parts[parts.getX(b)]],vertices:[a,b]});
        }
        worst.sort((a,b)=>b.ratio-a.ratio);rows.push({model:batch.model,lod:batch.lod,instance,over2:worst.length,worst:worst.slice(0,4)});
      }
    }
    return rows;
  });
}

try {
  await session.open();
  const spec = readSpec(row === 'G14' ? 'tests/scenes/catalog/l4-corpses-persist.json' : 'specs/scenes/catalog/ped-zoo-staff.json');
  if (stage === 'no-props') for (const actor of spec.actors) if (actor.look) actor.look.handProp = null;
  await session.load(spec);
  let previous = 0;
  for (const tick of row === 'G14' ? (stage.includes('overlap') ? [] : [120, 7320]) : [60]) {
    await session.step(tick - previous); previous = tick;
    await session.ready();
    result.samples.push(await session.page.evaluate(() => {
      const g = window.__SCENE__.game;
      return { tick: g.world.tick, corpses: [...g.world.entities.iterate()].filter(e => e.corpse).map(e => ({ id: e.id, archetype: e.archetype, at: {...e.transform} })), layout: window.__SS__.debug.corpseLayout(), render: window.__SS__.getState().render.quality };
    }));
    for (const zoom of [.5, 1.5]) {
      await session.page.evaluate(async ({zoom,row}) => { const api = window.__SS__, g = window.__SCENE__.game; api.camera.zoom(zoom); if (row === 'G14') { api.camera.follow(); g.view.view.update(g.world.entities.get(1).transform, 1); } else api.camera.cinematic({position:[-2.5+15*zoom,.8+19*zoom,15*zoom],target:[-2.5,.8,0]},true); await api.screenshotReady(); }, {zoom,row});
      await capture(`tick${tick}-z${zoom}`);
    }
    if (row === 'G14' && tick === 120 && stage === 'before') {
      // Diagnostic redraw only: distinguish the subject cut from absent body geometry.
      await session.page.evaluate(async () => {
        const { seeThrough } = await import('/src/render/SeeThrough.ts');
        const g = window.__SCENE__.game;
        seeThrough.corpse.value = 0;
        if (g.view.postFx) g.view.postFx.render(); else g.view.renderer.render(g.view.scene, g.view.camera);
      });
      const file = `${out}/tick120-no-cut-diagnostic.png`;
      const bytes = await session.page.screenshot({path: file});
      result.captures.push({file, sha256: createHash('sha256').update(bytes).digest('hex')});
    }
    if (row === 'G26') result.skin = [{camera:'wide',rows:await skinAudit()}];
    if (row === 'G26') for (const [name, target] of [['bag', [0, .85, 2]], ['phone', [-5, .85, 2]]]) {
      await session.page.evaluate(async target => { window.__SS__.camera.cinematic({position:[target[0]+2.7, target[1]+2.2, target[2]+3.4],target},true); await window.__SS__.screenshotReady(); }, target);
      await capture(`tick${tick}-${name}-close`);
      result.skin.push({camera:name,rows:await skinAudit()});
      if (stage === 'grips') (result.grips ??= []).push({camera:name,rows:await gripAudit()});
    }
  }
  if (row === 'G14' && stage !== 'before') {
    const spec = readSpec('tests/scenes/catalog/l4-corpses-persist.json');
    spec.actors[0].at = [0, 0];
    await session.load(spec); await session.step(120);
    result.overlap = [];
    for (const zoom of [.5, 1.5]) {
      await session.page.evaluate(async zoom => { const a = window.__SS__, g = window.__SCENE__.game; a.camera.follow(); a.camera.zoom(zoom); g.view.view.update(g.world.entities.get(1).transform, 1); await a.screenshotReady(); }, zoom);
      const visibility = await measureCourierShare(session);
      const mask = async hidden => {
        const data = await session.page.evaluate(async hidden => { window.__SS__.settings.set({idPass:true}); window.__SCENE__.hideProbe(false, hidden, false, true); await window.__SCENE__.ready(); return document.querySelector('canvas').toDataURL('image/png'); }, hidden);
        return PNG.sync.read(Buffer.from(data.split(',')[1], 'base64'));
      };
      const full = await mask(false), reference = await mask(true);
      let bodyPixels = 0, missedPixels = 0;
      for (let i = 0; i < reference.data.length; i += 4) if (reference.data[i] > 200 && reference.data[i+1] < 60 && reference.data[i+2] > 200) {
        bodyPixels++;
        if (!(full.data[i] > 200 && full.data[i+1] < 60 && full.data[i+2] > 200)) missedPixels++;
      }
      await session.page.evaluate(() => { window.__SS__.settings.set({idPass:false}); window.__SCENE__.hideProbe(false,false); });
      result.overlap.push({zoom, ...visibility, corpseOnly: {bodyPixels, missedPixels, share: 1 - missedPixels/bodyPixels, method: 'Same-frame courier ID pixels with all authored corpse actors visible/hidden; terrain and other environment remain in both frames.'}});
      await capture(`overlap-z${zoom}`);

    }
  }
  result.errors = session.errors;
} finally {
  await session.close(); stopServer();
  writeFileSync(`${out}/receipt.json`, JSON.stringify(result, null, 2) + '\n');
}
if (result.errors.length) throw Error(JSON.stringify(result.errors));
if (result.overlap?.some(cell => !cell.corpseOnly.bodyPixels || cell.corpseOnly.missedPixels)) process.exitCode = 1;
console.log(`${row}/${tier}/${stage}: ${result.captures.length} captures`);
