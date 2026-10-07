"""Reference measurement: 1536x1024 image. Front bumper (70,690), rear (1480,490),
front axle (620,750), rear axle (1260,600); wheel diameter about 240px.
Crown Victoria proportions: length 5.05m, width 1.87m, wheelbase 2.91m,
tyres .79m diameter, hood z1.03, belt z1.10, roof z1.65, lightbar z1.85.
White doors and roof, black hood/trunk/fenders; near side is -Y, nose +X.
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
W = 0.91                      # half width of the body skin
REAR_AXLE, FRONT_AXLE = -1.75, 2.89
WHEEL_R, ARCH_R = 0.5, 0.66
FONT = '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf'


def px(x_img):
    return -4.25 + (x_img - 105) / 1425 * 8.3


# --------------------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
TRUCK = bpy.data.collections.new('PoliceSedan')
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


def shutter(name, x0, x1, z0, z1, side, parent, y_skin=W, slat=0.072, mat='alu'):
    """Roller shutter: one rounded slat + array modifier (stays a single light mesh)."""
    n = max(2, round((z1 - z0) / slat))
    h = (z1 - z0) / n
    y = side * (y_skin + 0.012)
    o = box(name, ((x0 + x1) / 2, y, z0 + h / 2), (x1 - x0, 0.024, h * 0.94), mat, parent, bevel=h * 0.45, segs=3)
    arr = o.modifiers.new('slats', 'ARRAY')
    arr.use_relative_offset = False
    arr.use_constant_offset = True
    arr.constant_offset_displace = (0, 0, h)
    arr.count = n
    o.modifiers.move(len(o.modifiers) - 1, 0)
    return o


SIDES = [(-1, 'near'), (1, 'far')]

M['paint']=material('Obsidian enamel','#202227',.27,.08,.85)
M['white']=material('Ivory white enamel','#f1f1ef',.26,0,.85)
M['glass']=material('Smoked blue glass','#303945',.28,0,.35)
M['gold']=material('Badge gold','#d49b24',.3,.65)
M['badgeblue']=material('Badge blue','#173c73',.34,.15)
M['black']=material('Satin black','#17191b',.4)
M['head']=material('Headlight glass','#fff1be',.17,emit='#ffdf88',strength=2)
group('police_car')
group('body',parent='police_car')
def mesh(name, verts, faces, mat, parent='body',bevel=.01):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    return finish(bpy.data.objects.new(name,me),mat,parent,bevel=bevel)
def loft(name,sections,mat):
    # x, half-width, lower z, shoulder z, crown z
    verts=[]
    for x,w,lo,hi,top in sections:
        rw=.93 if mat=='white' else .78
        verts.extend([(x,-w*.92,lo),(x,-w,hi),(x,-w*rw,top),(x,w*rw,top),(x,w,hi),(x,w*.92,lo)])
    faces=[tuple(reversed(range(6))),tuple(range(len(verts)-6,len(verts)))]
    for j in range(len(sections)-1):
        for k in range(6): faces.append((j*6+k,j*6+(k+1)%6,(j+1)*6+(k+1)%6,(j+1)*6+k))
    return mesh(name,verts,faces,mat,bevel=.045)
body=loft('sculpted_body', [(-2.48,.83,.35,.86,.96),(-2.25,.93,.34,1.02,1.07),(-1.5,.94,.32,1.05,1.11),(-.7,.93,.32,1.06,1.12),(.9,.93,.32,1.04,1.10),(1.7,.92,.34,.98,1.04),(2.38,.87,.36,.86,.94),(2.48,.80,.40,.82,.89)],'paint')
for ax in [-1.47,1.44]: cut(body,raw_cyl('wheel_arch',(ax,0,.397),.46,2.4),'black')
box('undercarriage',(0,0,.31),(4.5,1.5,.16),'black','body',.04)
# cabin has a tapered roof, unlike an extruded box
loft('white_cabin',[(-1.46,.88,1.02,1.08,1.10),(-.95,.77,1.05,1.48,1.60),(-.64,.75,1.06,1.58,1.67),(.52,.75,1.06,1.57,1.65),(1.22,.87,1.02,1.09,1.12)],'white')
def surf(name,vs,mat,par='body'):
    o=mesh(name,vs,[tuple(range(len(vs)))],mat,par,0)
    sol=o.modifiers.new('panel thickness','SOLIDIFY'); sol.thickness=.008
    return o
for side,sn in SIDES:
    sy=lambda y:side*y
    # glazing quadrilaterals taper inward as they rise
    surf('front_window_'+sn,[(.13,sy(.886),1.115),(1.10,sy(.868),1.115),(.49,sy(.766),1.575),(.13,sy(.763),1.586)],'glass')
    surf('rear_window_'+sn,[(-1.28,sy(.866),1.12),(.04,sy(.886),1.115),(.04,sy(.763),1.587),(-.73,sy(.777),1.575)],'glass')
    box('B_pillar_'+sn,(.085,sy(.802),1.35),(.055,.03,.50),'black','body',.007,rot=(side*.20,0,0))
    for i,(xa,xb) in enumerate([(-1.23,.07),(.10,1.17)]):
        g='door_'+str(i)+'_'+sn; group(g,(xb,sy(.92),.95),parent='body')
        plate('white_door_'+str(i)+'_'+sn,[(xa,.43),(xb,.43),(xb,1.09),(xa,1.09)],side,.018,'white',g,y_skin=.935,bevel=.02)
        box('handle_'+g,(xa+.17,sy(.964),1.00),(.21,.037,.06),'black',g,.02)
        box('sill_'+g,((xa+xb)/2,sy(.95),.39),(xb-xa,.025,.06),'black',g,.01)
    text('police_livery_'+sn,'POLICE',.52,(-.24,sy(.965),.76),'-y' if side<0 else '+y','black','body',font='/System/Library/Fonts/Supplemental/Impact.ttf',stretch=1.02)
    # shield and central star on front door, forward of lettering
    bx,bz=.85,.77
    shield=[(bx+.16*u,bz+.22*v) for u,v in [(0,1),(.35,.75),(.8,.67),(1,.4),(.76,-.55),(0,-1),(-.76,-.55),(-1,.4),(-.8,.67),(-.35,.75)]]
    plate('gold_badge_'+sn,shield,side,.012,'gold','body',y_skin=.96)
    cylinder('badge_medallion_'+sn,(bx,sy(.981),bz),.115,.015,'y','badgeblue','body')
    star=[]
    for k in range(10):
        a=PI/2+k*PI/5; r=.096 if k%2==0 else .041; star.append((bx+r*math.cos(a),bz+r*math.sin(a)))
    plate('badge_star_'+sn,star,side,.009,'gold','body',y_skin=.994,bevel=.002)
    text('badge_label_'+sn,'POLICE',.045,(bx,sy(1.006),bz+.145),'-y' if side<0 else '+y','black','body',font='/System/Library/Fonts/Supplemental/Arial Bold.ttf')
    text('emergency_'+sn,'911',.18,(-1.99,sy(.94),.95),'-y' if side<0 else '+y','white','body',font='/System/Library/Fonts/Supplemental/Arial Bold.ttf')
    box('mirror_arm_'+sn,(.94,sy(.96),1.12),(.1,.24,.055),'black','body',.02)
    box('mirror_'+sn,(.96,sy(1.075),1.18),(.25,.16,.15),'paint','body',.06)
    box('mirror_lens_'+sn,(.833,sy(1.075),1.18),(.008,.12,.095),'glass','body',.01)
    box('side_indicator_'+sn,(1.75,sy(.933),.93),(.085,.02,.036),'amber','body',.008)
    box('side_moulding_rear_'+sn,(-2.19,sy(.924),.57),(.5,.03,.06),'black','body',.015)
# windshield and backlight slope in xz
surf('windshield',[(1.185,-.78,1.152),(1.185,.78,1.152),(.557,.672,1.633),(.557,-.672,1.633)],'glass')
surf('rear_windshield',[(-1.41,.82,1.13),(-1.41,-.82,1.13),(-.83,-.705,1.60),(-.83,.705,1.60)],'glass')
for y in [-.39,.39]: box('wiper_'+str(y),(1.09,y,1.185),(.027,.62,.026),'black','body',.009,rot=(0,.63,-.13))
text('hood_police','POLICE',.32,(1.78,0,1.035),'-y','white','body',depth=.001,font='/System/Library/Fonts/Supplemental/Arial Bold.ttf')
bpy.data.objects['hood_police'].rotation_euler=(0,0,PI/2)
# wheels: lathed tyres, steel wheels with actual round vent holes
for ax,an in [(-1.47,'rear'),(1.44,'front')]:
    cylinder('axle_'+an,(ax,0,.36),.07,1.7,'y','black','body')
    for side,sn in SIDES:
        g='wheel_'+an+'_'+sn; c=(ax,side*.875,.36); group(g,c,parent='body'); out='-y' if side<0 else 'y'
        lathe(g+'_tyre',[(.235,-.13),(.30,-.135),(.341,-.105),(.354,-.065),(.36,0),(.354,.065),(.341,.105),(.30,.135),(.235,.13)],c,out,'rubber',g,segs=64)
        rim=lathe(g+'_steel',[(.001,.10),(.13,.10),(.17,.075),(.215,.08),(.239,.12),(.253,.126),(.26,.103),(.254,-.10),(.001,-.10)],c,out,'black',g,segs=64)
        for k in range(10):
            a=k*2*PI/10; cut(rim,raw_cyl('vent',(ax+.196*math.cos(a),side*.99,.36+.196*math.sin(a)),.025,.18,segs=16))
        lathe(g+'_hub',[(.001,.155),(.08,.153),(.105,.136),(.109,.11)],c,out,'alu',g,segs=48)
        lathe(g+'_rimlip',[(.244,.124),(.255,.129),(.261,.12),(.255,.11)],c,out,'alu_dark',g,segs=64)
        for k in range(5):
            a=k*2*PI/5; cylinder(g+'_lug'+str(k),(ax+.126*math.cos(a),side*1.004,.36+.126*math.sin(a)),.014,.02,'y','alu',g,segs=8)
        for k in range(48):
            a=k*2*PI/48
            box(g+'_tread'+str(k),(ax+.357*math.cos(a),side*.875,.36+.357*math.sin(a)),(.015,.21,.009),'black',g,.003,segs=1,rot=(0,PI/2-a,0))
for nm in ['windshield','rear_windshield']:
    bpy.data.objects[nm].location.z=.012
# bumpers, grille, headlamps and substantial push bars
for x,n in [(2.43,'front'),(-2.44,'rear')]:
    box(n+'_bumper',(x,0,.50),(.24,1.80,.29),'paint','body',.09,segs=4)
    box(n+'_rub_strip',(x+( .125 if x>0 else -.125),0,.56),(.022,1.65,.055),'black','body',.015)
box('grille_bezel',(2.491,0,.82),(.045,.92,.26),'alu_dark','body',.025)
box('grille_recess',(2.521,0,.82),(.025,.86,.205),'black','body',.016)
for i in range(15):
    box('grille_vertical_'+str(i),(2.539,-.39+i*.056,.82),(.012,.012,.18),'alu_dark','body',.004)
for i in range(4): box('grille_horizontal_'+str(i),(2.549,0,.755+i*.043),(.012,.82,.012),'alu_dark','body',.004)
lathe('grille_oval',[(.001,.018),(.038,.018),(.044,0)],(2.56,0,.82),'x','blue','body',segs=32)
for side,sn in SIDES:
    box('headlight_frame_'+sn,(2.432,side*.65,.825),(.09,.39,.255),'chrome','body',.04)
    box('headlight_'+sn,(2.482,side*.61,.832),(.055,.27,.205),'head','body',.024)
    box('front_turn_'+sn,(2.468,side*.80,.82),(.04,.10,.19),'amber','body',.02)
    for k in range(6): box('lens_flute_'+sn+str(k),(2.513,side*.61-.10+k*.039,.832),(.006,.005,.18),'head','body',.002)
    box('tail_lamp_'+sn,(-2.485,side*.72,.78),(.04,.20,.24),'lamp','body',.045)
    box('tail_reverse_'+sn,(-2.51,side*.72,.78),(.01,.16,.065),'head','body',.008)
    box('push_upright_'+sn,(2.69,side*.52,.64),(.16,.12,.81),'black','body',.065,segs=4,rot=(0,-.10,0))
    box('push_pad_'+sn,(2.79,side*.52,.72),(.055,.13,.63),'rubber','body',.025)
    cylinder('push_bolt_'+sn,(2.827,side*.52,.45),.018,.015,'x','alu_dark','body',segs=12)
for z in [.32,.62,.97]: box('push_crossbar_'+str(z),(2.69,0,z),(.10,1.04,.075),'black','body',.025)
for x in [2.585,-2.585]:
    box('license_'+str(x),(x,0,.47),(.015,.31,.13),'white','body',.008)
    text('license_text_'+str(x),'SG • 104',.036,(x+(.01 if x>0 else -.01),0,.47),'+x' if x>0 else '-x','black','body',font='/System/Library/Fonts/Supplemental/Arial Bold.ttf')
# spotlight and antenna
cylinder('spotlight_stalk',(1.13,-1.00,1.31),.026,.22,'z','black','body')
lathe('spotlight_shell',[(.001,-.09),(.065,-.07),(.096,-.015),(.10,.045),(.078,.067)],(1.17,-1.0,1.43),'x','black','body',segs=40)
cylinder('spotlight_lens',(1.242,-1.,1.43),.075,.008,'x','chrome','body')
cylinder('antenna',(-1.88,.54,1.29),.007,.48,'z','black','body',segs=12)
# Fine body joins and wheel-arch lips.
for side,sn in SIDES:
    for ax,an in [(-1.47,'rear'),(1.44,'front')]:
        plate('arch_lip_'+an+sn,arc(ax,.397,.477,0,PI,32)+arc(ax,.397,.46,PI,0,32),side,.014,'paint','body',y_skin=.94,bevel=.005)
    for i in range(2):
        ob=bpy.data.objects['white_door_'+str(i)+'_'+sn]
        for ax in [-1.47,1.44]: cut(ob,raw_cyl('door_arch',(ax,0,.397),.467,2.4))
    box('fuel_door_'+sn,(-1.78,side*.949,.89),(.16,.012,.15),'paint','body',.023)
# Recessed bumper intake slots and fog lamps
for side,sn in SIDES:
    box('lower_intake_'+sn,(2.56,side*.63,.42),(.016,.31,.078),'black','body',.015)
    cylinder('fog_lens_'+sn,(2.571,side*.66,.42),.031,.012,'x','glass','body',segs=24)
M['ledblue']=material('Blue LED cores','#6abfff',.16,emit='#168fff',strength=6)
# roof lightbar red ends and blue centre, visible LED modules
group('lightbar',(0,0,1.72),parent='body')
for y in [-.58,.58]: box('lightbar_mount'+str(y),(0,y,1.70),(.30,.12,.10),'black','lightbar',.02)
box('lightbar_base',(0,0,1.765),(.32,1.57,.065),'black','lightbar',.025)
for i in range(8):
    y=-.665+i*.19; mt='lamp' if i in [0,1,6,7] else 'blue'
    box('lightbar_lens'+str(i),(0,y,1.855),(.30,.185,.15),mt,'lightbar',.025)
    for x in [-.155,.155]:
        box('LED_frame'+str(i)+str(x),(x,y,1.852),(.012,.143,.079),'alu_dark','lightbar',.006)
        for k in range(4):
            box('LED_'+str(i)+str(x)+str(k),(x*1.04,y-.05+k*.033,1.852),(.008,.023,.052),'head' if mt=='lamp' else 'ledblue','lightbar',.003)

# Final review: hollow cabin, genuine glazing openings, interior.
cab=bpy.data.objects['white_cabin']
cut(cab,raw_box('hollow_cabin',(-.10,0,1.30),(2.6,1.37,.58)))
for nm in ['windshield','rear_windshield','front_window_near','front_window_far','rear_window_near','rear_window_far']:
    original=bpy.data.objects[nm]
    cutter=original.copy(); cutter.data=original.data.copy(); TRUCK.objects.link(cutter)
    mw=original.matrix_world.copy(); cutter.parent=None; cutter.matrix_world=mw
    for mod in list(cutter.modifiers): cutter.modifiers.remove(mod)
    solid=cutter.modifiers.new('cut thickness','SOLIDIFY'); solid.thickness=.26; solid.offset=0
    bpy.context.view_layer.objects.active=cutter
    bpy.ops.object.modifier_apply(modifier=solid.name)
    cut(cab,cutter)
M['glass'].node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=.79
M['glass'].surface_render_method='DITHERED'
M['glass'].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.20
for y in [-.38,.38]:
    box('seat_cushion_'+str(y),(.10,y,1.09),(.44,.44,.13),'black','body',.07)
    box('seat_back_'+str(y),(-.09,y,1.28),(.15,.43,.39),'black','body',.065,rot=(0,-.12,0))
    box('headrest_'+str(y),(-.10,y,1.53),(.14,.27,.17),'black','body',.05)
box('rear_bench',(-.87,0,1.20),(.23,1.21,.31),'black','body',.07)
box('dashboard',(.81,0,1.18),(.29,1.43,.16),'black','body',.05)
lathe('steering_wheel',[(.125,-.008),(.143,-.005),(.149,.009),(.143,.020),(.125,.018)],(.55,-.39,1.32),'x','black','body',segs=40)
box('steering_hub',(.55,-.39,1.32),(.02,.16,.06),'black','body',.015)
for an in ['front','rear']:
    for sn in ['near','far']:
        g=GROUPS['wheel_'+an+'_'+sn]; g.scale=(1.10,1.10,1.10); g.location.z+=.037
for key in ['blue','lamp']:
    M[key].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=.45
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
    ground.is_shadow_catcher = False
    ground.data.materials.append(material('Studio floor','#eeeeee',.82))

    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    STAGE.objects.link(cam)
    scene.camera = cam
    cam.data.lens = 50
    views = {
        'ref': ((5.8, 7.8, 3.5), (0, 0, 0.9), 53),
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
