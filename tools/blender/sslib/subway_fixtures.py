"""L6 authored gate and shelter fixtures: complete solids, stable rigid owners.
Blender Z up, +X front; export converts once to glTF Y up. No decimation.
"""
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector
from . import palette, sockets, colliders, export, ao
from .rescue_assets import Scene


def own(obj, parent):
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world
    return obj


def chamfer_face(s, name, x, depth, width, height, z, token, emissive=False):
    """Closed eight-corner prism: retains lens/case bevel silhouette at distance."""
    c = min(width, height) * .16
    outline = [(-width/2+c,-height/2),(width/2-c,-height/2),
               (width/2,-height/2+c),(width/2,height/2-c),
               (width/2-c,height/2),(-width/2+c,height/2),
               (-width/2,height/2-c),(-width/2,-height/2+c)]
    verts = [(xx,y,zz+z) for xx in (x-depth/2,x+depth/2) for y,zz in outline]
    faces = [tuple(range(7,-1,-1)), tuple(range(8,16))]
    faces += [(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
    obj = s.mesh(name, verts, faces, token)
    if emissive:
        obj.data.materials.clear(); obj.data.materials.append(palette.mat(token, True))
    return obj


def light(s, name, position, token, group, flicker, emissive):
    anchor = sockets.empty('light:'+name, position, s.root)
    # Local -Z points downward: viable floor reach at any layout mounting height.
    anchor['ss_light'] = json.dumps(dict(type='point',color=token,intensity=2.6,
        range=9,pool=True,beam='none',reflect=True,shadow='none',heroPriority=1,
        flicker=flicker,powerGroup=group,breakable=True,
        emissiveNodes=['body_'+emissive]))


def gate(s):
    L = s.lod
    hinge = sockets.empty('gate', (0,-.99,0), s.root)
    s.protected.add('gate')
    hinge['closedYaw'] = 0.0; hinge['openYaw'] = -math.pi/2
    for y in (-1.12,1.12):
        s.box('jamb',(0,y,1.29),(.20,.18,2.58),'olive')
        s.box('foot',(0,y,.045),(.36,.32,.09),'uiDark')
    s.box('lintel',(0,0,2.49),(.20,2.12,.18),'olive')
    own(s.box('opaqueSteel',(0,0,1.27),(.105,1.98,2.30),'picketWhite'),hinge)
    for y in (-.92,.92):
        own(s.box('leafStile',(.085,y,1.27),(.07,.12,2.30),'oliveLight'),hinge)
    for z in (.18,2.36):
        own(s.box('leafRail',(.085,0,z),(.07,1.74,.12),'oliveLight'),hinge)
    # Bold X braces remain visible on the opaque front; no perforated panel.
    for a,b in [((.092,-.83,.30),(.092,.83,2.24)),((.098,.83,.30),(.098,-.83,2.24))]:
        own(s.beam('diagonalBrace',a,b,.105,'oliveLight'),hinge)
    own(s.box('latch',(.205 if L==2 else .155,.80,1.15),(.10,.20,.32),'uiDark'),hinge)
    for z in (.56,1.94):
        own(s.tube('hingeBarrel',(.09,-1.02,z),.082,.26,'uiDark'),hinge)
    if L < 2:
        own(s.box('latchGrip',(.225,.80,1.15),(.06,.07,.19),'silver'),hinge)
        own(s.box('braceReceiver',(.155,.58,.80),(.11,.26,.12),'uiDark'),hinge)
        for z in (.56,1.94):
            s.box('hingePlate',(.105,-1.10,z),(.05,.17,.35),'uiDark')
        if L == 0:
            for y in (-.92,.92):
                for z in (.22,2.32):
                    own(s.tube('rivet',(.13,y,z),.028,.025,'silver',(0,math.pi/2,0)),hinge)
            for z in (.56,1.94):
                own(s.tube('hingeCollar',(.09,-1.02,z),.092,.06,'silver'),hinge)
    closed = sockets.empty('gateClosed',(0,0,1.27),s.root)
    opened = sockets.empty('gateOpen',(.99,-.99,1.27),s.root)
    opened.rotation_euler.z = -math.pi/2
    sockets.empty('braceSlot',(.23,.35,.8),s.root)
    sockets.empty('latchSocket',(.20,1.79,1.15),hinge)
    proxy = colliders.cuboid('gate',(.105,1.98,2.30),(0,.99,1.27),hinge)
    proxy['enabledWhen'] = 'closed'; proxy['blocksSightWhen'] = 'closed'
    for y in (-1.12,1.12):colliders.cuboid('jamb'+str(y),(.20,.18,2.58),(0,y,1.29),s.root)
    s.root['ss_gate'] = json.dumps(dict(leaf='gate',collider='col:gate',closedAnchor=closed.name,
        openAnchor=opened.name,braceSlot='braceSlot',closedYaw=0,openYaw=-math.pi/2,
        blocksMovementWhen='closed',blocksSightWhen='closed'))
    s.physics()


def fluorescent(s):
    L = s.lod
    s.box('backHousing',(-.035,0,.20),(.15,1.82,.32),'silver')
    for z in (.055,.345):s.box('recessLip',(.04,0,z),(.12,1.64,.055),'picketWhite')
    for y in (-.85,.85):s.box('thickEndCap',(.0545,y,.20),(.27,.15,.34),'picketWhite')
    for y in (-.54,.54):s.box('mountingBracket',(-.13,y,.20),(.09,.13,.40),'uiDark')
    s.box('tubeSeparator',(.13,0,.20),(.035,1.53,.032),'uiDark')
    for z in (.125,.275):
        tube = s.tube('fluorescentTube',(.073,0,z),.052,1.52,'picketWhite',(math.pi/2,0,0))
        tube.data.materials.clear();tube.data.materials.append(palette.mat('picketWhite',True))
        if L < 2:
            for y in (-.735,.735):s.tube('tubeSocket',(.073,y,z),.065,.055,'silver',(math.pi/2,0,0))
    if L == 0:
        for y in (-.85,.85):s.tube('capFastener',(.177,y,.20),.026,.025,'uiDark',(0,math.pi/2,0))
    light(s,'fluorescent',(.10,0,.20),'light_fluorescent','metro-main','fluorescent','emi_picketWhite')
    sockets.empty('mountSocket',(-.175,0,.20),s.root)
    s.physics()


def emergency(s):
    L = s.lod
    chamfer_face(s,'protectedHousing',0,.13,.38,.55,.36,'silver')
    chamfer_face(s,'darkGasket',.075,.035,.32,.49,.36,'uiDark')
    chamfer_face(s,'redLens',.13,.12,.285,.45,.36,'sirenRed')
    core = s.box('emissiveCore',(.195,0,.36),(.025,.13,.27),'redDark')
    core.data.materials.clear();core.data.materials.append(palette.mat('redDark',True))
    for z in (.19,.36,.53):s.box('lensGuard',(.20,0,z),(.035,.31,.028),'redDark')
    for z in (.035,.685):s.box('wallMount',(-.035,0,z),(.08,.19,.07),'silver')
    if L < 2:
        for y in (-.155,.155):
            for z in (.13,.59):s.tube('housingBolt',(.075,y,z),.021,.02,'uiDark',(0,math.pi/2,0))
    if L == 0:
        for y in (-.135,.135):s.box('lensGuardSide',(.175,y,.36),(.04,.025,.40),'redDark')
    light(s,'emergency',(.23,0,.36),'light_siren_red','metro-emergency','none','emi_redDark')
    sockets.empty('mountSocket',(-.075,0,.36),s.root)
    s.physics()


def radio(s):
    L = s.lod
    # Reference-derived handheld silhouette, dark palette and broad control regions.
    chamfer_face(s,'portableCase',0,.16,.29,.42,.23,'tealDark')
    s.box('screenRecess',(.089,0,.32),(.025,.225,.16),'uiDark')
    s.box('tuningDisplay',(.106,0,.32),(.013,.18,.105),'foliageLight')
    s.box('speakerBed',(.094,0,.145),(.033,.23,.15),'uiDark')
    for z in (.10,.145,.19):s.box('speakerGrille',(.116,0,z),(.023,.22,.022),'navySeam')
    s.tube('antenna',(-.015,-.087,.63),.025,.36,'uiDark')
    s.tube('antennaBase',(-.015,-.087,.45),.040,.05,'uiDark')
    s.tube('tuningKnob',(.01,.085,.465),.039,.065,'uiDark')
    s.box('pushToTalk',(0,.157,.28),(.10,.035,.10),'brass')
    s.box('beltClip',(-.11,0,.28),(.04,.045,.20),'uiDark')
    if L < 2:
        s.box('batteryCover',(-.086,0,.21),(.02,.22,.28),'tealDark')
        s.box('displayScale',(.116,0,.30),(.006,.15,.009),'picketWhite')
    if L == 0:
        for y in (-.074,-.025,.025,.074):s.box('tuningTick',(.116,y,.345),(.005,.006,.022),'picketWhite')
        for y in (-.10,.10):
            for z in (.055,.405):s.tube('caseScrew',(.089,y,z),.009,.008,'brass',(0,math.pi/2,0))
    sockets.empty('audioSocket',(.12,0,.16),s.root)
    s.root['ss_audio'] = json.dumps(dict(anchor='audioSocket',role='shelter-radio-static',dressing=True))
    s.physics('light',.75)


RECIPES = {'prop.service-gate':gate,'prop.fluorescent-strip':fluorescent,
           'prop.emergency-light':emergency,'util.radio':radio}


def build_set(asset, directory):
    directory = Path(directory)
    tier = int(sys.argv[sys.argv.index('--distance-tier')+1]) if '--distance-tier' in sys.argv else None
    output = Path(sys.argv[sys.argv.index('--glb')+1]).resolve() if '--glb' in sys.argv else directory/'model.glb'
    stats = {}
    for L in ([tier] if tier is not None else (0,1,2)):
        if L not in (0,1,2):raise ValueError('distance tier must be 0, 1 or 2')
        bpy.ops.wm.read_factory_settings(use_empty=True)
        s = Scene(asset,L);RECIPES[asset](s)
        export.merge_by_material(s.root,s.protected)
        bpy.context.view_layer.update()
        meshes = [o for o in s.root.children_recursive if o.type=='MESH']
        points = [o.matrix_world@v.co for o in meshes for v in o.data.vertices]
        ground = min(p.z for p in points)
        for obj in s.root.children:obj.location.z -= ground
        bpy.context.view_layer.update()
        points = [o.matrix_world@v.co for o in meshes for v in o.data.vertices]
        low = [min(p[k] for p in points) for k in range(3)]
        high = [max(p[k] for p in points) for k in range(3)]
        sockets.empty('front',(high[0],0,(low[2]+high[2])/2),s.root)
        physics = json.loads(s.root['ss_physics'])
        physics['centerOfMass'] = [(low[0]+high[0])/2,(low[2]+high[2])/2,-(low[1]+high[1])/2]
        s.root['ss_physics'] = json.dumps(physics)
        if asset!='prop.service-gate':
            colliders.cuboid('body',tuple(high[k]-low[k] for k in range(3)),tuple((high[k]+low[k])/2 for k in range(3)),s.root)
        ao.bake_all(s.root.children_recursive,16)
        # Broad solid faces must stay readable when their corner AO is occluded by trim.
        for obj in meshes:
            for value in obj.data.color_attributes['ao'].data:
                shade = [.60+.40*c for c in value.color[:3]]
                if asset=='prop.service-gate' and obj.name=='gate_pal_picketWhite':
                    shade = [c*t for c,t in zip(shade,(.72,.91,.65))]
                value.color = (*shade,1)
        triangles = 0
        for obj in meshes:obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
        draws = sum(len(o.data.materials) for o in meshes)
        if triangles>(1500,600,200)[L] or draws>8:raise ValueError(f'{asset} LOD{L}: {triangles} triangles / {draws} draws')
        path = output if tier is not None else directory/('model'+('' if L==0 else '.lod'+str(L))+'.glb')
        export.glb(s.root,path)
        stats['lod'+str(L)] = dict(triangles=triangles,draws=draws,materials=len({m.name for o in meshes for m in o.data.materials}),
            bytes=path.stat().st_size,dimensions=dict(x=high[0]-low[0],y=high[2]-low[2],z=high[1]-low[1],tolerance=.03))
    if tier is None:
        (directory/'lod-stats.json').write_text(json.dumps(stats,indent=2)+'\n')
        if output!=directory/'model.glb':
            import shutil
            shutil.copyfile(directory/'model.glb',output)
    return stats
