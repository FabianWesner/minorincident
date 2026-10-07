"""Reference measurements (1024x1536 image): cabinet spans px170..907, z-image 704..1200;
wheels diameter ~220 px; mast from image y810 to y285; lamp heads y70..310.
Model: 1.95m cabinet length, 1.1m width, 1.12m tall; wheels diameter .65m;
mast at front X=.70 rises to 3.18m; lamp assembly tops at 3.95m.
+X front, -Y visible service side, +Z up. Four wheels, no towing tongue in reference.
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
TRUCK = bpy.data.collections.new('LightTower')
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



# Asset-specific materials and geometry
M.update({
'yellow':material('safety_yellow_enamel','#ffb000',.32,.08,.55),
'yellow_dark':material('yellow_edge','#b87a08',.38,.25),
'gun':material('gunmetal','#383a3d',.34,.65),
'bronze':material('warm_cast_aluminium','#a78e76',.3,.65),
'lens':material('warm_floodlight','#fff4ca',.18,.1,emit='#ffcf62',strength=5),
'led':material('LED_emitters','#fffbdc',.15,emit='#fff2b4',strength=9),
})
W=.55
group('generator');group('chassis');group('mast');group('floodlights')
def rod(name,a,b,r,mat,parent=None):
    a,b=Vector(a),Vector(b)
    o=cylinder(name,(a+b)/2,r,(b-a).length,'z',mat,parent,segs=16,bevel=.005)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return o

def bolt(name,p,axis='y',mat='bronze',r=.015,parent=None):
    return cylinder(name,p,r,.013,axis,mat,parent,segs=6,bevel=.002)
# steel running frame and bumpers
box('frame_rails',(0,0,.43),(2.18,1.22,.15),'gun','chassis',.025)
for x in (-1.08,1.08):
    box('bumper',(x,0,.43),(.16,1.44,.16),'gun','chassis',.025)
    for s in (-1,1):
        box('bumper_corner_cap',(x,s*.66,.44),(.20,.15,.21),'bronze','chassis',.025)
        bolt('bumper_bolt',(x+.11,s*.66,.44),'x')
# cabinet silhouette softened angled upper corners
outline=[(-.99,.53),(.99,.53),(.99,1.58),(.88,1.72),(-.87,1.72),(-.99,1.60)]
prism('cabinet',outline,-.55,.55,'yellow','generator',.045,4)
# roof with seam, raised stamped strips
box('lid_seam',(0,0,1.686),(1.84,1.10,.017),'yellow_dark','generator',.007)
top=box('top_lid',(0,0,1.715),(1.82,1.08,.045),'yellow','generator',.024)
for y in (-.37,.37):
    box('roof_pressed_rib',(-.02,y,1.746),(1.47,.035,.025),'yellow','generator',.013)
for x in (-.9,.9):
    for s in (-1,1):
        box('corner_upright',(x,s*.561,1.09),(.19,.028,1.03),'yellow','generator',.02)
        for z in (.69,1.53): bolt('panel_fastener',(x,s*.582,z),r=.023)
# side service panels mirrored, true ventilation cut-outs
for s in (-1,1):
    y=s*.566
    group('service_door_'+str(s),(-.63,y,1.1))
    box('door_reveal',(-.22,y,1.065),(1.12,.012,.88),'yellow_dark','generator',.009)
    door=box('service_panel',(-.22,y+s*.012,1.065),(1.10,.025,.86),'yellow','service_door_'+str(s),.014)
    cut(door,raw_box('vent_cut',(-.40,y,1.24),(.55,.14,.37)))
    box('vent_dark_recess',(-.40,y-s*.022,1.24),(.56,.015,.39),'black','generator',.015)
    frame('vent_rim',-.68,1.035,-.12,1.435,s,'gun','generator',bar=.024,r=.015,depth=.026,y_skin=.58)
    for k in range(7):
        box('angled_louvre',(-.40,s*.603,1.072+k*.05),(.54,.035,.023),'gun','generator',.007,rot=(.25*s,0,0))
    for xx in (-.697,-.10):
        for zz in (1.025,1.445): bolt('vent_screw',(xx,s*.618,zz),r=.009)
    box('recessed_lift_handle',(-.43,s*.603,.79),(.23,.035,.075),'yellow_dark','generator',.015)
    box('lift_handle',(-.43,s*.63,.81),(.21,.045,.045),'yellow','generator',.012)
    for zz in (.73,1.41):
        box('hinge',(-.77,s*.602,zz),(.024,.022,.09),'bronze','generator',.004)
    # narrow control module toward front
    box('control_recess',(.53,s*.587,1.05),(.25,.027,.59),'gun','generator',.025)
    frame('control_frame',.418,.76,.64,1.34,s,'bronze','generator',bar=.018,r=.015,depth=.019,y_skin=.601)
    box('switch_face',(.53,s*.62,1.24),(.16,.017,.13),'black','generator',.018)
    cylinder('rotary_switch',(.53,s*.65,1.24),.04,.04,'y','bronze','generator',24)
    box('orange_socket',(.53,s*.627,.95),(.12,.023,.24),'yellow_dark','generator',.012)
    for z in (.88,.92,.96,1.0):box('socket_ridge',(.53,s*.649,z),(.09,.018,.012),'yellow','generator',.004)
    for xx in (.425,.63):
        for zz in (.78,1.325):bolt('control_screw',(xx,s*.642,zz),r=.008)
# front mast mount protective plate and vents
box('front_mast_plate',(1.02,0,1.1),(.12,.38,1.06),'gun','mast',.025)
for k in range(5):
    box('front_vent_slot',(1.09,0,.84+k*.051),(.015,.22,.025),'black','mast',.006)
    box('front_vent_lip',(1.103,0,.856+k*.051),(.023,.23,.012),'alu_dark','mast',.004)
for z in (1.13,1.23):
    rod('mount_handle',(1.13,-.09,z),(1.13,.09,z),.021,'alu','mast')
    for y in (-.09,.09):bolt('mount_screw',(1.13,y,z),'x',r=.017)
for y in (-.47,.47):
    box('front_corner_panel',(1.014,y,1.09),(.028,.14,1.01),'yellow','generator',.015)
    for z in (.75,1.4):cylinder('front_lock',(1.049,y,z),.036,.03,'x','gun','generator',24)
# shallow pressed roof recesses with softened edges
for yy in (-.20,.20):
    cut(top,raw_box('pressed_top_cut',(.04,yy,1.76),(1.15,.29,.055)))
    box('pressed_top_inset',(.04,yy,1.733),(1.13,.27,.009),'yellow','generator',.015)
# fuel filler and tubular carrying handle on rear roof
cylinder('filler_base',(-.50,0,1.755),.14,.034,'z','gun','generator')
cylinder('fuel_cap',(-.50,0,1.79),.105,.05,'z','black','generator',32,bevel=.007)
for k in range(16):
    t=k*2*PI/16
    box('cap_grip',(-.5+.102*math.cos(t),.102*math.sin(t),1.795),(.017,.017,.042),'black','generator',.004)
cu=bpy.data.curves.new('carry_handle_tube','CURVE');cu.dimensions='3D';cu.bevel_depth=.042;cu.bevel_resolution=3;cu.resolution_u=10
sp=cu.splines.new('BEZIER');sp.bezier_points.add(5)
for bp,co in zip(sp.bezier_points,[(-.78,-.43,1.73),(-.69,-.36,1.93),(-.67,-.29,1.96),(-.67,.29,1.96),(-.69,.36,1.93),(-.78,.43,1.73)]):
    bp.co=co;bp.handle_left_type='AUTO';bp.handle_right_type='AUTO'
o=bpy.data.objects.new('rounded_carry_handle',cu);TRUCK.objects.link(o);o.data.materials.append(M['yellow'])
bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o=bpy.context.object;o.select_set(False);o.parent=GROUPS['generator']
# four articulated chunky wheels
for x in (-.72,.72):
    cylinder('axle',(x,0,.325),.055,1.35,'y','gun','chassis')
    for s in (-1,1):
        y=s*.65; g='wheel_'+str(x)+'_'+str(s);group(g,(x,y,.325))
        lathe('tyre',[(.13,-.115),(.24,-.115),(.29,-.09),(.316,-.055),(.325,0),(.316,.065),(.29,.108),(.24,.12),(.13,.12)],(x,y,.325),'y','rubber',g,48)
        for k in range(32):
            t=k*2*PI/32
            for row in (-1,1):
                a=t+row*.035
                o=box('tyre_tread',(x+.321*math.sin(a),y+row*.059,.325+.321*math.cos(a)),(.047,.096,.025),'rubber',g,.007,2,rot=(0,a, row*.16))
        lathe('rim',[(.065,-.02),(.13,-.024),(.172,.014),(.187,.025),(.187,.04),(.171,.04),(.127,.0),(.065,.0)],(x,y+s*.118,.325),'y','bronze',g,48)
        lathe('rim_lip',[(.170,-.01),(.188,-.01),(.194,0),(.187,.014),(.172,.014)],(x,y+s*.136,.325),'y','alu',g,48)
        cylinder('rim_dish',(x,y+s*.129,.325),.132,.019,'y','alu_dark',g,40,bevel=.008)
        cylinder('hub',(x,y+s*.159,.325),.061,.047,'y','gun',g,32,bevel=.006)
        for k in range(6):
            t=k*2*PI/6
            bolt('wheel_lug',(x+.108*math.sin(t),y+s*.156,.325+.108*math.cos(t)),r=.013,parent=g)
        if x<0:
            pts=[(x-.38,.39),(x-.30,.68),(x-.20,.73),(x+.22,.73),(x+.36,.55),(x+.37,.41),(x+.29,.42),(x+.22,.62),(x-.19,.63),(x-.28,.39)]
            prism('wheel_fender',pts,s*.53,s*.83,'gun','chassis',.017)
# telescopic mast, collars and fixing pins
for name,z,r,d in [('outer',1.98,.094,.61),('middle',2.65,.067,.80),('inner',3.13,.046,.22)]:
    cylinder('mast_'+name,(.75,0,z),r,d,'z','alu','mast',48,bevel=.005)
for z,r in [(1.73,.113),(2.29,.101),(3.19,.077)]:
    cylinder('mast_collar',(.75,0,z),r,.11,'z','bronze','mast',32,bevel=.006)
    bolt('mast_set_screw',(.75,-r-.012,z),r=.02)
rod('mast_aux_rail',(.75,.095,2.28),(.75,.095,3.2),.017,'bronze','mast')
box('mast_lock_bracket',(.75,-.10,2.76),(.10,.047,.15),'yellow_dark','mast',.012)
cylinder('mast_lock_knob',(.75,-.153,2.76),.052,.054,'y','bronze','mast',12,bevel=.007)
# two deep trapezoidal lamps, canted slightly upward
rod('head_crossbar',(.75,-.46,3.27),(.75,.46,3.27),.032,'gun','floodlights')
for i,y in enumerate((-.34,.34)):
    g='lamp_pivot_'+str(i);group(g,(.75,y,3.3))
    # lamps point +X: wide face in y/z, deep rear housing
    prism('tapered_lamp_shell',[(.42,3.37),(.55,3.28),(.86,3.28),(.86,3.9),(.49,3.86),(.42,3.77)],y-.258,y+.258,'bronze',g,.03,3)
    housing=box('floodlight_cast_housing',(.73,y,3.59),(.25,.57,.63),'bronze',g,.06,4)
    box('floodlight_rear',(.587,y,3.59),(.04,.44,.51),'gun',g,.028)
    for k in range(6):box('cooling_fin',(.557,y,3.39+k*.073),(.044,.44,.023),'alu_dark',g,.006)
    bezel=box('gold_bezel',(.875,y,3.59),(.075,.58,.64),'yellow_dark',g,.04,4)
    cut(bezel,raw_box('lens_opening',(.89,y,3.59),(.20,.46,.52)))
    box('inner_reflector_well',(.864,y,3.59),(.016,.46,.52),'bronze',g,.02)
    box('reflector',(.889,y,3.49 if i==0 else 3.59),(.012,.46,.30 if i==0 else .52),'lens',g,.024)
    for row in range(3 if i==0 else 5):
        for col in range(4):
            box('LED_cell',(.904,y+(col-1.5)*.104,(3.49+(row-1)*.095) if i==0 else (3.59+(row-2)*.095)),(.008,.084,.077),'led',g,.013,3)
    for yy in (-.245,.245):
        for zz in (-.27,.27):bolt('lamp_bezel_bolt',(.92,y+yy,3.59+zz),'x',r=.012,parent=g)
    for yy in (-.31,.31):
        rod('lamp_yoke',(.72,y+yy,3.28),(.72,y+yy,3.54),.023,'bronze',g)
        cylinder('lamp_pivot_bolt',(.72,y+yy,3.54),.033,.023,'y','gun',g,12)
# rear service cover, exhaust cooling grille, power outlets and lifting grip
box('rear_panel_seam',(-1.007,0,1.08),(.015,.91,.94),'yellow_dark','generator',.018)
rear=box('rear_access_cover',(-1.022,0,1.08),(.025,.88,.91),'yellow','generator',.018)
cut(rear,raw_box('rear_vent_opening',(-1.03,0,1.27),(.13,.57,.31)))
box('rear_vent_well',(-1.006,0,1.27),(.01,.57,.31),'black','generator',.012)
for k in range(6):box('rear_cooling_louvre',(-1.046,0,1.145+k*.047),(.025,.55,.018),'gun','generator',.006)
for yy in (-.38,.38):
    for zz in (.69,1.47):bolt('rear_cover_bolt',(-1.046,yy,zz),'x',r=.012)
rod('rear_lifting_grip',(-1.07,-.13,.96),(-1.07,.13,.96),.019,'gun','generator')
for yy in (-.21,.21):
    cylinder('rear_outlet',(-1.053,yy,.79),.051,.031,'x','gun','generator',24,bevel=.006)
    box('outlet_cap_latch',(-1.074,yy,.80),(.019,.054,.012),'black','generator',.004)
# comparison round 1: larger tyres and broad deep lamp housings
for name,e in GROUPS.items():
    if name.startswith('wheel_'):
        e.scale=(1.16,1.12,1.16)
        e.location.z=.377
    if name.startswith('lamp_pivot_'):
        e.scale=(1.35,1.18,1.1)
        e.rotation_euler.z=math.radians(-12 if name.endswith('0') else 40)
        e.rotation_euler.y=math.radians(-12)
# raise chassis / cabinet to match axle height (mast remains attached by same shift)
for o in TRUCK.objects:
    if o.parent is None and not o.name.startswith('wheel_'):
        o.location.z+=.052
# sheltered electrical cable following mast
rod('power_cable',(.69,.09,1.8),(.69,.09,3.25),.011,'black','mast')
def stage(view):
    world = bpy.data.worlds.new('studio')
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    env = nt.nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(str(Path(bpy.utils.resource_path('LOCAL')) / 'datafiles/studiolights/world/studio.exr'))
    bg = nt.nodes['Background']
    bg.inputs['Strength'].default_value = 0.35
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
    light('key', 'AREA', (5, 7, 9), 700, 5, (1.0, 0.93, 0.84))
    light('fill', 'AREA', (-6, 5, 6), 250, 6, (0.8, 0.88, 1.0))
    light('rim', 'AREA', (-4, -7, 8), 600, 4, (1.0, 0.85, 0.75))

    ground = bpy.data.objects.new('ground', bpy.data.meshes.new('ground'))
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40)
    bm.to_mesh(ground.data)
    bm.free()
    STAGE.objects.link(ground)
    ground.data.materials.append(material('studio_floor','#dedede',.85))
    ground.is_shadow_catcher = False

    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    STAGE.objects.link(cam)
    scene.camera = cam
    cam.data.lens = 50
    views = {
        'ref': ((8.5, 8, 5.4), (0, 0, 1.95), 48),
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
    cam.data.ortho_scale = 7.7
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
    scene.view_settings.view_transform = 'Khronos PBR Neutral'
    scene.view_settings.look = 'None'
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
