"""Destroyed defensive line: explicit authored recipes at 1500/600/200 caps."""
import sys
import shutil
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools/blender'))
from sslib.army_core import Army, build_set
from sslib import palette

HERE=Path(__file__).resolve().parent

def recipe(s):
    l=s.lod
    s.owner('body')
    # Semantic owner remains available to placement, but wrecked gate is static.
    s.socket('gateArm',(-2.5,1,1.0))
    s.socket('hmgPosition',(.5,1.05,.5))
    s.socket('braceSlot',(0,-1.7,.5))
    s.socket('front',(2.70,0,1))
    # Bent barrier boom, a fallen barricade and empty open-backed sandbag nest.
    s.box('gate motor',(-2.60,1.10,.60),(.55,.55,1.2),'oliveSeam',bevel=.04)
    s.rod('bent boom first',(-2.5,1,1.10),(-.65,.70,.46),.075,'sidewalk',seg=5 if l==2 else 8)
    s.rod('bent boom second',(-.65,.70,.46),(1.30,.25,.16),.075,'sidewalk',seg=5 if l==2 else 8)
    if l<2:
        for i in range(3 if l==0 else 2):s.box('boom warning',(-1.95+i*.51,.87-i*.083,.89-i*.17),(.18,.17,.16),'woodWarm',rot=(0,.33,-.16),bevel=0)
    segs=(5,3,1)[l]; x=-2.65; step=(2.30)/segs
    for i in range(segs):
        s.extrude_yz('toppled jersey barrier',[(-2.0,0),(-.90,0),(-.90,.22),(-1.35,.22),(-1.50,.62),(-2.0,.62)],x+i*step,x+(i+1)*step-(.012 if l<2 else 0),'woodWarm' if i%2==0 else 'sidewalk')
    s.extrude_yz('broken barrier end',[(-1.90,0),(-1.24,0),(-1.24,.13),(-1.49,.13),(-1.57,.38),(-1.90,.38)],.24,.84,'sidewalk')
    bags=[(.4,.84,.18),(1.32,.84,.18),(2.2,.84,.18),(.4,1.49,.18),(2.2,1.49,.18)]
    if l==2:bags=bags[:4]
    if l==0:bags += [(.83,.84,.46),(1.74,.84,.46),(2.2,1.42,.46)]
    for i,p in enumerate(bags):s.box('dark sandbag',p,(.86,.54,.36),'khakiSeam',rot=(0,0,i*.08),bevel=.075 if l==0 else 0)
    # Abandoned bent HMG, receiver slumped sideways, barrel broken downward.
    s.box('gun receiver',(1.40,1.22,.79),(.52,.22,.24),'uiDark',rot=(0,.24,.4),bevel=.015)
    s.rod('broken hmg barrel',(1.57,1.3,.82),(2.18,1.46,.49),.045,'uiDark',seg=8)
    # Collapsed tent canopy: ridge slumped from the standing pole end to the ground, solid sheet.
    top=[(-2.7,-.55,.07),(-.3,-.60,.07),(-.5,-.10,.20),(-.25,.30,.07),(-2.7,.40,.07),(-2.5,-.10,.74)]
    low=[(x,y,max(.02,z-.05)) for x,y,z in top]
    n=len(top)
    faces=[(0,1,2,5),(5,2,3,4)]+[(n+3,n+2,n+1,n+0)[::-1] if False else f for f in []]
    faces+=[(n+5,n+2,n+1,n+0),(n+4,n+3,n+2,n+5)]
    faces+=[(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)]
    s.add('collapsed tarp',top+low,faces,'policeBlue')
    if l<2:
        s.rod('gun stand',(1.36,1.22,.16),(1.40,1.22,.76),.055,'oliveSeam')
        # Collapsed checkpoint tarp, jagged solid folded cloth, recognizable blue.
        for a,b in [((-2.8,-.55,.05),(-2.4,-.32,1.05)),((-2.4,-.32,1.05),(-1.35,.08,.38)),((-1.35,.08,.38),(-.30,.36,.12))]:s.rod('snapped canopy frame',a,b,.025,'sidewalk',seg=6)
        for i in range(6 if l==0 else 2):s.box('scattered hardware',(-.6+i*.31,-.7+.12*(i%2),.05),(.20,.15,.10),'oliveSeam',rot=(0,0,i*.7),bevel=0)
        for i in range(3 if l==0 else 1):s.box('barrier paint chip',(-2.25+i*.58,-2.012,.35),(.25,.016,.23),'woodWarm',rot=(0,-.20,0),bevel=0)
    if l<2:
        for i,(cx,cy,sz,rz) in enumerate([(-.1,-1.25,(.44,.30,.26),.5),(.55,-1.05,(.36,.28,.24),-.3),(-.35,-.15,(.40,.26,.22),1.1)][:3 if l==0 else 2]):
            s.box('spilled ammo crate',(cx,cy,sz[2]/2),sz,'oliveSeam',rot=(0,0,rz),bevel=0 if l else .02)
        if l==0:
            s.cyl('toppled drum',(.95,-.55,.17),.15,.40,'uiDark',axis='Y',seg=10)
            for i,(cx,cy) in enumerate([(2.0,.25),(2.1,-.5),(.1,1.45)]):s.box('fallen sandbag',(cx,cy,.13),(.62,.36,.20),'khakiSeam',rot=(0,.1,i*1.0+.4),bevel=.04)
    # Cool soot and dust dim the abandoned line without losing palette identity.
    for token in ['khakiSeam','oliveSeam','sidewalk','policeBlue','woodWarm']:
        mat=palette.mat(token);rgb=mat.diffuse_color[:3];mean=sum(rgb)/3
        mat.diffuse_color=tuple((c*.75+mean*.25)*(.40 if token in ['khakiSeam','oliveSeam'] else .65) for c in rgb)+(1,)
        mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=mat.diffuse_color
    s.physics('fixed',0,'prop.metal-heavy',False,(0,.5,0))
    s.collider('line',(2.3,1.1,.62),(-1.50,-1.45,.31))
    s.collider('gateMotor',(.55,.55,1.2),(-2.60,1.10,.60))
    s.collider('brokenEnd',(.60,.66,.38),(.54,-1.57,.19))
    s.collider('nest',(2.66,1.18,.46),(1.30,1.16,.23))

if '--distance-tier' in sys.argv:
    tier=int(sys.argv[sys.argv.index('--distance-tier')+1])
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s=Army('decay.abandoned-checkpoint',tier);recipe(s)
    s.finish(Path(sys.argv[sys.argv.index('--glb')+1]))
else:
    stats=build_set('decay.abandoned-checkpoint',HERE,recipe)
    output=Path(sys.argv[sys.argv.index('--glb')+1]).resolve()
    if output!=HERE/'model.glb':shutil.copyfile(HERE/'model.glb',output)
