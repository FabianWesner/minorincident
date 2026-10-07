"""Retro gas pump measured from reference (1024x1536).
Image: base z=1440, cabinet shoulder=350, globe top=34. At 2.65m total,
base 0-.20m, cabinet .20-2.05m, globe centre 2.40m radius .28m.
Face width ~330px, side apparent width ~150px; real width .70m depth .48m.
Front +X, visible side -Y. Entire asset generated as mesh geometry.
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default=None):
    return ARGS[ARGS.index(name) + 1] if name in ARGS else default


PI = math.pi
W = 1.25                      # half width of the body skin
REAR_AXLE, FRONT_AXLE = -1.75, 2.89
WHEEL_R, ARCH_R = 0.5, 0.66
FONT = '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf'


def px(x_img):
    return -4.25 + (x_img - 105) / 1425 * 8.3


# --------------------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
TRUCK = bpy.data.collections.new('FireEngine')
STAGE = bpy.data.collections.new('Stage')
scene.collection.children.link(TRUCK)
scene.collection.children.link(STAGE)

# --------------------------------------------------------------------------- materials
def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1.0]


def material(name, color, rough=0.5, metal=0.0, coat=0.0, coat_rough=0.03, emit=None, strength=0.0, aniso=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Coat Roughness'].default_value = coat_rough
    if aniso:
        b.inputs['Anisotropic'].default_value = aniso
    if emit:
        b.inputs['Emission Color'].default_value = srgb(emit)
        b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    m.diffuse_color = srgb(color)
    return m


M = {
    'red': material('paint_red', '#c3160e', 0.28, coat=1.0, coat_rough=0.04),
    'red_dark': material('paint_red_dark', '#6a0d08', 0.45),
    'chrome': material('chrome', '#f1f3f6', 0.07, 1.0),
    'alu': material('aluminium', '#c9cdd4', 0.3, 0.55),
    'alu_dark': material('aluminium_dark', '#9aa0a8', 0.38, 0.55),
    'tread': material('tread_plate', '#b3b8bf', 0.36, 0.6),
    'rim': material('rim_silver', '#cfd3d9', 0.18, 1.0),
    'rubber': material('tyre_rubber', '#141416', 0.82),
    'black': material('black_plastic', '#1c1c20', 0.42, coat=0.3),
    'glass': material('glass_tint', '#0b1016', 0.02, 0.0, coat=1.0, coat_rough=0.0),
    'white': material('paint_white', '#f5f4ef', 0.32, coat=0.8),
    'flame': material('flame_orange', '#f7a21b', 0.3, coat=0.8),
    'amber': material('lamp_amber', '#ff9a1a', 0.15, emit='#ff8a00', strength=2.2),
    'lamp': material('lamp_red', '#e0140a', 0.15, emit='#ff1200', strength=2.5),
    'blue': material('lamp_blue', '#2d4bff', 0.15, emit='#1f3dff', strength=4.0),
    'head': material('lamp_head', '#fff4d8', 0.08, emit='#ffe9b8', strength=3.0),
    'glow': material('lamp_strip', '#ffcc40', 0.2, emit='#ffb81a', strength=2.5),
    'gauge': material('gauge_face', '#f4f1e8', 0.4),
}

# --------------------------------------------------------------------------- object helpers
GROUPS = {}


def group(name, location=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.3
    e.location = location
    TRUCK.objects.link(e)
    if parent:
        e.parent = GROUPS[parent]
        e.matrix_parent_inverse = GROUPS[parent].matrix_world.inverted()
    bpy.context.view_layer.update()
    GROUPS[name] = e
    return e


def finish(obj, mat, parent, bevel=0.0, segs=3, smooth=True, harden=True, angle=40):
    TRUCK.objects.link(obj)
    if isinstance(mat, str):
        mat = M[mat]
    if mat is not None and obj.type == 'MESH' and not obj.data.materials:
        obj.data.materials.append(mat)
    if obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = smooth
    if bevel > 0:
        b = obj.modifiers.new('bevel', 'BEVEL')
        b.width = bevel
        b.segments = segs
        b.limit_method = 'ANGLE'
        b.angle_limit = math.radians(angle)
        b.harden_normals = harden
        b.miter_outer = 'MITER_ARC'
    if smooth and obj.type == 'MESH':
        wn = obj.modifiers.new('weighted', 'WEIGHTED_NORMAL')
        wn.keep_sharp = True
    if parent:
        bpy.context.view_layer.update()
        obj.parent = GROUPS[parent]
        obj.matrix_parent_inverse = GROUPS[parent].matrix_world.inverted()
    return obj


def from_bm(name, bm):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    return bpy.data.objects.new(name, me)


def box(name, center, size, mat, parent=None, bevel=0.02, segs=3, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    o = from_bm(name, bm)
    o.location = center
    o.rotation_euler = rot
    return finish(o, mat, parent, bevel=min(bevel, min(size) * 0.45), segs=segs)


def prism(name, pts_xz, y0, y1, mat, parent=None, bevel=0.03, segs=3):
    """2D side silhouette (x, z) extruded across y0..y1."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y0, z)) for x, z in pts_xz]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    moved = [v for v in ext['geom'] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, y1 - y0, 0), verts=moved)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = from_bm(name, bm)
    return finish(o, mat, parent, bevel=bevel, segs=segs)


def plate(name, pts_xz, side, depth, mat, parent=None, y_skin=W, bevel=0.006, segs=2, lift=0.0):
    """Flat shape lying on a side skin. side=-1 near (-Y), +1 far (+Y). pts in world (x, z)."""
    y0 = side * (y_skin + lift)
    y1 = side * (y_skin + lift + depth)
    return prism(name, pts_xz, min(y0, y1), max(y0, y1), mat, parent, bevel, segs)


def ring(name, outer, inner, side, depth, mat, parent=None, y_skin=W, bevel=0.005, lift=0.0):
    """Frame between two loops with equal vertex count, on a side skin."""
    bm = bmesh.new()
    y0 = side * (y_skin + lift)
    y1 = side * (y_skin + lift + depth)
    n = len(outer)
    layers = []
    for y in (y0, y1):
        o = [bm.verts.new((x, y, z)) for x, z in outer]
        i = [bm.verts.new((x, y, z)) for x, z in inner]
        layers.append((o, i))
    for (o, i) in layers:
        for k in range(n):
            bm.faces.new((o[k], o[(k + 1) % n], i[(k + 1) % n], i[k]))
    (o0, i0), (o1, i1) = layers
    for k in range(n):
        bm.faces.new((o0[k], o1[k], o1[(k + 1) % n], o0[(k + 1) % n]))
        bm.faces.new((i0[k], i0[(k + 1) % n], i1[(k + 1) % n], i1[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(from_bm(name, bm), mat, parent, bevel=bevel, segs=2)


def lathe(name, profile, center, axis, mat, parent=None, segs=48, smooth=True):
    """Surface of revolution: profile [(radius, along_axis)], revolved about `axis` ('x','y','z' with sign)."""
    bm = bmesh.new()
    rings = []
    for r, a in profile:
        loop = []
        for k in range(segs):
            t = 2 * PI * k / segs
            loop.append(bm.verts.new((r * math.cos(t), r * math.sin(t), a)))
        rings.append(loop)
    for j in range(len(rings) - 1):
        for k in range(segs):
            a0, a1 = rings[j][k], rings[j][(k + 1) % segs]
            b0, b1 = rings[j + 1][k], rings[j + 1][(k + 1) % segs]
            try:
                bm.faces.new((a0, a1, b1, b0))
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    sign = -1 if axis.startswith('-') else 1
    ax = axis[-1]
    rot = {'z': Matrix.Identity(4), 'y': Matrix.Rotation(-PI / 2, 4, 'X'), 'x': Matrix.Rotation(PI / 2, 4, 'Y')}[ax]
    if sign < 0:
        rot = rot @ Matrix.Rotation(PI, 4, 'X')
    bmesh.ops.transform(bm, matrix=rot, verts=bm.verts)
    o = from_bm(name, bm)
    o.location = center
    return finish(o, mat, parent, smooth=smooth, harden=False)


def cylinder(name, center, r, depth, axis, mat, parent=None, segs=40, bevel=0.0):
    prof = [(1e-4, -depth / 2), (r, -depth / 2), (r, depth / 2), (1e-4, depth / 2)]
    o = lathe(name, prof, center, axis, mat, parent, segs)
    if bevel:
        b = o.modifiers.new('bevel', 'BEVEL')
        b.width = bevel
        b.segments = 2
        b.limit_method = 'ANGLE'
        o.modifiers.move(len(o.modifiers) - 1, 0)
    return o


def text(name, body, size, center, facing, mat, parent=None, depth=0.008, font=FONT, spacing=1.0, stretch=1.0):
    """facing: '-y' near side, '+y' far side, '+x' front face, '-x' rear face."""
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.font = bpy.data.fonts.load(font, check_existing=True)
    cu.size = size
    cu.extrude = depth / 2
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.space_character = spacing
    cu.resolution_u = 6
    o = bpy.data.objects.new(name, cu)
    o.location = center
    o.scale = (stretch, 1, 1)
    o.rotation_euler = {'-y': (PI / 2, 0, 0), '+y': (PI / 2, 0, PI), '+x': (PI / 2, 0, PI / 2), '-x': (PI / 2, 0, -PI / 2)}[facing]
    TRUCK.objects.link(o)
    o.data.materials.append(M[mat] if isinstance(mat, str) else mat)
    bpy.context.view_layer.objects.active = o
    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.view_layer.objects.active
    TRUCK.objects.unlink(o)
    if parent:
        o.parent = None
    return finish(o, None, parent, smooth=False)


def cut(target, cutter_obj, mat=None):
    """Exact boolean difference, applied immediately; the cutter's material lines the cut."""
    if mat is not None:
        cutter_obj.data.materials.clear()
        cutter_obj.data.materials.append(M[mat])
        if M[mat].name not in [m.name for m in target.data.materials]:
            target.data.materials.append(M[mat])
    mod = target.modifiers.new('cut', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter_obj
    mod.material_mode = 'TRANSFER'
    target.modifiers.move(len(target.modifiers) - 1, 0)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter_obj)


def raw_cyl(name, center, r, depth, axis='y', segs=64):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=depth)
    rot = {'y': Matrix.Rotation(PI / 2, 4, 'X'), 'x': Matrix.Rotation(PI / 2, 4, 'Y'), 'z': Matrix.Identity(4)}[axis]
    bmesh.ops.transform(bm, matrix=rot, verts=bm.verts)
    o = from_bm(name, bm)
    o.location = center
    bpy.context.scene.collection.objects.link(o)
    return o


def raw_box(name, center, size):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    o = from_bm(name, bm)
    o.location = center
    bpy.context.scene.collection.objects.link(o)
    return o


def arc(cx, cz, r, a0, a1, n):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cz + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


def rrect(x0, z0, x1, z1, r, n=5):
    pts = []
    pts += arc(x1 - r, z0 + r, r, -PI / 2, 0, n)
    pts += arc(x1 - r, z1 - r, r, 0, PI / 2, n)
    pts += arc(x0 + r, z1 - r, r, PI / 2, PI, n)
    pts += arc(x0 + r, z0 + r, r, PI, 1.5 * PI, n)
    return pts


def frame(name, x0, z0, x1, z1, side, mat, parent, bar=0.04, r=0.04, depth=0.03, lift=0.0, y_skin=W):
    ring(name, rrect(x0 - bar, z0 - bar, x1 + bar, z1 + bar, r + bar * 0.6), rrect(x0, z0, x1, z1, r), side, depth, mat, parent, y_skin, lift=lift)



import random
random.seed(41)
M['cream']=material('aged ivory enamel','#e8d4b4',.43,coat=.35)
M['rust']=material('oxidized exposed steel','#78432c',.82)
M['steel']=material('dark aged steel','#55565a',.4,.7)
M['digit']=material('warm counter ink','#d3c8b4',.62)
M['red']=material('vermilion enamel','#b90806',.36,coat=.5)
M['globe']=material('milk glass','#f6e5cd',.32,emit='#ffe4bd',strength=.12)
group('pump')
group('cabinet',parent='pump'); group('globe',parent='pump'); group('hose',parent='pump');group('nozzle',parent='pump')
verts=[(x*w,y*d,z) for z,w,d in [(0,.345,.47),(.17,.317,.442)] for x,y in [(-1,-1),(1,-1),(1,1),(-1,1)]]
me=bpy.data.meshes.new('tapered cast plinth');me.from_pydata(verts,[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]);me.update()
finish(bpy.data.objects.new('tapered cast plinth',me),'steel','cabinet',.018,4)

box('base red step',(0,0,.185),(.60,.86,.075),'red','cabinet',.024,4)
box('lower foot chrome bead',(0,0,.22),(.57,.83,.025),'alu_dark','cabinet',.011)
shell=box('red cabinet shell',(0,0,1.085),(.51,.77,1.76),'red','cabinet',.065,6)
box('rounded shoulder',(0,0,1.99),(.54,.79,.24),'red','cabinet',.10,8)
box('shoulder stainless belt',(0,0,1.875),(.563,.817,.035),'alu','cabinet',.014,4)
# Front and rear doors and nested meter bezels. Rotate side-plane helper by 90deg about Z.
def face_box(name,y,z,width,height,depth,mat,x=.272,bevel=.012):
    return box(name,(x,y,z),(depth,width,height),mat,'cabinet',bevel,4)
def front_frame(name,y,z,w,h,bar,rad,mat,x=.30):
    ob=ring(name,rrect(-w/2,z-h/2,w/2,z+h/2,rad),rrect(-w/2+bar,z-h/2+bar,w/2-bar,z+h/2-bar,rad-bar*.5),-1,.018,mat,'cabinet',y_skin=x)
    ob.rotation_euler.z=PI/2
    ob.location.y=y
    return ob
for side in (1,-1):
    x=side*.265
    door=face_box('ivory access door '+str(side),0,1.03,.615,1.62,.027,'cream',x,.022)
    face_box('lower red door sill '+str(side),0,.25,.61,.08,.035,'red',side*.276)
    if side==-1:
        for target in [door,shell]:
            cutter=box('rear aperture cutter',(-.29,0,1.52),(.20,.414,.51),'black',bevel=.042,segs=6)
            bpy.context.view_layer.objects.active=cutter
            bpy.ops.object.modifier_apply(modifier='bevel')
            cut(target,cutter)
        continue
    for target in [door,shell]:
        cutter=box('meter aperture cutter',(.29,0,1.52),(.20,.414,.51),'black',bevel=.042,segs=6)
        bpy.context.view_layer.objects.active=cutter
        bpy.ops.object.modifier_apply(modifier='bevel')
        cut(target,cutter)

    face_box('meter dark recess',0,1.52,.455,.54,.014,'black',.217,.047)
    face_box('meter ivory interior',0,1.52,.400,.483,.008,'cream',.228,.038)
    front_frame('heavy rounded meter bezel',0,1.52,.48,.58,.031,.067,'alu',.28)
    front_frame('inner bezel shadow lip',0,1.52,.418,.518,.009,.041,'steel',.296)
    for row,(z,count,w) in enumerate([(1.68,4,.065),(1.50,3,.066),(1.36,1,.082)]):
        ys=[(i-(count-1)/2)*(w+.005) for i in range(count)] if row<2 else [-.064,.064]
        for i,y in enumerate(ys):
            face_box('counter frame %s %s'%(row,i),y,z,w+.009,.094,.008,'alu_dark',.246,.006)
            face_box('black mechanical drum %s %s'%(row,i),y,z,w,.082,.009,'black',.254,.004)
            text('counter numeral %s %s'%(row,i),'0',.074,(.261,y,z),'+x','digit','cabinet',.0007,font='/System/Library/Fonts/Supplemental/Arial.ttf')
            face_box('drum divider %s %s'%(row,i),y+w/2-.002,z,.002,.079,.002,'steel',.263,.0004)
    for y in [-.253,.253]:
        for z in [.32,1.14]:
            cylinder('door fastener',( .297,y,z),.018,.012,'x','alu_dark','cabinet',24,.002)
            face_box('fastener slot',y,z,.017,.003,.002,'black',.305,.0004)
    face_box('raised shoulder contour',0,1.926,.61,.069,.012,'red',.273,.023)
    face_box('cap badge',0,1.96,.34,.077,.018,'alu',.285,.010)
    for z in [1.94,1.965,1.984]: face_box('badge grille',0,z,.22,.006,.003,'steel',.298,.002)
    for y in [-.15,.15]:
        cylinder('badge screw',(.300,y,1.96),.006,.005,'x','steel','cabinet',16)
# Round globe mounted above shoulder.
cylinder('globe pedestal',(0,0,2.145),.116,.048,'z','steel','globe',48,.006)
cylinder('pedestal red collar',(0,0,2.168),.11,.03,'z','red','globe',48,.004)
cylinder('globe red housing',(0,0,2.455),.292,.145,'x','red','globe',96,.012)
for s in [-1,1]:
    cylinder('milk glass face '+str(s),(s*.079,0,2.455),.256,.014,'x','globe','globe',96,.004)
    lathe('globe raised red rim '+str(s),[(.254,0),(.262,.007),(.276,.005),(.280,-.006),(.269,-.012)],(s*.087,0,2.455),'x' if s==1 else '-x','red','globe',96)
    # faceted embossed five-point star: alternating tips/valleys and raised centre.
    verts=[(s*.116,0,2.455)]
    for i in range(10):
        a=PI/2+i*PI/5;r=.198 if i%2==0 else .082
        verts.append((s*.094,r*math.cos(a),2.455+r*math.sin(a)))
    faces=[(0,1+i,1+(i+1)%10) for i in range(10)]
    me=bpy.data.meshes.new('star');me.from_pydata(verts,[],faces);me.update()
    star=finish(bpy.data.objects.new('embossed red star '+str(s),me),'red','globe',smooth=False)
# Hose and sculpted metal nozzle on visible side.
def tube(name,pts,r,mat,parent):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=18;cu.bevel_depth=r;cu.bevel_resolution=4
    sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
    for bp,co in zip(sp.bezier_points,pts):bp.co=co;bp.handle_left_type='AUTO';bp.handle_right_type='AUTO'
    ob=bpy.data.objects.new(name,cu);TRUCK.objects.link(ob);ob.data.materials.append(M[mat]);bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.convert(target='MESH');ob.select_set(False);ob.parent=GROUPS[parent];return ob
tube('heavy hanging black fuel hose',[(.01,-.422,.70),(.0,-.45,.49),(.03,-.70,.35),(.09,-.88,.39),(.14,-.89,.62),(.15,-.69,.98),(.15,-.58,1.25)],.028,'rubber','hose')
box('hose lower anchor',(0,-.402,.73),(.075,.032,.17),'red','hose',.014)
cylinder('nozzle socket',(0,-.416,1.64),.095,.037,'y','alu_dark','nozzle',48,.009)
cylinder('socket black throat',(0,-.44,1.64),.068,.014,'y','black','nozzle',48)
tube('nozzle curved spout',[(0,-.45,1.64),(.0,-.50,1.63),(.04,-.55,1.60),(.09,-.58,1.54)],.029,'alu_dark','nozzle')
prism('nozzle sculpted handle',[(.078,1.275),(.145,1.275),(.15,1.43),(.177,1.49),(.147,1.54),(.090,1.535),(.065,1.49),(.084,1.44)],-.621,-.555,'alu_dark','nozzle',.013,4)
cylinder('hose nozzle ferrule',(.14,-.58,1.27),.035,.045,'z','alu','nozzle',32,.004)
tube('trigger guard',[(.12,-.61,1.50),(.12,-.69,1.49),(.12,-.70,1.34),(.12,-.61,1.33)],.010,'steel','nozzle')
box('trigger lever',(.12,-.653,1.41),(.014,.02,.14),'black','nozzle',.006)
box('nozzle resting bracket',(0,-.41,1.32),(.075,.04,.15),'steel','nozzle',.01)
# small scattered geometric chips; glTF-friendly, deterministic, without textures.
for i in range(600):
    y=random.uniform(-.296,.296);z=random.uniform(.25,1.82)
    if abs(y)<.25 and 1.22<z<1.83:continue
    r=random.uniform(.0008,.0035)
    ob=face_box('ivory age fleck %03d'%i,y,z,r*random.uniform(1,2.8),r*random.uniform(1,3),.0005,'rust',.280,0)
for i in range(260):
    x=random.uniform(-.23,.23);z=random.uniform(.26,1.83)
    if abs(x)<.08 and z>1.24:continue
    box('side paint chip %03d'%i,(x,-.386,z),(random.uniform(.001,.004),.0007,random.uniform(.003,.014)),'steel','cabinet',0)
for i in range(100):
    y=random.uniform(-.43,.43);z=random.uniform(.025,.14)
    face_box('base rust %03d'%i,y,z,random.uniform(.002,.012),random.uniform(.002,.009),.0006,'rust',.346,0)
# Edge chips on narrow red face rails and sill.
for i in range(180):
    y=random.choice([-1,1])*random.uniform(.319,.374); z=random.uniform(.27,1.82)
    face_box('red edge wear %03d'%i,y,z,random.uniform(.001,.004),random.uniform(.002,.016),.001,'steel',.254,0)
for i in range(90):
    y=random.uniform(-.30,.30);z=random.uniform(.217,.279)
    face_box('sill wear %03d'%i,y,z,random.uniform(.002,.017),random.uniform(.001,.004),.001,'rust',.295,0)
# The hidden service face repeats the counter assembly and badge.
for ob in list(TRUCK.objects):
    if ob.name.startswith(('meter ','heavy rounded','inner bezel','counter ','black mechanical','drum divider','raised shoulder','cap badge','badge grille','badge screw','door fastener','fastener slot')):
        cp=ob.copy();cp.data=ob.data.copy();TRUCK.objects.link(cp)
        cp.name='rear '+ob.name
        cp.matrix_world=Matrix.Rotation(PI,4,'Z') @ ob.matrix_world

# Consolidate all deterministic flecks by material to keep draw calls practical.
for token in ['ivory age fleck','side paint chip','base rust','red edge wear','sill wear']:
    obs=[o for o in TRUCK.objects if o.name.startswith(token)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0]
    bpy.ops.object.join()
    obs[0].name=token+' combined'

def stage(view):
    world = bpy.data.worlds.new('studio')
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    env = nt.nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(str(Path(bpy.utils.resource_path('LOCAL')) / 'datafiles/studiolights/world/studio.exr'))
    bg = nt.nodes['Background']
    bg.inputs['Strength'].default_value = 0.6
    nt.links.new(env.outputs['Color'], bg.inputs['Color'])
    # light-grey backdrop like the reference
    lp = nt.nodes.new('ShaderNodeLightPath')
    mix = nt.nodes.new('ShaderNodeMixShader')
    flat = nt.nodes.new('ShaderNodeBackground')
    flat.inputs['Color'].default_value = (0.86, 0.86, 0.86, 1)
    flat.inputs['Strength'].default_value = 1.5
    out = nt.nodes['World Output']
    nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs[0])
    nt.links.new(bg.outputs[0], mix.inputs[1])
    nt.links.new(flat.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])

    def light(name, kind, loc, energy, size, color=(1, 1, 1)):
        ld = bpy.data.lights.new(name, kind)
        ld.energy = energy
        ld.color = color
        if kind == 'AREA':
            ld.size = size
        o = bpy.data.objects.new(name, ld)
        o.location = loc
        STAGE.objects.link(o)
        d = Vector((0, 0, 1.4)) - Vector(loc)
        o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        return o
    light('key', 'AREA', (8, -9, 10), 1300, 7, (1.0, 0.93, 0.84))
    light('fill', 'AREA', (-9, -6, 5), 450, 8, (0.8, 0.88, 1.0))
    light('rim', 'AREA', (-4, 9, 8), 800, 6, (1.0, 0.85, 0.75))

    ground = bpy.data.objects.new('ground', bpy.data.meshes.new('ground'))
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=200)
    bm.to_mesh(ground.data)
    bm.free()
    STAGE.objects.link(ground)
    ground.data.materials.append(material('studio floor','#dedede',.8))

    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    STAGE.objects.link(cam)
    scene.camera = cam
    cam.data.lens = 50
    views = {
        'ref': ((7.2, -4.5, 3.1), (0, -.05, 1.35), 58),
        'front': ((13, -3.5, 3.2), (0.6, 0, 1.4), 50),
        'side': ((0.0, -15.5, 2.0), (0.0, 0, 1.6), 45),
        'rear': ((-11, -7, 4.5), (-0.5, 0, 1.4), 45),
        'far': ((5, 13, 4.0), (0.2, 0, 1.45), 45),
        'top': ((6, -9, 11), (0, 0, 1.4), 45),
    }
    loc, tgt, lens = views[view]
    cam.location = loc
    cam.data.lens = lens
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 3.35 * scene.render.resolution_x / scene.render.resolution_y if False else 5.45
    cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()

    scene.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = 'GPU'
    scene.cycles.samples = int(arg('--samples', 96))
    scene.cycles.use_denoising = True
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.render.resolution_x = int(arg('--width', 1837))
    scene.render.resolution_y = int(arg('--height', 856))


bpy.context.view_layer.update()
tris = 0
dg = bpy.context.evaluated_depsgraph_get()
for o in TRUCK.objects:
    if o.type == 'MESH':
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        ev.to_mesh_clear()
print(f'BUILD OK: {sum(1 for o in TRUCK.objects if o.type == "MESH")} meshes, {tris} triangles')

if arg('--blend'):
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(arg('--blend')).resolve()))
if arg('--glb'):
    for o in bpy.context.view_layer.objects:
        o.select_set(o.name in TRUCK.objects)
    bpy.ops.export_scene.gltf(filepath=str(Path(arg('--glb')).resolve()), export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_lights=False, export_cameras=False)
    print('GLB OK', arg('--glb'))
if arg('--render'):
    stage(arg('--view', 'ref'))
    scene.render.filepath = str(Path(arg('--render')).resolve())
    bpy.ops.render.render(write_still=True)
    print('RENDER OK', arg('--render'))
