import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const regions: Record<string,{source:string;left:number;top:number;width:number;height:number}> = JSON.parse(readFileSync('assets/regions.json','utf8'));
const id = process.argv[2], region = regions[id];
if (!region) throw new Error('Usage: tsx tools/assets/crop.ts <region ID>');
const source = existsSync(region.source) ? resolve(region.source) : resolve('/Users/fabianwesner/Workspace/suburban-survivors',region.source);
mkdirSync(`assets/${id}`,{recursive:true});
const {left,top,width,height} = region;
await sharp(source).extract({left,top,width,height}).png().toFile(`assets/${id}/reference.png`);
