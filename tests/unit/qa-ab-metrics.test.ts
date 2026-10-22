import { expect, test } from 'vitest';
import { PNG } from 'pngjs';
import { perceptualDiff } from '../../tools/qa/ab-metrics';
function frame(points:{x:number;y:number;width:number;height:number}[]=[]) {
  const png=new PNG({width:1280,height:720});
  for(let p=0;p<png.width*png.height;p++){png.data[p*4]=35;png.data[p*4+1]=55;png.data[p*4+2]=45;png.data[p*4+3]=255;}
  for(const r of points)for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++){const i=(y*png.width+x)*4;png.data[i]=235;png.data[i+1]=180;png.data[i+2]=140;}
  return PNG.sync.write(png);
}
test('identical captures score zero',()=>{const a=frame();expect(perceptualDiff(a,a).score).toBe(0);});
test('small missing actor survives the full viewport denominator',()=>{const result=perceptualDiff(frame(),frame([{x:501,y:307,width:12,height:28}]));expect(result.globalChanged).toBeLessThan(.001);expect(result.score).toBeGreaterThan(.02);});
test('sparse particle noise stays below the default gate',()=>{const result=perceptualDiff(frame(),frame(Array.from({length:20},(_,i)=>({x:40+i*51,y:30+i*29,width:1,height:1}))));expect(result.score).toBeLessThan(.02);});
test('different viewport dimensions are rejected',()=>{expect(()=>perceptualDiff(frame(),PNG.sync.write(new PNG({width:64,height:64})))).toThrow('dimensions');});
