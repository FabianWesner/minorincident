"""Localized standing fire dressing: open window, broad char, intact roof line.
Explicit solid recipes for each distance; mountSocket aligns to a house facade.
"""
import json
import shutil
import sys
from pathlib import Path
import bpy
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.rescue_assets import Scene, finish
from sslib import sockets


def recipe(lod):
    s = Scene('decay.burned-facade.house', lod)
    roof = s.joint('roof')
    # Continuous structural wall around a real rectangular window aperture.
    for y in (-1.35, 1.35):
        s.box('wallPier', (0,y,1.35), (.18,.9,2.7), 'mustardLight')
    for z,h in ((.45,.9),(2.43,.54)):
        s.box('wallSpandrel', (0,0,z), (.18,1.8,h), 'mustardLight')
    s.box('roofLine', (0,0,2.8), (.42,3.6,.20), 'navy', roof)
    # Flat broad patches have irregular outer edges and remain behind the frame.
    for y in (-1.05,1.05):
        pts=[(.098,y-.31,.65),(.098,y+.38,.76),(.098,y+.29,1.15),
             (.098,y+.40,2.20),(.098,y+.16,2.65),(.098,y-.32,2.43)]
        s.mesh('charPatch',pts,[tuple(range(6))],'uiDark')
    s.box('charLintel',(.105,0,2.47),(.035,2.28,.35),'uiDark')
    s.box('charApron',(.105,0,.75),(.035,2.16,.30),'asphalt')
    for y in (-.96,.96):
        s.box('brokenSurround',(.15,y,1.56),(.14,.16,1.65),'woodWarm')
    for z in (.90,2.22):
        s.box('surroundRail',(.15,0,z),(.14,2.08,.16),'woodWarm')
    # Jagged dark recess, behind the intact border. No collapsed floors/rubble.
    outline=[(-.88,.99),(-.55,1.12),(-.28,.95),(.05,1.07),(.41,.96),(.86,1.01),
             (.75,1.40),(.89,1.67),(.74,2.10),(.32,2.02),(.06,2.14),(-.28,1.99),(-.84,2.08),(-.74,1.62)]
    s.mesh('windowVoid',[(.03,y,z) for y,z in outline],[tuple(range(len(outline)))],'uiDark')
    if lod < 2:
        s.box('brokenMullion',(.17,0,1.90),(.10,.075,.58),'woodWarm')
        s.box('brokenSash',(.17,-.48,1.53),(.10,.80,.065),'woodWarm')
        for z in (.22,.42,2.54):
            s.box('survivingSiding',(.111,0,z),(.025,3.55,.035),'woodWarm')
    if lod == 0:
        for y,z in ((-.72,1.08),(.74,1.99),(.3,1.07)):
            s.mesh('glassShard',[(.18,y,z),(.18,y+.13,z),(.18,y+.05,z+.20)],[(0,1,2)],'backpackTeal')
    sockets.empty('mountSocket',(-.10,0,0),s.root)
    sockets.empty('windowSocket',(.03,0,1.56),s.root)
    s.physics(wood=True)
    return s


stats={}
for lod in (0,1,2):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path=HERE/('model'+('' if lod==0 else '.lod'+str(lod))+'.glb')
    stats['lod'+str(lod)]=finish(recipe(lod),path)
    if stats['lod'+str(lod)]['triangles'] > (1500,600,200)[lod]:
        raise ValueError(stats)
(HERE/'lod-stats.json').write_text(json.dumps(stats,indent=2)+'\n')
if '--glb' in sys.argv:
    target=Path(sys.argv[sys.argv.index('--glb')+1]).resolve()
    if target != HERE/'model.glb': shutil.copyfile(HERE/'model.glb',target)
