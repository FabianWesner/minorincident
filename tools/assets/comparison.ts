import { PNG } from 'pngjs';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export async function comparison(images: string[], reference: string, output: string): Promise<void> {
  const paths = existsSync(reference) ? [reference, ...images] : images;
  const sheet = new PNG({width:1800,height:338*Math.ceil(paths.length/3)});
  for(let i=0;i<sheet.data.length;i+=4) { sheet.data[i]=42;sheet.data[i+1]=39;sheet.data[i+2]=48;sheet.data[i+3]=255; }
  for(const [index,path] of paths.entries()) {
    const source=PNG.sync.read(readFileSync(path));
    const scale=Math.min(600/source.width,338/source.height), width=Math.round(source.width*scale),height=Math.round(source.height*scale);
    const left=index%3*600+Math.floor((600-width)/2),top=Math.floor(index/3)*338+Math.floor((338-height)/2);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
      const from=(Math.min(source.height-1,Math.floor(y/scale))*source.width+Math.min(source.width-1,Math.floor(x/scale)))*4;
      const to=((top+y)*sheet.width+left+x)*4;
      source.data.copy(sheet.data,to,from,from+4);
    }
  }
  writeFileSync(output,PNG.sync.write(sheet));
}
