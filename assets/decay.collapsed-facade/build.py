"""Jagged two-bay facade remnant. Explicit closed-solid recipes: 1500/600/200 caps."""
import sys
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
        s.extrude('brokenPier'+str(i),p,'x',-.4,.2,'sidewalk')
    s.box('floorSlab',(-.2,0,1.7),(1.35,5.6,.23),'sidewalk',bevel=0)
    s.extrude('brokenWallCrown',[(-2.8,1.82),(-2.8,2.1),(-1.9,2.0),(-1.65,2.45),(-1.25,2.2),(-.35,3.5),(-.35,1.82)],'x',-.4,.05,'brick')
    s.extrude('brokenWallCrownR',[(.55,1.82),(.55,3.7),(.9,3.2),(1.1,3.35),(1.65,2.4),(1.8,2.55),(2.75,2.12),(2.75,1.82)],'x',-.4,.05,'brick')
    s.box('foundation',(-.1,0,.12),(1.6,6.0,.24),'sidewalk',bevel=0)
    # Large fallen wall chunk in foreground: tilted, toothed edge, distinct from rubble.
    fallen=s.extrude('fallenWall',[(-1.1,0),(-1.1,.45),(-.7,.55),(-.48,.93),(.1,.7),(.5,1.0),(1.1,.3),(1.1,0)],'x',-.24,.24,'sidewalk')
    fallen.location=(1.2,1.2,.36);fallen.rotation_euler=(.25,-.55,.2)
    s.box('charredLintel',(.25,-1.2,1.55),(.18,1.5,.2),'uiDark',bevel=0,d=1)
    for y in (-1.85,1.65):
        s.beam('brokenWindowPost',(.28,y,.3),(.3,y+.1,1.55),.11,'uiDark',d=1)
    # Rebar and snapped joists: fewer explicit pieces at distance.
    for i,(y,z) in enumerate([(-2.5,2.4),(.1,4.55),(2.5,2.25),(-1.25,2.25)]):
        s.beam('exposedRebar',(-.05,y,z),(.06,y+.12,z+.45),.055,'leather',d=2 if i==1 else 1)
        s.beam('snappedJoist',(-.25,y,1.65),(-.8,y+.05,.75),.12,'uiDark',d=1)
    count=(24,10,0)[s.lod]
    for i in range(count):
        y=-2.5+(i%9)*.61
        x=.5+(i//9)*.35
        s.box('masonryRubble',(x,y,.22+(i%3)*.045),(.32,.27,.26),['brick','sidewalk','uiDark'][i%3],rot=(.12,.2,(i%5)*.4),bevel=.018)
    for i in range((10,4,0)[s.lod]):
        y=-2.65 if i%2==0 else .06
        z=.35+(i//2)*.55
        s.box('exposedBrick',(.22,y,z),(.1,.32,.18),'brick',d=1,bevel=0)
    sockets.empty('wallAttachSocket',(-.4,0,0),s.root)
    sockets.empty('rubbleSocket',(1.2,1.2,0),s.root)
    colliders.cuboid('remnant',(1.6,6.0,4.65),(-.1,0,2.325),s.root)
    s.physics('fixed',0,False)


run('decay.collapsed-facade',__file__,recipe,'collapsed-facade')
