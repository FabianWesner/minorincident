"""School bus measured from reference-upscaled.png (1612 x 975).
Visible side rear roof (70,170), cab roof corner (1090,260), roof high corner (355,58).
Side rear bottom (75,650), door sill (1060,800), bonnet nose (1515,540).
Rear wheel centre (266,691), front (1200,812); diameters approximately 190px.
Side windows: narrow rear at 90..155, then 180..330, 355..510, 533..693, 715..882.
Body world rear=-4.2, cab front=2.1, bonnet tip=4.05; wheel radius=.65.
Window belt z=2.05..3.05, roof crown=3.72; side door x=1.0..2.05.
Build entirely as mesh parts, +X front, -Y reference side, metres, tyre bottom z=0.
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.distance import tier_argument, export_variant, build_native_lods
DISTANCE = tier_argument()
if '--lod-only' in sys.argv:
    build_native_lods(__file__)
    sys.exit(0)

HERE = Path(__file__).resolve().parent
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default=None):
    return ARGS[ARGS.index(name) + 1] if name in ARGS else default


PI = math.pi
W = 1.3  # half width of passenger body
FONT = '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf'


# --------------------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
TRUCK = bpy.data.collections.new('SchoolBus')
STAGE = bpy.data.collections.new('Stage')
scene.collection.children.link(TRUCK)
scene.collection.children.link(STAGE)

# --------------------------------------------------------------------------- materials
def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1.0]


def material(name, color, rough=0.5, metal=0.0, coat=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    if emit:
        b.inputs['Emission Color'].default_value = srgb(emit)
        b.inputs['Emission Strength'].default_value = strength
    m.diffuse_color = srgb(color)
    return m


# Palette identities are the runtime material contract. No image textures.
M = {
 'yellow': material('pal_schoolBusYellow', '#f2b630', .58, coat=.06),
 'edge': material('pal_woodWarm', '#b0703f', .55),
 'black': material('pal_uiDark', '#25222c', .62, coat=.08),
 'rim': material('pal_asphalt', '#5b4f5c', .48, .15),
 'white': material('pal_picketWhite', '#f2e6dc', .42),
 'stop': material('pal_survivorRed', '#d9363e', .36, coat=.25),
 'lamp': material('emi_sirenRed', '#ff2d2d', .25, emit='#ff2d2d', strength=.3),
 'head': material('emi_windowGlow', '#ffc773', .22, emit='#ffc773', strength=2.5),
}
M['yellow'].node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value = .18
M['glass'] = M['black']
M['rubber'] = M['black']
M['reflection'] = M['rim']
M['amber'] = M['head']
M['plate'] = M['white']

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
    if DISTANCE: bevel = 0
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
        b.segments = min(segs, 3 if obj.name.startswith(('passenger_shell','rounded_roof','sculpted_bonnet','front_fender')) else 2)
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
    if DISTANCE: segs = min(segs, 12 if DISTANCE == 1 else 6)
    if DISTANCE == 2 and name.endswith('_tyre'): profile = [profile[i] for i in (0, 1, 4, 5, 8, 9)]
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
    if DISTANCE: segs = min(segs, 12 if DISTANCE == 1 else 6)
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
    cu.extrude = 0 if DISTANCE else depth / 2
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.space_character = spacing
    cu.resolution_u = 2
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


def raw_cyl(name, center, r, depth, axis='y', segs=48):
    if DISTANCE: segs = min(segs, 12 if DISTANCE == 1 else 6)
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
    if DISTANCE: n = min(n, 12 if DISTANCE == 1 else 6)
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cz + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


def rrect(x0, z0, x1, z1, r, n=3):
    if DISTANCE: return [(x0,z0),(x1,z0),(x1,z1),(x0,z1)]
    if DISTANCE: n = min(n, 12 if DISTANCE == 1 else 6)
    pts = []
    pts += arc(x1 - r, z0 + r, r, -PI / 2, 0, n)
    pts += arc(x1 - r, z1 - r, r, 0, PI / 2, n)
    pts += arc(x0 + r, z1 - r, r, PI / 2, PI, n)
    pts += arc(x0 + r, z0 + r, r, PI, 1.5 * PI, n)
    return pts


def frame(name, x0, z0, x1, z1, side, mat, parent, bar=0.04, r=0.04, depth=0.03, lift=0.0, y_skin=W):
    ring(name, rrect(x0 - bar, z0 - bar, x1 + bar, z1 + bar, r + bar * 0.6), rrect(x0, z0, x1, z1, r), side, depth, mat, parent, y_skin, lift=lift)


SIDES=[(-1,'near'),(1,'far')]
group('veh.school-bus');group('chassis',parent='veh.school-bus');group('body',parent='veh.school-bus');group('bonnet',parent='veh.school-bus')
box('underframe',(-.05,0,.65),(7.95,1.6,.24),'black','chassis',.05)
body=box('passenger_shell',(-1.05,0,2.01),(6.3,2.6,2.94),'yellow','body',.09,5)
cut(body,raw_cyl('rear_arch',(-2.65,0,.65),.79,3.1),'black')
# Roof rounded cap and subtly raised perimeter seams
box('rounded_roof',(-1.05,0,3.46),(6.4,2.64,.52),'yellow','body',.23,7)
for x in [-4.04,-3.35,-1.45,.55,1.92]:
 box('roof_transverse_seam',(x,0,3.723),(.012,2.18,.009),'edge','body',.002,2)
for y in [-1.08,1.08]:box('roof_longitudinal_seam',(-1.05,y,3.718),(6.0,.014,.012),'edge','body',.004)
hood=prism('sculpted_bonnet',[(2.0,.58),(4.05,.58),(4.05,1.88),(3.87,2.06),(2.42,2.24),(2.0,2.12)],-1.06,1.06,'yellow','bonnet',.13,5)
cut(hood,raw_cyl('front_arch',(3.02,0,.65),.8,3.0),'black')
for side,sn in SIDES:
 # yellow fender flared outboard, true hollow arch
 f=box('front_fender_'+sn,(3.04,side*1.13,1.16),(2.08,.45,1.16),'yellow','bonnet',.16,5)
 cut(f,raw_cyl('fender_cut',(3.02,side*1.13,.65),.79,.9),'black')
 outer=arc(-2.65,.65,.86,0,PI,28);inner=arc(-2.65,.65,.78,PI,0,28)
 plate('rear_arch_lip_'+sn,outer+inner,side,.065,'black','body',bevel=.022)
 outer=arc(3.02,.65,.84,0,PI,28);inner=arc(3.02,.65,.78,PI,0,28)
 plate('front_arch_lip_'+sn,outer+inner,side,.04,'black','body',y_skin=1.356,bevel=.018)
 for j,(a,b,z,h) in enumerate([(-4.12,.94,1.98,.16),(-4.12,-3.52,1.21,.15),(-1.78,.94,1.21,.19),(-4.13,-3.51,.57,.12),(-1.8,.97,.57,.12)]):
  box('rub_rail_%s_%s'%(sn,j),((a+b)/2,side*1.326,z),(b-a,.065,h),'black','body',.021)
 windows=[(-4.04,-3.6),(-3.45,-2.5),(-2.35,-1.4),(-1.25,-.3),(-.15,.8)]
 for i,(a,b) in enumerate(windows):
  # real shallow recesses in yellow skin
  cut(body,raw_box('window_recess',((a+b)/2,side*1.3,2.58),(b-a+.07,.12,1.06)))
  plate('window_%s_%d'%(sn,i),rrect(a-.035 if DISTANCE else a,2.05 if DISTANCE else 2.08,b+.035 if DISTANCE else b,3.11 if DISTANCE else 3.09,.055),side,.012,'glass','body',y_skin=1.255)
  frame('window_gasket_%s_%d'%(sn,i),a,2.08,b,3.09,side,'black','body',bar=.035,r=.055,depth=.035,y_skin=1.28)
  plate('window_reflection_%s_%d'%(sn,i),[(a+.045,2.72),(b-.04,3.04),(b-.04,2.85),(a+.045,2.53)],side,.002,'reflection','body',y_skin=1.277,bevel=0)
 text('school_bus_lettering_'+sn,'SCHOOL BUS',.65,(-2.13,side*1.341,1.63),'-y' if side<0 else '+y','black','body',stretch=1.2)
 for x in [-4.12,-3.51,-2.42,-1.32,-.23,.91]:
  for z in [1.08,1.89,3.16]:cylinder('panel_rivet',(x,side*1.316,z),.018,.014,'y','edge','body',segs=12)
 for x in [-3.8,-.8]:
  box('lower_panel_seam',(x,side*1.307,.86),(.012,.008,.42),'edge','body',.002)
 # narrow full-height folding two-panel door (mirrored hidden side)
 group('door_'+sn,(1.02,side*1.3,.57),parent='body')
 for i,(a,b) in enumerate([(1.02,1.51),(1.54,2.02)]):
  leaf='door_'+sn+'_'+str(i)
  group(leaf,(a,side*1.326,.57),parent='door_'+sn)
  box('door_leaf_%s_%d'%(sn,i),((a+b)/2,side*1.326,1.83),(b-a,.055,2.53),'yellow',leaf,.026)
  for j,(z0,z1) in enumerate([(.7,1.82),(2.02,3.02)]):
   plate('door_glass_%s_%d_%d'%(sn,i,j),rrect(a+.055,z0,b-.055,z1,.04),side,.025,'glass',leaf,y_skin=1.36)
   frame('door_gasket_%s_%d_%d'%(sn,i,j),a+.055,z0,b-.055,z1,side,'black',leaf,bar=.025,r=.04,y_skin=1.365,depth=.02)
 box('door_center_seal_'+sn,(1.525,side*1.365,1.83),(.024,.035,2.53),'black','door_'+sn+'_1',.008)
 box('entry_step_'+sn,(1.53,side*1.34,.53),(1.1,.18,.1),'black','body',.025)
 box('door_handle_'+sn,(2.06,side*1.365,1.94),(.12,.07,.13),'black','door_'+sn+'_1',.026)
 # markers and mirror with upper and lower brackets
 for x,z in [(-3.15,3.34),(.7,3.34),(-4.06,.93),(2.06,1.97)]:
  box('side_marker_base',(x,side*1.337,z),(.23,.055,.12),'edge','body',.025)
  box('side_red_marker',(x,side*1.372,z),(.18,.025,.083),'lamp','body',.018)
 for z in [2.16,2.95]:
  box('mirror_outrigger_'+sn,(2.18,side*1.47,z),(.06,.42,.06),'black','body',.025)
 box('mirror_vertical_arm_'+sn,(2.18,side*1.67,2.55),(.055,.055,.83),'black','body',.02)
 box('mirror_case_'+sn,(2.21,side*1.67,2.58),(.13,.26,.61),'black','body',.045)
 box('mirror_glass_'+sn,(2.133,side*1.67,2.58),(.015,.21,.53),'glass','body',.006)
 box('hood_side_latch_'+sn,(3.16,side*1.373,1.79),(.11,.04,.13),'black','bonnet',.025)
 box('hood_indicator_'+sn,(3.67,side*1.374,1.79),(.23,.04,.12),'amber','bonnet',.025)
box('near_rear_vertical_lamp',(-4.12,-1.355,.99),(.1,.07,.34),'lamp','body',.025)
# Warning lamps above windshield at front and rear
for x,label in [(2.13,'front'),(-4.24,'rear')]:
 for side,sn in SIDES:
  box(label+'_warning_mount_'+sn,(x,side*.98,3.37),(.07,.56,.49),'black','body',.08,4)
  for dy in [-.14,.14]:
   cylinder(label+'_warning_rim',(x+(.046 if x>0 else -.046),side*.98+dy,3.38),.13,.045,'x','black','body',segs=32,bevel=.012)
   lathe(label+'_red_lens',[(.0001,0),(.1,0),(.119,.035),(.09,.063),(.0001,.07)],(x+(.072 if x>0 else -.072),side*.98+dy,3.38),'x' if x>0 else '-x','lamp','body',segs=32)
 box(label+'_header_center_panel',(x,0,3.39),(.027,1.27,.44),'yellow','body',.025)
 box(label+'_header_marker',(x+(.03 if x>0 else -.03),0,3.55),(.035,.23,.105),'lamp','body',.02)
# windshield frames front face, shallow inset into body
for i,y in enumerate([-.65,.65]):
 box('windshield_surround_'+str(i),(2.118,y,2.64),(.064,1.13,1.04),'black','body',.045)
 box('windshield_'+str(i),(2.155,y,2.64),(.025,1.03,.94),'glass','body',.027)
 box('wiper_blade_'+str(i),(2.178,y,2.24),(.026,.72,.025),'black','body',.009,rot=(.13,0,0))
 box('wiper_arm_'+str(i),(2.182,y+.13,2.27),(.025,.35,.018),'rim','body',.007,rot=(-.43,0,0))
# grille and front headlamps
box('grille_yellow_frame',(4.074,0,1.36),(.06,1.48,1.0),'edge','bonnet',.055)
box('grille_recess',(4.112,0,1.36),(.03,1.35,.88),'black','bonnet',.033)
for k in range(7):box('grille_horizontal_bar_'+str(k),(4.137,0,.99+k*.123),(.028,1.3,.035),'rim','bonnet',.009)
for y in [-1.04,1.04]:
 box('headlamp_bezel',(4.072,y,1.16),(.085,.43,.58),'yellow','bonnet',.06)
 box('headlamp_gasket',(4.122,y,1.17),(.018,.33,.43),'edge','bonnet',.035)
 box('headlamp_lens',(4.14,y,1.17),(.025,.275,.37),'head','bonnet',.033)
box('nose_clearance_lamp',(4.09,0,1.95),(.035,.21,.105),'amber','bonnet',.025)
box('front_bumper',(4.15,0,.62),(.31,2.82,.43),'black','chassis',.065)
box('front_license_plate',(4.315,0,.63),(.014,.5,.27),'plate','chassis',.016)
for y in [-.73,.73]:box('bumper_recess',(4.314,y,.64),(.018,.15,.22),'rubber','chassis',.01)
box('rear_bumper',(-4.3,0,.62),(.26,2.76,.33),'black','chassis',.045)
# Hinged rear emergency door completes hidden end.
group('doorRear',(-4.24,-.62,.64),parent='body')
box('rear_emergency_door',(-4.219,0,1.95),(.03,1.23,2.63),'edge','doorRear',.028)
box('rear_door_panel',(-4.245,0,1.95),(.015,1.18,2.57),'yellow','doorRear',.02)
box('rear_window_gasket',(-4.26,0,2.64),(.035,1.04,.89),'black','doorRear',.045)
box('rear_window',(-4.281,0,2.64),(.018,.96,.81),'glass','doorRear',.03)
text('rear_town','SUNSET GROVE',.13,(-4.288,0,1.42),'-x','black','body')
text('front_plate_text','SG 218',.11,(4.329,0,.63),'+x','black','chassis')
text('rear_school_bus','SCHOOL BUS',.23,(-4.276,0,3.38),'-x','black','body')
box('emergency_handle',(-4.28,.38,1.75),(.06,.22,.045),'black','doorRear',.013)
for y in [-1.1,1.1]:
 for z in [.94,1.27]:cylinder('rear_tail_lamp',(-4.25,y,z),.12,.045,'x','lamp','body',segs=32,bevel=.015)
# Final comparison pass: raised bonnet joint, bumper fasteners and door hinge caps.
for side,sn in SIDES:
    box('bonnet_panel_joint_'+sn,(2.39,side*1.071,1.99),(.014,.011,.29),'edge','bonnet',.002)
    box('fender_latch_'+sn,(3.55,side*1.375,1.3),(.11,.045,.16),'black','bonnet',.018)
    for z in [.66,1.92,3.08]:
        cylinder('door_hinge_'+sn,(1.0,side*1.378,z),.022,.025,'y','rim','door_'+sn+'_0',segs=12)
for y in [-1.22,-.92,.92,1.22]:
    cylinder('bumper_bolt',(4.317,y,.69),.018,.009,'x','rim','chassis',segs=12)
# detailed tyres and inset dark steel rims with recessed ventilation holes
for ax,label in [(-2.65,'rear'),(3.02,'front')]:
 for side,sn in SIDES:
  g=('wheelF' if label=='front' else 'wheelR')+('L' if side>0 else 'R');c=(ax,side*1.16,.65);group(g,c,parent='chassis');axis='-y' if side<0 else 'y'
  lathe(g+'_tyre',[(.36,-.23),(.5,-.24),(.59,-.21),(.64,-.14),(.65,-.07),(.65,.07),(.64,.14),(.59,.21),(.5,.24),(.36,.23)],c,axis,'rubber',g,segs=48)
  for r in [.49,.57]:lathe(g+'_sidewall_ring',[(r,.239),(r+.012,.243),(r+.018,.236)],c,axis,'rubber',g,segs=48)
  lathe(g+'_steel_rim',[(.0001,.15),(.24,.15),(.31,.19),(.37,.235),(.4,.232),(.41,.21),(.4,.16),(.36,.13)],c,axis,'rim',g,segs=48)
  for k in range(8):
   t=k*2*PI/8
   cylinder(g+'_vent',(ax+.292*math.cos(t),side*1.364,.65+.292*math.sin(t)),.048,.013,'y','black',g,segs=20)
   cylinder(g+'_lug',(ax+.18*math.cos(t),side*1.398,.65+.18*math.sin(t)),.027,.022,'y','rim',g,segs=6,bevel=.004)
  lathe(g+'_hub',[(.0001,.245),(.11,.245),(.135,.222),(.135,.18),(.0001,.18)],c,axis,'rim',g,segs=32)
  for k in range(48):
   t=k*2*PI/48
   box(g+'_tread',(ax+.646*math.cos(t),side*1.16,.65+.646*math.sin(t)),(.017,.32,.010),'rubber',g,.004,1,rot=(0,PI/2-t,0))
# near-side stop paddle with nested octagonal plates and lettering
sx,sz=.3,1.45;group('stop_paddle',(.86,-1.4,sz),parent='body')
def octagon(r):return [(sx+r*math.cos(PI/8+k*PI/4),sz+r*math.sin(PI/8+k*PI/4)) for k in range(8)]
box('stop_hinge',(.86,-1.4,1.46),(.16,.13,.29),'black','stop_paddle',.035)
plate('stop_black_back',octagon(.57),-1,.075,'black','stop_paddle',y_skin=1.36,bevel=.012)
plate('stop_white_border',octagon(.535),-1,.018,'white','stop_paddle',y_skin=1.443,bevel=.007)
plate('stop_red_face',octagon(.494),-1,.012,'stop','stop_paddle',y_skin=1.466,bevel=.007)
text('STOP_lettering','STOP',.57,(sx,-1.489,sz),'-y','white','stop_paddle',font='/System/Library/Fonts/Supplemental/Impact.ttf',stretch=1.0,depth=.008)
for z in [sz-.41,sz+.41]:cylinder('stop_bolt',(sx,-1.489,z),.015,.01,'y','rim','stop_paddle',segs=12)
cylinder('rear_side_reflector',(-3.87,-1.343,1.65),.135,.04,'y','lamp','body',segs=32,bevel=.015)

# =========================================================================== STAGE (render only)
def stage(view):
    world = bpy.data.worlds.new('studio')
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    env = nt.nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(str(Path(bpy.utils.resource_path('LOCAL')) / 'datafiles/studiolights/world/studio.exr'))
    bg = nt.nodes['Background']
    bg.inputs['Strength'].default_value = 0.18
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
    light('key', 'AREA', (8, -9, 10), 1300, 7, (1.0, 0.93, 0.84))
    light('fill', 'AREA', (-9, -6, 5), 650, 8, (0.8, 0.88, 1.0))
    light('rim', 'AREA', (-4, 9, 8), 1100, 6, (1.0, 0.85, 0.75))

    ground = bpy.data.objects.new('ground', bpy.data.meshes.new('ground'))
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40)
    bm.to_mesh(ground.data)
    bm.free()
    STAGE.objects.link(ground)
    ground.data.materials.append(material('studio_ground', '#dedede', .82))

    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    STAGE.objects.link(cam)
    scene.camera = cam
    cam.data.lens = 50
    views = {
        'ref': ((8.5, -14.2, 6.25), (0, 0, 1.9), 48),
        'game': ((10, -10, 12), (0, 0, 1.85), 45),
        'front': ((13, -3.5, 3.2), (0.6, 0, 1.4), 50),
        'side': ((0.0, -15.5, 2.0), (0.0, 0, 1.6), 45),
        'rear': ((-11, -7, 4.5), (-0.5, 0, 1.4), 45),
        'far': ((5, 13, 4.0), (0.2, 0, 1.45), 45),
        'top': ((6, -9, 11), (0, 0, 1.4), 45),
    }
    loc, tgt, lens = views[view]
    cam.location = loc
    cam.data.lens = lens
    if view in ('ref', 'game'):
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = 11.5 if view == 'ref' else 14.0
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
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.exposure = -0.35
    scene.view_settings.look = 'None'
    scene.render.resolution_x = int(arg('--width', 1837))
    scene.render.resolution_y = int(arg('--height', 856))


# Apply and batch geometry per articulated assembly and material. Preserve joint origins.
def batch():
    for obj in list(TRUCK.objects):
        if obj.type != 'MESH':
            continue
        bpy.context.view_layer.objects.active = obj
        for mod in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
        if len(obj.data.materials) > 1:
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.mesh.separate(type='MATERIAL')
            bpy.ops.object.mode_set(mode='OBJECT')
    buckets = {}
    animated = {'wheelFL','wheelFR','wheelRL','wheelRR','door_near_0','door_near_1','door_far_0','door_far_1','doorRear','stop_paddle'}
    # Lamp faces are separate controllable meshes; keep their center as pivot.
    for obj in list(TRUCK.objects):
        if obj.type != 'MESH':
            continue
        if obj.data.materials[0].name.startswith('emi_'):
            obj['decorativeEmissive'] = True
        if obj.name.startswith('headlamp_lens'):
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)
            bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
            continue
        parent = obj.parent
        assembly = parent.name if parent and parent.name in animated else 'body'
        if '_red_lens' in obj.name:
            assembly = ('warningFront' if obj.location.x > 0 else 'warningRear') + ('L' if obj.location.y < 0 else 'R')
            if assembly not in GROUPS: group(assembly,(obj.location.x, -.98 if obj.location.y < 0 else .98,3.38),parent='veh.school-bus')
        if obj.name.startswith('rear_tail_lamp'):
            side = 'L' if obj.location.y < 0 else 'R'
            assembly = 'brakeLamp'+side
            if assembly not in GROUPS: group(assembly,(-4.25,obj.location.y,1.1),parent='veh.school-bus')
        buckets.setdefault((assembly,obj.data.materials[0].name),[]).append(obj)
    for (assembly,mat),obs in buckets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in obs:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = obs[0]
        if len(obs) > 1:
            bpy.ops.object.join()
        obj = bpy.context.object
        obj.name = assembly + ':' + mat
        world = obj.matrix_world.copy()
        obj.parent = GROUPS[assembly]
        obj.matrix_world = world
        # Set mesh origin at the assembly joint without moving its vertices.
        pivot = GROUPS[assembly].matrix_world.translation
        scene.cursor.location = pivot
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    for obj in TRUCK.objects:
        if obj.type == 'MESH':
            # Remove zero-area triangles left by the exact wheel-arch booleans.
            bm=bmesh.new()
            bm.from_mesh(obj.data)
            bmesh.ops.triangulate(bm,faces=list(bm.faces))
            bad=[f for f in bm.faces if f.calc_area()<1e-10]
            if bad:bmesh.ops.delete(bm,geom=bad,context='FACES')
            bm.to_mesh(obj.data)
            bm.free()
            # AO is baked to this channel on export, without UVs or image textures.
            ao = obj.data.color_attributes.new(name='ao', type='BYTE_COLOR', domain='CORNER')
            for c in ao.data:
                c.color = (1,1,1,1)

if DISTANCE:
    front = group('lightsFront', parent='veh.school-bus')
    brake = group('lightsBrake', parent='veh.school-bus')
    for obj in list(TRUCK.objects):
        if obj.type != 'MESH': continue
        target = front if obj.name.startswith('headlamp_lens') else brake if obj.name.startswith('rear_tail_lamp') else None
        if target:
            world = obj.matrix_world.copy(); obj.parent = target; obj.matrix_world = world
    for sn, side in [('near', -1), ('far', 1)]:
        box('door_black_edge_'+sn, (1.045, side*1.365, 1.83), (.025,.02,2.53), 'rim', 'door_'+sn+'_0', 0)

if DISTANCE:
    export_variant(Path(__file__).parent, DISTANCE, omit=('window_gasket', 'lettering', 'rear_school_bus', 'tread', 'lug', 'rivet', 'bolt', 'seat', 'steering', 'sidewall', 'rim lip'), far_omit=('window_recess', 'mirror_arm', 'roof_transverse_seam', 'header_marker', 'rear_side_reflector', 'front_fender', 'rub_rail', 'arch_lip', 'window_reflection', 'warning_bezel', 'lens_ring', 'window_frame', 'window_rubber', 'lens_rib', 'lamp_ring', 'side_red_marker', 'side_amber_marker', 'wiper', 'handle', 'seam', 'badge', 'text', 'letter', 'logo', 'stripe', 'rib', 'hub', 'rim', 'gasket', 'dashboard', 'headrest', 'axle', 'differential', 'grille bar', 'vent', 'hinge', 'clamp', 'spoke'), flat_parts=('*rim*', '*red_lens', 'rear_tail_lamp'))

batch()
root = GROUPS['veh.school-bus']
root['ss_physics'] = {'class':'heavy','mass':6500,'friction':.8,'restitution':.05,
                     'centerOfMass':[0,1.3,0],'pushable':False,'kickable':False,
                     'flammable':True,'burnTime':45,'sounds':'vehicle.bus'}
for name,loc in [('driverSeat',(1.55,.65,1.65)),('exitL',(1.5,1.65,.4)),('exitR',(1.5,-1.65,.4))]:
    group(name,loc,parent='veh.school-bus')
for name,loc,size in [('body',(-1.05,0,2.05),(6.3,2.6,2.95)),('hood',(3.1,0,1.25),(2.1,2.4,1.3))]:
    o=group('col:'+name,loc,parent='veh.school-bus')
    o['collider']='cuboid';o['shape']='cuboid';o['size']=list(size)
front=group('lightsFront',parent='veh.school-bus')
brake=group('lightsBrake',parent='veh.school-bus')
for obj in list(TRUCK.objects):
    if obj.type != 'MESH': continue
    kind = 'headlight' if obj.name.startswith('headlamp_lens') else 'brake' if obj.name.startswith('brakeLamp') else None
    if kind:
        world=obj.matrix_world.copy();obj.parent=front if kind=='headlight' else brake;obj.matrix_world=world
        anchor=group('light:'+obj.name,world.translation,parent='veh.school-bus')
        anchor.rotation_euler=Vector((1,0,-.16) if kind=='headlight' else (-1,0,0)).to_track_quat('-Z','Y').to_euler()
        anchor['ss_light']={'type':'spot' if kind=='headlight' else 'point','color':'light_led_white' if kind=='headlight' else 'light_siren_red',
          'intensity':5 if kind=='headlight' else 1,'range':18 if kind=='headlight' else 2,'angle':50,'penumbra':.4,
          'pool':True,'beam':'soft' if kind=='headlight' else 'none','flare':True,'reflect':True,'shadow':'hero' if kind=='headlight' else 'none',
          'heroPriority':1,'flicker':'none','animation':None,'powerGroup':'self','breakable':True,'emissiveNodes':[obj.name],'tiers':'all'}

bpy.context.view_layer.update()
meshes=[o for o in TRUCK.objects if o.type=='MESH']
tris=sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in meshes)
calls=sum(len(o.data.materials) for o in meshes)
print(f'BUILD OK: {len(meshes)} meshes, {tris} triangles, {calls} draw calls')
if arg('--glb'):
    lod=int(arg('--lod',0))
    if lod:
        for o in meshes:
            bpy.context.view_layer.objects.active=o
            mod=o.modifiers.new('LOD reduction','DECIMATE')
            mod.ratio=.14 if lod==1 else .045
            bpy.ops.object.modifier_apply(modifier=mod.name)
        print('LOD OK',lod,sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in meshes))
    scene.render.engine='CYCLES'
    scene.cycles.samples=32
    scene.cycles.seed=0
    scene.render.bake.target='VERTEX_COLORS'
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
        o.data.color_attributes.active_color_index=list(o.data.color_attributes).index(o.data.color_attributes['ao'])
        o.data.color_attributes.render_color_index=o.data.color_attributes.active_color_index
    bpy.context.view_layer.objects.active=meshes[0]
    bpy.ops.object.bake(type='AO',target='VERTEX_COLORS',use_clear=True)
    print('AO OK: deterministic 32-sample vertex bake',[(o.name,[a.name for a in o.data.color_attributes]) for o in meshes[:1]])
    bpy.ops.object.select_all(action='DESELECT')
    for o in TRUCK.objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(arg('--glb')).resolve()),export_format='GLB',use_selection=True,
      export_apply=True,export_yup=True,export_lights=False,export_cameras=False,export_extras=True)
    print('GLB OK',arg('--glb'))
if arg('--render'):
    stage(arg('--view','ref'))
    scene.render.filepath=str(Path(arg('--render')).resolve())
    bpy.ops.render.render(write_still=True)
    print('RENDER OK',arg('--render'))

# Every full source export refreshes the native distance tiers.
if "--glb" in sys.argv and not DISTANCE:
    build_native_lods(__file__)
