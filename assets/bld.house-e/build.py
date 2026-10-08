"""Reproducible palette-only house. +X front, Z up, metre units.
Rebuild with tools/blender/run.py. Independent color slots,
mirrored variant and optional garage; default geometry follows the concept crop.
"""
import argparse
import json
import math
import random
import sys
import subprocess
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(REPO / 'tools/blender'))
# Standing variants keep the integrated base's transforms and anchors.
if '--decay' in sys.argv:
    from sslib.house_decay import build_house
    tier = int(sys.argv[sys.argv.index('--distance-tier')+1]) if '--distance-tier' in sys.argv else None
    build_house(HERE, sys.argv[sys.argv.index('--glb')+1], sys.argv[sys.argv.index('--decay')+1], tier)
    raise SystemExit(0)
from sslib.distance import tier_argument, export_variant
DISTANCE = tier_argument()
from sslib import palette, ao, export as shared_export
ASSET_ID = 'bld.house-e'
KIND = 'e'
p = argparse.ArgumentParser()
p.add_argument('--glb')
p.add_argument('--quality', choices=['high','low'], default='high')
p.add_argument('--render')
p.add_argument('--view', choices=['ref', 'game', 'front', 'side', 'rear'], default='ref')
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960)
p.add_argument('--height', type=int, default=540)
p.add_argument('--wall-token', default='mustardLight' if KIND == 'd' else 'apronSage')
p.add_argument('--trim-token', default='picketWhite')
p.add_argument('--roof-token', default='navy')
p.add_argument('--mirror', action='store_true')
p.add_argument('--garage', action='store_true')
p.add_argument('--no-dressing', action='store_true')
p.add_argument('--door-angle', type=float, default=0)
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
rng = random.Random(404 if KIND == 'd' else 405)
M = {token: palette.mat(token) for token in ['sidewalk', 'woodWarm', 'brick', 'uiDark', 'denim',
    'foliage', 'foliageDark', 'foliageLight', 'grass', 'cardiganRose', 'schoolBusYellow',
    'brass', 'picketWhite', 'bandage', 'silver', 'asphalt', 'leather', a.wall_token, a.trim_token, a.roof_token]}
M['wall'] = M[a.wall_token]
M['trim'] = M[a.trim_token]
M['roof'] = M[a.roof_token]
M['glow'] = palette.mat('windowGlow', emissive=True)
M['glow'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = .6
M['glow'].node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=.88
M['glow'].surface_render_method='BLENDED'
M['glow'].node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=.05
for m in set(M.values()):
    m.use_backface_culling = True
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .72


def empty(name, pos=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    scene.collection.objects.link(o)
    o.location = pos
    o.parent = parent
    o.empty_display_size = .14
    bpy.context.view_layer.update()
    return o


root = empty('root')
root['asset_id'] = ASSET_ID
root['category'] = 'building'
root['tier'] = 'hero'
root['forward'] = '+X'
root['variant'] = {'wall': a.wall_token, 'trim': a.trim_token, 'roof': a.roof_token,
                   'mirror': a.mirror, 'garage': a.garage}
root['colorSlots'] = {'wall': M['wall'].name, 'trim': M['trim'].name, 'roof': M['roof'].name}
root['optionalGroups'] = ['dressing', 'garage']
body = empty('body', parent=root)
roof = empty('roof', parent=root)
interior = empty('interior', parent=root)
dressing = empty('dressing', parent=root)
glazing = empty('windows', parent=root)
protected = {'body', 'roof', 'interior', 'dressing', 'windows'}


def mesh(name, verts, faces, token, parent=body, bevel=.018, segments=2):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    o.data.materials.append(M[token])
    o.parent = parent
    o.matrix_parent_inverse = parent.matrix_world.inverted()
    if bevel:
        mod = o.modifiers.new('soft edges', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'ANGLE'
        mod.harden_normals = True
        normal = o.modifiers.new('weighted normals', 'WEIGHTED_NORMAL')
        normal.keep_sharp = True
    return o


def box(name, pos, size, token='trim', parent=body, bevel=.018, rot=None, segments=1):
    x, y, z = [v / 2 for v in size]
    o = mesh(name, [(i, j, k) for i in [-x, x] for j in [-y, y] for k in [-z, z]],
             [(0, 4, 6, 2), (1, 3, 7, 5), (0, 1, 5, 4), (2, 6, 7, 3),
              (0, 2, 3, 1), (4, 5, 7, 6)], token, parent, min(bevel, min(size)*.35), max(segments,2 if bevel>=.03 else 1))
    o.location = pos
    if rot:
        o.rotation_euler = rot
    return o


def beam(name, start, end, width, token='trim', parent=body, depth=None):
    delta = Vector(end) - Vector(start)
    o = box(name, (Vector(start)+Vector(end))/2, (width, depth or width, delta.length), token, parent)
    o.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    return o


def ball(name, pos, size, token, parent=dressing, sub=1):
    if DISTANCE: sub = 1
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    o.location = pos
    o.scale = size
    o.data.materials.append(M[token])
    o.parent = parent
    o.matrix_parent_inverse = parent.matrix_world.inverted()
    for f in me.polygons:
        f.use_smooth = True
    return o


def cone(name, pos, radius1, radius2, depth, token, parent=body, vertices=12):
    if DISTANCE: vertices = min(vertices, 10 if DISTANCE == 1 else 6)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=vertices, radius1=radius1, radius2=radius2, depth=depth)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    o.location = pos
    o.data.materials.append(M[token])
    o.parent = parent
    o.matrix_parent_inverse = parent.matrix_world.inverted()
    b = o.modifiers.new('rounded rim', 'BEVEL')
    b.width = .01
    b.segments = 2
    o.modifiers.new('weighted normals', 'WEIGHTED_NORMAL')
    return o


def plate(name, polygon, height, thickness, token='roof', parent=roof, bevel=.008):
    n = len(polygon)
    vs = [(x, y, height(x, y)+d) for d in [0, thickness] for x, y in polygon]
    fs = [tuple(reversed(range(n))), tuple(range(n, 2*n))]
    fs += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    return mesh(name, vs, fs, token, parent, bevel, segments=1)


def clip(poly, fn):
    result = []
    for v, w in zip(poly, poly[1:]+poly[:1]):
        fv, fw = fn(*v), fn(*w)
        if fv >= -1e-8:
            result.append(v)
        if (fv > 0) != (fw > 0):
            t = fv/(fv-fw)
            result.append((v[0]+t*(w[0]-v[0]), v[1]+t*(w[1]-v[1])))
    clean = []
    for point in result:
        if not clean or math.dist(point, clean[-1]) > 1e-6:
            clean.append(point)
    if len(clean)>1 and math.dist(clean[0], clean[-1])<1e-6:
        clean.pop()
    return clean


def tiled_plane(name, polygon, height, spacing=(.40, .52), parent=roof, mask=None):
    if sum(v[0]*w[1]-w[0]*v[1] for v, w in zip(polygon, polygon[1:]+polygon[:1])) < 0:
        polygon = list(reversed(polygon))
    plate(name+'_deck', polygon, height, .075, parent=parent)
    xmin, xmax = min(p[0] for p in polygon), max(p[0] for p in polygon)
    ymin, ymax = min(p[1] for p in polygon), max(p[1] for p in polygon)
    dx, dy = spacing
    for i in range(math.ceil((xmax-xmin)/dx)):
        xa = xmin+i*dx+.009
        xb = min(xmax-.004, xmin+(i+1)*dx-.009)
        for j in range(-1, math.ceil((ymax-ymin)/dy)+1):
            ya = ymin+j*dy+(.5*dy if i%2 else 0)+.009
            yb = ya+dy-.018
            tile = [(xa, ya), (xb, ya), (xb, yb), (xa, yb)]
            for v, w in zip(polygon, polygon[1:]+polygon[:1]):
                tile = clip(tile, lambda x, y, v=v, w=w: (w[0]-v[0])*(y-v[1])-(w[1]-v[1])*(x-v[0])) if tile else []
            if len(tile)<3:
                continue
            area = abs(sum(v[0]*w[1]-w[0]*v[1] for v, w in zip(tile, tile[1:]+tile[:1])))/2
            if area < .004:
                continue
            cx, cy = sum(x for x,y in tile)/len(tile), sum(y for x,y in tile)/len(tile)
            if mask and mask(cx, cy):
                continue
            plate('shingle', tile, lambda x,y: height(x,y)+.082, .041, parent=parent)


def gable(name, x0, x1, width, eave, peak, token='wall', parent=body, yc=0):
    vs = [(x, y+yc, z) for x in [x0, x1] for y,z in [(-width/2,eave),(width/2,eave),(0,peak)]]
    return mesh(name, vs, [(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)], token, parent)


def gabled_roof(x0, x1, half, eave, peak, yc=0, parent=roof):
    for sign in [-1, 1]:
        h = lambda x,y: peak-(peak-eave)*abs(y-yc)/half
        tiled_plane('gable_roof', [(x0,yc),(x1,yc),(x1,yc+sign*half),(x0,yc+sign*half)], h, spacing=(.48,.34), parent=parent)
        beam('eave_fascia',(x0,yc+sign*half,eave-.06),(x1,yc+sign*half,eave-.06),.18,parent=parent)
        for x in [x0, x1]:
            beam('rake_fascia',(x,yc,peak+.012),(x,yc+sign*half,eave-.02),.20,parent=parent)
    for i in range(math.ceil((x1-x0)/.5)):
        x = x0+(i+.5)*(x1-x0)/math.ceil((x1-x0)/.5)
        box('ridge_cap',(x,yc,peak+.105),(.48,.20,.10),'roof',parent,.025)


# Facade-local coordinates allow real wall/board openings on all four sides.
def facade_box(name, origin, u, z, w, h, depth, offset, token='wall', parent=body, bevel=.012):
    side, fixed = origin
    sign = 1 if fixed>0 else -1
    pos = (fixed+sign*offset,u,z) if side=='X' else (u,fixed+sign*offset,z)
    size = (depth,w,h) if side=='X' else (w,depth,h)
    return box(name,pos,size,token,parent,bevel)


def spans(lo, hi, openings, za, zb):
    result = [(lo,hi)]
    for u0,u1,z0,z1 in openings:
        if za<z1 and zb>z0:
            result = [p for l,h in result for p in [(l,min(h,u0)),(max(l,u1),h)] if p[1]-p[0]>.001]
    return result


def wall(name, origin, lo, hi, z0, z1, openings):
    levels = sorted({z0,z1,*[z for op in openings for z in op[2:]]})
    for za,zb in zip(levels, levels[1:]):
        for ua,ub in spans(lo,hi,openings,za,zb):
            facade_box('wall_'+name,origin,(ua+ub)/2,(za+zb)/2,ub-ua,zb-za,.14,-.07)
    row = 0
    z = z0+.028
    while z<z1-.01:
        top = min(z1,z+.225)
        for ua,ub in spans(lo,hi,openings,z,top):
            o = facade_box('clapboard_'+name,origin,(ua+ub)/2,(z+top)/2,ub-ua,top-z,.06,.028,bevel=.008)
            # Slight overlap produces a lap-board shadow without coplanar decals.
            o.rotation_euler.y = -.025 if origin[0]=='X' else 0
            o.rotation_euler.x = .025 if origin[0]=='Y' else 0
        z += .23
        row += 1
    foundation_count = 1 if DISTANCE == 2 else math.ceil((hi-lo)/.75)
    for i in range(foundation_count):
        ua=lo+i*(hi-lo)/foundation_count;ub=lo+(i+1)*(hi-lo)/foundation_count
        facade_box('foundation_block',origin,(ua+ub)/2,.25,ub-ua-.012,.5,.18,-.01,'sidewalk',bevel=.02)
    facade_box('skirt_trim',origin,(lo+hi)/2,.51,hi-lo,.09,.10,.055,'trim')


windows = []
def window(name, origin, u, z, w, h, shutters=False, parent=None, flower=False, dark=False):
    group = empty(name,parent=parent or glazing)
    windows.append(group)
    fb = lambda n,v,zz,ww,hh,d,off,t: facade_box(n,origin,v,zz,ww,hh,d,off,t,group,.011)
    fb('window_reveal',u,z,w+.1,h+.1,.12,-.02,'woodWarm')
    fb('window_pane',u,z,w-.06,h-.06,.04,.047,'uiDark' if dark else 'glow')
    for v in [u-w/2-.06,u+w/2+.06]:fb('casing',v,z,.14,h+.25,.16,.10,'trim')
    for zz in [z-h/2-.07,z+h/2+.07]:fb('casing',u,zz,w+.3,.15,.16,.10,'trim')
    fb('sill',u,z-h/2-.14,w+.38,.10,.28,.15,'trim')
    for v in [u-w/2+.02,u,u+w/2-.02]:fb('window_sash',v,z,.045,h,.052,.08,'trim')
    for zz in ([z-h/2+.02,z+h/2-.02,z] if dark else [z-h/2+.02,z-h/6,z+h/6,z+h/2-.02]):
        fb('window_mullion',u,zz,w,.042,.055,.082,'trim')
    if not dark:
        for side in [-1,1]:
            for i in range(2):fb('curtain_fold',u+side*(w/2-.06-i*.05),z,.052,h-.05,.023,.076,'woodWarm')
    if shutters:
        for v in [u-w/2-.34,u+w/2+.34]:
            fb('shutter_frame',v,z,.40,h+.02,.10,.065,'denim')
            fb('shutter_inset',v,z,.28,h-.18,.028,.129,'uiDark')
            for zz in [z-h/2+.16+i*.16 for i in range(int((h-.2)/.16))]:
                fb('shutter_louver',v,zz,.28,.07,.026,.154,'denim')
    if flower:
        fb('flower_box',u,z-h/2-.30,w+.10,.25,.30,.20,'denim' if KIND=='d' else 'woodWarm')
        side,fixed=origin
        for i in range(5):
            t=u-w*.4+i*w*.2
            pos=(fixed+(.27 if fixed>0 else -.27),t,z-h/2-.14) if side=='X' else (t,fixed+(.27 if fixed>0 else -.27),z-h/2-.14)
            shrub(pos,.16,dressing,count=5,flower_count=1)
    return group


def flower(pos, size=.06, token='picketWhite', parent=dressing):
    # Flowers face out/up with five individually rounded petals and golden centres.
    x,y,z=pos
    for k in range(5):
        t=k*math.tau/5
        ball('flower_petal',(x+size*.65*math.cos(t),y+size*.65*math.sin(t),z+.009),
             (size*.48,size*.48,size*.20),token,parent)
    ball('flower_center',(x,y,z+.022),(size*.27,size*.27,size*.22),'schoolBusYellow',parent)


def shrub(pos, size, parent=dressing, count=20, flower_count=6):
    x,y,z=pos
    ball('shrub_core',(x,y,z),(.80*size,.86*size,.78*size),'foliageDark',parent,sub=2)
    for i in range(count):
        theta=i*2.39996323
        nz=1-2*(i+.5)/count
        radius=math.sqrt(1-nz*nz)
        dx,dy=radius*math.cos(theta),radius*math.sin(theta)
        ball('leaf_cluster',(x+dx*size*.75,y+dy*size*.78,z+nz*size*.73),
             (.26*size,.22*size,.25*size),['foliage','foliageLight'][i%3==0],parent,sub=2)
    for i in range(flower_count):
        theta=i*2.39996323
        dz=.15+.72*(i+.5)/flower_count
        r=math.sqrt(1-dz*dz)
        flower((x+math.cos(theta)*size*r*1.08,y+math.sin(theta)*size*r*1.08,z+dz*size*1.08),
               max(.045,size*.14),'cardiganRose' if i%3==0 else 'picketWhite',parent)


def pine(x,y,height):
    cone('pine_trunk',(x,y,.2+height*.42),.07,.06,height*.85,'woodWarm',dressing)
    for j in range(5):
        z=.5+height*j*.15
        cone('pine_foliage',(x,y,z+height*.16),height*(.23-j*.035),.028,height*.43,
             'foliageDark' if j%2==0 else 'foliage',dressing,vertices=10)


def lantern(name,pos):
    x,y,z=pos
    group=empty(name,parent=root);protected.add(name)
    box('lamp_backplate',(x,y,z+.03),(.065,.18,.31),'uiDark',group,.02)
    box('lantern_arm',(x+.14,y,z+.23),(.27,.045,.055),'uiDark',group,.01)
    box('lantern_core',(x+.22,y,z),(.15,.18,.27),'glow',group,.021)
    for zz in [z-.16,z+.16]:box('lantern_frame',(x+.22,y,zz),(.24,.27,.052),'uiDark',group,.012)
    for xx in [x+.125,x+.315]:
        for yy in [y-.115,y+.115]:beam('lantern_cage',(xx,yy,z-.15),(xx,yy,z+.15),.026,'uiDark',group)
    cone('lantern_hood',(x+.22,y,z+.205),.19,.04,.105,'uiDark',group)
    return group


def entry(x,y,z,token):
    door=empty('door_front',(x,y+.53,z),root);protected.add('door_front')
    door['hinge_axis']='Z';door['open_angle']=-100
    box('door_leaf',(x,y,z+1.01),(.085,1.04,2.02),token,door,.025)
    for yy in [y-.61,y+.61]:box('door_jamb',(x+.045,yy,z+1.02),(.17,.14,2.19))
    box('door_lintel',(x+.045,y,z+2.12),(.17,1.36,.16))
    box('threshold',(x+.1,y,z+.018),(.30,1.13,.04),'woodWarm')
    for yy in [y-.24,y+.24]:
        for zz in [z+.40,z+1.03]:
            box('door_panel_rebate',(x+.048,yy,zz),(.024,.36,.45),'woodWarm' if token=='uiDark' else 'leather',door,.015)
            box('door_panel',(x+.064,yy,zz),(.017,.28,.36),token,door,.01)
        box('door_lite_bezel',(x+.052,yy,z+1.71),(.027,.32,.31),'woodWarm',door,.01)
        box('door_lite',(x+.071,yy,z+1.71),(.018,.23,.21),'glow',door,.006)
    for zz in [z+.40,z+1.05,z+1.72]:
        cone('hinge',(x+.055,y+.525,zz),.022,.022,.12,'brass',door)
    ball('door_knob',(x+.133,y-.35,z+1.03),(.051,.045,.045),'brass',door,sub=2)
    box('door_handle',(x+.12,y-.35,z+.90),(.065,.028,.17),'brass',door,.011)
    return door


def chimney(x,y,bottom,top):
    box('chimney_mortar',(x,y,(bottom+top)/2),(.52,.58,top-bottom),'sidewalk',roof,.016)
    for row in range(math.ceil((top-bottom)/.17)):
        z=bottom+.085+row*.17
        if z>top-.025:continue
        for sign in [-1,1]:
            for i in range(2):
                u=-.14+i*.28
                box('chimney_brick',(x+sign*.271,y+u,z),(.052,.25,.151),'brick',roof,.008,segments=1)
                box('chimney_brick',(x+u,y+sign*.30,z),(.25,.05,.151),'brick',roof,.008,segments=1)
    box('chimney_coping',(x,y,top+.055),(.71,.76,.11),'sidewalk',roof,.018)
    box('flue_dark',(x,y,top+.17),(.38,.41,.16),'uiDark',roof,.013)
    for yy in [y-.25,y+.25]:box('rain_cap_support',(x,yy,top+.22),(.04,.04,.25),'silver',roof,.007)
    box('chimney_rain_cap',(x,y,top+.35),(.62,.65,.085),'sidewalk',roof,.012)


def railing(x0,x1,y0,y1,z,parent=body):
    for zz in [z+.13,z+.79]:beam('porch_rail',(x0,y0,zz),(x1,y1,zz),.10,parent=parent,depth=.09)
    length=math.hypot(x1-x0,y1-y0)
    for i in range(1,max(2,math.ceil(length/.19))):
        t=i/max(2,math.ceil(length/.19))
        box('baluster',(x0+(x1-x0)*t,y0+(y1-y0)*t,z+.45),(.045,.045,.61),parent=parent,bevel=.008)


# The little paved pad matches the sheet and makes ground contact unambiguous.
PAD_X0, PAD_X1 = (-3.7,5.3) if KIND=='d' else (-3.9,4.6)
PAD_HALF=4.0
box('pad',( (PAD_X0+PAD_X1)/2,0,.095),(PAD_X1-PAD_X0,8,.19),'sidewalk',dressing,.025)
for i in range(1 if DISTANCE == 2 else math.ceil((PAD_X1-PAD_X0)/.70)):
    x=PAD_X0+(i+.5)*(PAD_X1-PAD_X0)/(1 if DISTANCE == 2 else math.ceil((PAD_X1-PAD_X0)/.70))
    for y in [-3.83,3.83]:box('curb',(x,y,.20),((PAD_X1-PAD_X0)/(1 if DISTANCE == 2 else math.ceil((PAD_X1-PAD_X0)/.70))-.012,.32,.30),'sidewalk',dressing,.018)
for i in range(11):
    y=-3.64+i*.73
    for x in [PAD_X0+.16,PAD_X1-.16]:box('curb',(x,y,.20),(.32,.70,.30),'sidewalk',dressing,.018)

if KIND=='d':
    FRONT, BACK, HALF, EAVE = 2.6,-2.6,3.15,5.65
    front_ops=[(-2.2,-1.30,1.10,2.65),(1.3,2.2,1.10,2.65),(-2.2,-1.30,3.67,5.12),(1.3,2.2,3.67,5.12),(-.53,.53,.58,2.62)]
    wall('front',('X',FRONT),-HALF,HALF,.5,EAVE,front_ops)
    wall('rear',('X',BACK),-HALF,HALF,.5,EAVE,[(-2,-.9,1.2,2.65),(.9,2,1.2,2.65),(-2,-.9,3.72,5.12),(.9,2,3.72,5.12)])
    for sign in [-1,1]:
        ops=[(-1.85,-.85,1.10,2.65),(.60,1.60,1.10,2.65),(-1.85,-.85,3.67,5.12),(.60,1.60,3.67,5.12)]
        wall('side',('Y',sign*HALF),BACK,FRONT,.5,EAVE,ops)
        for z in [1.875,4.395]:
            for x in [-1.35,1.10]:window('window_side'+str(sign)+'_'+str(z)+'_'+str(x),('Y',sign*HALF),x,z,1,1.45)
    for z in [1.875,4.395]:
        for y in [-1.75,1.75]:window('window_front_'+str(z)+'_'+str(y),('X',FRONT),y,z,.90,1.45,shutters=True,flower=z>3)
        for y in [-1.45,1.45]:window('window_rear_'+str(z)+'_'+str(y),('X',BACK),y,z,1.10,1.4)
    for x in [BACK,FRONT]:
        for y in [-HALF,HALF]:box('corner_board',(x,y,3.08),(.16,.16,5.17))
    # Hipped roof: four planar faces with clipped rows of individual shingles.
    peak=7.10; eave=5.78; hx=2.98; hy=3.48; ridge=.72
    for sign in [-1,1]:
        h=lambda x,y:peak-(peak-eave)*abs(x)/hx
        polygon=[(0,-ridge),(0,ridge),(sign*hx,hy),(sign*hx,-hy)]
        tiled_plane('hip_front_back',polygon,h,mask=(lambda x,y: sign>0 and x>1.55 and abs(y)<.72))
        beam('eave_fascia',(sign*hx,-hy,eave-.035),(sign*hx,hy,eave-.035),.17,parent=roof)
        polygon=[(0,sign*ridge),(-hx,sign*hy),(hx,sign*hy)]
        h=lambda x,y:peak-(peak-eave)*(abs(y)-ridge)/(hy-ridge)
        tiled_plane('hip_end',polygon,h)
        beam('eave_fascia',(-hx,sign*hy,eave-.035),(hx,sign*hy,eave-.035),.17,parent=roof)
        for x in [-hx,hx]:beam('hip_cap',(0,sign*ridge,peak+.12),(x,sign*hy,eave+.12),.13,'roof',roof)
    beam('hip_ridge',(0,-ridge,peak+.13),(0,ridge,peak+.13),.18,'roof',roof)
    # Small centered dormer on the front slope.
    box('dormer_shell',(2.10,0,6.33),(1.45,1.32,1.10),'wall',roof)
    gable('dormer_gable',1.37,2.84,1.32,6.82,7.20,parent=roof)
    for y in [-.65,.65]:box('dormer_corner',(2.855,y,6.37),(.10,.12,1.10),'trim',roof)
    for z in [5.93,6.16,6.39,6.62]:box('dormer_clapboard',(2.847,0,z),(.05,1.22,.21),'wall',roof,.008)
    gabled_roof(1.22,2.99,.80,6.84,7.25,parent=roof)
    window('window_dormer',('X',2.875),0,6.35,.65,.69,parent=roof,dark=True)
    chimney(-1.30,2.0,6.30,7.108)
    door=entry(FRONT+.015,0,.58,'uiDark')
    # Portico leaves the upper windows and their flower boxes visible.
    box('porch_foundation',(3.30,0,.30),(1.47,1.99,.60),'brick',bevel=.025)
    for x,z,depth in [(4.43,.24,.67),(4.15,.38,.64),(3.88,.53,.65)]:
        box('brick_step',(x,0,(z+.19)/2),(depth,1.65,z-.19),'brick',bevel=.022)
        box('brick_tread',(x+.015,0,z+.022),(depth+.045,1.70,.045),'brick',bevel=.012)
        for y in [-.61,-.20,.20,.61]:box('step_mortar',(x+.35,y,(z+.19)/2),(.007,.014,max(.012,z-.21)),'sidewalk',bevel=.002)
    for x in [2.85,3.82]:
        for y in [-.96,.96]:
            box('column',(x,y,1.78),(.17,.17,2.43))
            for z in [.66,1.12,2.96]:box('column_collar',(x,y,z),(.27,.27,.12))
    for y in [-.96,.96]:railing(2.88,3.80,y,y,.64)
    gable('portico_gable',2.63,3.94,2.36,3.01,3.62,parent=roof)
    for z in [3.09,3.29,3.49]:
        w=2.36*(3.62-z)/.61
        box('portico_gable_siding',(3.955,0,z),(.044,max(.15,w-.05),.16),'wall',roof,.009)
    gabled_roof(2.48,4.06,1.29,3.03,3.70,parent=roof)
    lantern('lamp_left',(FRONT+.08,.84,2.18))
    lantern('lamp_right',(FRONT+.08,-.84,2.18))
    for y in [-2.30,2.30]:shrub((3.78,y,.95),.76,count=46,flower_count=12)
    for y in [-3.48,3.48]:
        shrub((.9,y,.68),.48,count=24,flower_count=8)
        pine(2.05,y,2.30)
    for y in [-2.35,2.35]:box('grass_bed',(3.87,y,.22),(2.0,2.10,.06),'grass',dressing,.025)
    floor_size=(5.0,6.06)
else:
    FRONT,BACK,HALF,EAVE=2.18,-3.18,2.94,3.15
    wall('front',('X',FRONT),-HALF,HALF,.5,EAVE,[(-1.54,-.56,.62,2.66),(.20,1.32,1.19,2.79)])
    wall('rear',('X',BACK),-HALF,HALF,.5,EAVE,[(-1.95,-.65,1.17,2.77),(.70,2.,1.17,2.77)])
    for sign in [-1,1]:
        wall('side',('Y',sign*HALF),BACK,FRONT,.5,EAVE,[(-1.75,-.3,1.17,2.77)])
        window('window_side_'+str(sign),('Y',sign*HALF),-1.025,1.97,1.45,1.60,flower=True)
    window('window_front',('X',FRONT),.76,1.99,1.12,1.60)
    for y in [-1.30,1.35]:window('window_rear_'+str(y),('X',BACK),y,1.97,1.30,1.60)
    for x in [BACK,FRONT]:
        for y in [-HALF,HALF]:box('corner_board',(x,y,1.84),(.16,.16,2.68))
    # Front gable extends all the way over the porch; back gable closes the shell.
    gable('front_gable',3.82,3.94,6.12,3.18,5.20,parent=roof)
    gable('rear_gable',BACK-.06,BACK+.06,6.12,3.18,5.20)
    for z in [3.31+i*.22 for i in range(8)]:
        w=6.12*(5.2-z)/2.02
        for x,parent in [(3.96,roof),(BACK-.08,body)]:box('gable_clapboard',(x,0,z),(.05,w,.20),'wall',parent,.008)
    gabled_roof(-3.44,4.10,3.23,3.22,5.35)
    window('window_attic',('X',3.991),0,4.22,.67,.62,parent=roof,dark=True)
    # Exposed decorative brackets sit under the front rake and beam.
    for y in [-2.63,-1.54,0,1.54,2.63]:
        z=5.20-2.02*abs(y)/3.06
        box('rake_bracket',(4.02,y,z-.10),(.26,.18,.24),'trim',roof,.018)
        beam('rake_brace',(3.86,y,z-.44),(4.04,y,z-.17),.14,parent=roof)
    box('porch_beam',(3.80,0,3.11),(.27,5.9,.25))
    box('porch_foundation',(3.03,0,.32),(1.80,5.86,.64),'sidewalk',bevel=.023)
    for j in range(17):box('porch_plank',(3.02,-2.75+j*.342,.666),(1.87,.327,.075),'woodWarm',bevel=.014)
    for x,z,depth in [(4.21,.31,.49),(3.99,.46,.50),(3.77,.60,.51)]:
        box('stone_step',(x,0,(z+.19)/2),(depth,2.21,z-.19),'sidewalk',bevel=.02)
        box('step_tread',(x+.035,0,z+.025),(depth+.085,2.26,.05),'sidewalk',bevel=.015)
    for y in [-2.75,2.75]:
        box('stone_pier_mortar',(3.80,y,.93),(.65,.65,.92),'asphalt')
        for row in range(4):
            for sign in [-1,1]:
                for i in range(2):
                    u=-.16+i*.32
                    box('pier_stone',(3.80+sign*.329,y+u,.62+row*.21),(.075,.29,.185),'sidewalk',bevel=.039)
                    box('pier_stone',(3.80+u,y+sign*.329,.62+row*.21),(.29,.075,.185),'silver',bevel=.039)
        box('pier_cap',(3.80,y,1.415),(.80,.80,.14))
        # Tapered chunky Craftsman columns.
        vs=[(x+3.8,yy+y,z) for z,r in [(1.47,.21),(3.04,.13)] for x,yy in [(-r,-r),(r,-r),(r,r),(-r,r)]]
        mesh('tapered_column',vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'trim')
        for z in [1.52,2.99]:box('column_collar',(3.8,y,z),(.51,.51,.13))
        railing(2.35,3.76,y,y,.73)
        beam('porch_brace',(3.56,y,2.89),(3.05,y,3.10),.13)
    railing(3.80,3.80,2.38,1.20,.72)
    box('entry_newel',(3.80,1.2,1.13),(.17,.17,.85))
    box('entry_newel_cap',(3.80,1.2,1.57),(.26,.26,.085))
    door=entry(FRONT+.02,-1.05,.66,'woodWarm')
    lantern('lamp_porch',(FRONT+.09,-.23,2.35))
    chimney(-1.70,-1.90,3.96,4.53)
    # Cozy porch bench with raised seat pads, red cushions and slatted back.
    bench=empty('porch_bench',parent=root);protected.add('porch_bench')
    for x in [2.50,3.13]:
        for y in [.35,1.82]:box('bench_leg',(x,y,.91),(.10,.10,.51),'woodWarm',bench,.017)
    box('bench_seat',(2.85,1.08,1.14),(.83,1.83,.13),'woodWarm',bench,.025)
    box('bench_back',(2.46,1.08,1.55),(.105,1.78,.90),'woodWarm',bench,.021)
    for y in [.37,1.79]:
        box('bench_arm',(2.82,y,1.53),(.86,.10,.10),'woodWarm',bench,.026)
        box('arm_post',(3.14,y,1.31),(.075,.075,.46),'woodWarm',bench,.013)
    for y in [.68,1.48]:
        box('seat_cushion',(2.84,y,1.25),(.74,.74,.15),'bandage',bench,.055)
        box('back_cushion',(2.56,y,1.61),(.21,.72,.69),'bandage',bench,.065,rot=(0,-.12,0))
        box('throw_pillow',(2.75,y,1.56),(.24,.52,.51),'cardiganRose',bench,.08,rot=(.1,-.10,0))
    planter=empty('hanging_planter',parent=dressing)
    cone('hanging_pot',(2.61,2.10,2.22),.14,.22,.28,'cardiganRose',planter)
    for j in range(3):
        t=j*math.tau/3
        beam('pot_chain',(2.61+.20*math.cos(t),2.10+.20*math.sin(t),2.36),(2.61,2.10,2.99),.015,'brass',planter)
    shrub((2.61,2.10,2.42),.23,planter,count=15,flower_count=2)
    for y in [-2.14,2.14]:shrub((3.93,y,.78),.61,count=36,flower_count=10)
    for y in [-3.45,3.45]:
        box('grass_bed',(.12,y,.22),(6.65,.68,.055),'grass',dressing,.02)
        pine(-2.45,y,1.9)
        for x in [-1.7,.8]:shrub((x,y,.58),.35,count=17,flower_count=5)
    floor_size=(5.13,5.63)

# Plausible small interior visible when roof is hidden; rear design is inferred.
box('interior_floor',((FRONT+BACK)/2,0,.47),(floor_size[0],floor_size[1],.065),'woodWarm',interior,.008)
for j in range(12):box('floor_joint',((FRONT+BACK)/2,-HALF+.2+j*(2*HALF-.4)/12,.507),(floor_size[0]-.02,.013,.004),'sidewalk',interior,.001)
if KIND=='d':
    box('upper_floor',((FRONT+BACK)/2,0,3.15),(floor_size[0],floor_size[1],.12),'woodWarm',interior,.008)
box('sofa_seat',(-1.65,-1.50,.82),(1.0,1.70,.50),'denim',interior,.07)
box('sofa_back',(-2.02,-1.50,1.14),(.24,1.73,.87),'denim',interior,.07)
for y in [-2.35,-.65]:box('sofa_arm',(-1.62,y,1.00),(1.03,.19,.67),'denim',interior,.055)
box('interior_table',(-.20,-1.45,.89),(.80,1.15,.11),'woodWarm',interior,.03)
for x in [-.45,.05]:
    for y in [-1.85,-1.05]:box('table_leg',(x,y,.67),(.07,.07,.42),'woodWarm',interior,.01)

# Optional single-bay garage is absent in the two matching base models.
if a.garage:
    garage=empty('garage',parent=root);protected.add('garage')
    gy=-HALF-1.50
    box('garage_shell',(-.55,gy,1.58),(4.10,2.8,2.77),'wall',garage,.035)
    box('garage_plinth',(-.55,gy,.22),(4.20,2.90,.44),'sidewalk',garage,.025)
    for z in [.64+i*.23 for i in range(10)]:box('garage_clapboard',(-.55,gy-1.43,z),(4.13,.05,.21),'wall',garage,.008)
    gable('garage_gable',-2.61,1.51,2.8,2.98,3.82,parent=garage,yc=gy)
    gabled_roof(-2.80,1.70,1.61,2.98,3.90,yc=gy,parent=garage)
    dg=empty('door_garage',(1.56,gy,2.77),garage);protected.add('door_garage')
    dg['hinge_axis']='Y';dg['open_angle']=90
    box('garage_door',(1.57,gy,1.60),(.13,2.48,2.36),'trim',dg,.025)
    for z in [.75,1.32,1.89,2.46]:
        for y in [gy-.75,gy,gy+.75]:box('garage_panel',(1.65,y,z),(.035,.68,.42),'sidewalk',dg,.014)
    c=empty('col:garage',(-.55,gy,1.58),root);c['collider']='cuboid';c['size']=[4.10,2.8,2.77]

# Fine garden accents on the perimeter, deterministic and removable as one group.
if not a.no_dressing:
    for i in range(32):
        x=rng.uniform(PAD_X0+.4,PAD_X1-.4);y=rng.choice([-1,1])*rng.uniform(3.45,3.65)
        ball('grass_tuft',(x,y,.26),(.10,.065,.12),'grass',dressing)
        if i%3==0:flower((x,y,.37),.038)
else:
    for obj in list(dressing.children_recursive):bpy.data.objects.remove(obj,do_unlink=True)

# Explicit distance recipes preserve structural openings, decks and roof forms.
if DISTANCE == 2:
    # Fuse the two short-end curb runs, preserving their exact footprint.
    for obj in list(dressing.children_recursive):
        if obj.type == 'MESH' and obj.name.startswith('curb') and obj.dimensions.x < .4:
            bpy.data.objects.remove(obj, do_unlink=True)
    for x in [PAD_X0+.16,PAD_X1-.16]:
        box('curb_run',(x,0,.20),(.32,7.7,.30),'sidewalk',dressing,0)
if DISTANCE:
    export_variant(HERE, DISTANCE,
        omit=('shingle', 'leaf_cluster', 'flower_', 'grass_tuft', 'floor_joint',
              'curtain_fold', 'shutter_louver', 'chimney_brick', 'pier_stone'),
        far_omit=('clapboard', 'window_mullion', 'window_sash', 'ridge_cap',
                  'hip_cap', 'pot_chain', 'rake_bracket', 'rake_brace',
                  'column_collar', 'door_panel', 'door_hinge', 'bench_leg',
                  'window_reveal', 'shutter_inset'), fold_palette=True)

# Record light regions before material joining; retain semantic anchors after joining.
light_records=[]
for group in [*windows,door,*[o for o in root.children if o.name.startswith('lamp_')]]:
    glowing=[o for o in group.children_recursive if o.type=='MESH' and o.data.materials[0]==M['glow']]
    if not glowing:continue
    bpy.context.view_layer.update()
    coords=[o.matrix_world@v.co for o in glowing for v in o.data.vertices]
    pos=sum(coords,Vector())/len(coords)
    owner=group
    while owner!=root and owner.name not in protected:owner=owner.parent
    light_records.append((group.name,pos,owner.name+'_'+M['glow'].name))

# Merge by material inside each visibility/articulation group, as the shared pipeline does.
shared_export.merge_by_material(root,protected)
asset=[root,*root.children_recursive]
meshes=[o for o in asset if o.type=='MESH']
for o in meshes:
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    bm.to_mesh(o.data);bm.free()
    if o.data.materials[0].name in ['pal_foliage','pal_foliageDark','pal_foliageLight','pal_cardiganRose','pal_schoolBusYellow','pal_picketWhite'] and o.parent.name in ['dressing','windows','hanging_planter']:
        for face in o.data.polygons:face.use_smooth=True

# Full default pad footprint centered; keep semantic hinge positions in metre units.
points_before_center=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
center=Vector(((min(v.x for v in points_before_center)+max(v.x for v in points_before_center))/2,
               (min(v.y for v in points_before_center)+max(v.y for v in points_before_center))/2,0))
for obj in root.children:obj.location-=center
bpy.context.view_layer.update()
if a.mirror:
    reflection=Matrix.Diagonal((1,-1,1,1))
    for obj in asset[1:]:
        if obj.type=='MESH':
            obj.data.transform(reflection)
            bm=bmesh.new();bm.from_mesh(obj.data)
            bmesh.ops.reverse_faces(bm,faces=bm.faces)
            bm.to_mesh(obj.data);bm.free()
        obj.location.y=-obj.location.y
    door['open_angle']=100
    bpy.context.view_layer.update()

col=empty('col:house',((FRONT+BACK)/2-center.x,-center.y,(EAVE+.5)/2),root)
col['collider']='cuboid';col['size']=[FRONT-BACK,2*HALF,EAVE-.5]
empty('entrySocket',(PAD_X1-center.x-.25,-center.y,.20),root)
front=empty('front',(PAD_X1-center.x+.01,-center.y,1.5),root)
front['forward']='+X'
# Light links resolve to actual merged emissive mesh names, preserving visibility groups.
for name,pos,node_name in light_records:
    pos-=center
    if a.mirror:pos.y=-pos.y
    anchor=empty('light:'+name,pos,root)
    anchor['ss_light']={'type':'point' if name.startswith('lamp_') else 'window',
        'color':'light_window_warm','intensity':1.6,'range':3,'pool':True,'beam':'none',
        'flare':name.startswith('lamp_'),'reflect':True,'shadow':'none',
        'heroPriority':1 if name.startswith('lamp_') else 0,'flicker':'none',
        'animation':None,'powerGroup':'residential','breakable':True,
        'emissiveNodes':[node_name],'tiers':'all'}

asset=[root,*root.children_recursive]

def stats():
    return sum(len(o.data.loop_triangles) for o in meshes)
for obj in meshes:obj.data.calc_loop_triangles()
triangles={'lod0':stats()}
points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
dimensions={'x':round(max(v.x for v in points)-min(v.x for v in points),4),
            'y':round(max(v.z for v in points)-min(v.z for v in points),4),
            'z':round(max(v.y for v in points)-min(v.y for v in points),4)}

def tone_ao(objects):
    # The stylized palette needs a gentle occlusion tint, including enclosed rooms.
    # Preserve the measured Cycles visibility while bounding its artistic strength.
    for obj in objects:
        for value in obj.data.color_attributes['ao'].data:
            visibility=max(0,min(1,value.color[0]))
            shade=.68+.32*visibility
            value.color=(shade,shade,shade,1)

if a.glb:
    ao.bake_all(meshes,samples=32)
    tone_ao(meshes)
    path=Path(a.glb).resolve()
    path.parent.mkdir(parents=True,exist_ok=True)
    shared_export.glb(root,path)
    from sslib.distance import build_native_lods
    # Native source reruns strip explicit detail and export solid low-sided forms.
    build_native_lods(__file__)
    root = bpy.data.objects['root']
    meshes = [o for o in root.children_recursive if o.type == 'MESH']
    import shutil
    for level in (1,2):
        source = HERE / ('model.lod'+str(level)+'.glb')
        target = path.with_name(path.stem+'.lod'+str(level)+'.glb')
        if source != target: shutil.copyfile(source,target)
    # Optimize in place using the project's canonical meshopt/quantization pipeline.
    # Keep named mesh nodes too: light anchors refer to their emissive names.
    definition=next(d for d in json.loads((REPO/'src/assets/manifest.json').read_text()) if d['id']==ASSET_ID).copy()
    definition['tier']='hero'
    definition['requiredNodes']=sorted({*definition['requiredNodes'],*[o.name for o in root.children_recursive],root.name})
    paths=[str(path),*[str(path.with_name(path.stem+'.lod'+str(level)+'.glb')) for level in [1,2]]]
    js="\n".join([
        "import { optimizeAsset } from './tools/assets/optimize.ts';",
        "import { assetIO } from './tools/assets/io.ts';",
        "import { triangleCount } from './tools/assets/delivery.ts';",
        "const def="+json.dumps(definition)+";const paths="+json.dumps(paths)+";",
        "for(const path of paths)await optimizeAsset(path,path,def);",
        "const io=await assetIO();const stats={};",
        "for(const [i,path] of paths.entries())stats['lod'+i]=triangleCount(await io.read(path));",
        "console.log('OPTIMIZED_COUNTS '+JSON.stringify(stats));"])
    completed=subprocess.run(['node','--import','tsx','--input-type=module','-e',js],cwd=str(REPO),check=True,capture_output=True,text=True)
    print(completed.stdout)
    triangles=json.loads(next(line.split(' ',1)[1] for line in completed.stdout.splitlines() if line.startswith('OPTIMIZED_COUNTS ')))
    report={'id':ASSET_ID,'tier':'hero','triangles':triangles,'draw_calls':len(meshes),
        'materials':sorted({o.data.materials[0].name for o in meshes}),
        'dimensions':dimensions,'nodes_ok':all(bpy.data.objects.get(n) for n in ['root','roof','interior','door_front','front']),
        'within_budget':triangles['lod0']<=100000 and len(meshes)<=40 and triangles['lod1']<=12000 and triangles['lod2']<=4000,
        'ao':'Cycles CPU, deterministic seed 17, 32 samples, COLOR_0',
        'matches_reference':False,'done':False,'webgl2_ok':False,'webgpu_ok':False,
        'gaps':['Back and small furnished interior are inferred from the single reference view.']}
    (HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    print('EXPORT OK',json.dumps(report))

# Optional articulation verification is applied after the default GLBs are written.
if a.door_angle:door.rotation_euler.z=math.radians(a.door_angle)
if a.render:
    scene.render.engine='BLENDER_EEVEE'
    scene.eevee.taa_render_samples=a.samples
    world=bpy.data.worlds.new('warm lavender studio');scene.world=world;world.use_nodes=True
    bg=world.node_tree.nodes['Background'];bg.inputs['Color'].default_value=(.15,.125,.20,1);bg.inputs['Strength'].default_value=.55
    for loc,power,size,col in [((8,4,12),1900,7,(1,.77,.52)),((2,-7,9),1200,7,(.66,.74,1)),((-5,4,10),1700,6,(1,.62,.36))]:
        light=bpy.data.lights.new('studio area','AREA');light.energy=power;light.shape='DISK';light.size=size;light.color=col
        obj=bpy.data.objects.new('studio area',light);scene.collection.objects.link(obj);obj.location=loc
        obj.rotation_euler=(Vector((0,0,2.4))-obj.location).to_track_quat('-Z','Y').to_euler()
    for anchor in [o for o in asset if o.name.startswith('light:lamp_')]:
        light=bpy.data.lights.new('porch spill','POINT');light.energy=18;light.color=(1,.54,.20);light.shadow_soft_size=.15
        obj=bpy.data.objects.new('porch spill',light);scene.collection.objects.link(obj);obj.location=anchor.location+Vector((.12,0,0))
    cam=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'));scene.collection.objects.link(cam);scene.camera=cam
    height=7.5 if KIND=='d' else 5.5
    target=Vector((.2,0,height*.41))
    views={'ref':(20,-6,8.9) if KIND=='d' else (18,-10,8.5),'game':(13,-13,17.3),'front':(20,0,6),'side':(0,20,8),'rear':(-15,-12,10)}
    cam.location=target+Vector(views[a.view])
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO'
    rotation=cam.rotation_euler.to_matrix().inverted()
    projected=[rotation@(v-target) for v in points]
    width=max(v.x for v in projected)-min(v.x for v in projected)
    height=max(v.y for v in projected)-min(v.y for v in projected)
    cam.data.ortho_scale=max(width,height*a.width/a.height)*1.15
    if a.view=='game':cam.data.ortho_scale*=1.15
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
    # Plain neutral dark-grey world; light emission stays on the model.
    scene.render.film_transparent=False
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.023,.0203,.0295,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8
    scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(Path(a.render).resolve())
    Path(a.render).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print('RENDER OK',a.render)
print('BUILD OK',ASSET_ID,triangles,dimensions)
