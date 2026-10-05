import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

const regions: Record<string,{source:string;left:number;top:number;width:number;height:number}> = JSON.parse(readFileSync('assets/regions.json','utf8'));
const id = process.argv[2], region = regions[id];
if (!region) throw new Error('Usage: tsx tools/assets/crop.ts <region ID>');
const source = existsSync(region.source) ? resolve(region.source) : resolve('/Users/fabianwesner/Workspace/suburban-survivors',region.source);
mkdirSync(`assets/${id}`,{recursive:true});
const {left,top,width,height} = region;
const input=PNG.sync.read(readFileSync(source));
if(left<0||top<0||width<=0||height<=0||left+width>input.width||top+height>input.height)throw new Error('Crop outside source image');
const output=new PNG({width,height});
PNG.bitblt(input,output,left,top,width,height,0,0);
writeFileSync(`assets/${id}/reference.png`,PNG.sync.write(output));
