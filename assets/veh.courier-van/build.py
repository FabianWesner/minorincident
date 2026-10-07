"""Medical courier van: deterministic metres, +X forward / +Z up.
Static geometry merges by material; moving doors, wheels and lamps retain pivots.
All applied trim is at least 3 mm proud. No image textures are exported.
"""
import math, sys, json
from pathlib import Path
import bmesh, bpy
from mathutils import Matrix, Vector
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.lod import hard_normals, refresh_normals
from sslib.distance import tier_argument, export_variant, build_native_lods
DISTANCE = tier_argument()

HERE = Path(__file__).resolve().parent
if '--normals-only' in sys.argv:
    refresh_normals(HERE, Path(sys.argv[sys.argv.index('--lod-input-directory') + 1]))
    sys.exit(0)

ARGS = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(name, default=None):
    return ARGS[ARGS.index(name)+1] if name in ARGS else default
LEVEL=0
PI=math.pi
W=1.0
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
STAGE=bpy.data.collections.new('Stage')
scene.collection.children.link(STAGE)
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


M = {
    'teal': material('pal_backpackTeal', '#2f6e6a', .38, coat=.3),
    'white': material('pal_picketWhite', '#f2e6dc', .34, coat=.45),
    'chrome': material('pal_sidewalk', '#b9a4a0', .28, .45),
    'black': material('pal_uiDark', '#25222c', .65),
    'glass': material('pal_asphalt', '#5b4f5c', .23, coat=.2, alpha=.43),
    'amber': material('emi_schoolBusYellow', '#f2b630', .28, emit='#f2b630', strength=.45),
    'lamp': material('emi_sirenRed', '#ff2d2d', .28, emit='#ff2d2d', strength=.55),
    'head': material('emi_windowGlow', '#ffc773', .24, emit='#ffc773', strength=3.0),
}
# A single charcoal material serves tyre and trim; no suffixed palette variants.

# Keep glass dark and readable under the broad studio key.
M['glass'].node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=.12
M['glass'].node_tree.nodes['Principled BSDF'].inputs['IOR'].default_value=1.12

BOLD_FONT=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
GROUPS = {}


def group(name, location=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.3
    e.location = location
    CAR.objects.link(e)
    if parent:
        e.parent = GROUPS[parent]
        e.matrix_parent_inverse = GROUPS[parent].matrix_world.inverted()
    bpy.context.view_layer.update()
    GROUPS[name] = e
    return e


def finish(obj, mat, parent, bevel=0.0, segs=2, smooth=True, harden=True, angle=40):
    if DISTANCE: bevel = 0
    CAR.objects.link(obj)
    if isinstance(mat, str):
        mat = M[mat]
    if mat is not None and obj.type == 'MESH' and not obj.data.materials:
        obj.data.materials.append(mat)
    if obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = smooth
    if LEVEL:bevel=0
    if LEVEL==1:segs=1
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
    if DISTANCE: bevel = 0
    if LEVEL and name in {'tread','vent_slats','head_lens_flute','antenna','antenna_base'}:return None
    if LEVEL==2 and name in {'cargo_floor','chassis','fog_lens','cargo_panel_reveal','cargo_panel','rear_panel_reveal','rear_panel','mirror_face','seat','seat_back','headrest','dashboard','steering_spoke','hood_vent','mudflap','panel_seam','rocker','plate_mount','blank_plate','lower_intake','front_indicator','side_indicator','tail_side','wiper','cab_bulkhead'}:return None
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    o = from_bm(name, bm)
    o.location = center
    o.rotation_euler = rot
    return finish(o, mat, parent, bevel=min(bevel, min(size) * 0.45), segs=segs)


def prism(name, pts_xz, y0, y1, mat, parent=None, bevel=0.03, segs=2):
    if DISTANCE: bevel = 0
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
    if DISTANCE: bevel = 0
    """Flat shape lying on a side skin. side=-1 near (-Y), +1 far (+Y). pts in world (x, z)."""
    y0 = side * (y_skin + lift)
    y1 = side * (y_skin + lift + depth)
    return prism(name, pts_xz, min(y0, y1), max(y0, y1), mat, parent, bevel, segs)


def ring(name, outer, inner, side, depth, mat, parent=None, y_skin=W, bevel=0.005, lift=0.0):
    if DISTANCE: bevel = 0
    """Frame between two loops with equal vertex count, on a side skin."""
    if LEVEL==2 and name=='window_rubber':return None
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


def lathe(name, profile, center, axis, mat, parent=None, segs=40, smooth=True):
    if DISTANCE: segs = min(segs, 12 if DISTANCE == 1 else 8)
    """Surface of revolution: profile [(radius, along_axis)], revolved about `axis` ('x','y','z' with sign)."""
    if LEVEL==2 and name in {'rim_lip','hub_cap','sidewall_rib','steering'}:return None
    if LEVEL:segs=min(segs,16 if LEVEL==1 else 8)
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
    if DISTANCE: bevel = 0; segs = min(segs, 12 if DISTANCE == 1 else 8)
    if LEVEL==2 and name=='axle':return None
    if LEVEL and name in {'lug','lock','clamp_bolt','hinge_pin'}:return None
    prof = [(1e-4, -depth / 2), (r, -depth / 2), (r, depth / 2), (1e-4, depth / 2)]
    o = lathe(name, prof, center, axis, mat, parent, segs)
    if bevel:
        b = o.modifiers.new('bevel', 'BEVEL')
        b.width = bevel
        b.segments = 2
        b.limit_method = 'ANGLE'
        o.modifiers.move(len(o.modifiers) - 1, 0)
    return o


def cut(target, cutter_obj):
    """Apply an exact difference and discard the temporary cutter."""
    if target is None:
        bpy.data.objects.remove(cutter_obj)
        return
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
    if DISTANCE: segs=min(segs, 12 if DISTANCE==1 else 6)
    bm = bmesh.new()
    if LEVEL:segs=min(segs,24 if LEVEL==1 else 12)
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


def build_vehicle(level):
    global LEVEL,CAR,GROUPS,moving,root,STATIC
    LEVEL=level
    CAR=bpy.data.collections.new('CourierVan_LOD'+str(level));scene.collection.children.link(CAR)
    GROUPS={}
    root=group('veh.courier-van')
    root['assetId']='veh.courier-van';root['tier']='Hero'
    root['lodFiles']=['model.glb','model.lod1.glb','model.lod2.glb']
    root['ss_physics']={'class':'heavy','mass':1950.,'friction':.8,'restitution':.08,'centerOfMass':[0,1,0],'pushable':False,'kickable':False,'flammable':True,'burnTime':45,'sounds':'vehicle.metal-heavy'}
    STATIC='veh.courier-van';moving=set()
    def moving_group(name,loc,parent=STATIC):
        g=group(name,loc,parent);moving.add(g);return name
    # Hollow continuous body and wheel openings, rather than wheels buried in a box.
    outline=[(-2.5,.48),(2.5,.48),(2.5,1.30),(2.30,1.46),(1.85,1.55),(1.12,2.53),(.87,2.67),(-2.30,2.67),(-2.5,2.58)]
    shell=prism('shell',outline,-W,W,'white',STATIC,.065,4)
    cut(shell,raw_box('interior',(-.43,0,1.53),(3.98,1.83,2.03)))
    # Cab void follows the sloping windshield.
    cut(shell,raw_box('cab_void',(1.04,0,1.84),(1.45,1.80,1.12)))
    for x in [-1.63,1.65]:cut(shell,raw_cyl('arch_cut',(x,0,.46),.57,2.4,'y',64))
    cut(shell,raw_box('windscreen_open',(1.40,0,2.02),(1.05,1.79,.92)))
    # Rear door openings.
    cut(shell,raw_box('rear_open',(-2.48,0,1.64),(.35,1.79,1.89)))
    box('cargo_floor',(-.72,0,.58),(3.40,1.80,.12),'black',STATIC,.025)
    box('chassis',(0,0,.43),(4.8,1.66,.15),'black',STATIC,.04)
    for s,lr in [(-1,'L'),(1,'R')]:
        # Cab door: hinge on leading upright, skin plus open window frame.
        door=moving_group('door'+lr,(1.70,s*.99,1.45))
        doorpts=[(.50,.59),(1.72,.59),(1.72,1.49),(1.10,2.39),(.50,2.39)]
        cutter=prism('door_cut',doorpts,s*.89-.2,s*.89+.2,None,bevel=0)
        cut(shell,cutter)
        pane=plate('cab_door_skin',doorpts,s,.06,'white',door,y_skin=.94,bevel=.018,segs=3)
        win=[(.62,1.57),(1.59,1.57),(1.04,2.28),(.62,2.28)]
        cutter=prism('window_cut',win,-1.3,1.3,None,bevel=0);cut(pane,cutter)
        cx=sum(x for x,z in win)/4;cz=sum(z for x,z in win)/4
        inner=[(cx+(x-cx)*.91,cz+(z-cz)*.90) for x,z in win]
        ring('window_rubber',win,inner,s,.027,'black',door,y_skin=.987,bevel=.008)
        plate('door_glass',inner,s,.012,'glass',door,y_skin=.995,bevel=.012)
        stripe=plate('door_stripe',[(.51,1.01),(1.71,1.01),(1.71,1.32),(.51,1.32)],s,.013,'teal',door,y_skin=1.004)
        for x in [1.65]:
            cut(pane,raw_cyl('door_arch',(x,0,.46),.574,2.4,'y',64))
            cut(stripe,raw_cyl('stripe_arch',(x,0,.46),.58,2.4,'y',64))
        box('door_handle',(.68,s*1.043,1.43),(.20,.048,.060),'black',door,.014,3)
        cylinder('lock',(.61,s*1.070,1.36),.012,.014,'y','black',door,16)
        plate('mirror_triangle',[(1.39,1.57),(1.60,1.57),(1.43,1.80)],s,.032,'black',door,y_skin=1.01)
        box('mirror_arm',(1.44,s*1.11,1.62),(.10,.24,.065),'black',door,.018)
        box('mirror_housing',(1.43,s*1.25,1.77),(.18,.21,.32),'black',door,.035,4)
        box('mirror_face',(1.331,s*1.25,1.77),(.012,.15,.25),'black',door,.025,3)
        # Sliding cargo panel only on near side; opposite fixed panel preserves same visual layout.
        cargo=moving_group('doorCargo'+lr,(.48,s*1.0,1.4)) if s<0 else STATIC
        if s<0:
            cut(shell,raw_box('cargo_open',(-.40,s*.97,1.58),(1.72,.34,1.91)))
            box('sliding_door',(-.40,s*.97,1.58),(1.70,.06,1.89),'white',cargo,.025,3)
        # Raised recessed-looking panel with a perimeter reveal.
        for x,length,owner in [(-1.86,.95,STATIC),(-.42,1.65,cargo)]:
            box('cargo_panel_reveal',(x,s*1.009,2.03),(length,.018,.90),'chrome',owner,.033,3)
            box('cargo_panel',(x,s*1.024,2.03),(length-.043,.018,.848),'white',owner,.035,3)
        # Stripe pieces cross panel boundaries but stay 12mm proud.
        for x,length,owner in [(-1.90,1.18,STATIC),(-.40,1.70,cargo)]:
            box('cargo_teal_band',(x,s*1.018,1.165),(length,.024,.31),'teal',owner,.007)
        box('cargo_handle',(.31,s*1.048,1.43),(.065,.045,.22),'black',cargo,.020)
        box('sliding_track',(-1.75,s*1.046,1.47),(1.18,.035,.043),'black',STATIC,.010)
        for x in [-2.28,.46]:box('panel_seam',(x,s*1.012,1.57),(.008,.012,1.88),'chrome',STATIC,.002)
        sill=box('rocker',(-.38,s*1.012,.63),(4.14,.034,.10),'white',STATIC,.025,3)
        for x in [-1.63,1.65]:cut(sill,raw_cyl('rocker_cut',(x,0,.46),.59,2.4,'y',64))
        for x in [-1.63,1.65]:
            arc_segments=40 if LEVEL==0 else (24 if LEVEL==1 else 8)
            ts=[PI*i/arc_segments for i in range(arc_segments+1)]
            pts=[(x+.625*math.cos(t),.46+.625*math.sin(t)) for t in ts]+[(x+.574*math.cos(t),.46+.574*math.sin(t)) for t in reversed(ts)]
            plate('arch_molding',pts,s,.033,'black',STATIC,y_skin=1.002,bevel=.010)
            box('mudflap',(x-.49,s*.95,.41),(.05,.20,.40),'black',STATIC,.009)
        band=plate('front_fender_band',[(1.73,1.01),(2.49,1.01),(2.49,1.32),(1.73,1.32)],s,.015,'teal',STATIC,y_skin=1.009,bevel=.005)
        cut(band,raw_cyl('fender_band_arch',(1.65,0,.46),.582,2.4,'y',64))
        box('fender_marker',(1.78,s*1.022,1.43),(.094,.028,.039),'amber',STATIC,.012)
        # Medical cross made from one polygon avoids crossing coplanar rectangles.
        x=-1.86;z=2.03;a=.31;b=.105
        pts=[(x-b,z-a),(x+b,z-a),(x+b,z-b),(x+a,z-b),(x+a,z+b),(x+b,z+b),(x+b,z+a),(x-b,z+a),(x-b,z+b),(x-a,z+b),(x-a,z-b),(x-b,z-b)]
        plate('medical_cross',pts,s,.015,'teal',STATIC,y_skin=1.040,bevel=.010)
        def text_side(label,name,center,size,owner):
            if LEVEL==2:return
            cu=bpy.data.curves.new(name,'FONT');cu.body=label;cu.align_x='CENTER';cu.align_y='CENTER';cu.size=size;cu.font=BOLD_FONT;cu.resolution_u= 2 if DISTANCE else (5 if LEVEL==0 else 2);cu.extrude= 0 if DISTANCE else (.004 if LEVEL==0 else 0);cu.bevel_depth= 0 if DISTANCE else (.001 if LEVEL==0 else 0);cu.bevel_resolution=1
            ob=bpy.data.objects.new(name,cu);CAR.objects.link(ob);ob.location=center
            # text local X along +X / -X, local Y upwards, normal outward.
            ob.rotation_euler=(PI/2,0,0) if s<0 else (PI/2,0,PI)
            bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.convert(target='MESH');ob=bpy.context.object;ob.select_set(False)
            ob.data.materials.append(M['teal']);ob.parent=GROUPS[owner];ob.matrix_parent_inverse=GROUPS[owner].matrix_world.inverted()
        text_side('MEDICAL','medical_text',(-.42,s*1.047,2.23),.35,cargo)
        text_side('COURIER','courier_text',(-.42,s*1.047,1.94),.35,cargo)
        text_side('SUNSET GROVE','town_text',(-.42,s*1.047,1.69),.090,cargo)
    cylinder('antenna_base',(1.18,0,2.579),.027,.055,'z','black',STATIC,24)
    cylinder('antenna',(1.18,0,2.689),.010,.17,'z','black',STATIC,16)
    # Hood/raked windscreen and pillars have a coherent sloping silhouette.
    prism('hood',[(1.80,1.47),(2.46,1.30),(2.46,1.39),(1.80,1.56)],-.92,.92,'white',STATIC,.035,3)
    angle=math.atan2(1.13-1.82,2.48-1.58);length=math.hypot(.69,.90)
    c=Vector((1.475,0,2.03));normal=Vector((math.cos(angle),0,-math.sin(angle)))
    gasket=box('windscreen_gasket',c,(.048,1.84,length),'black',STATIC,.035,4,rot=(0,angle,0))
    cutter=raw_box('screen_open',c,(.28,1.72,length-.09));cutter.rotation_euler.y=angle
    cut(gasket,cutter)
    prism('roof_eyebrow',[(.87,2.58),(1.17,2.43),(1.24,2.49),(1.08,2.63),(.87,2.67)],-.93,.93,'white',STATIC,.032,4)
    box('windscreen',c+normal*.032,(.016,1.72,length-.09),'glass',STATIC,.035,4,rot=(0,angle,0))
    for s in [-1,1]:
        prism('A_pillar',[(1.74,1.53),(1.88,1.53),(1.16,2.53),(1.05,2.53)],s*.91-.04,s*.91+.04,'white',STATIC,.025,3)
        box('wiper',(1.855,s*.39,1.674),(.028,.64,.029),'black',STATIC,.010,rot=(0,angle,.08*s))
        box('hood_vent',(1.94,s*.41,1.536),(.16,.35,.017),'black',STATIC,.010,rot=(0,.25,0))
        for k in range(4):box('vent_slats',(1.89+k*.030,s*.41,1.551-k*.0075),(.009,.31,.007),'chrome',STATIC,.002)
        box('seat',(1.04,s*.44,.91),(.49,.53,.16),'black',STATIC,.05,3)
        box('seat_back',(.80,s*.44,1.26),(.19,.51,.63),'black',STATIC,.06,4,rot=(0,-.1,0))
        box('headrest',(.77,s*.44,1.68),(.15,.29,.21),'black',STATIC,.05,3)
    box('dashboard',(1.59,0,1.43),(.36,1.76,.19),'black',STATIC,.045,3)
    lathe('steering',[(.16,-.02),(.19,-.02),(.19,.02),(.16,.02),(.16,-.02)],(1.36,-.43,1.57),'x','black',STATIC,48)
    box('steering_spoke',(1.36,-.43,1.57),(.035,.32,.028),'black',STATIC,.007)
    box('cab_bulkhead',(.43,0,1.58),(.08,1.78,1.89),'white',STATIC,.03)
    # Rear split doors, each hinged at the outside edge.
    for s,lr in [(-1,'L'),(1,'R')]:
        rear=moving_group('doorRear'+lr,(-2.50,s*.94,1.63))
        box('rear_door',(-2.49,s*.445,1.63),(.07,.87,1.84),'white',rear,.03,3)
        box('rear_panel_reveal',(-2.536,s*.445,2.0),(.019,.72,.87),'white',rear,.032,3)
        box('rear_panel',(-2.553,s*.445,2.0),(.019,.68,.826),'white',rear,.032,3)
        box('rear_band',(-2.541,s*.445,1.16),(.017,.86,.31),'teal',rear,.007)
        box('rear_handle',(-2.563,s*.10,1.41),(.040,.065,.18),'black',rear,.018)
        for z in [.91,2.25]:
            box('rear_hinge',(-2.52,s*.962,z),(.083,.10,.16),'black',rear,.02)
            cylinder('hinge_pin',(-2.56,s*.974,z),.019,.19,'z','black',rear,16)
    box('rear_header',(-2.495,0,2.603),(.13,1.90,.126),'white',STATIC,.030,4)
    # Open roof rack: rail stock, crossbars, clamp pads and upright brackets.
    for s in [-1,1]:
        for x in [-2.03,-.83,.63]:
            box('rack_foot',(x,s*.82,2.702),(.19,.18,.065),'black',STATIC,.018)
            prism('rack_bracket',[(x-.06,2.70),(x+.07,2.70),(x+.02,2.91),(x-.03,2.91)],s*.82-.038,s*.82+.038,'black',STATIC,.008)
            cylinder('clamp_bolt',(x,s*.88,2.79),.018,.022,'y','chrome',STATIC,12)
        box('rack_side_rail',(-.68,s*.82,2.96),(3.62,.065,.070),'black',STATIC,.022,3)
        for x in [-2.48,1.12]:box('rack_endcap',(x,s*.82,2.96),(.09,.08,.087),'black',STATIC,.023)
    for x in [-2.26,-1.48,-.70,.08,.88]:box('rack_crossbar',(x,0,2.89),(.065,1.92,.063),'black',STATIC,.020,3)
    for y in [-.43,0,.43]:box('rack_floor_rail',(-.69,y,2.91),(3.40,.038,.042),'black',STATIC,.012)
    for x in [-2.27,.91]:box('rack_end_rail',(x,0,2.96),(.07,1.70,.070),'black',STATIC,.020,3)
    # Grille, bumper and unbranded diamond courier badge.
    box('grille_frame',(2.50,0,1.13),(.09,1.40,.40),'chrome',STATIC,.035,3)
    box('grille_recess',(2.557,0,1.13),(.026,1.33,.34),'black',STATIC,.02)
    for z in [.999,1.115,1.232]:box('grille_slat',(2.579,0,z),(.032,1.25,.030),'chrome',STATIC,.008)
    box('fictional_badge',(2.604,0,1.12),(.04,.17,.17),'white',STATIC,.015,rot=(PI/4,0,0))
    for x in [-2.56,2.57]:
        bumper=box('bumper',(x,0,.70),(.27,2.09,.38),'black',STATIC,.085,4)
        face=x+math.copysign(.145,x)
        box('plate_mount',(face,0,.71),(.025,.48,.21),'chrome',STATIC,.012)
        box('blank_plate',(face+math.copysign(.02,x),0,.71),(.012,.42,.15),'black',STATIC,.009)
        if x>0:
            for y in [-.72,.72]:
                if LEVEL<2:cut(bumper,raw_box('fog_recess',(face,y,.66),(.16,.25,.15)))
                box('fog_lens',(face-.057,y,.66),(.018,.18,.082),'head',STATIC,.010)
            for y in [-.43,.43]:box('lower_intake',(face+.006,y,.77),(.017,.18,.17),'black',STATIC,.008)
    group('lightsFront',parent=STATIC);group('lightsBrake',parent=STATIC)
    for s,lr in [(-1,'L'),(1,'R')]:
        lamp=moving_group('lampHead'+lr,(2.53,s*.85,1.14),'lightsFront')
        box('headlight_back',(2.525,s*.855,1.15),(.09,.29,.43),'black',STATIC,.028,3)
        box('headlight_lens',(2.583,s*.845,1.18),(.034,.25,.28),'head',lamp,.034,4)
        box('front_indicator',(2.584,s*.848,.997),(.030,.22,.06),'amber',STATIC,.011)
        box('side_indicator',(2.526,s*1.007,1.16),(.11,.020,.13),'amber',STATIC,.016)
        for k in range(4):box('head_lens_flute',(2.602,s*.845-.06+k*.04,1.18),(.005,.004,.19),'head',lamp,.001)
        tail=moving_group('lampBrake'+lr,(-2.51,s*.97,1.13),'lightsBrake')
        box('tail_gasket',(-2.535,s*.965,1.17),(.07,.12,.62),'black',STATIC,.022,3)
        for z,mat,height in [(1.39,'lamp',.19),(1.17,'head',.16),(.96,'lamp',.19)]:
            box('tail_lens',(-2.582,s*.965,z),(.035,.104,height),mat,tail if mat=='lamp' else STATIC,.014,3)
            box('tail_side',(-2.49,s*1.047,z),(.16,.025,height),mat,tail if mat=='lamp' else STATIC,.012)
        a=group('light:headlight'+lr,(2.65,s*.85,1.18),STATIC);a.rotation_euler=Vector((1,0,-.09)).to_track_quat('-Z','Y').to_euler()
        a['ss_light']={'type':'spot','color':'light_window_warm','intensity':3,'range':20,'angle':48,'penumbra':.4,'pool':True,'beam':'soft','flare':True,'reflect':True,'shadow':'hero','heroPriority':2,'flicker':'none','powerGroup':'self','breakable':True,'emissiveNodes':['lampHead'+lr+'_emi_windowGlow'],'tiers':'all'}
        a=group('light:brake'+lr,(-2.65,s*.96,1.3),STATIC)
        a['ss_light']={'type':'point','color':'light_siren_red','intensity':.8,'range':2,'pool':False,'beam':'none','flare':True,'reflect':True,'shadow':'none','heroPriority':0,'flicker':'none','powerGroup':'self','breakable':True,'emissiveNodes':['lampBrake'+lr+'_emi_sirenRed'],'tiers':'all'}
    box('third_brake',(-2.581,0,2.617),(.025,.24,.045),'lamp',STATIC,.012)
    # Steel wheels with rounded tyre shoulders, recessed ventilation and lug nuts.
    TY=[(.25,-.15),(.37,-.15),(.44,-.12),(.465,-.075),(.468,0),(.465,.075),(.44,.12),(.37,.15),(.25,.15)]
    RIM=[(.001,.085),(.265,.085),(.287,.12),(.278,.161),(.243,.165),(.226,.124),(.13,.109),(.001,.109)]
    for x,ax in [(1.65,'F'),(-1.63,'R')]:
        cylinder('axle',(x,0,.468),.05,1.90,'y','black',STATIC,24)
        for s,lr in [(-1,'L'),(1,'R')]:
            name=moving_group('wheel'+ax+lr,(x,s*.96,.468));c=(x,s*.96,.468);axis='-y' if s<0 else 'y'
            lathe('tyre',TY if LEVEL<2 else [(.001,-.15),(.468,-.15),(.468,.15),(.001,.15)],c,axis,'black',name,80)
            rim=lathe('steel_rim',RIM if LEVEL<2 else [(.001,.085),(.28,.085),(.28,.16),(.001,.16)],c,axis,'chrome',name,80)
            for k in range(12 if LEVEL==0 else 0):
                t=2*PI*k/12
                cut(rim,raw_cyl('vent',(x+.197*math.cos(t),s*1.11,.468+.197*math.sin(t)),.028,.18,'y',16))
            lathe('rim_lip',[(.247,.16),(.274,.174),(.286,.154),(.283,.14)],c,axis,'chrome',name,80)
            lathe('hub_cap',[(.001,.186),(.093,.186),(.113,.158),(.109,.113),(.001,.113)],c,axis,'black',name,48)
            for k in range(6):
                t=2*PI*k/6
                cylinder('lug',(x+.132*math.cos(t),s*1.12,.468+.132*math.sin(t)),.014,.022,'y','chrome',name,6)
            for r in [.357,.388]:lathe('sidewall_rib',[(r,.149),(r+.005,.154),(r+.01,.149)],c,axis,'black',name,80)
            for k in range(64):
                t=2*PI*k/64
                for yy in [-.080,.080]:box('tread',(x+.466*math.cos(t),s*.96+yy,.468+.466*math.sin(t)),(.033,.072,.009),'black',name,.0015,1,rot=(0,PI/2-t,.16))
    for name,loc in [('driverSeat',(1.03,-.44,.99)),('exitL',(1.02,-1.5,0)),('exitR',(1.02,1.5,0))]:group(name,loc,STATIC)
    col=group('col:body',(0,0,1.41),STATIC);col['collider']='cuboid';col['shape']='cuboid';col['size']=[5.40,2.4,2.82]
    # Consolidate once after bevels. One mesh/material per animation owner.
    for o in list(CAR.objects):
        if o.type!='MESH':continue
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    def motion_owner(o):
        p=o.parent
        while p:
            if p in moving:return p
            p=p.parent
        return None
    if DISTANCE:
        export_variant(Path(__file__).parent, DISTANCE, omit=('tread', 'lug', 'rivet', 'seat', 'steering', 'sidewall_rib','rim_lip','sidewall_line','hub_cap','clamp_bolt','corner_fastener','sidewall_bead'), far_omit=('seat', 'steering', 'handle', 'wiper', 'rib', 'badge', 'rim spoke', 'seam', 'rim', 'hub', 'label', 'letter', 'logo', 'stripe', 'gasket', 'frame_ring', 'dial', 'louver','town_text','courier_text','medical_text','arch_molding','hinge_pin','lock','head_lens_flute','axle','rack_foot','rack_bracket','medical_cross','vent_slats','tail_side'), flat_parts=('steel_rim',))

    buckets={}
    for o in list(CAR.objects):
        if o.type=='MESH':buckets.setdefault((motion_owner(o),o.data.materials[0].name),[]).append(o)
    for (owner,matname),obs in buckets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object
        world=o.matrix_world.copy();o.parent=owner or root;o.matrix_world=world
        o.name='body' if owner is None and matname=='pal_picketWhite' else (owner.name if owner else 'static')+'_'+matname
        o.data.name=o.name
        if owner is None and matname.startswith('emi_'):o['decorativeEmissive']=True
        scene.cursor.location=owner.matrix_world.translation if owner else (0,0,0)
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    meshes=[o for o in CAR.objects if o.type=='MESH']
    def clean_mesh(o):
        # Work in final pivot-local float coordinates, matching glTF export precision.
        bm=bmesh.new();bm.from_mesh(o.data)
        bmesh.ops.triangulate(bm,faces=list(bm.faces))
        thin=[f for f in bm.faces if f.calc_area()<max(e.calc_length()**2 for e in f.edges)*1e-5]
        if thin:bmesh.ops.delete(bm,geom=thin,context='FACES')
        bm.to_mesh(o.data);bm.free();o.data.update()
        bpy.context.view_layer.objects.active=o
        normals=o.modifiers.new('clean_normals','WEIGHTED_NORMAL');normals.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=normals.name)
    for o in meshes:
        clean_mesh(o)
        # Collapse redundant bevel tessellation while retaining the rich authored forms.
        bpy.context.view_layer.objects.active=o
        if LEVEL==0:
            reduction=o.modifiers.new('hero_tessellation','DECIMATE');reduction.ratio=.62
            bpy.ops.object.modifier_apply(modifier=reduction.name)
        clean_mesh(o)
    points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
    min_z=min(v.z for v in points);cx=(min(v.x for v in points)+max(v.x for v in points))*.5
    for o in list(root.children):o.location.z-=min_z;o.location.x-=cx
    bpy.context.view_layer.update()
    for o in meshes:o.data.calc_loop_triangles()
    
    tris=sum(len(o.data.loop_triangles) for o in meshes)
    draws=len(meshes)
    required=['body','wheelFL','wheelFR','wheelRL','wheelRR','doorL','doorR','doorRearL','doorRearR','doorCargoL','lightsFront','lightsBrake','driverSeat','exitL','exitR']
    report={'id':'veh.courier-van','tier':'Hero','triangles':tris,'draw_calls':draws,'materials':sorted({m.name for o in meshes for m in o.data.materials}),'nodes_ok':all(n in bpy.data.objects for n in required),'within_budget':tris<=80000 and draws<=40,'rounds':0,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
    
    assert report['nodes_ok'] and report['within_budget'], report
    print('BUILD OK',json.dumps(report))
    return CAR,meshes,report

CAR,meshes,report=build_vehicle(int(arg('--lod',0)))
(HERE/'build-stats.json').write_text(json.dumps(report,indent=2)+'\n')
if arg('--glb'):
    scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=0;scene.cycles.device='CPU'
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        a=o.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER')
        o.data.color_attributes.active_color=a;o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0];scene.render.bake.target='VERTEX_COLORS'
    bpy.ops.object.bake(type='AO');print('AO OK')
    def export_glb(path):
        bpy.ops.object.select_all(action='DESELECT')
        for o in CAR.objects:o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(Path(path).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_lights=False,export_cameras=False,export_vertex_color='NAME',export_vertex_color_name='ao',export_all_vertex_colors=False)
        print('GLB OK',path)
    export_glb(arg('--glb'))
    hero_collection,hero_meshes,hero_root=CAR,meshes,root
    saved_names={o:o.name for o in hero_collection.objects}
    for o,name in saved_names.items():
        o.name='hero_archive_'+name;o.hide_render=True
    lod_stats={}
    for o,name in saved_names.items():
        o.name=name;o.hide_render=False
    CAR,meshes,root=hero_collection,hero_meshes,hero_root;LEVEL=0
    if lod_stats:(HERE/'lod-stats.json').write_text(json.dumps(lod_stats,indent=2)+'\n')

def stage(view):
    world=bpy.data.worlds.new('Studio');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.16,.13,.19,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
    def light(name,loc,energy,size,color):
        d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.shape='DISK';d.size=size;d.color=color
        o=bpy.data.objects.new(name,d);STAGE.objects.link(o);o.location=loc
        o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
    light('Key',(1,-4,7),950,5,(1,.82,.67))
    light('Fill',(1,5,5),650,5,(.66,.73,1))
    light('Rim',(-4,1,5),1100,4,(1,.69,.49))
    bm=bmesh.new();bmesh.ops.create_grid(bm,x_segments=1,y_segments=1,size=200)
    floor=from_bm('Ground',bm);STAGE.objects.link(floor)
    mat=material('stage_floor','#302c36',.85);floor.data.materials.append(mat)
    cam=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'));STAGE.objects.link(cam);scene.camera=cam
    views={'ref':((8,-10,6.3),8.2),'game':((9,-9,12),9.0),'front':((10,0,3.8),7.2),'rear':((-8,-5,3.8),6.8),'side':((0,-12,3.6),7.7)}
    loc,scale=views[view];cam.location=loc;cam.data.type='ORTHO';cam.data.ortho_scale=scale
    cam.rotation_euler=(Vector((0,0,1.40))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine='CYCLES'
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
    for d in prefs.devices:d.use=True
    scene.cycles.device='GPU';scene.cycles.samples=int(arg('--samples',24));scene.cycles.use_denoising=True
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.resolution_x=int(arg('--width',960));scene.render.resolution_y=int(arg('--height',540));scene.render.resolution_percentage=100
if arg('--render'):
    path=Path(arg('--render'));path.parent.mkdir(parents=True,exist_ok=True)
    stage(arg('--view','ref'));scene.render.filepath=str(path.resolve());bpy.ops.render.render(write_still=True);print('RENDER OK',path)
    if '-ref' in path.stem or path.name=='hero.png':
        scene.camera.location=(9,-9,12);scene.camera.data.ortho_scale=9
        scene.camera.rotation_euler=(Vector((0,0,1.40))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
        game_path=path.with_name('game.png' if path.name=='hero.png' else path.name.replace('-ref','-game'))
        if path.name=='hero.png':
            scene.cycles.samples=24;scene.render.resolution_x=960;scene.render.resolution_y=540
        scene.render.filepath=str(game_path.resolve());bpy.ops.render.render(write_still=True);print('RENDER OK game')

if arg('--glb') and not DISTANCE:
    build_native_lods(__file__)
