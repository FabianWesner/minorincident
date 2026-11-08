"""One transparent atlas: approved story-script wall messages and one spent-casing patch."""
import html
import math
from pathlib import Path
import random
import subprocess

ROOT=Path(__file__).resolve().parents[2]
WORDS=['HELP — 3 INSIDE','AUTHORIZED PERSONNEL ONLY|— BIOHAZARD LEVEL 4']
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="512" viewBox="0 0 2048 512">']
for i,word in enumerate(WORDS):
    x=(i%4)*512;y=(i//4)*128
    for line,text in enumerate(word.split('|')):
        size=min(46, int(460 / max(1,len(text)) / .65)); baseline=83 if '|' not in word else 53+line*49
        svg.append(f'<text x="{x+256}" y="{y+baseline}" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="{size}" letter-spacing="1" fill="{["#d6b68a","#cc8c6d","#dfd3ad"][i%3]}" opacity=".9">{html.escape(text)}</text>')
rng=random.Random(1108)
for i in range(44):
    cx=24+rng.random()*464;cy=394+rng.random()*100;a=rng.random()*math.tau;length=8+rng.random()*10;width=2+rng.random()*2
    pts=[]
    for dx,dy in [(-length/2,-width/2),(length/2,-width/2),(length/2,width/2),(-length/2,width/2)]:pts.append(f'{cx+dx*math.cos(a)-dy*math.sin(a):.2f},{cy+dx*math.sin(a)+dy*math.cos(a):.2f}')
    svg.append(f'<polygon points="{" ".join(pts)}" fill="#b8914c" opacity=".8"/>')
for i in range(14):
    a=i*math.tau/14;cx=768+180*math.cos(a);cy=448+45*math.sin(a)
    svg.append(f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="35" ry="8" fill="#554f47" opacity=".9"/>')
svg.append('<ellipse cx="768" cy="448" rx="160" ry="40" fill="#292722" opacity=".85"/>')
svg.append('</svg>')
source=ROOT/'assets/l10-vignettes/story-atlas.svg';source.write_text('\n'.join(svg)+'\n')
out=ROOT/'public/assets/decals/l10-stories.png';out.parent.mkdir(parents=True,exist_ok=True)
subprocess.run(['magick','-font','/System/Library/Fonts/Supplemental/Arial Bold.ttf','-background','none',str(source),'-depth','8',str(out)],check=True)
