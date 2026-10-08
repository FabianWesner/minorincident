"""L3 civic frontage recipes. Explicit complete solids at each distance tier.

The shelter retains the existing author's width-to-forward rotation and 1.23
width factor. Decay changes glazing/dressing, never the roof, feet or origin.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix
from . import palette, sockets, colliders, export, ao
from .rescue_assets import Scene


def lettering(s, label, pos, size, token='picketWhite', parent=None, side=1):
    bpy.ops.object.text_add(location=pos)
    obj = bpy.context.object
    obj.name = 'sign_' + label
    obj.data.body = label
    obj.data.size = size
    obj.data.align_x = 'CENTER'
    obj.data.align_y = 'CENTER'
    obj.data.resolution_u = 1
    # Local horizontal +Y, up +Z, outward +X.
    obj.rotation_euler = Matrix(((0,0,side),(side,0,0),(0,1,0))).to_euler()
    obj.data.materials.append(palette.mat(token))
    bpy.ops.object.convert(target='MESH')
    obj.parent = parent or s.body


def station(s):
    L = s.lod
    roof = s.joint('roof')
    interior = s.joint('interior')
    s.box('pavement',(0,0,.10),(12,16,.20),'picketWhite')
    # Main civic block, open +X entry, continuous rear and side walls.
    s.box('rearWall',(-4.85,-3,3.15),(.30,8,6.10),'brick')
    for y in (-6.85,.85):
        s.box('sideWall',(-1,y,3.15),(8,.30,6.10),'brick')
    for y in (-5.50,-.50):
        s.box('entryJamb',(2.85,y,3.15),(.30,3,6.10),'brick')
    s.box('entryLintel',(2.85,-3,4.55),(.30,2,3.30),'brick')
    s.box('civicFloor',(-1,-3,.24),(7.5,7.5,.08),'picketWhite',interior)
    # Distinct lower armory wing and open armory threshold.
    s.box('armoryRear',(-4.85,3,1.60),(.30,4,2.80),'brick')
    for y in (1.15,4.85):s.box('armorySide',(-2,y,1.60),(6,.30,2.80),'brick')
    for y in (1.70,4.30):s.box('armoryJamb',(.85,y,1.60),(.30,1.40,2.80),'brick')
    s.box('armoryLintel',(.85,3,2.70),(.30,1.20,.60),'brick')
    s.box('armoryFloor',(-2,3,.24),(5.5,3.5,.08),'picketWhite',interior)
    for x,y,w,d,z in [(-1,-3,8.3,8.3,6.35),(-2,3,6.3,4.3,3.15)]:
        s.box('flatRoof',(x,y,z),(w,d,.30),'asphalt',roof)
        for yy in (y-d/2+.10,y+d/2-.10):s.box('parapet',(x,yy,z+.20),(w,.20,.20),'asphalt',roof)
        for xx in (x-w/2+.10,x+w/2-.10):s.box('parapet',(xx,y,z+.20),(.20,d,.20),'asphalt',roof)
        s.box('roofVent',(x-.8,y+.7,z+.30),(1.2,.8,.4),'asphalt',roof)
    # Broad cream courses and corner pilasters communicate civic brickwork.
    for z in (.45,3.08,6.10):s.box('frontCourse',(3.025,-3,z),(.10,8,.22),'picketWhite')
    for y in (-6.5,.5):s.box('frontPilaster',(3.08,y,3.22),(.16,.32,5.65),'picketWhite')
    s.box('blueEntranceCanopy',(3.48,-3,2.95),(1.30,2.95,.30),'policeBlue')
    s.box('stationSign',(4.145,-3,2.96),(.035,2.65,.38),'policeBlue')
    lettering(s,'SUNSET GROVE POLICE',(4.17,-3,2.96),.20)
    s.box('armorySign',(1.07,3,2.76),(.10,1.45,.32),'policeBlue')
    lettering(s,'ARMORY',(1.13,3,2.76),.24)
    for y in (-4.10,-1.90):s.box('blueEntryBorder',(3.05,y,1.58),(.16,.18,2.45),'policeBlue')
    door = s.joint('doorMain',(3,-4,.28))
    s.box('openBlueDoor',(0,.90,1.18),(.13,1.8,2.36),'policeBlue',door)
    door.rotation_euler.z = -math.pi/2
    colliders.cuboid('doorMain',(.13,1.8,2.36),(0,.90,1.18),door)
    door['ss_door'] = json.dumps({'axis':'Y','openAngle':-90,'initialState':'open'})
    for y in (1.70,4.30):
        s.box('armoryWindow',(1.025,y,1.72),(.06,.70,.80),'policeBlue')
        s.box('armoryGlass',(1.07,y,1.72),(.025,.50,.60),'uiDark')
    # Large windows are raised glazing inside solid frames, never loose thin strips.
    for z in (1.60,4.50):
        for y in (-5.55,-.45):
            s.box('windowBorder',(3.03,y,z),(.10,1.10,1.60),'picketWhite')
            s.box('blueWindowFrame',(3.095,y,z),(.07,.90,1.38),'policeBlue')
            s.box('glazing',(3.14,y,z),(.025,.68,1.15),'uiDark')
            if L<2:s.box('windowMullion',(3.162,y,z),(.02,.06,1.15),'policeBlue')
    for x in (-3.6,-.8,1.7):
        for y in (-7.01,1.01):
            s.box('sideWindow',(x,y,4.50),(1.10,.035,1.35),'policeBlue')
            s.box('sideGlass',(x,y+(-.025 if y<0 else .025),4.5),(.85,.02,1.08),'uiDark')
    # Badge shield and star are readable even when the sign lettering is subpixel.
    vs=[(3.16,y,z) for y,z in [(-3.6,5.75),(-2.4,5.75),(-2.50,5.08),(-3,4.80),(-3.50,5.08)]]
    s.mesh('civicShield',vs,[(0,1,2,3,4)],'policeBlue')
    star=[]
    for i in range(10):
        angle=math.pi/2+i*math.pi/5;r=.40 if i%2==0 else .18
        star.append((3.175,-3+r*math.cos(angle),5.35+r*math.sin(angle)))
    s.mesh('badgeStar',star,[tuple(range(10))],'khaki')
    # Yard surrounds the wing with an open route at +X. Chunky rail kit, not a new gate.
    for y in (5.15,7.60):
        for x in (-4.9,-2.4,.1,2.6,5.1):s.box('yardPost',(x,y,1.15),(.13,.13,1.9),'uiDark')
        for z in (.55,1.3,2.05):s.box('yardRail',(.1,y,z),(10,.08,.08),'uiDark')
        for x in [i*.50-4.9 for i in range(21)]:s.box('yardPicket',(x,y,1.28),(.045,.06,1.40),'uiDark')
    for z in (.55,1.3,2.05):s.box('rearYardRail',(-4.9,6.375,z),(.08,2.45,.08),'uiDark')
    for y in (-5.6,-.4,6.3):
        for row in range(3):
            for i in range(3 if L<2 else 2):
                s.box('sandbag',(4.9-row*.07,y+(i-1)*.62+(.18 if row%2 else 0),.34+row*.25),(.65,.59,.25),'khaki')
    if L<2:
        for z in (.85,1.6,2.35,3.7,5.2):
            for y in (-6.2,-5.4,-.6,.2):s.box('brickCourse',(3.012,y,z),(.035,.55,.09),'khaki')
    for name,pos in [('entranceSocket',(3.25,-3,.2)),('armorySocket',(1.3,3,.2)),('yardEntrySocket',(5.5,6.3,.2)),('coverLeftSocket',(4.25,-5.6,.2)),('coverRightSocket',(4.25,-.4,.2))]:sockets.empty(name,pos,s.root)
    # Wall proxies preserve both apertures; the yard and entrance remain navigable.
    for name,size,pos in [('rear',( .3,8,6.1),(-4.85,-3,3.15)),('sideL',(8,.3,6.1),(-1,-6.85,3.15)),('sideR',(8,.3,6.1),(-1,.85,3.15)),('entryL',(.3,3,6.1),(2.85,-5.5,3.15)),('entryR',(.3,3,6.1),(2.85,-.5,3.15)),('lintel',(.3,2,3.3),(2.85,-3,4.55)),('armoryRear',(.3,4,2.8),(-4.85,3,1.6)),('armorySide',(6,.3,2.8),(-2,4.85,1.6))]:colliders.cuboid(name,size,pos,s.root)
    s.physics()
    return s


def shelter(s, decay):
    L=s.lod
    roof=s.joint('roof');sockets.empty('interior',parent=s.root)
    # Same closed roof cross-section as integrated base, sampled explicitly.
    def arch(name,x0,x1,token,thick=.12,lift=0):
        count=[24,12,8][L];vs=[]
        for x in (x0,x1):
            for lower in (False,True):
                for i in range(count+1):
                    y=-.92+1.84*i/count
                    vs.append((x,y,2.25+.4*math.sin(math.pi*i/count)+lift-(thick if lower else 0)))
        n=count+1;fs=[]
        for i in range(count):fs.extend([(i,i+1,2*n+i+1,2*n+i),(n+i,3*n+i,3*n+i+1,n+i+1),(i,n+i,n+i+1,i+1),(2*n+i,2*n+i+1,3*n+i+1,3*n+i)])
        fs.extend([(0,2*n,3*n,n),(count,n+count,3*n+count,2*n+count)])
        obj=s.mesh(name,vs,fs,token);obj.parent=roof
    arch('canopy',-1.95,1.95,'asphalt')
    for x in (-1.9,-.63,.63,1.9):arch('archBand',x-.055,x+.055,'woodWarm',.17,.025)
    for y in (-.9,.9):s.box('roofLip',(0,y,2.20),(4.04,.16,.20),'asphalt',roof)
    # Original splice plates define the exact base AABB, retained at every tier.
    for x in (-1.9,-.63,.63,1.9):
        for y in (-.985,.985):
            s.box('roofSplice',(x,y,2.20),(.19,.035,.19),'asphalt',roof)
            s.box('spliceBoss',(x,y+(.024 if y>0 else -.024),2.20),(.052,.0234,.052),'asphalt',roof)
    for x in (-1.78,1.78):
        for y in (-.76,.76):
            s.box('post',(x,y,1.12),(.19,.19,2.24),'asphalt')
            s.box('foot',(x,y,.024),(.39,.39,.048),'woodWarm')
        for z in (.4,2):s.box('posterEdge',(x,0,z),(.23,1.38,.095),'uiDark')
        s.box('posterFrame',(x,0,1.2),(.16,1.32,1.66),'woodWarm')
        if decay=='w3' and x>0:
            # Torn side pane: closed remnant volume, with a wide missing region.
            outline=[(-.57,.46),(.57,.46),(.57,1.94),(.20,1.94),(.35,1.66),(.10,1.40),(.26,1.10),(-.15,.90),(-.57,1.03)]
            vs=[(xx,y,z) for xx in (x-.09,x+.09) for y,z in outline];n=len(outline)
            fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
            s.mesh('tornSidePane',vs,fs,'picketWhite')
        else:s.box('posterBoard',(x,0,1.2),(.18,1.14,1.48),'asphalt' if x<0 else 'picketWhite')
    for z in (.30,1.90):s.box('rearRail',(0,.76,z),(3.58,.13,.14),'uiDark')
    for y in (-.30,-.08,.14):s.box('benchSeat',(0,y,.57),(2.62,.20,.13),'woodWarm')
    for z in (.85,1.10,1.35):
        obj=s.box('benchBack',(0,.30,z),(2.62,.14,.20),'woodWarm');obj.rotation_euler.x=math.radians(-8)
    for x in (-1,1):
        for y in (-.29,.30):
            obj=s.box('benchLeg',(x,y,.28),(.13,.15,.49),'uiDark');obj.rotation_euler.x=math.radians(18 if y<0 else -18)
            s.box('benchFoot',(x,y,.035),(.25,.23,.07),'woodWarm')
        s.box('benchCross',(x,0,.48),(.16,.76,.13),'uiDark')
        s.box('benchSupport',(x,.34,.90),(.14,.15,.98),'uiDark')
    for side in (-1,1):
        lettering(s,'STILL HERE',(-1.78+side*.104,0,1.52),.20,'schoolBusYellow',side=side)
        # Map blocks are solid proud panels; fewer blocks at distance.
        for row in range(2 if L==2 else 3):
            for col in range(2):
                if decay=='w3' and row>0:continue
                s.box('mapBlock',(1.78+side*.104,-.28+col*.56,.78+row*.30),(.012,.43,.22),'backpackTeal' if col else 'schoolBusYellow')
    if decay:
        # Jagged closed remnant profiles surround real missing-pane space.
        for index,(x0,x1) in enumerate([(-1.70,-.65),(-.57,.57),(.65,1.70)]):
            outline=[(x0,.76,.38),(x1,.76,.38),(x1,.76,1.82),(x0,.76,1.82)] if decay=='w2' and index<2 else [(x0,.76,1.82),(x1,.76,1.82),(x1,.76,1.45),(x1-.23,.76,1.60),(x1-.40,.76,1.38),(x0+.15,.76,1.62),(x0,.76,1.48)]
            vs=outline+[(x,y+.026,z) for x,y,z in outline];n=len(outline)
            fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
            s.mesh('smashedGlazing',vs,fs,'picketWhite')
        if decay=='w2':
            for z in (.83,1.55):
                obj=s.box('boardedPoster',(-1.895,0,z),(.055,1.38,.16),'woodWarm');obj.rotation_euler.x=.22
            s.box('abandonedBag',(.42,-.49,.24),(.48,.32,.48),'backpackTeal')
            s.box('bagPocket',(.42,-.67,.22),(.30,.04,.27),'schoolBusYellow')
            s.box('abandonedParcel',(.96,-.50,.22),(.43,.38,.44),'woodWarm')
        else:
            s.box('broadSideSoot',(-1.885,-.20,1.16),(.025,.70,1.24),'uiDark')
            s.box('charredPoster',(1.88,-.32,.68),(.024,.36,.42),'uiDark')
            s.box('benchSoot',(.76,.21,1.06),(.61,.045,.70),'uiDark')
            s.box('roofScorch',(1.28,.10,2.645),(.56,.40,.02),'asphalt',roof)
            # Damaged route sign tilts locally, not the whole shelter.
            obj=s.box('tornRouteSign',(1.90,-.10,1.62),(.025,.70,.34),'schoolBusYellow');obj.rotation_euler.x=-.35
            if L<2:
                s.box('discardedBoard',(.80,-.52,.06),(.75,.13,.10),'woodWarm',angle=.25)
    # Preserve the source rotation, exact feet and roof footprint. No AABB fitting.
    transform=Matrix.Rotation(math.pi/2,4,'Z')@Matrix.Diagonal((1.23,1,1,1))
    bpy.context.view_layer.update()
    for obj in s.root.children_recursive:
        if obj.type=='MESH':obj.matrix_world=transform@obj.matrix_world
    s.physics()
    for name,pos in [('entranceSocket',(.94,0,0)),('benchSocket',(0,0,.57)),('navSocket',(1.1,0,0))]:sockets.empty(name,pos,s.root)
    for y in (-2.1894,2.1894):colliders.cuboid('end'+str(y),(.3,.24,2.24),(0,y,1.12),s.root)
    colliders.cuboid('bench',(.8,3.23,1.35),(-.10,0,.675),s.root)
    s.root['decay']=decay or 'w0'
    return s


def facade(s):
    L=s.lod
    # Generic standing shop wall. Full profile survives 200-triangle far budget.
    s.box('threshold',(.16,0,.10),(1.60,4.8,.20),'sidewalk')
    for y in (-2.15,2.15):s.box('standingPier',(0,y,1.98),(.40,.50,3.56),'brick')
    s.box('windowSill',(0,-.60,.64),(.40,2.60,.88),'brick')
    s.box('charredLintel',(0,0,3.05),(.40,3.90,.35),'uiDark')
    # Locally chipped parapet, no wholesale collapse or ground rubble.
    outline=[(-2.4,3.20),(-2.4,3.80),(-1.6,3.80),(-1.45,3.52),(-.9,3.62),(-.5,3.4),(.1,3.72),(.6,3.55),(1.1,3.80),(2.4,3.80),(2.4,3.2)]
    vs=[(x,y,z) for x in (-.20,.20) for y,z in outline];n=len(outline)
    fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    s.mesh('chippedStandingParapet',vs,fs,'brick')
    for y in (-1.92,.66,1.91):s.box('charredFrame',(.22,y,1.97),(.10,.10,1.94),'uiDark')
    s.box('charredSill',(.22,-.63,1.13),(.12,2.70,.14),'uiDark')
    # Broad non-coplanar soot, both faces; broken pale glass tips at far tier too.
    for x in (-.207,.207):
        s.box('sootPatch',(x,-2.17,2.30),(.014,.44,1.7),'uiDark')
        s.box('sootPatch',(x,2.17,2.85),(.014,.44,1.3),'uiDark')
    for y in (-1.8,.4):s.mesh('glassShard',[(.28,y,2.82),(.28,y+.22,2.82),(.28,y+.05,2.48)],[(0,1,2)],'picketWhite')
    if L<2:
        s.box('charredAwning',(.48,0,2.89),(.80,3.92,.14),'uiDark')
        for y in (-1.45,-.4,.65,1.6):s.box('scorchedTrim',(.90,y,2.82),(.06,.12,.28),'woodWarm')
        for z in (.45,.75,3.4):
            for y in (-2.16,2.16):s.box('brickJoint',(.217,y,z),(.02,.38,.035),'sidewalk')
    if L==0:
        for y in (-1.4,-.8,-.2,.4,1,1.6):s.box('localChar',(.219,y,3.45),(.024,.28,.14),'uiDark')
    s.physics()
    sockets.empty('attachSocket',(-.21,0,0),s.root)
    colliders.cuboid('wall',(.44,4.8,3.8),(0,0,1.9),s.root)
    return s


def finish(s,path):
    export.merge_by_material(s.root,s.protected)
    bpy.context.view_layer.update()
    meshes=[o for o in s.root.children_recursive if o.type=='MESH']
    points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
    low=[min(v[k] for v in points) for k in range(3)];high=[max(v[k] for v in points) for k in range(3)]
    sockets.empty('front',(high[0],0,0),s.root)
    physics=json.loads(s.root['ss_physics']);physics['centerOfMass']=[(low[0]+high[0])/2,(low[2]+high[2])/2,-(low[1]+high[1])/2];s.root['ss_physics']=json.dumps(physics)
    ao.bake_all(meshes,16)
    for obj in meshes:
        for color in obj.data.color_attributes['ao'].data:color.color=tuple(.55+.45*c for c in color.color[:3])+(1,)
    export.glb(s.root,path)
    for obj in meshes:obj.data.calc_loop_triangles()
    triangles=sum(len(o.data.loop_triangles) for o in meshes)
    cap=([1500,600,200] if s.asset=='decay.burned-facade' else [30000,12000,4000])[s.lod]
    assert triangles<=cap,(s.asset,s.lod,triangles,cap)
    assert len(meshes)<=8,(s.asset,s.lod,len(meshes))
    return {'triangles':triangles,'draws':len(meshes),'materials':len({m.name for o in meshes for m in o.data.materials}),'bytes':Path(path).stat().st_size,'dimensions':{'x':high[0]-low[0],'y':high[2]-low[2],'z':high[1]-low[1],'tolerance':.015}}


def run(asset,source,default_decay=None):
    parser=argparse.ArgumentParser();parser.add_argument('--glb',required=True);parser.add_argument('--quality',default='high');parser.add_argument('--decay',default=default_decay);parser.add_argument('--distance-tier',type=int,choices=(0,1,2))
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    directory=Path(source).resolve().parent
    if asset=='bld.bus-stop' and directory.name!=asset:directory=directory.parent/asset
    suffix='.'+args.decay if args.decay else ''
    stats={}
    for lod in ((args.distance_tier,) if args.distance_tier is not None else (0,1,2)):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        scene=Scene(asset,lod)
        scene=station(scene) if asset=='bld.police-station' else shelter(scene,args.decay) if asset=='bld.bus-stop' else facade(scene)
        path=directory/('model'+suffix+('' if lod==0 else '.lod'+str(lod))+'.glb')
        stats['lod'+str(lod)]=finish(scene,path)
        if lod==(args.distance_tier or 0):
            import shutil
            output=Path(args.glb).resolve();output.parent.mkdir(parents=True,exist_ok=True)
            if output!=path:shutil.copyfile(path,output)
    (directory/('lod-stats'+suffix+'.json')).write_text(json.dumps(stats,indent=2)+'\n')
