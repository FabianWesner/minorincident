"""Jagged two-bay facade remnant. Explicit closed-solid recipes: 1500/600/200 caps."""
import sys
import bmesh
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.fairhaven import run, CAPS
from sslib import colliders, sockets
CAPS['collapsed-facade'] = [1500, 600, 200]


def recipe(s):
    # Three masonry piers and real open window bays; middle pier keeps a tall
    # broken crown. All tiers retain the jagged silhouette and fallen slab.
    profiles = [
        [(-2.8,0),(-2.8,2.3),(-2.6,2.55),(-2.25,2.15),(-2.12,1.8),(-2.12,0)],
        [(-.35,0),(-.35,4.2),(-.05,4.0),(.08,4.65),(.38,4.5),(.55,3.65),(.55,0)],
        [(2.25,0),(2.25,1.65),(2.45,2.35),(2.75,2.15),(2.8,2.0),(2.8,0)],
    ]
    for i,p in enumerate(profiles):
        pier=s.extrude('brokenPier'+str(i),p,'x',-.4,.2,'sidewalk')
        if s.lod==0 and i==1:
            bm=bmesh.new();bm.from_mesh(pier.data)
            bmesh.ops.bevel(bm,geom=list(bm.edges),offset=.025,segments=1,affect='EDGES')
            bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
            bm.to_mesh(pier.data);bm.free()
    s.box('floorSlab',(-.2,0,1.7),(1.35,5.6,.23),'sidewalk',bevel=.025,d=1)
    s.extrude('brokenWallCrown',[(-2.8,1.82),(-2.8,2.1),(-1.95,2.0),(-1.95,2.38),(-1.65,2.45),(-1.3,2.2),(-1.3,2.65),(-.35,3.5),(-.35,1.82)],'x',-.4,.05,'brick')
    s.extrude('brokenWallCrownR',[(.55,1.82),(.55,3.7),(.9,3.2),(.9,3.45),(1.1,3.35),(1.5,2.4),(1.5,2.7),(1.8,2.55),(2.75,2.12),(2.75,1.82)],'x',-.4,.05,'brick')
    s.box('foundation',(-.1,0,.12),(1.6,6.0,.24),'sidewalk',bevel=.025)
    # Large fallen wall chunk in foreground: tilted, toothed edge, distinct from rubble.
    fallen=s.extrude('fallenWall',[(-1.1,0),(-1.1,.45),(-.48,.93),(.5,1.0),(1.1,.3),(1.1,0)] if s.lod==2 else [(-1.1,0),(-1.1,.45),(-.7,.55),(-.48,.93),(.1,.7),(.5,1.0),(1.1,.3),(1.1,0)],'x',-.24,.24,'sidewalk')
    fallen.location=(1.2,1.2,.36);fallen.rotation_euler=(.25,-.55,.2)
    # Returning side wall: the facade is the corner of a building, not a free-standing sheet.
    s.extrude('returnWall',[(-.4,0),(-.4,2.5),(1.55,.7),(1.55,0)] if s.lod==2 else [(-.4,0),(-.4,2.55),(-.05,2.2),(.15,2.45),(.5,1.55),(.75,1.7),(1.05,.9),(1.4,.75),(1.55,0)],'y',2.35,2.75,'brick')
    s.extrude('returnWallDust',[(-.4,2.3),(-.4,2.55),(-.05,2.2),(.1,2.2),(.1,2.3)],'y',2.3,2.8,'sidewalk',d=0)
    # Pancaked upper floor leaning on the rubble, one corner dug into the ground.
    s.box('pancakedSlab',(.55,-1.1,.95),(1.5,2.3,.2),'sidewalk',rot=(.22,.42,.12),bevel=.02,d=1)
    s.box('slabBroken',(.95,-2.4,.45),(.9,.9,.18),'sidewalk',rot=(-.2,.3,.5),d=0)
    # Rubble mounds (stacked, tilted, varied sizes) heaped against the wall foot.
    mounds=[(.75,-1.7,[(0,0,.0,.62,.5,.42),(.3,.35,.0,.5,.45,.4),(-.25,.25,.0,.45,.4,.34),(.05,.1,.36,.46,.38,.34),(.35,-.3,.28,.36,.3,.3),(-.1,-.35,.3,.34,.34,.3),(.2,.5,.32,.3,.28,.26)]),
            (.95,1.1,[(0,0,.0,.66,.52,.44),(.3,-.38,.0,.5,.44,.4),(-.3,-.25,.0,.46,.42,.36),(.0,.05,.4,.5,.4,.36),(.3,.3,.0,.4,.34,.3),(-.05,.35,.3,.36,.32,.3),(.25,-.1,.36,.32,.3,.3)]),
            (.85,2.2,[(0,0,.0,.5,.5,.4),(.25,-.3,.0,.4,.36,.34),(-.2,-.3,.2,.34,.32,.3)])]
    toks=['sidewalk','brick','uiDark','sidewalk','brick']
    n=0
    for mi,(mx,my,blocks) in enumerate(mounds):
        for i,(dx,dy,dz,sx,sy,sz) in enumerate(blocks):
            n+=1
            d=0 if i>=3 else 1 if i>=1 or mi!=1 else 2
            s.box('rubbleHeap',(mx+dx,my+dy,.14+dz+sz*.4),(sx,sy,sz),toks[(n+i)%5],rot=(.18*((n%3)-1),.22*((i%3)-1),.5*n),bevel=0,d=d)
    s.box('charredLintel',(.25,-1.2,1.55),(.18,1.5,.2),'uiDark',bevel=0,d=1)
    for y in (-1.85,1.65):
        s.beam('brokenWindowPost',(.28,y,.3),(.3,y+.1,1.55),.11,'uiDark',d=1)
    # Rebar and snapped joists: fewer explicit pieces at distance.
    for i,(y,z) in enumerate([(-2.5,2.4),(.1,4.55),(2.5,2.25),(-1.25,2.25)]):
        s.beam('exposedRebar',(-.05,y,z),(.06,y+.12,z+.45),.055,'leather',d=2 if i==1 else 1)
        s.beam('snappedJoist',(-.25,y,1.65),(-.8,y+.05,.75),.12,'uiDark',d=1)
    count=(6,4,0)[s.lod]
    for i in range(count):
        y=-2.5+(i%9)*.61
        x=.5+(i//9)*.35
        s.box('masonryRubble',(x,y,.22+(i%3)*.045),(.32,.27,.26),['brick','sidewalk','uiDark'][i%3],rot=(.12,.2,(i%5)*.4),bevel=.018)
    for i in range((10,4,0)[s.lod]):
        y=-2.65 if i%2==0 else .06
        z=.35+(i//2)*.55
        s.box('exposedBrick',(.22,y,z),(.1,.32,.18),'brick',d=1,bevel=0)
    for y in (-2.48,.08):
        s.extrude('charredPier',[(y-.16,.35),(y-.22,1.3),(y+.02,2.5),(y+.16,1.5),(y+.2,.35)],'x',.208,.233,'uiDark',d=1)
    for i in range(10):
        y = -2.48 if i%2==0 else .08
        s.box('brickTone',(.24,y,.38+(i//2)*.44),(.055,.3,.14),'brick',d=0,bevel=0)
    for y in (-1.55,1.55):
        s.beam('danglingJoist',(-.45,y,1.64),(-.18,y+.1,.65),.12,'uiDark',d=0)
    sockets.empty('wallAttachSocket',(-.4,0,0),s.root)
    sockets.empty('rubbleSocket',(1.2,1.2,0),s.root)
    colliders.cuboid('remnant',(1.6,6.0,4.65),(-.1,0,2.325),s.root)
    s.physics('fixed',0,False)


run('decay.collapsed-facade',__file__,recipe,'collapsed-facade')
