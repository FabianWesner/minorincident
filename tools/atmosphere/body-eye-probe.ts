/** Frozen game-camera E25 eye probe, both presets/tiers and every player zoom.
 * Run after build under e2e-lock; SCENE_SERVER=preview, unique SCENE_PORT.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
const backend = (process.argv[2] ?? 'webgl2') as Backend;
const phase = process.argv[3] ?? 'after';
const out = `docs/reports/night-bodies-eyes/${phase}/${backend}`;
mkdirSync(out, { recursive: true });
const rows: object[] = [];
const lum = (r: number, g: number, b: number) => {
 const linear = (v: number) => v / 255 <= .04045 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4;
 return .2126 * linear(r) + .7152 * linear(g) + .0722 * linear(b);
};
try {
 for (const tier of ['high', 'low'] as const) {
  const session = new SceneSession({ backend, tier, viewport: { width: 1600, height: 900 } });
  try {
   await session.open();
   for (const time of ['night', 'L1'] as const) {
    await session.page.evaluate(async ({ tier, time }) => {
     const a = window.__SS__!; a.settings.set({ quality: tier }); await a.loadLevel('night-street'); a.pause(); a.cheats.god(true);
     a.settings.set({ timeOfDay: time });
     a.teleport('player', { x: 51, z: -32.5 }); a.camera.follow(); await a.step(90);
     const ids = [0,1,2].map(i => a.spawn('infected.runner', { x: 50+i*1.1, z: -31.2 }, { state: 'idle', yaw: -Math.PI/4 }));
     // Isolate eye color from brim occlusion; the unchanged E25 night test and
     // the seven-model catalog still exercise the production accessory choices.
     const game = (window.__SCENE__ as unknown as {game:import('../../src/Game').Game}).game;
     for(const id of ids){const e=game.world.entities.get(id)!;e.appearance={entityId:-1,asset:e.infected!.variant,tint:'#785a45',accessories:['acc.hair-short-crop'],handProp:null,tier:'average',bornInfected:true};}
     (window as unknown as { eyeProbeIds: number[] }).eyeProbeIds = ids;
     await a.screenshotReady();
    }, { tier, time });
    const cells: { frame: number; jpeg: Buffer }[] = [];
    for (const zoom of [.5, 1, 1.5]) {
     const state = await session.page.evaluate(async zoom => {
      const a=window.__SS__!, game=(window.__SCENE__ as unknown as {game:import('../../src/Game').Game}).game;
      const rig=game.view.view, target={x:51,y:.72,z:-32.5};
      rig.reset(target); rig.zoom(Math.log(zoom),true); rig.update(target,0);
      for(let i=0;i<4;i++) game.view.update(1);
      await a.screenshotReady();
      const ids=(window as unknown as {eyeProbeIds:number[]}).eyeProbeIds;
      const crowd = (game.view as unknown as { crowd: { batches: Map<string, { mesh: import('three').InstancedMesh; state: import('three').InstancedBufferAttribute; tint: import('three').InstancedBufferAttribute; poses: import('../../src/render/characters/CrowdPosePalette').CrowdPosePalette; probe: {figures:{id:number}[]} }> } }).crowd;
      const heads = ids.map(id => {
       for (const batch of crowd.batches.values()) {
        const slot=batch.probe.figures.findIndex(f=>f.id===id); if(slot<0)continue;
        const instance=batch.mesh.matrix.clone(),part=instance.clone();batch.mesh.getMatrixAt(slot,instance);
        const packed=batch.tint.getW(slot), frame=batch.state.getX(slot), geometry=batch.mesh.geometry;
        const positions=geometry.getAttribute('position'),parts=geometry.getAttribute('_parts');
        const eyes:number[][]=[], projected=new Map<number,number[]>();
        const point=game.view.camera.position.clone();
        for(let i=0;i<parts.count;i++)if(parts.getZ(i)>.5){
         batch.poses.part(frame,Math.floor(packed/2),packed%2,parts.getX(i),part);
         point.fromBufferAttribute(positions,i).applyMatrix4(part).applyMatrix4(instance);
         const screen=a.camera.project(point.x,point.y,point.z);eyes.push(screen);projected.set(i,screen);
        }
        if(!eyes.length)throw new Error(`No drawn eye geometry for ${id}`);
        const eyeBox=[Math.min(...eyes.map(p=>p[0])),Math.min(...eyes.map(p=>p[1])),Math.max(...eyes.map(p=>p[0])),Math.max(...eyes.map(p=>p[1]))];
        if(eyeBox.some(v=>Math.abs(v)>.98))throw new Error(`Eye ${id} is outside the camera: ${eyeBox}`);
        const eyeTriangles:number[][][]=[];const indices=geometry.index;
        for(let i=0;i<(indices?.count??positions.count);i+=3){const triangle=[0,1,2].map(k=>projected.get(indices?indices.getX(i+k):i+k));if(triangle.every(p=>!!p))eyeTriangles.push(triangle as number[][]);}
        return {id,eyeBox,eyeTriangles};
       }
       throw new Error(`Eye probe ${id} was not drawn`);
      });
      return { heads, perf:a.perf(), crowd:a.getState().render.crowd };
     },zoom);
     const file=`${out}/${time}-${tier}-z${zoom}.png`;
     const image=PNG.sync.read(await session.page.locator('canvas').screenshot({path:file}));
     const eyes=state.heads.map(({id,eyeBox,eyeTriangles})=>{
      const pixels=new Set<number>();
      const cross=(a:number[],b:number[],x:number,y:number)=>(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);
      for(const triangle of eyeTriangles){
       const p=triangle.map(v=>[(v[0]+1)/2*image.width,(1-v[1])/2*image.height]);
       const x0=Math.max(0,Math.floor(Math.min(...p.map(v=>v[0])))),x1=Math.min(image.width-1,Math.ceil(Math.max(...p.map(v=>v[0]))));
       const y0=Math.max(0,Math.floor(Math.min(...p.map(v=>v[1])))),y1=Math.min(image.height-1,Math.ceil(Math.max(...p.map(v=>v[1]))));
       const area=cross(p[0],p[1],p[2][0],p[2][1]);if(Math.abs(area)<1e-6)continue;
       for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if([cross(p[0],p[1],x+.5,y+.5),cross(p[1],p[2],x+.5,y+.5),cross(p[2],p[0],x+.5,y+.5)].every(v=>v*area>=0))pixels.add(y*image.width+x);
      }
      let best={luminance:-1,r:0,g:0,b:0,redMargin:0};
      for(const pixel of pixels){
       const i=pixel*4,r=image.data[i],g=image.data[i+1],b=image.data[i+2],luminance=lum(r,g,b);
       if(luminance>best.luminance)best={luminance,r,g,b,redMargin:r-Math.max(g,b)};
      }
      return {id,eyeBox,eyePixels:pixels.size,...best};
     });
     const p=state.perf;
     rows.push({time,tier,zoom,file,eyes,pass:eyes.every(e=>e.redMargin>=60)&&p.backend===(backend==='webgpu'?'webgpu':'webgl')&&p.quality.tier===tier,backend:p.backend,quality:p.quality.tier,drawCalls:p.drawCalls,triangles:p.triangles,heapBytes:p.heapBytes,crowd:state.crowd});
     cells.push({frame:zoom*100,jpeg:await session.snapshot()});
     console.log(`${backend} ${tier} ${time} z${zoom}: ${eyes.map(e=>e.redMargin).join('/')} red margin; ${p.drawCalls} draws, ${p.triangles} triangles`);
    }
    await session.makeSheet(cells,`${out}/${time}-${tier}-sheet.jpg`,640,1000);
   }
   if(session.errors.length) rows.push({tier,errors:session.errors});
  } finally {await session.close();}
 }
} finally {stopServer();writeFileSync(`${out}/measurements.json`,JSON.stringify(rows,null,2)+'\n');}
if(rows.some(r=>'pass' in r&&!r.pass||'errors' in r))process.exitCode=1;
