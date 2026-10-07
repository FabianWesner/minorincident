"""Sunset Grove ranch: +X entrance, Z up, metres. No external assets/textures.
Rebuild through experiment/tools/blender_run.py. Static parts merge per material
and visibility group; entrance hinge, roof, windows and porch lamp stay addressable.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.lod import simplify as simplify_lod

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--render')
parser.add_argument('--view', default='ref', choices=['ref', 'game', 'front', 'side', 'rear'])
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
parser.add_argument('--glb')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
asset = bpy.data.collections.new('House A')
scene.collection.children.link(asset)


def linear(hexcolor):
    c = [int(hexcolor[i:i+2], 16)/255 for i in (1, 3, 5)]
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in c)


def material(token, color, emission=0):
    m = bpy.data.materials.new(('emi_' if emission else 'pal_')+token)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*linear(color), 1)
    bsdf.inputs['Roughness'].default_value = .65 if not emission else .3
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*linear(color), 1)
        bsdf.inputs['Emission Strength'].default_value = emission
    m.diffuse_color = (*linear(color), 1)
    return m


M = {token: material(token, color) for token, color in {
    'sidewalk': '#b9a4a0', 'asphalt': '#5b4f5c', 'picketWhite': '#f2e6dc',
    'woodWarm': '#b0703f', 'brick': '#a8483a', 'uiDark': '#25222c',
    'foliage': '#7da23c', 'backpackTeal': '#2f6e6a'}.items()}
M['glow'] = material('windowGlow', '#ffc773', 1.1)
glass=M['glow'].node_tree.nodes['Principled BSDF']
glass.inputs['Emission Color'].default_value=(*linear('#ffb14c'),1)
glass.inputs['Alpha'].default_value=.82
M['glow'].surface_render_method='BLENDED'
M['glow'].use_backface_culling=True


def empty(name, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    asset.objects.link(o)
    o.location = (loc[0], -loc[1], loc[2])
    o.parent = parent
    o.empty_display_size = .15
    bpy.context.view_layer.update()
    return o


root = empty('root')
root['asset_id'] = 'bld.house-a'
root['category'] = 'building'
root['tier'] = 'Hero'
root['forward'] = '+X'
body = empty('body', parent=root)
roof = empty('roof', parent=root)
interior = empty('interior', parent=root)
door = empty('door_front', (2.085, -1.02, .48), root)
door['hinge_axis'] = 'Z'
door['open_angle'] = -100


def mesh(name, verts, faces, token, parent=body, bevel=.018, segments=2):
    me = bpy.data.meshes.new(name)
    # Mirror authoring Y so the porch sits on the reference camera's right.
    me.from_pydata([(x,-y,z) for x,y,z in verts], [], [tuple(reversed(f)) for f in faces])
    me.update()
    o = bpy.data.objects.new(name, me)
    asset.objects.link(o)
    o.data.materials.append(M[token])
    o.parent = parent
    o.matrix_parent_inverse = parent.matrix_world.inverted()
    if bevel:
        mod = o.modifiers.new('Soft edges', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'ANGLE'
        mod.harden_normals = True
        wn = o.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
        wn.keep_sharp = True
    return o


def box(name, c, size, token, parent=body, bevel=.018, rot=(0, 0, 0), segments=2):
    x, y, z = (v/2 for v in size)
    vs = [(-x,-y,-z),(-x,-y,z),(-x,y,-z),(-x,y,z),
          (x,-y,-z),(x,-y,z),(x,y,-z),(x,y,z)]
    o = mesh(name, vs, [(0,4,6,2),(1,3,7,5),(0,1,5,4),
                       (2,6,7,3),(0,2,3,1),(4,5,7,6)], token, parent,
             min(bevel, min(size)*.4), segments)
    o.location = (c[0], -c[1], c[2])
    o.rotation_euler = rot
    return o


def prism(name, xy, zfun, thickness, token, parent=roof, bevel=.012):
    if sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(xy,xy[1:]+xy[:1])) < 0:
        xy=list(reversed(xy))
    vs = [(x,y,zfun(x,y)+dz) for dz in (0, thickness) for x,y in xy]
    n = len(xy)
    faces = [tuple(reversed(range(n))), tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name, vs, faces, token, parent, bevel)


def beam(name, a, b, width, depth, token, parent=roof):
    d = Vector(b)-Vector(a)
    o = box(name, (Vector(a)+Vector(b))/2, (width,depth,d.length),token,parent,.02)
    d.y = -d.y
    o.rotation_euler = d.to_track_quat('Z','Y').to_euler()
    return o


def cylinder(name, c, radius, depth, token, parent=body, axis='Z', vertices=24):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=vertices, radius1=radius,
                          radius2=radius, depth=depth)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    asset.objects.link(o)
    o.location = (c[0], -c[1], c[2])
    o.rotation_euler = (0, math.pi/2, 0) if axis=='X' else (0,0,0)
    o.data.materials.append(M[token])
    o.parent = parent
    o.matrix_parent_inverse = parent.matrix_world.inverted()
    be = o.modifiers.new('Rim bevel','BEVEL'); be.width=.008; be.segments=2
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o


# Main shell and lap boards have true window/door openings, rather than decals.
# Wall-local u runs along facade; n is its outward normal.
FRONT = (2.0,0,0)
REAR = (-2.5,0,0)
RIGHT = (0,-3.2,0)
LEFT = (0,3.2,0)

def facade_point(origin, u, z, depth=0):
    if origin[0]:
        return (origin[0]+depth*(1 if origin[0]>0 else -1),u,z)
    return (u,origin[1]+depth*(1 if origin[1]>0 else -1),z)


def facade_box(name, origin, u, z, width, height, depth, offset, token, parent=body, bevel=.012):
    c = facade_point(origin,u,z,offset)
    size = (depth,width,height) if origin[0] else (width,depth,height)
    return box(name,c,size,token,parent,bevel)


def spans(start, end, openings, z0, z1):
    pieces=[(start,end)]
    for u0,u1,v0,v1 in openings:
        if z0 < v1 and z1 > v0:
            pieces=[q for a,b in pieces for q in ((a,min(b,u0)),(max(a,u1),b)) if q[1]-q[0]>.001]
    return pieces


wall_specs = [('front',FRONT,-3.2,3.2,[(.1,2.2,1.12,2.58),(-2.10,-1.02,.45,2.56)]),
              ('right',RIGHT,-2.5,2.,[(-.65,.72,1.12,2.58)]),
              ('left',LEFT,-2.5,2.,[(-.95,.5,1.12,2.58)]),
              ('rear',REAR,-3.2,3.2,[(-2.25,-.90,1.12,2.58),(.65,2.0,1.12,2.58)])]
for name, origin, start, end, openings in wall_specs:
    # Structural shell split at every opening edge.
    levels=sorted({.45,3.02,*[z for op in openings for z in op[2:]]})
    for a,b in zip(levels,levels[1:]):
        for lo,hi in spans(start,end,openings,a,b):
            facade_box('wall_'+name,origin,(lo+hi)/2,(a+b)/2,hi-lo,b-a,.15,-.075,'sidewalk')
    for row in range(14):
        z0=.48+row*.18; z1=z0+.175
        for lo,hi in spans(start,end,openings,z0,z1):
            pts=[facade_point(origin,u,z,(.085 if z==z0 else .035) if front else .004)
                 for front in (False,True)
                 for u,z in [(lo,z0),(hi,z0),(hi,z1),(lo,z1)]]
            # Normalized winding is reconstructed below for each facade normal.
            faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
            lap=mesh('lap_'+name,pts,faces,'sidewalk',body,.006)
            bm=bmesh.new();bm.from_mesh(lap.data)
            bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(lap.data);bm.free()
    # Chunky foundation with short non-coplanar expansion seams.
    for i in range(math.ceil((end-start)/.8)):
        lo=start+i*.8; hi=min(end,lo+.8)
        facade_box('foundation_'+name,origin,(lo+hi)/2,.235,hi-lo-.012,.47,.17,-.002,'sidewalk',bevel=.014)
    facade_box('base_trim_'+name,origin,(start+end)/2,.485,end-start,.07,.08,.05,'picketWhite')

for x in [-2.49,1.99]:
    for y in [-3.19,3.19]:
        box('corner_trim',(x+( .02 if x>0 else -.02),y+( .02 if y>0 else -.02),1.765),(.17,.17,2.59),'picketWhite',bevel=.012)

# Main gables run across X at both ends of the ridge (ridge along Y).
MAIN_RIDGE = 4.38
MAIN_EAVE = 3.12
MAIN_X0, MAIN_X1, RIDGE_X = -2.80, 2.30, -.25
SLOPE = (MAIN_RIDGE-MAIN_EAVE)/(MAIN_X1-RIDGE_X)
main_z = lambda x,y: MAIN_RIDGE-SLOPE*abs(x-RIDGE_X)
PORCH_Y=-1.58
PORCH_HALF=1.47
PORCH_RIDGE=3.89
PORCH_EAVE=2.97
porch_z=lambda x,y: PORCH_RIDGE-(PORCH_RIDGE-PORCH_EAVE)*abs(y-PORCH_Y)/PORCH_HALF
for side in [-1,1]:
    y=side*3.205
    # Closed pentagonal infill meets the roof underside, including raised corners.
    vs=[(-2.5,y,3.0),(2.0,y,3.0),(2.0,y,main_z(2,0)),
        (RIDGE_X,y,MAIN_RIDGE),(-2.5,y,main_z(-2.5,0))]
    face=(0,1,2,3,4) if side<0 else (4,3,2,1,0)
    o=mesh('gable',vs,[face],'sidewalk',body,0)
    sol=o.modifiers.new('Thickness','SOLIDIFY'); sol.thickness=.10
    for row in range(8):
        z0=3.0+row*.18; z1=min(MAIN_RIDGE,z0+.175)
        lower=(MAIN_RIDGE-z0)/SLOPE; upper=(MAIN_RIDGE-z1)/SLOPE
        lo0,hi0=max(-2.5,RIDGE_X-lower),min(2.0,RIDGE_X+lower)
        lo1,hi1=max(-2.5,RIDGE_X-upper),min(2.0,RIDGE_X+upper)
        pts=[(lo0,side*3.255,z0),(hi0,side*3.255,z0),
             (hi1,side*3.255,z1),(lo1,side*3.255,z1)]
        face=(0,1,2,3) if side<0 else (3,2,1,0)
        o=mesh('gable_lap',pts,[face],'sidewalk',body,.006)
        sol=o.modifiers.new('Thickness','SOLIDIFY');sol.thickness=.025

# Roof underlays, discrete staggered shingles, fascia and rounded ridge caps.
# The visible main shingles are clipped at the porch valley, avoiding overlap clutter.
def clip(poly, fn):
    out=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        fa,fb=fn(*a),fn(*b)
        if fa>=0: out.append(a)
        if (fa>=0)!=(fb>=0):
            t=fa/(fa-fb); out.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
    clean=[]
    for p in out:
        if not clean or math.dist(p,clean[-1])>1e-8: clean.append(p)
    if len(clean)>1 and math.dist(clean[0],clean[-1])<1e-8: clean.pop()
    return clean


for lo,hi in [(MAIN_X0,RIDGE_X),(RIDGE_X,MAIN_X1)]:
    prism('roof_deck',[(lo,-3.48),(hi,-3.48),(hi,3.48),(lo,3.48)],main_z,.075,'asphalt')
    front=lo==RIDGE_X
    for row in range(10):
        xa=lo+(hi-lo)*row/10; xb=lo+(hi-lo)*(row+1)/10
        for col in range(13):
            ya=-3.48+col*.58-(.29 if row%2 else 0); yb=min(3.48,ya+.566)
            ya=max(-3.48,ya)
            if yb-ya<.03: continue
            poly=[(xa+.006,ya),(xb-.006,ya),(xb-.006,yb),(xa+.006,yb)]
            parts=[poly]
            if front and xb>.77:
                # Partition at the porch ridge; in each half the valley is linear.
                parts=[]
                for sign in [-1,1]:
                    p=clip(poly,lambda x,y:sign*(y-PORCH_Y))
                    p=clip(p,lambda x,y: main_z(x,y)-porch_z(x,y)-.025) if p else []
                    if len(p)>=3: parts.append(p)
            for p in parts:
                prism('main_shingle',p,lambda x,y:main_z(x,y)+.083,.041,'asphalt',bevel=.012)
    x=lo if not front else hi
    box('eave_fascia',(x,0,MAIN_EAVE-.025),(.14,7.04,.21),'picketWhite',roof,.023)
    box('soffit',(x+(.10 if not front else -.10),0,MAIN_EAVE-.085),(.38,6.9,.09),'picketWhite',roof,.01)
for y in [-3.5,3.5]:
    for x in [MAIN_X0,MAIN_X1]:
        beam('gable_fascia',(x,y,MAIN_EAVE),(RIDGE_X,y,MAIN_RIDGE),.17,.16,'picketWhite')
for col in range(12):
    yc=-3.48+col*.58+.286
    for s in [-1,1]:
        prism('ridge_cap',[(RIDGE_X, yc-.277),(RIDGE_X+s*.15,yc-.277),
                          (RIDGE_X+s*.15,yc+.277),(RIDGE_X,yc+.277)],
              lambda x,y:main_z(x,y)+.14,.04,'asphalt',bevel=.015)

# Porch: raised plank deck, two broad stairs, four square columns and rails.
box('porch_foundation',(2.79,PORCH_Y,.235),(1.75,2.69,.47),'sidewalk',bevel=.025)
for i in range(10):
    box('deck_plank',(2.79,-2.89+i*.269,.493),(1.78,.256,.095),'woodWarm',bevel=.014)
for i,(cx,z,depth) in enumerate([(3.91,.13,.57),(3.67,.29,.54)]):
    box('step_riser',(cx,PORCH_Y,z/2),(depth,1.51,z),'woodWarm',bevel=.014)
    box('step_tread',(cx+.025,PORCH_Y,z+.035),(depth+.065,1.57,.07),'woodWarm',bevel=.02)
for x in [2.17,3.49]:
    for y in [-2.86,-.30]:
        box('column_plinth',(x,y,.61),(.31,.31,.23),'picketWhite',bevel=.02)
        box('porch_column',(x,y,1.77),(.205,.205,2.40),'picketWhite',bevel=.016)
        for z in [.77,1.48,2.86]:
            box('column_collar',(x,y,z),(.285,.285,.11),'picketWhite',bevel=.013)
# Side railings plus short front rails leave a generous entry gap.
for y in [-2.86,-.30]:
    for z,h in [(.75,.10),(1.40,.12)]:
        box('side_rail',(2.82,y,z),(1.34,.105,h),'picketWhite',bevel=.015)
    for k in range(5):
        box('side_baluster',(2.3+k*.245,y,1.055),(.062,.065,.65),'picketWhite',bevel=.008)
for ya,yb in [(-2.86,-2.40),(-.76,-.30)]:
    for z in [.74,1.40]:
        box('front_rail',(3.49,(ya+yb)/2,z),(.115,yb-ya,.11),'picketWhite',bevel=.015)
    for y in [ya+.12,ya+.32]:
        box('front_baluster',(3.49,y,1.06),(.065,.065,.65),'picketWhite',bevel=.008)
    y=yb if ya<-2 else ya
    box('entry_newel',(3.49,y,1.025),(.20,.20,1.07),'picketWhite',bevel=.018)
    for z in [.58,1.54]:
        box('newel_cap',(3.49,y,z),(.26,.26,.09),'picketWhite',bevel=.016)

# Porch gable shell + short clipped lap courses.
gable=mesh('porch_gable_shell',[(3.53,PORCH_Y-PORCH_HALF,2.92),
       (3.53,PORCH_Y+PORCH_HALF,2.92),(3.53,PORCH_Y,PORCH_RIDGE)],
       [(0,1,2)],'sidewalk',roof,0)
solid=gable.modifiers.new('Thickness','SOLIDIFY');solid.thickness=.08
for i in range(5):
    z=3.005+i*.18
    half=(PORCH_RIDGE-.08-z)*PORCH_HALF/(PORCH_RIDGE-PORCH_EAVE)
    if half>.03:
        box('porch_gable_lap',(3.56,PORCH_Y,z),(.13,2*half,.17),'sidewalk',roof,.009)
box('porch_header',(3.54,PORCH_Y,2.94),(.24,2.86,.18),'picketWhite',roof,.02)
for side in [-1,1]:
    ya,yb=sorted([PORCH_Y,PORCH_Y+side*PORCH_HALF])
    prism('porch_roof_deck',[(.78,ya),(3.73,ya),(3.73,yb),(.78,yb)],porch_z,.072,'asphalt')
    for row in range(6):
        aa=ya+(yb-ya)*row/6; bb=ya+(yb-ya)*(row+1)/6
        for col in range(6):
            xa=.78+col*.54-(.27 if row%2 else 0); xb=min(3.73,xa+.526); xa=max(.78,xa)
            if xb-xa>.02:
                p=[(xa,aa+.006),(xb,aa+.006),(xb,bb-.006),(xa,bb-.006)]
                p=clip(p,lambda x,y:porch_z(x,y)-main_z(x,y)+.025)
                if len(p)>=3: prism('porch_shingle',p,lambda x,y:porch_z(x,y)+.083,.043,'asphalt',bevel=.012)
    y=PORCH_Y+side*PORCH_HALF
    box('porch_eave_fascia',(2.25,y,PORCH_EAVE), (3.06,.14,.20),'picketWhite',roof,.024)
    beam('porch_rake',(3.755,y,PORCH_EAVE),(3.755,PORCH_Y,PORCH_RIDGE),.18,.19,'picketWhite')
for col in range(6):
    xa=.79+col*.49; xb=xa+.475
    for side in [-1,1]:
        p=[(xa,PORCH_Y),(xb,PORCH_Y),(xb,PORCH_Y+side*.13),(xa,PORCH_Y+side*.13)]
        p=clip(p,lambda x,y:porch_z(x,y)-main_z(x,y)+.025)
        if len(p)>=3: prism('porch_ridge',p,lambda x,y:porch_z(x,y)+.14,.04,'asphalt',bevel=.012)

# Addressable warm-glazed windows with deep rebates, wide casings, sill caps,
# divided lights, and curtain folds proud of the pane. No flat overlays.
windows=[]
def window(name, origin, u, width):
    g=empty(name,parent=root)
    windows.append(g)
    z=1.85; h=1.46
    facade_box('window_reveal',origin,u,z,width+.11,h+.11,.11,-.006,'woodWarm',g)
    facade_box('window_glass',origin,u,z,width-.085,h-.08,.035,.065,'glow',g,.009)
    for v in [u-width/2-.035,u+width/2+.035]:
        facade_box('window_casing',origin,v,z,.135,h+.25,.12,.105,'picketWhite',g)
    for zz in [z-h/2-.10,z+h/2+.10]:
        facade_box('window_casing',origin,u,zz,width+.30,.16,.14,.115,'picketWhite',g)
    facade_box('projecting_sill',origin,u,z-h/2-.085,width+.35,.095,.26,.175,'picketWhite',g,.016)
    for v in [u-width/2+.015,u+width/2-.015,u]:
        facade_box('sash',origin,v,z,.052,h,.048,.102,'picketWhite',g,.006)
    facade_box('meeting_rail',origin,u,z+.04,width,.05,.055,.104,'picketWhite',g,.006)
    if width>1.7:
        for v in [u-width/4,u+width/4]:
            facade_box('muntin',origin,v,z,.036,h,.041,.100,'picketWhite',g,.005)
    for side in [-1,1]:
        for fold in range(3):
            v=u+side*(width/2-.09-fold*.042)
            facade_box('curtain_fold',origin,v,z,.045,h-.10,.025,.091,'woodWarm',g,.008)
    return g
window('window_front',FRONT,1.15,2.10)
window('window_right',RIGHT,.035,1.37)
window('window_left',LEFT,-.225,1.45)
window('window_rearL',REAR,-1.575,1.35)
window('window_rearR',REAR,1.325,1.35)

# Entry door pivot is at its left hinge, not at the leaf centre.
box('door_leaf',(2.03,-1.56,1.52),(.085,1.06,2.08),'brick',door,.021)
for y in [-2.18,-.94]:
    box('door_jamb',(2.08,y,1.53),(.16,.13,2.24),'picketWhite',bevel=.014)
box('door_lintel',(2.08,-1.56,2.66),(.16,1.38,.16),'picketWhite',bevel=.017)
box('threshold',(2.135,-1.56,.50),(.24,1.18,.055),'woodWarm',bevel=.011)
for y in [-1.79,-1.33]:
    for z in [1.77,2.17]:
        box('door_lite_rebate',(2.082,y,z),(.022,.34,.34),'woodWarm',door,.008)
        box('door_lite',(2.100,y,z),(.012,.27,.275),'glow',door,.005)
    box('raised_lower_panel',(2.086,y,1.02),(.025,.32,.59),'brick',door,.016)
    for zz in [.72,1.32]:
        box('panel_moulding',(2.104,y,zz),(.018,.33,.025),'woodWarm',door,.006)
for z in [.82,1.50,2.24]:
    cylinder('door_hinge',(2.10,-1.04,z),.026,.11,'uiDark',door)
cylinder('knob_rose',(2.107,-1.96,1.43),.052,.019,'uiDark',door,'X')
cylinder('door_knob',(2.145,-1.96,1.43),.041,.064,'woodWarm',door,'X')

# Reference wall lantern: chunky bronze cap, warm core and four cage uprights.
lamp=empty('lamp_porch',(2.11,-2.39,2.30),root)
box('lamp_backplate',(2.112,-2.39,2.12),(.055,.18,.30),'uiDark',lamp,.025)
box('lamp_arm',(2.25,-2.39,2.28),(.27,.055,.055),'uiDark',lamp,.013)
box('lantern_glow',(2.30,-2.39,2.08),(.18,.20,.30),'glow',lamp,.025)
for z in [1.905,2.255]:
    box('lantern_frame',(2.30,-2.39,z),(.26,.28,.055),'uiDark',lamp,.018)
for x in [2.20,2.40]:
    for y in [-2.51,-2.27]:
        box('lantern_corner',(x,y,2.08),(.032,.032,.32),'uiDark',lamp,.007)
vs=[(2.14,-2.55,2.27),(2.46,-2.55,2.27),(2.46,-2.23,2.27),(2.14,-2.23,2.27),(2.30,-2.39,2.39)]
mesh('lantern_hood',vs,[(0,3,2,1),(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'uiDark',lamp,.012)
cylinder('lantern_finial',(2.30,-2.39,2.415),.026,.065,'uiDark',lamp)

# A few true interior silhouettes sit behind the shallow, warm window panes.
cylinder('window_plant_pot',(1.72,1.89,1.27),.135,.22,'woodWarm',interior)
cylinder('plant_stem',(1.72,1.89,1.50),.017,.37,'foliage',interior,vertices=12)
for dx,dy,dz in [(-.08,0,.02),(.10,0,.10),(0,-.07,.19),(0,.075,.30)]:
    leaf=box('plant_leaf',(1.72+dx,1.89+dy,1.43+dz),(.13,.075,.18),'foliage',interior,.037,segments=3)
    leaf.rotation_euler=(0,dx*4,dy*4)
box('window_console',(1.66,.69,1.26),(.40,.64,.12),'woodWarm',interior,.026)
for y in [.45,.93]: box('console_leg',(1.64,y,.90),(.065,.065,.62),'woodWarm',interior,.012)
cylinder('indoor_lamp_base',(1.66,.69,1.36),.095,.05,'woodWarm',interior)
cylinder('indoor_lamp_stem',(1.66,.69,1.49),.021,.25,'woodWarm',interior)
# Simple tapered shade; avoid adding another emissive material or light anchor.
verts=[]
for z,r in [(1.55,.15),(1.75,.09)]:
    verts.extend((1.66+r*math.cos(k*math.tau/16),.69+r*math.sin(k*math.tau/16),z) for k in range(16))
faces=[tuple(reversed(range(16))),tuple(range(16,32))]+[(k,(k+1)%16,(k+1)%16+16,k+16) for k in range(16)]
mesh('indoor_lamp_shade',verts,faces,'picketWhite',interior,.008)

# Small complete interior supports a roof-hide view and the opening front door.
box('interior_floor',(-.26,0,.426),(4.23,6.13,.075),'woodWarm',interior,.015)
for i in range(15):
    box('floor_joint',(-.26,-2.89+i*.407,.470),(4.2,.012,.007),'sidewalk',interior,.002)
box('sofa_base',(-1.32,1.83,.72),(.94,1.70,.40),'backpackTeal',interior,.08)
box('sofa_back',(-1.64,1.83,1.04),(.25,1.78,.83),'backpackTeal',interior,.07)
for y in [1.00,2.66]: box('sofa_arm',(-1.32,y,.94),(.95,.19,.60),'backpackTeal',interior,.06)
for y in [1.40,2.20]: box('sofa_cushion',(-1.16,y,.96),(.62,.74,.16),'backpackTeal',interior,.05)
box('table_top',(.15,1.8,.79),(.73,1.14,.11),'woodWarm',interior,.035)
for x in [-.12,.41]:
    for y in [1.35,2.25]: box('table_leg',(x,y,.61),(.065,.065,.32),'woodWarm',interior,.012)
box('kitchen_cabinet',(-1.99,-1.26,.95),(.56,2.85,.91),'picketWhite',interior,.025)
box('counter',(-1.98,-1.26,1.43),(.66,2.96,.10),'sidewalk',interior,.02)
for y in [-2.18,-1.27,-.36]:
    box('cabinet_panel',(-1.68,y,.95),(.025,.82,.75),'picketWhite',interior,.019)
    box('cabinet_handle',(-1.652,y,1.20),(.025,.18,.023),'uiDark',interior,.006)

# Merge static geometry by parent and material after evaluating all bevels.
def merge_parts():
    buckets={}
    bpy.context.view_layer.update()
    deps=bpy.context.evaluated_depsgraph_get()
    evaluated=[(o,bpy.data.meshes.new_from_object(o.evaluated_get(deps),
               preserve_all_data_layers=True,depsgraph=deps))
               for o in list(asset.objects) if o.type=='MESH']
    for o,data in evaluated:
        old=o.data; o.modifiers.clear(); o.data=data
        bpy.data.meshes.remove(old)
        buckets.setdefault((o.parent,o.data.materials[0]),[]).append(o)
    for (parent,mat),objs in buckets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs: o.select_set(True)
        bpy.context.view_layer.objects.active=objs[0]
        bpy.ops.object.join()
        o=objs[0]
        o.name=parent.name+'_'+mat.name
        # Apply transform with vertices preserved in world space; hinge stays on parent.
        bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
        o.select_set(False)
merge_parts()

# Deterministic geometry AO, stored as a glTF COLOR_0/ao vertex attribute.
# Hemisphere visibility samples avoid an image atlas and keep palette materials simple.
def bake_ao(samples=32):
    meshes=[o for o in asset.objects if o.type=='MESH']
    verts=[]; faces=[]
    for o in meshes:
        offset=len(verts); verts.extend(o.matrix_world@v.co for v in o.data.vertices)
        faces.extend(tuple(offset+i for i in p.vertices) for p in o.data.polygons)
    tree=BVHTree.FromPolygons(verts,faces,all_triangles=False)
    dirs=[]
    for i in range(samples):
        z=(i+.5)/samples; a=i*2.399963229728653
        r=math.sqrt(1-z*z); dirs.append(Vector((r*math.cos(a),r*math.sin(a),z)))
    for o in meshes:
        attr=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='POINT')
        normalmat=o.matrix_world.to_3x3().inverted().transposed()
        for v in o.data.vertices:
            n=(normalmat@v.normal).normalized()
            q=Vector((0,0,1)).rotation_difference(n)
            start=o.matrix_world@v.co+n*.006
            occ=0
            for d in dirs:
                hit=tree.ray_cast(start,q@d,.65)
                if hit[0] is not None: occ+=1-hit[3]/.65
            value=max(.50,1-.52*occ/samples)
            attr.data[v.index].color=(value,value,value,1)
        o.data.color_attributes.active_color=attr
bpy.context.view_layer.update()
bake_ao()

# All emissive meshes are explicitly linked to a semantic light anchor.
for g in [*windows,door,lamp]:
    glow=[o.name for o in asset.objects if o.type=='MESH' and o.parent==g and o.data.materials[0]==M['glow']]
    if not glow: continue
    loc=(2.30,-2.39,2.08) if g==lamp else tuple(next(o for o in asset.objects if o.name==glow[0]).matrix_world.translation)
    if g!=lamp: loc=(loc[0],-loc[1],loc[2])
    anchor=empty('light:'+g.name,loc,root)
    anchor['ss_light']={'type':'point' if g==lamp else 'window','color':'light_window_warm',
       'intensity':1.8,'range':3,'pool':True,'beam':'none','flare':g==lamp,'reflect':True,
       'shadow':'none','heroPriority':1 if g==lamp else 0,'flicker':'none','animation':None,
       'powerGroup':'residential','breakable':True,'emissiveNodes':glow,'tiers':'all'}
col=empty('col:house',(-.25,0,1.72),root)
col['collider']='cuboid'; col['size']=[4.5,6.4,3.44]
col=empty('col:porch',(2.8,PORCH_Y,.235),root)
col['collider']='cuboid'; col['size']=[1.8,2.7,.47]
empty('entrySocket',(3.85,PORCH_Y,.48),root)

# Center the complete footprint, while leaving the scene root at the origin.
bpy.context.view_layer.update()
points=[o.matrix_world@v.co for o in asset.objects if o.type=='MESH' for v in o.data.vertices]
center=Vector(((min(v.x for v in points)+max(v.x for v in points))/2,
               (min(v.y for v in points)+max(v.y for v in points))/2,0))
for o in list(root.children): o.location-=center
bpy.context.view_layer.update()


def stats():
    meshes=[o for o in asset.objects if o.type=='MESH']
    tris=0
    for o in meshes:
        o.data.calc_loop_triangles(); tris+=len(o.data.loop_triangles)
    return tris,len(meshes),sorted({m.name for o in meshes for m in o.data.materials})


tri,draw,mats=stats()
report={'id':'bld.house-a','tier':'Hero','triangles':tri,'draw_calls':draw,'materials':mats,
        'nodes_ok':all(bpy.data.objects.get(n) for n in ['root','roof','interior','door_front','lamp_porch','window_front']),
        'within_budget':tri<=100000 and draw<=40,'rounds':4,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'geometry-stats.json').write_text(json.dumps(report,indent=2)+'\n')
print('BUILD OK',json.dumps(report))


def export(path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset.objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(path).resolve()),export_format='GLB',
       use_selection=True,export_apply=True,export_yup=True,export_extras=True,
       export_lights=False,export_cameras=False,export_materials='EXPORT')
    print('GLB OK',path)


if args.glb:
    export(args.glb)
    # Same addressable groups and hinges at all densities. LODs ship alongside LOD0.
    for level,ratio in [(1,.55),(2,.25)]:
        copies=[]
        for o in [o for o in asset.objects if o.type=='MESH']:
            copies.append((o,o.data))
            o.data=o.data.copy()
            simplify_lod(o, ratio)
        export(Path(args.glb).with_name(f'model.lod{level}.glb'))
        for o,data in copies:
            reduced=o.data; o.data=data; bpy.data.meshes.remove(reduced)


def studio():
    world=bpy.data.worlds.new('warm studio'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(*linear('#6b6078'),1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
    # Camera rays see the neutral dark reference backdrop; lighting stays lavender.
    nt=world.node_tree; bg=nt.nodes['Background']; output=nt.nodes['World Output']
    flat=nt.nodes.new('ShaderNodeBackground'); flat.inputs['Color'].default_value=(*linear('#2a2730'),1)
    flat.inputs['Strength'].default_value=1
    lp=nt.nodes.new('ShaderNodeLightPath'); mix=nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Camera Ray'],mix.inputs[0]);nt.links.new(bg.outputs[0],mix.inputs[1]);nt.links.new(flat.outputs[0],mix.inputs[2]);nt.links.new(mix.outputs[0],output.inputs['Surface'])
    def light(name,loc,power,color,size=5,kind='AREA'):
        ld=bpy.data.lights.new(name,kind);ld.energy=power;ld.color=color
        if kind=='AREA': ld.shape='DISK';ld.size=size
        else: ld.shadow_soft_size=size
        o=bpy.data.objects.new(name,ld);scene.collection.objects.link(o);o.location=Vector(loc)-center
        o.rotation_euler=(Vector((0,0,1.6))-Vector(loc)).to_track_quat('-Z','Y').to_euler()
    light('Golden key',(2,7,8),1300,(1,.73,.48),6)
    light('Lavender fill',(6,-5,7),900,(.67,.72,1),7)
    light('Rim',(-5,-2,8),1400,(1,.58,.35),5)
    light('Porch lantern',(2.52,2.39,2.08),13,(1,.49,.13),.16,'POINT')
    for x,y in [(2.2,-1.15),(.035,3.4)]: light('Window spill',(x,y,1.85),25,(1,.55,.17),.5,'POINT')
    cam=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'));scene.collection.objects.link(cam);scene.camera=cam
    target=Vector((0,0,1.25 if args.view=='game' else 1.50))
    views={'ref':(22,8,12),'game':(13,-13,13.35),'front':(18,0,6),'side':(0,-18,7),'rear':(-14,12,10)}
    cam.location=Vector(views[args.view])+target
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO';cam.data.ortho_scale=15.3 if args.view!='game' else 17.0
    scene.render.engine='CYCLES'
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='METAL';prefs.get_devices()
    for d in prefs.devices:d.use=True
    scene.cycles.device='GPU';scene.cycles.samples=args.samples;scene.cycles.use_denoising=True
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.resolution_x=args.width;scene.render.resolution_y=args.height
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(Path(args.render).resolve())
    bpy.ops.render.render(write_still=True)
    print('RENDER OK',args.render)

if args.render: studio()
