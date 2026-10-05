"""Sunset Grove ambulance. +X forward, metres, ground contact z=0.
Reference proportions: 6.47 m long, 2.36 m wide, 3.37 m tall.
Surface details have >=3 mm clearance. Motion groups retain joint origins;
all other geometry is merged by palette material before GLB export.
Run through experiment/tools/blender_run.py, never directly.
"""
import math
import sys
import json
from collections import defaultdict
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default=None):
    return ARGS[ARGS.index(name) + 1] if name in ARGS else default


PI = math.pi
W = 1.12                      # half width of the body skin
FONT = '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf'

# --------------------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
TRUCK = bpy.data.collections.new('Ambulance')
STAGE = bpy.data.collections.new('Stage')
scene.collection.children.link(TRUCK)
scene.collection.children.link(STAGE)

# --------------------------------------------------------------------------- materials
def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1.0]


def material(name, color, rough=0.5, metal=0.0, coat=0.0, coat_rough=0.03, emit=None, strength=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Coat Roughness'].default_value = coat_rough
    if emit:
        b.inputs['Emission Color'].default_value = srgb(emit)
        b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    m.diffuse_color = srgb(color)
    return m


# Palette identities are shared with the game; scalars supply paint/metal response.
M = {
 'white': material('pal_picketWhite','#f2e6dc',.32,coat=.35),
 'red': material('pal_survivorRed','#c92330',.34,coat=.35),
 'medical': material('pal_policeBlue','#1554d0',.34),
 'chrome': material('pal_sidewalk','#b9a4a0',.25,.78),
 'black': material('pal_uiDark','#25222c',.60),
 'glass': material('pal_asphalt','#455360',.14,coat=.8,alpha=.78),
 'amber': material('emi_schoolBusYellow','#f2b630',.24,emit='#f2b630',strength=1.4),
 'lamp': material('emi_sirenRed','#ff2d2d',.22,emit='#ff2d2d',strength=1.6),
 'blue': material('emi_policeBlue','#2f6bff',.22,emit='#2f6bff',strength=1.8),
 'head': material('emi_windowGlow','#ffc773',.22,emit='#ffc773',strength=1.3),
}
for key in ('alu','alu_dark','tread','rim'): M[key]=M['chrome']
for key in ('rubber','seat'): M[key]=M['black']
M['cabin_glass']=M['glass']

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


def finish(obj, mat, parent, bevel=0.0, segs=2, smooth=True, harden=True, angle=40):
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


def box(name, center, size, mat, parent=None, bevel=0.02, segs=2, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    o = from_bm(name, bm)
    o.location = center
    o.rotation_euler = rot
    return finish(o, mat, parent, bevel=min(bevel, min(size) * 0.45), segs=segs)


def prism(name, pts_xz, y0, y1, mat, parent=None, bevel=0.03, segs=2):
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


def lathe(name, profile, center, axis, mat, parent=None, segs=32, smooth=True):
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


def cylinder(name, center, r, depth, axis, mat, parent=None, segs=32, bevel=0.0):
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
    cu.resolution_u = 3
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

SIDES = [(-1, 'near'), (1, 'far')]

group('ambulance');group('chassis',parent='ambulance');group('patient_box',parent='ambulance');group('cab',parent='ambulance')
box('frame',(-.1,0,.53),(6.05,1.55,.22),'black','chassis')
body=box('box_shell',(-1.23,0,1.89),(3.75,2.24,2.78),'white','patient_box',.07,3)
cut(body,raw_cyl('rear_arch',(-1.95,0,.51),.65,3),'black')
cabpts=[(.66,.48),(3.06,.48),(3.06,1.48),(2.8,1.66),(1.88,1.98),(1.23,2.71),(.73,2.76)]
cab=prism('cab_shell',cabpts,-1.02,1.02,'white','cab',.08,3)
cut(cab,raw_cyl('front_arch',(2.12,0,.51),.65,3),'black')
cavity=prism('cabin_cavity',[(.79,1.57),(1.85,1.57),(1.85,1.93),(1.15,2.64),(.79,2.64)],-.92,.92,None,bevel=0)
cut(cab,cavity)
for side in [-1,1]:
 inner=[(.89,1.75),(1.54,1.75),(1.53,2.09),(1.16,2.53),(.91,2.53)]
 cutter=prism('open_side_window',inner,min(side*.85,side*1.2),max(side*.85,side*1.2),None,bevel=0)
 cut(cab,cutter)
wc=raw_box('open_front_window',(1.61,0,2.35),(.34,1.77,.78));wc.rotation_euler[1]=-.73;cut(cab,wc)
# seats, visible through glazing, including raised head rests
for yy in [-.47,.47]:
 box('seat_cushion'+str(yy),(1.02,yy,1.68),(.43,.42,.13),'seat','cab',.045)
 box('seat_back'+str(yy),(.85,yy,2.01),(.14,.43,.55),'seat','cab',.055,rot=(0,-.13,0))
 box('head_rest'+str(yy),(.84,yy,2.36),(.14,.27,.24),'seat','cab',.05)
box('cabin_rear_wall',(.80,0,2.12),(.02,1.83,1.04),'seat','cab',.008)
box('cabin_floor',(1.27,0,1.58),(.95,1.83,.035),'black','cab',.01)
box('dashboard',(1.66,0,1.91),(.24,1.74,.16),'black','cab',.035)
lathe('steering_wheel',[(.14,-.012),(.17,-.012),(.182,0),(.17,.012),(.14,.012),(.14,-.012)],(1.49,-.48,2.01),'x','black','cab',40)
box('steering_spoke',(1.49,-.48,2.01),(.024,.29,.023),'black','cab',.007)

# roof lip and aluminium lower rail
box('roof_cap',(-1.23,0,3.28),(3.78,2.28,.10),'white','patient_box',.045)
box('rear_step',(-3.20,0,.47),(.30,2.36,.28),'alu','chassis',.025)
box('front_bumper',(3.14,0,.62),(.25,2.16,.39),'chrome','chassis',.06)
for side,sname in SIDES:
 y=side*W
 stripe=box('box_stripe_'+sname,(-1.23,side*1.137,1.25),(3.68,.024,.42),'red','patient_box',.004)
 cut(stripe,raw_cyl('stripe_arch',(-1.95,0,.51),.657,3))
 box('lower_rail_'+sname,(-1.23,side*1.14,.49),(3.72,.045,.075),'alu','patient_box',.015)
 # fender chrome outlines
 for ax in [-1.95,2.12]:
  skin=1.13 if ax<0 else 1.035
  ring('arch_trim_'+sname+str(ax),arc(ax,.51,.68,0,PI,32),arc(ax,.51,.635,0,PI,32),side,.045,'alu','chassis',skin,.006)
 # door seam, window, compartments
 group('patient_door_'+sname,(-.67,y,1.67),parent='patient_box')
 frame('door_frame_'+sname,-.69,.56,.20,2.78,side,'alu','patient_door_'+sname,.025,.018,.026)
 box('door_panel_'+sname,(-.245,side*1.133,1.67),(.855,.018,2.15),'white','patient_door_'+sname,.016)
 box('door_red_'+sname,(-.245,side*1.160,1.25),(.855,.018,.42),'red','patient_door_'+sname,.002)
 plate('door_window_'+sname,rrect(-.49,1.87,.02,2.53,.07),side,.018,'glass','patient_door_'+sname,1.154)
 frame('window_gasket_'+sname,-.49,1.87,.02,2.53,side,'black','patient_door_'+sname,.023,.06,.022,y_skin=1.15)
 box('door_handle_mount_'+sname,(-.53,side*1.17,1.42),(.12,.04,.19),'white','patient_door_'+sname,.025)
 box('door_handle_'+sname,(-.53,side*1.198,1.42),(.055,.024,.13),'black','patient_door_'+sname,.012)
 for i,(x0,x1,z0,z1) in enumerate([(-3.02,-2.47,.57,1.00),(-1.21,-.78,.57,.95),(.29,.60,.57,1.05),(.29,.60,1.58,2.30)]):
  frame('locker_frame_'+sname+str(i),x0,z0,x1,z1,side,'alu','patient_box',.016,.02,.012)
  box('locker_handle_'+sname+str(i),((x0+x1)/2,side*1.16,z1-.065),((x1-x0)*.65,.035,.025),'chrome','patient_box',.008)
 for x in [-2.58,-1.10]:
  plate('scene_light_'+sname+str(x),rrect(x-.12,2.80,x+.12,3.02,.025),side,.035,'chrome','patient_box')
  plate('scene_lens_'+sname+str(x),rrect(x-.095,2.825,x+.095,2.995,.018),side,.018,'alu_dark','patient_box',1.16)
 for x in [-2.90,.39]:
  box('emergency_frame_'+sname+str(x),(x,side*1.16,2.96),(.30,.06,.27),'black','patient_box',.025)
  box('emergency_red_'+sname+str(x),(x,side*1.202,2.96),(.265,.05,.235),'lamp','patient_box',.025)
  for dx in [-.065,0,.065]:
   for dz in [-.045,.015]:box('led_'+sname+str(x)+str(dx)+str(dz),(x+dx,side*1.231,2.96+dz),(.045,.008,.035),'head','patient_box',.003)
 for x in [-2.91,-1.22,.46]:box('side_marker_'+sname+str(x),(x,side*1.18,.51),(.15,.04,.045),'amber','patient_box',.008)
 # large star of life, three crossed bars on side
 def star(name,cx,cz,r,skin):
  pts=[]
  for k in range(6):
   a=PI/6+k*PI/3
   for da,rr in [(-math.atan(.23),r*math.sqrt(1+.23**2)),(math.atan(.23),r*math.sqrt(1+.23**2)),(PI/6,r*.46)]:
    pts.append((cx+rr*math.cos(a+da),cz+rr*math.sin(a+da)))
  plate(name,pts,side,.009,'medical','patient_box',skin+.007,bevel=.001)
  # white staff and sinusoidal serpent rendered as tube
  box(name+'staff',(cx,side*(skin+.026),cz),(.022,.01,r*1.5),'white','patient_box',.009)
  cu=bpy.data.curves.new(name+'snake','CURVE');cu.dimensions='3D';cu.bevel_depth=r*.035;cu.bevel_resolution=2
  sp=cu.splines.new('POLY');sp.points.add(39)
  for k in range(40):
   t=k/39;sp.points[k].co=(cx+math.sin(t*PI*5)*r*.105,side*(skin+.040),cz-r*.65+t*r*1.30,1)
  ob=bpy.data.objects.new(name+'snake',cu);TRUCK.objects.link(ob);ob.data.materials.append(M['white'])
 star('medical_symbol_'+sname,-2.06,2.29,.53,1.142)
 text('ambulance_lettering_'+sname,'AMBULANCE',.37,(-2.04,side*1.165,1.67),'-y' if side<0 else '+y','medical','patient_box',font='/System/Library/Fonts/Supplemental/Arial Bold.ttf',stretch=.93)
 # cab door and glass
 ring('cab_door_seam_'+sname,[(.76,.63),(1.63,.63),(1.63,2.14),(1.20,2.64),(.76,2.64)],[(.773,.643),(1.617,.643),(1.617,2.14),(1.193,2.627),(.773,2.627)],side,.009,'alu_dark','cab',1.025,.002)
 win=[(.84,1.70),(1.60,1.70),(1.58,2.10),(1.19,2.59),(.88,2.59)]
 ring('cab_window_'+sname,win,[(.89,1.75),(1.54,1.75),(1.53,2.09),(1.16,2.53),(.91,2.53)],side,.025,'black','cab',1.035,.008)
 plate('cab_window_glass_'+sname,[(.89,1.75),(1.54,1.75),(1.53,2.09),(1.16,2.53),(.91,2.53)],side,.012,'cabin_glass','cab',1.065,.008)
 stripe=plate('cab_stripe_'+sname,[(.73,1.12),(2.96,1.12),(2.96,1.47),(.73,1.47)],side,.024,'red','cab',1.04,.005)
 cut(stripe,raw_cyl('stripe_arch',(2.12,0,.51),.657,3))
 star('cab_medical_'+sname,1.12,1.30,.17,1.08)
 box('cab_handle_'+sname,(.89,side*1.075,1.50),(.10,.04,.16),'white','cab',.02)
 box('mirror_arm_'+sname,(1.51,side*1.16,1.91),(.17,.26,.035),'black','cab',.008)
 box('mirror_'+sname,(1.51,side*1.29,2.02),(.20,.16,.35),'black','cab',.04)
 box('step_'+sname,(.99,side*1.10,.46),(.62,.30,.09),'tread','chassis',.015)
# windshield slope follows cab front rake, actual pane above the hood
wind=box('windshield_black',(1.576,0,2.335),(.055,1.88,.91),'black','cab',.06,5,rot=(0,-.73,0))
wc=raw_box('gasket_cut',(1.576,0,2.335),(.30,1.76,.79));wc.rotation_euler[1]=-.73;cut(wind,wc)
box('windshield_glass',(1.612,0,2.36),(.012,1.76,.79),'cabin_glass','cab',.04,4,rot=(0,-.73,0))
for sy in [-.51,.51]:
 box('windshield_wiper',(1.904,sy,2.049),(.026,.65,.024),'black','cab',.009,rot=(.10,0,0))
 box('hood_vent',(2.21,sy,1.85),(.15,.34,.018),'black','cab',.008,rot=(0,.22,0))
# grille surround and bars
box('grille_surround',(3.064,0,1.22),(.085,1.55,.78),'chrome','cab',.06)
box('grille_inset',(3.115,0,1.22),(.035,1.39,.64),'black','cab',.035)
for z in [1.00,1.15,1.30,1.45]:box('grille_chrome_'+str(z),(3.144,0,z),(.026,1.32,.026),'chrome','cab',.009)
for y in [-.52,-.26,0,.26,.52]:box('grille_vertical_'+str(y),(3.135,y,1.22),(.015,.018,.58),'alu_dark','cab',.004)
o=cylinder('medical_grille_roundel',(3.165,0,1.24),.105,.025,'x','medical','cab');o.scale.y=1.0;o.scale.z=1.0
for side in [-1,1]:
 box('headlamp_frame'+str(side),(3.09,side*.91,1.23),(.11,.29,.46),'chrome','cab',.035)
 box('headlamp'+str(side),(3.158,side*.91,1.26),(.035,.22,.33),'head','cab',.018)
 box('turn_signal'+str(side),(3.165,side*.91,.995),(.035,.22,.055),'amber','cab',.01)
 box('bumper_recess'+str(side),(3.272,side*.79,.62),(.018,.24,.105),'black','chassis',.012)
box('plate_mount',(3.28,0,.57),(.027,.53,.23),'black','chassis',.012)
box('license_plate',(3.30,0,.57),(.018,.38,.19),'white','chassis',.008)
# Front-facing lightbar on patient box brow
box('lightbar_base',(.69,0,2.99),(.19,1.75,.09),'chrome','patient_box',.025)
for i,y in enumerate([-.72,-.36,0,.36,.72]):
 box('lightbar_module_'+str(i),(.79,y,3.02),(.23,.34,.24),'blue' if i==2 else 'red','patient_box',.025)
 for zz in [2.98,3.05]:
  for yy in [-.085,0,.085]:box('bar_led_'+str(i)+str(zz)+str(yy),(.914,y+yy,zz),(.01,.055,.04),'head' if i==2 else 'amber','patient_box',.003)
for x in [-2.94,.48]:
 for y in [-1.02,1.02]:box('roof_corner_lamp'+str(x)+str(y),(x,y,3.35),(.14,.12,.035),'lamp','patient_box',.014)
for y in [-.76,-.38,0,.38,.76]:box('cab_roof_marker'+str(y),(1.22,y,2.79),(.10,.08,.035),'amber','cab',.012)
# wheels with shaped tyres, rim holes, bolts and tread
for ax,label in [(-1.95,'rear'),(2.12,'front')]:
 for side,sname in SIDES:
  cy=side*(1.00 if ax<0 else .94);g='wheel_'+label+'_'+sname;group(g,(ax,cy,.51),parent='chassis');axis='-y' if side<0 else 'y'
  lathe(g+'_tyre',[(.30,-.17),(.43,-.17),(.49,-.13),(.51,-.08),(.515,.08),(.49,.15),(.43,.18),(.30,.18)],(ax,cy,.515),axis,'rubber',g,48)
  lathe(g+'_rim',[(.001,-.08),(.29,-.08),(.33,.08),(.34,.15),(.31,.17),(.285,.12),(.22,.10),(.001,.10)],(ax,cy,.515),axis,'rim',g,48)
  cylinder(g+'_hub',(ax,cy+side*.17,.515),.115,.075,axis,'chrome',g)
  for k in range(8):
   a=k*PI/4
   cylinder(g+'_rim_hole'+str(k),(ax+.25*math.cos(a),cy+side*.14,.515+.25*math.sin(a)),.041,.012,axis,'black',g,16)
   cylinder(g+'_lug'+str(k),(ax+.15*math.cos(a),cy+side*.22,.515+.15*math.sin(a)),.022,.024,axis,'chrome',g,12)
  for k in range(48):
   a=k*2*PI/48
   box(g+'_tread'+str(k),(ax+.514*math.cos(a),cy,.515+.514*math.sin(a)),(.035,.24,.018),'rubber',g,.004,segs=1,rot=(0,PI/2-a,0))
  box('mudflap_'+g,(ax-.56,cy,.34),(.045,.38,.42),'black','chassis',.01)
# Rear double doors and safety lighting
for side in [-1,1]:
 box('rear_door_'+str(side),(-3.12,side*.54,1.86),(.027,1.04,2.57),'white','patient_box',.025)
 box('rear_red_'+str(side),(-3.145,side*.54,1.25),(.012,1.035,.42),'red','patient_box',.001)
 box('rear_window_frame_'+str(side),(-3.16,side*.54,2.36),(.033,.53,.59),'black','patient_box',.04)
 box('rear_window_'+str(side),(-3.183,side*.54,2.36),(.014,.46,.52),'glass','patient_box',.03)
 box('rear_handle_'+str(side),(-3.18,side*.12,1.65),(.055,.045,.21),'white','patient_box',.015)
 for z in [.79,1.04,2.97]:box('rear_light_'+str(side)+str(z),(-3.19,side*.99,z),(.05,.13,.15),'lamp' if z!=1.04 else 'amber','patient_box',.02)
text('rear_label','AMBULANCE',.25,(-3.175,0,2.86),'-x','medical','patient_box',font='/System/Library/Fonts/Supplemental/Arial Bold.ttf')

# Proud metal trim, tyre mouldings and hood creases added after comparison two.
for side,sname in SIDES:
 for ax in [-1.95,2.12]:
  cy=side*(1 if ax<0 else .94)
  axis='-y' if side<0 else 'y'
  for rad in [.355,.43]:
   lathe('sidewall_bead_'+sname+str(ax)+str(rad),[(rad-.006,.177),(rad,.182),(rad+.006,.177)],(ax,cy,.515),axis,'rubber','wheel_'+('rear' if ax<0 else 'front')+'_'+sname,48)
  lathe('rim_lip_'+sname+str(ax),[(.295,.16),(.313,.18),(.335,.175),(.344,.153)],(ax,cy,.515),axis,'rim','wheel_'+('rear' if ax<0 else 'front')+'_'+sname,48)
 for ix in range(12):
  for iy in range(3):
   box('step_diamond_'+sname+str(ix)+'_'+str(iy),(.73+ix*.047,side*(1.01+iy*.085),.508),(.04,.018,.007),'alu','chassis',.002,segs=1,rot=(0,0,.60 if ix%2 else -.60))
 # side corner extrusion and amber marker above light bar
 box('box_front_corner_'+sname,(.63,side*1.138,1.89),(.06,.028,2.71),'alu','patient_box',.014)
 for x in [-3.06,.63]:box('upper_side_trim_'+sname+str(x),(x,side*1.142,2.01),(.032,.025,2.48),'white','patient_box',.012)
for yy in [-.60,.60]:
 box('hood_crease_'+str(yy),(2.43,yy,1.795),(.64,.012,.012),'white','cab',.009,rot=(0,.335,0))
 for k in range(7):box('vent_slit_'+str(yy)+str(k),(2.21,yy-.11+k*.035,1.865),(.13,.014,.009),'alu_dark','cab',.003,rot=(0,.22,0))
for yy in [-.91,.91]:
 box('headlight_crossbar'+str(yy),(3.18,yy,1.26),(.008,.22,.014),'chrome','cab',.003)
 box('headlight_vertical'+str(yy),(3.18,yy,1.26),(.008,.01,.30),'chrome','cab',.003)
# Corner signals, brow lamps and rear hinge hardware.
for side,sname in SIDES:
 box('front_side_signal_'+sname,(3.005,side*1.043,1.25),(.13,.025,.32),'amber','cab',.025)
 box('box_brow_signal_'+sname,(.686,side*.96,3.19),(.025,.09,.055),'amber','patient_box',.01)
 box('front_brow_red_frame_'+sname,(.694,side*.96,2.99),(.045,.18,.26),'black','patient_box',.025)
 box('front_brow_red_'+sname,(.732,side*.96,2.99),(.045,.145,.21),'lamp','patient_box',.018)
 for z in [.80,2.64]:
  box('rear_hinge_'+sname+str(z),(-3.16,side*.96,z),(.05,.13,.035),'chrome','patient_box',.01)
 # medical box corner lamp frames are slim to preserve the box silhouette.
box('hood_badge',(2.72,0,1.721),(.075,.065,.012),'medical','cab',.008,rot=(0,.33,0))
text('town_identity','SUNSET GROVE',.115,(-2.04,-1.169,1.51),'-y','medical','patient_box',font='/System/Library/Fonts/Supplemental/Arial Bold.ttf')
# Proud roof edging, hatch and fasteners.
for sy in (-1,1):
 box('roof_edge',(-1.23,sy*1.106,3.340),(3.57,.024,.018),'white','patient_box',.006)
 for x in (-3.02,.56):
  for z in (.65,1.75,2.65):
   cylinder('corner_fastener',(x,sy*1.164,z),.015,.012,'y','chrome','patient_box',12)
box('roof_hatch',(-.10,0,3.342),(.14,.10,.014),'chrome','patient_box',.004)
# All curves are exported as explicitly named mesh parts.
for ob in list(TRUCK.objects):
 if ob.type=='CURVE':
  bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
  bpy.ops.object.convert(target='MESH')
# Hinge/light assemblies preserve global transforms and export meaningful pivots.
def assembly_reparent(obj, parent):
 bpy.context.view_layer.update()
 world=obj.matrix_world.copy()
 obj.parent=parent
 obj.matrix_world=world
for side,sname in SIDES:
 door=group('cab_door_'+sname,(1.64,side*1.035,1.36),parent='cab')
 for prefix in ['cab_door_seam_','cab_window_','cab_window_glass_','cab_handle_','mirror_arm_','mirror_']:
  ob=bpy.data.objects.get(prefix+sname)
  if ob:assembly_reparent(ob,door)
 for ob in list(TRUCK.objects):
  if ob.name.startswith('cab_medical_'+sname):assembly_reparent(ob,door)
 panel=prism('cab_door_skin_'+sname,[(.785,.655),(1.625,.655),(1.625,1.70),(.785,1.70)],min(side*1.019,side*1.048),max(side*1.019,side*1.048),'white',bevel=.014)
 assembly_reparent(panel,door)
 cut(cab,raw_box('door_cut',(1.205,side*1.005,1.175),(.858,.22,1.076)))
 # Door stripe and emblem remain attached to the actual door.
 stripe=plate('door_stripe_'+sname,[(.785,1.12),(1.625,1.12),(1.625,1.47),(.785,1.47)],side,.018,'red',y_skin=1.055,bevel=.003)
 assembly_reparent(stripe,door)
 # Cut a slot in the fixed stripe at the door outline.
 fixed=bpy.data.objects.get('cab_stripe_'+sname)
 cut(fixed,raw_box('stripe_door_cut',(1.205,side*1.07,1.295),(.86,.16,.40)))
 rear=group('rear_door_'+sname+'_hinge',(-3.12,side*1.06,1.86),parent='patient_box')
 for prefix in ['rear_door_','rear_red_','rear_window_frame_','rear_window_','rear_handle_']:
  ob=bpy.data.objects.get(prefix+str(side))
  if ob:assembly_reparent(ob,rear)
cut(body,raw_box('patient_cavity',(-1.23,0,1.92),(3.49,1.98,2.52)))
for side,sname in SIDES:
 cut(body,raw_box('patient_door_cut',(-.245,side*1.105,1.67),(.87,.40,2.16)))
 cut(bpy.data.objects.get('box_stripe_'+sname),raw_box('door_stripe_cut',(-.245,side*1.14,1.25),(.89,.20,.45)))
 for z in (.78,2.64):
  box('patient_hinge_'+sname,(-.67,side*1.188,z),(.052,.028,.18),'white','patient_door_'+sname,.008)
 # Rear openings are real holes, with a paired hinge at each rear edge.
 cut(body,raw_box('rear_opening',(-3.10,side*.54,1.86),(.35,1.035,2.56)))
lightbar=group('emergency_lightbar',(.79,0,3.02),parent='patient_box')
for ob in list(TRUCK.objects):
 if ob.name.startswith('lightbar_') or ob.name.startswith('bar_led_'):assembly_reparent(ob,lightbar)
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
    light('key', 'AREA', (8, -9, 10), 2600, 7, (1.0, 0.93, 0.84))
    light('fill', 'AREA', (-9, -6, 5), 900, 8, (0.8, 0.88, 1.0))
    light('rim', 'AREA', (-4, 9, 8), 1600, 6, (1.0, 0.85, 0.75))

    ground = bpy.data.objects.new('ground', bpy.data.meshes.new('ground'))
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40)
    bm.to_mesh(ground.data)
    bm.free()
    STAGE.objects.link(ground)
    ground.is_shadow_catcher = True

    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    STAGE.objects.link(cam)
    scene.camera = cam
    cam.data.lens = 50
    views = {
        'ref': ((7.8, -13.6, 6.6), (0, 0, 1.55), 68),
        'game': ((9.8, -9.8, 13.0), (0, 0, 1.45), 48),
        'front': ((13, -3.5, 3.2), (0.6, 0, 1.4), 50),
        'side': ((0.0, -15.5, 2.0), (0.0, 0, 1.6), 45),
        'rear': ((-11, -7, 4.5), (-0.5, 0, 1.4), 45),
        'far': ((5, 13, 4.0), (0.2, 0, 1.45), 45),
        'top': ((6, -9, 11), (0, 0, 1.4), 45),
    }
    loc, tgt, lens = views[view]
    cam.location = loc
    cam.data.lens = lens
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
    scene.view_settings.look = 'AgX - Punchy'
    scene.render.resolution_x = int(arg('--width', 1837))
    scene.render.resolution_y = int(arg('--height', 856))


# Export contract and batching. Geometry is baked once, then grouped by material
# within each moving assembly; its empty remains the joint used by the game.
root = GROUPS['ambulance']
root.name = 'veh.ambulance'
GROUPS['patient_box'].name = 'body'
root['assetId'] = 'veh.ambulance'
root['tier'] = 'Hero'
root['ss_physics'] = json.dumps({'class':'heavy','mass':3200,'friction':.75,
    'restitution':.08,'centerOfMass':[0,1.05,0],'pushable':False,
    'kickable':False,'flammable':True,'burnTime':25})

motion = {}
for old,new in [('wheel_front_near','wheelFL'),('wheel_front_far','wheelFR'),
                ('wheel_rear_near','wheelRL'),('wheel_rear_far','wheelRR'),
                ('cab_door_near','doorL'),('cab_door_far','doorR'),
                ('patient_door_near','doorPatient'),
                ('rear_door_near_hinge','doorRearL'),('rear_door_far_hinge','doorRearR')]:
    joint = GROUPS[old]
    joint.name = new
    motion[joint] = new
# The opposite patient-box flank is a fixed equipment panel, not a second entry.
GROUPS['patient_door_far'].name = 'equipmentPanel'
# Doors use the same opaque dark palette finish for glazing and gaskets; the
# windshield retains its glossy tint and visible cabin seats.
for obj in list(TRUCK.objects):
    parent = obj.parent
    while parent and parent not in motion:
        parent = parent.parent
    if parent in motion and not motion[parent].startswith('wheel'):
        if obj.type == 'MESH':
            for i,mat in enumerate(obj.data.materials):
                if mat == M['glass']: obj.data.materials[i] = M['black']
                elif mat == M['chrome']: obj.data.materials[i] = M['white']

for name,pos in [('driverSeat',(1.0,-.47,1.68)),('exitL',(1.12,-1.60,0)),
                 ('exitR',(1.12,1.60,0))]:
    group(name,pos,parent='ambulance')
for name,pos,size in [('box',(-1.23,0,1.89),(3.75,2.24,2.78)),
                      ('cab',(1.9,0,1.48),(2.45,2.04,1.94))]:
    col = group('col:'+name,pos,parent='ambulance')
    col['collider']='cuboid'; col['shape']='cuboid'; col['size']=list(size)

lamp_groups = {}
for name,pos in [('lightsFront',(3.16,0,1.26)),('lightsBrake',(-3.19,0,.79)),
                 ('sirenL',(.79,-.6,3.02)),('sirenR',(.79,.6,3.02))]:
    lamp_groups[name] = group(name,pos,parent='ambulance')
    motion[lamp_groups[name]] = name

for obj in list(TRUCK.objects):
    if obj.type == 'CURVE':
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True); bpy.context.view_layer.objects.active=obj
        bpy.ops.object.convert(target='MESH')

batches = defaultdict(list)
for obj in list(TRUCK.objects):
    if obj.type != 'MESH': continue
    bpy.context.view_layer.objects.active=obj
    for mod in list(obj.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    mat = obj.data.materials[0]
    # LED grids follow their lens color, with the center module remaining blue.
    if obj.name.startswith(('led_','bar_led_')):
        mat = M['white']
        obj.data.materials.clear();obj.data.materials.append(mat)
    parent=obj.parent
    while parent and parent not in motion: parent=parent.parent
    owner=parent if parent in motion else root
    if mat == M['head']: owner=lamp_groups['lightsFront']
    elif mat in (M['lamp'],M['blue']) or obj.name.startswith(('led_','bar_led_')):
        if obj.name.startswith('rear_light_'): owner=lamp_groups['lightsBrake']
        else: owner=lamp_groups['sirenL' if obj.matrix_world.translation.y<0 else 'sirenR']
    # Exact booleans may add unused slots; compact them prior to joining.
    obj.data.materials.clear();obj.data.materials.append(mat)
    for face in obj.data.polygons: face.material_index=0
    batches[(owner,mat)].append(obj)

for (owner,mat),objects in batches.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    obj=bpy.context.object
    world=obj.matrix_world.copy();obj.parent=GROUPS['patient_box'] if owner==root else owner;obj.matrix_world=world
    obj.name = ('static_' if owner==root else owner.name+'_')+mat.name
    obj['decorativeEmissive']=mat.name.startswith('emi_')
    if owner == root and mat == M['chrome']:
        dec=obj.modifiers.new('trim_density','DECIMATE');dec.ratio=.60
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.modifier_apply(modifier=dec.name)
    # Set child origin to assembly origin without changing the world-space mesh.
    bpy.context.view_layer.update()
    pivot=owner.matrix_world.translation.copy()
    scene.cursor.location=pivot
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

for name,typ,pos,direction,color,emissive,intensity,ran in [
 ('headlightL','spot',(3.18,-.91,1.26),(1,0,-.12),'light_window_warm','lightsFront',4,20),
 ('headlightR','spot',(3.18,.91,1.26),(1,0,-.12),'light_window_warm','lightsFront',4,20),
 ('brakeL','point',(-3.20,-.99,.79),(-1,0,0),'light_siren_red','lightsBrake',1,3),
 ('brakeR','point',(-3.20,.99,.79),(-1,0,0),'light_siren_red','lightsBrake',1,3),
 ('sirenL','beacon',(.8,-.6,3.02),(0,-1,0),'light_siren_red','sirenL',4,14),
 ('sirenR','beacon',(.8,.6,3.02),(0,1,0),'light_siren_blue','sirenR',4,14)]:
    anchor=group('light:'+name,pos,parent='ambulance')
    anchor.rotation_euler=Vector(direction).to_track_quat('-Z','Y').to_euler()
    anchor['ss_light']=json.dumps({'type':typ,'color':color,'intensity':intensity,
       'range':ran,'angle':42,'penumbra':.4,'pool':True,'beam':'soft' if typ=='spot' else 'none',
       'flare':True,'reflect':True,'shadow':'hero' if typ=='spot' else 'none',
       'heroPriority':2,'flicker':'none','powerGroup':'self','breakable':True,
       'animation':{'strobe':'police'} if typ=='beacon' else None,
       'emissiveNodes':[o.name for o in TRUCK.objects if o.parent==lamp_groups[emissive]],'tiers':'all'})

bpy.context.view_layer.update()
meshes=[o for o in TRUCK.objects if o.type=='MESH']
if arg('--glb'):
    # Deterministic Cycles AO is stored as an active vertex-color attribute,
    # not an image texture. The game can multiply it into palette shading.
    scene.render.engine='CYCLES'
    scene.cycles.samples=32
    scene.cycles.seed=0
    scene.cycles.device='CPU'
    scene.render.bake.target='VERTEX_COLORS'
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:
        attr=obj.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
        obj.data.color_attributes.active_color_index=len(obj.data.color_attributes)-1
        obj.data.color_attributes.render_color_index=len(obj.data.color_attributes)-1
        obj.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    bpy.ops.object.bake(type='AO')
    print('AO OK: deterministic vertex colors, 32 samples')
tris=sum(len(o.data.loop_triangles) for o in meshes if not o.data.calc_loop_triangles())
draws=sum(len(o.data.materials) for o in meshes)
required=['body','wheelFL','wheelFR','wheelRL','wheelRR','doorL','doorR',
          'lightsFront','lightsBrake','driverSeat','exitL','exitR','sirenL','sirenR']
report={'id':'veh.ambulance','tier':'Hero','triangles':tris,'draw_calls':draws,
        'materials':sorted({m.name for o in meshes for m in o.data.materials}),
        'nodes_ok':all(bpy.data.objects.get(n) for n in required),
        'within_budget':tris<=80000 and draws<=40,'rounds':3,
        'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'build-metrics.json').write_text(json.dumps(report,indent=2)+'\n')
print('BUILD OK',json.dumps(report))
if arg('--glb'):
    for obj in bpy.context.view_layer.objects: obj.select_set(obj.name in TRUCK.objects)
    bpy.ops.export_scene.gltf(filepath=str(Path(arg('--glb')).resolve()),export_format='GLB',
        use_selection=True,export_apply=True,export_yup=True,export_extras=True,
        export_lights=False,export_cameras=False,export_all_vertex_colors=True)
    print('GLB OK',arg('--glb'))
    # Hero vehicles ship a joint-preserving LOD chain. Restore the source meshes
    # afterwards so the studio preview always renders LOD0.
    original={obj:obj.data for obj in meshes}
    lod_counts={}
    for level,ratio in [(1,.14),(2,.035)]:
        for obj,data in original.items():
            obj.data=data.copy()
            bpy.context.view_layer.objects.active=obj
            dec=obj.modifiers.new('lod_density','DECIMATE');dec.ratio=ratio
            bpy.ops.object.modifier_apply(modifier=dec.name)
        lodpath=Path(arg('--glb')).with_name('model.lod'+str(level)+'.glb').resolve()
        bpy.ops.export_scene.gltf(filepath=str(lodpath),export_format='GLB',
            use_selection=True,export_apply=True,export_yup=True,export_extras=True,
            export_lights=False,export_cameras=False,export_all_vertex_colors=True)
        lod_counts['LOD'+str(level)]=sum(len(obj.data.loop_triangles) for obj in meshes if not obj.data.calc_loop_triangles())
        for obj,data in original.items():
            temporary=obj.data;obj.data=data;bpy.data.meshes.remove(temporary)
    (HERE/'lod-metrics.json').write_text(json.dumps(lod_counts,indent=2)+'\n')
if arg('--render'):
    stage(arg('--view','ref'))
    scene.render.filepath=str(Path(arg('--render')).resolve())
    bpy.ops.render.render(write_still=True)
    print('RENDER OK',arg('--render'))
