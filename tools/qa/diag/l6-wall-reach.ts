import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { loadLevel } from '../../sim-runner/levels';
import { l6Doors } from '../../../src/data/l6';

const out = 'docs/reports/s245-l6walls'; mkdirSync(out, { recursive: true });
const imagePath = process.argv[2] ?? `${out}/after.png`;
const w = await loadLevel('L6', 1), nav = w.infected!.nav.forPlayer(.35);
const x0 = -32, x1 = 290, z0 = -30, z1 = 32, scale = 2;
const nx = Math.ceil((x1 - x0) / nav.cellSize), nz = Math.ceil((z1 - z0) / nav.cellSize);
const start = nav.cell(110.25, 15.25), seed = start >= 0 ? start : nav.nearestCell(110.25, 15.25);
const fill = (blocked: Uint8Array) => {
  const seen = new Uint8Array(nav.width * nav.depth), q = [seed]; seen[seed] = 1;
  for (let n = 0; n < q.length; n++) {
    const k = q[n], i = k % nav.width, j = Math.floor(k / nav.width);
    for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const a = i + di, b = j + dj, v = b * nav.width + a;
      if (a >= 0 && b >= 0 && a < nav.width && b < nav.depth && !seen[v] && !blocked[v]) { seen[v] = 1; q.push(v); }
    }
  }
  return seen;
};
const png = (path: string, seen: Uint8Array) => {
  const width = nx * scale, height = nz * scale, rgb = Buffer.alloc(width * height * 3), raw = Buffer.alloc((width * 3 + 1) * height);
  for (let j=0;j<nz;j++) for(let i=0;i<nx;i++) {
    const x=x0+(i+.5)*nav.cellSize,z=z0+(j+.5)*nav.cellSize,cell=nav.cell(x,z);
    const footprint=(x>=30&&x<=246&&z>=11.2&&z<=18.8)||(x>=-30&&x<=30&&z>=-28&&z<=18.8)||(x>=246&&x<=258&&z>=11.2&&z<=19.7)||(x>=258&&x<=288&&z>=0&&z<=30)||[[54,1.2,11.2],[126,1.2,11.2],[198,1.2,11.2],[78,18.8,28.8],[174,18.8,28.8]].some(([cx,lo,hi])=>Math.abs(x-cx)<=2.3&&z>=lo&&z<=hi);
    let c:[number,number,number];
    if(cell<0||nav.blocked[cell]) c=[48,53,61];
    else if(seen[cell]) c=footprint?[226,229,220]:[238,66,54];
    else c=[115,121,127];
    for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){const o=((j*scale+dy)*width+i*scale+dx)*3;rgb[o]=c[0];rgb[o+1]=c[1];rgb[o+2]=c[2];}
  }
  for(let y=0;y<height;y++){raw[y*(width*3+1)]=0;rgb.copy(raw,y*(width*3+1)+1,y*width*3,(y+1)*width*3);}
  const crc=(b:Buffer)=>{let c=~0;for(const v of b){c^=v;for(let k=0;k<8;k++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}return ~c>>>0;};
  const chunk=(t:string,d:Buffer)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]),c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
  const ih=Buffer.alloc(13);ih.writeUInt32BE(width,0);ih.writeUInt32BE(height,4);ih[8]=8;ih[9]=2;
  writeFileSync(path,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
};
const now = fill(nav.blocked); png(imagePath,now);
const footprint=(x:number,z:number)=>(x>=30&&x<=246&&z>=11.2&&z<=18.8)||(x>=-30&&x<=30&&z>=-28&&z<=18.8)||(x>=246&&x<=258&&z>=11.2&&z<=19.7)||(x>=258&&x<=288&&z>=0&&z<=30)||[[54,1.2,11.2],[126,1.2,11.2],[198,1.2,11.2],[78,18.8,28.8],[174,18.8,28.8]].some(([cx,lo,hi])=>Math.abs(x-cx)<=2.3&&z>=lo&&z<=hi);
const escaped:number[]=[];for(let k=0;k<now.length;k++)if(now[k]&&!footprint(nav.x(k),nav.z(k)))escaped.push(k);
const anchors=w.missions!.def.anchors, anchorReach=Object.entries(anchors).map(([name,a])=>({name,reachable:(()=>{const k=nav.nearestCell(a.x,a.z,.35);return k>=0&&!!now[k];})()}));
const doors=l6Doors.map((d,i)=>{const z=d.z>0?d.z+(d.z>15?-.8:.8):d.z;return{name:`service-${i}`,x:d.x,z:d.z,inside:[d.x,z],reachable:(()=>{const k=nav.nearestCell(d.x,z,.35);return k>=0&&!!now[k];})()};});
const walls={south:{samples:0,blocked:0},north:{samples:0,blocked:0}};
for(let x=30.5;x<246;x+=1){
  const opening=[54,78,126,174,198].some(doorX=>Math.abs(doorX-x)<2.7);
  if(opening)continue;
  for(const [side,z] of [['south',11.0],['north',19.0]] as const){walls[side].samples++;if(!w.solids.clear({x,y:.6,z},.35,1,false))walls[side].blocked++;}
}
console.log(JSON.stringify({imagePath,grid:[nav.width,nav.depth],reached:now.reduce((a,b)=>a+b,0),outsideFootprint:escaped.length,firstOutside:escaped.slice(0,10).map(k=>[nav.x(k),nav.z(k)]),wallCollisionSamples:walls,anchors:anchorReach,doors},null,2));
w.dispose();
