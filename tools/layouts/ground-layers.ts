/** Reject broad, parallel faces within 2 mm (the observed unstable range at
 * the game camera), excluding authored edge aprons narrower than 5 mm. */
export const unsafeGroundGap = .002;
export interface GroundTriangle { id: string; material: string; layer?: number; y: number; points: [number, number][] }
export interface GroundConflict { first: string; second: string; gap: number; area: number; at: [number, number] }
const signedArea = (p: readonly number[][]) => p.reduce((s,a,i)=>{ const b=p[(i+1)%p.length]; return s+a[0]*b[1]-a[1]*b[0]; },0)/2;
function intersection(a: number[][], b: number[][]): number[][] {
  const sign=Math.sign(signedArea(b)); let out=a;
  for(let i=0;i<b.length&&out.length;i++) {
    const c=b[i],d=b[(i+1)%b.length],cross=(p:number[])=>sign*((d[0]-c[0])*(p[1]-c[1])-(d[1]-c[1])*(p[0]-c[0]));
    const input=out;out=[];
    for(let j=0;j<input.length;j++) {
      const p=input[j],q=input[(j+1)%input.length],cp=cross(p),cq=cross(q);
      if(cp>=0)out.push(p);
      if((cp>=0)!==(cq>=0)) {const t=cp/(cp-cq);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
    }
  }
  return out;
}
export function groundConflicts(triangles: readonly GroundTriangle[], maxGap = unsafeGroundGap): GroundConflict[] {
  const cells=new Map<string,number[]>(), conflicts:GroundConflict[]=[];
  const bounds=triangles.map(t=>{const xs=t.points.map(p=>p[0]),zs=t.points.map(p=>p[1]);return [Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)];});
  for(const [index,a] of triangles.entries()) {
    const [x0,x1,z0,z1]=bounds[index], seen=new Set<number>();
    const keys:string[]=[];
    for(let x=Math.floor(x0/20);x<=Math.floor(x1/20);x++) for(let z=Math.floor(z0/20);z<=Math.floor(z1/20);z++)keys.push(`${x}:${z}`);
    for(const key of keys)for(const other of cells.get(key)??[]) {
      if(seen.has(other))continue;seen.add(other);
      const b=triangles[other],gap=Math.abs(a.y-b.y);
      if(a.material===b.material||gap>maxGap+1e-6)continue;
      const [bx0,bx1,bz0,bz1]=bounds[other];
      if(x0>=bx1||x1<=bx0||z0>=bz1||z1<=bz0)continue;
      const p=intersection(a.points,b.points);if(p.length<3)continue;
      const area=Math.abs(signedArea(p)),perimeter=p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+Math.hypot(a[0]-b[0],a[1]-b[1]);},0);
      if(area<.01||2*area/perimeter<=.005)continue;
      conflicts.push({first:a.id,second:b.id,gap,area,at:p.reduce<[number,number]>((s,v)=>[s[0]+v[0]/p.length,s[1]+v[1]/p.length],[0,0])});
    }
    for(const key of keys) {const list=cells.get(key)??[];list.push(index);cells.set(key,list);}
  }
  return conflicts;
}

/** Equal heights use palette-name order, making priorities stable across cells and rebuilds. */
export const groundGroup = (t: GroundTriangle): string => `${t.y.toFixed(5)}:${t.material}`;
export function groundPriorities(triangles: readonly GroundTriangle[]): Map<string, number> {
  const groups = new Map(triangles.map(t => [groundGroup(t), t]));
  const ordered = [...groups.keys()].sort((a,b) => groups.get(a)!.y - groups.get(b)!.y || a.localeCompare(b));
  const order = new Map(ordered.map((key,i) => [key,i]));
  const byId = new Map(triangles.map(t => [t.id,t]));
  const below = new Map<string, Map<string,number>>();
  for (const conflict of groundConflicts(triangles, .65)) {
    let a = groundGroup(byId.get(conflict.first)!), b = groundGroup(byId.get(conflict.second)!);
    if (order.get(a)! > order.get(b)!) [a,b] = [b,a];
    const row = below.get(b) ?? new Map(); row.set(a,conflict.gap); below.set(b,row);
  }
  const ranks = new Map<string,number>();
  for (const key of ordered) ranks.set(key, Math.max(0, ...[...below.get(key) ?? []].map(([k,gap]) => gap <= unsafeGroundGap + 1e-6 || ranks.get(k)! > 0 ? ranks.get(k)! + 1 : 0)));
  return ranks;
}
