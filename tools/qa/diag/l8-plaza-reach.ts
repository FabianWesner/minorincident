import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { loadLevel } from '../../sim-runner/levels';
const w = await loadLevel('L8', 1);
const anchors = w.missions!.def.anchors; const c = anchors['central-plaza']; console.log('plaza', c);
const X0=-120,X1=120,Z0=-100,Z1=100,G=0.5; const NX=(X1-X0)/G, NZ=(Z1-Z0)/G;
const free=new Uint8Array(NX*NZ), seen=new Uint8Array(NX*NZ);
for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){const p={x:X0+i*G+G/2,y:0,z:Z0+j*G+G/2}; free[j*NX+i]=w.solids.clear(p,0.35,1,false)?1:0;}
const si=Math.floor((c.x-X0)/G), sj=Math.floor((c.z-Z0)/G); const q=[sj*NX+si]; seen[q[0]]=1; let n=0;
while(q.length){const k=q.pop()!;n++;const i=k%NX,j=(k/NX)|0;for(const[di,dj]of[[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj;if(a<0||b<0||a>=NX||b>=NZ)continue;const kk=b*NX+a;if(!seen[kk]&&free[kk]){seen[kk]=1;q.push(kk);}}}
let freeN=0; for(const v of free) freeN+=v; console.log('free',freeN,'reached',n);
const S=2,W=NX*S,H=NZ*S,px=Buffer.alloc(W*H*3);
for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){const k=j*NX+i;const col=!free[k]?[50,50,60]:seen[k]?[225,225,215]:[230,60,60];for(let a=0;a<S;a++)for(let b=0;b<S;b++){const o=((j*S+b)*W+i*S+a)*3;px[o]=col[0];px[o+1]=col[1];px[o+2]=col[2];}}
const raw=Buffer.alloc((W*3+1)*H);for(let y=0;y<H;y++){raw[y*(W*3+1)]=0;px.copy(raw,y*(W*3+1)+1,y*W*3,(y+1)*W*3);}
const crc=(b:Buffer)=>{let c=~0;for(const v of b){c^=v;for(let k=0;k<8;k++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}return ~c>>>0;};
const chunk=(t:string,d:Buffer)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const cc=Buffer.alloc(4);cc.writeUInt32BE(crc(td));return Buffer.concat([l,td,cc]);};
const ih=Buffer.alloc(13);ih.writeUInt32BE(W,0);ih.writeUInt32BE(H,4);ih[8]=8;ih[9]=2;
writeFileSync(process.argv[2]!,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
process.exit(0);
