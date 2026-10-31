/** Measure standing bind geometry for the heroine and delivered adult humans. */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { Matrix4, Vector3 } from 'three';
import type { AssetDef } from '../../src/assets/types';
import { assetIO } from '../assets/io';
import { measureFigure } from '../assets/figure-proportions';

const io = await assetIO(), phase=process.argv[2]??'before';
const manifest = JSON.parse(await (await import('node:fs/promises')).readFile('src/assets/manifest.json', 'utf8')) as AssetDef[];
const heroineDef = manifest.find(d => d.id === 'char.courier-female')!;
  const adult = manifest.filter(d => ['character', 'infected'].includes(d.category) && !/kid|brother|corgi|dog|cat|crow|lion|gorilla|flamingo|zebra|elephant|mega-alpha|bloated|brute|alpha/i.test(d.id));
const v3 = (x: number[]) => new Vector3(x[0], x[1], x[2]);
function measure(doc: Awaited<ReturnType<typeof io.read>>, id: string) {
  const nodes = doc.getRoot().listNodes(), joints = new Map(nodes.map(n => [n.getName(), n]));
  const m = measureFigure(doc), ground = m.ground, height = m.height;
  const jointPoint = (name: string) => { const n = joints.get(name); if (!n) throw Error(`${id}: missing ${name}`); return new Vector3().setFromMatrixPosition(new Matrix4().fromArray(n.getWorldMatrix())); };
  const bindPoints: Vector3[] = [], byJoint = new Map<string,Vector3[]>();
  for (const node of nodes) {
    const mesh = node.getMesh(), skin = node.getSkin(); if (!mesh || !skin) continue;
    const matrices = skin.listJoints().map((j, i) => new Matrix4().fromArray(j.getWorldMatrix()).multiply(new Matrix4().fromArray(skin.getInverseBindMatrices()!.getElement(i, []))));
    for (const primitive of mesh.listPrimitives()) {
      const pos = primitive.getAttribute('POSITION')!, ji = primitive.getAttribute('JOINTS_0'), we = primitive.getAttribute('WEIGHTS_0'); if (!ji || !we) continue;
      for (let i = 0; i < pos.getCount(); i++) {
        const raw = v3(pos.getElement(i, [])), js = ji.getElement(i, []) as number[], ws = we.getElement(i, []) as number[];
        let p = new Vector3(); for (let k = 0; k < ws.length; k++) if (ws[k]) p.add(raw.clone().applyMatrix4(matrices[js[k]]).multiplyScalar(ws[k]));
        bindPoints.push(p);
        const owner=(skin.listJoints()[js[ws.indexOf(Math.max(...ws))]]?.getName()??'').replace(/^survivor\d+_/,'');
        const owned=byJoint.get(owner)??[];owned.push(p);byJoint.set(owner,owned);
      }
    }
  }
  const segment = (defs: [string,string,string[],number][]) => {const values=defs.map(([a,b,owners,fraction]) => {
    const start=jointPoint(a),end=jointPoint(b),axis=end.clone().sub(start).normalize(),length=end.distanceTo(start),mid=start.clone().lerp(end,fraction);
    const pts=owners.flatMap(o=>byJoint.get(o)??[]).filter(p=>{const rel=p.clone().sub(start),axial=rel.dot(axis);return Math.abs(axial/length-fraction)<.20;});
    return pts.length?Math.max(...pts.map(p=>p.clone().sub(mid).addScaledVector(axis,-p.clone().sub(mid).dot(axis)).length())):NaN;
  }).filter(Number.isFinite);return values.length?Math.max(...values):NaN;};
  const radius = {
    upperArm: segment([['armL','foreArmL',['armL','elbowL'],.5],['armR','foreArmR',['armR','elbowR'],.5]]), forearm: segment([['foreArmL','handL',['foreArmL','foreArmTwistL'],.5],['foreArmR','handR',['foreArmR','foreArmTwistR'],.5]]),
    thigh: segment([['hip','shinL',['legL'],.30],['hip','shinR',['legR'],.30]]), calf: segment([['shinL','footL',['shinL'],.5],['shinR','footR',['shinR'],.5]]),
  };
  const torso = ['torso','spine','chest'].flatMap(n=>byJoint.get(n)??[]);
  const ext = (pts: Vector3[], k: 'x'|'y'|'z') => Math.max(...pts.map(p=>p[k]))-Math.min(...pts.map(p=>p[k]));
  const feet = ['footL','footR','toeL','toeR'].flatMap(n=>byJoint.get(n)??[]);
  const shoeHeight = feet.length ? ext(feet,'y') : NaN, shoeLength = feet.length ? ext(feet,'x') : NaN;
  return { id, heightM:height, ratios:{ upperArmRadius:radius.upperArm/height, forearmRadius:radius.forearm/height, thighRadius:radius.thigh/height, calfRadius:radius.calf/height, torsoWidth:ext(torso,'z')/height, torsoDepth:ext(torso,'x')/height, shoeLength:shoeLength/height, shoeHeight:shoeHeight/height }, groundM:ground };
}
const rows=[];
for (const def of [heroineDef,...adult]) { try { const delivered=`public/assets/models/skinned/${def.id}.lod0.glb`;let path=def.id==='char.courier-female'?'public/assets/models/char.courier-female.skin.glb':existsSync(delivered)?delivered:def.sourceGlb ?? def.glb;
    if(['npc.civilian-man-a','npc.civilian-woman-a'].includes(def.id)){if(phase==='after')path=def.glb;else{const filename=def.id==='npc.civilian-man-a'?'model.q249.skin.glb':'model.skin.glb',saved=`docs/reports/slim/pilot/input/${def.id}.${filename}`;if(existsSync(saved))path=saved;}}
    const row=measure(await io.read(path),def.id);rows.push({...row,path}); } catch (e) { rows.push({id:def.id,error:String(e)}); } }
mkdirSync('docs/reports/slim',{recursive:true});
const out=phase==='after'?'docs/reports/slim/pilot/measurements-after.json':'docs/reports/slim/measurements.json';
writeFileSync(out,JSON.stringify({source:`${phase} bind-pose source`,rows},null,2)+'\n');
const heroine=rows[0] as typeof rows[number];
const keys=['upperArmRadius','forearmRadius','thighRadius','calfRadius','torsoWidth','torsoDepth','shoeLength','shoeHeight'] as const;
const fmt=(x:number)=>Number.isFinite(x)?x.toFixed(4):'—';
const lines=['# Slim build measurements','', 'Standing bind-pose dimensions measured from the current delivered high GLBs. Limb radii are maximum perpendicular distances from the bone axis at the segment midpoint; torso width/depth and shoe length/height are mesh envelopes. All values are divided by standing height. The source includes every manifest human adult except children and intentionally bulky Alpha/brute/bloated archetypes.', '', '| Figure | Upper arm r/H | Forearm r/H | Thigh r/H | Calf r/H | Torso width/H | Torso depth/H | Shoe length/H | Shoe height/H |','|---|---:|---:|---:|---:|---:|---:|---:|---:|',...rows.map(r=>`| ${r.id} | ${keys.map(k=>fmt((r as any).ratios?.[k]??NaN)).join(' | ')} |`),'',`Heroine reference: ${keys.map(k=>`${k} ${fmt((heroine as any).ratios[k])}`).join('; ')}.`,''];
if(phase!=='after')writeFileSync('docs/reports/slim/README.md',lines.join('\n'));
console.log(`${rows.length} figures measured`);
