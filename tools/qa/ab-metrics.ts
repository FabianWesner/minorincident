import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

/** Local coverage keeps a missing actor/head accessory from being diluted by 921,600 background pixels. */
export function perceptualDiff(aBuffer:Buffer,bBuffer:Buffer) {
  const a=PNG.sync.read(aBuffer),b=PNG.sync.read(bBuffer);
  if(a.width!==b.width||a.height!==b.height) throw new Error('A/B frame dimensions differ');
  const {width,height}=a,mask=new PNG({width,height});
  const changed=pixelmatch(a.data,b.data,mask.data,width,height,{threshold:.15,includeAA:false,diffMask:true});
  const stride=width+1,integral=new Uint32Array(stride*(height+1));
  for(let y=0;y<height;y++) {let sum=0;for(let x=0;x<width;x++){sum+=Number(mask.data[(y*width+x)*4+3]>0);integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+sum;}}
  const tile=Math.min(48,width,height),step=Math.max(1,Math.floor(tile/2));
  const origins=(length:number)=>[...new Set([...Array.from({length:Math.floor((length-tile)/step)+1},(_,i)=>i*step),length-tile])];
  let maximum=0,box={x:0,y:0,width:tile,height:tile};
  for(const y of origins(height))for(const x of origins(width)){
    const count=integral[(y+tile)*stride+x+tile]-integral[y*stride+x+tile]-integral[(y+tile)*stride+x]+integral[y*stride+x];
    if(count>maximum){maximum=count;box={x,y,width:tile,height:tile};}
  }
  const heatmap=new PNG({width,height});
  for(let p=0;p<width*height;p++) {
    const i=p*4,red=mask.data[i+3]>0,grey=Math.round((a.data[i]*.21+a.data[i+1]*.72+a.data[i+2]*.07)*.5);
    heatmap.data[i]=red?255:grey;heatmap.data[i+1]=red?35:grey;heatmap.data[i+2]=red?25:grey;heatmap.data[i+3]=255;
  }
  return {score:maximum/(tile*tile),globalChanged:changed/(width*height),changedPixels:changed,box,heatmap:PNG.sync.write(heatmap)};
}
