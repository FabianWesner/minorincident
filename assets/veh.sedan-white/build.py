"""White retro sedan: deterministic metres, +X forward / +Z up.
Static geometry merges by material; moving doors, wheels and lamps retain pivots.
All applied trim is at least 3 mm proud. No image textures are exported.
"""
import math, sys, json
from pathlib import Path
import bmesh, bpy
from mathutils import Matrix, Vector
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.lod import hard_normals, refresh_normals

HERE = Path(__file__).resolve().parent
if '--normals-only' in sys.argv:
    refresh_normals(HERE, Path(sys.argv[sys.argv.index('--lod-input-directory') + 1]))
    sys.exit(0)

ARGS = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(name, default=None):
    return ARGS[ARGS.index(name)+1] if name in ARGS else default
PI=math.pi
W=.90
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
CAR=bpy.data.collections.new('Sedan')
STAGE=bpy.data.collections.new('Stage')
scene.collection.children.link(CAR)
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
    'white': material('pal_picketWhite', '#f2e6dc', .34, coat=.45),
    'chrome': material('pal_sidewalk', '#b9a4a0', .28, .45),
    'black': material('pal_uiDark', '#25222c', .65),
    'glass': material('pal_asphalt', '#5b4f5c', .36, coat=0, alpha=.50),
    'amber': material('emi_schoolBusYellow', '#f2b630', .28, emit='#f2b630', strength=.45),
    'lamp': material('emi_sirenRed', '#ff2d2d', .28, emit='#ff2d2d', strength=.55),
    'head': material('emi_windowGlow', '#ffc773', .24, emit='#ffc773', strength=3.0),
}
# A single charcoal material serves tyre and trim; no suffixed palette variants.

# Keep glass dark and readable under the broad studio key.
M['glass'].node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=.12
M['glass'].node_tree.nodes['Principled BSDF'].inputs['IOR'].default_value=1.12

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
    CAR.objects.link(obj)
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


def lathe(name, profile, center, axis, mat, parent=None, segs=40, smooth=True):
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


def cut(target, cutter_obj):
    """Apply an exact difference and discard the temporary cutter."""
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


root=group('veh.sedan-white')
root['assetId']='veh.sedan-white';root['tier']='Hero'
root['lodFiles']=['model.glb','model.lod1.glb','model.lod2.glb']
root['ss_physics']={'class':'heavy','mass':1150.0,'friction':.8,'restitution':.08,'centerOfMass':[0,.65,0],'pushable':False,'kickable':False,'flammable':True,'burnTime':45,'sounds':'vehicle.metal-heavy'}
STATIC='veh.sedan-white'
moving=set()
# Continuous lower shell, with genuine wheel arches and cabin aperture.
shell=prism('body_shell',[(-2.18,.43),(2.19,.43),(2.19,1.06),(2.05,1.15),(1.04,1.22),(-1.49,1.22),(-2.14,1.14)],-.90,.90,'white',STATIC,.050,3)
for x in [-1.40,1.40]:
    cut(shell,raw_cyl('wheel_arch',(x,0,.39),.465,2.3,'y',64))
# Interior void also makes the lower door apertures functional.
cut(shell,raw_box('cabin_void',(-.22,0,1.03),(2.31,1.65,1.00)))
for s,lr in [(-1,'L'),(1,'R')]:
    for name,x0,x1 in [('door'+lr,-.12,1.03),('doorRear'+lr,-1.34,-.13)]:
        cut(shell,raw_box('door_aperture',((x0+x1)/2,s*.85,.90),(x1-x0, .40,.62)))
        g=group(name,(x1,s*.88,1.05),STATIC);moving.add(g)
        panel=box(name+'_skin',((x0+x1)/2,s*.888,.90),(x1-x0-.015,.055,.61),'white',name,.013,3)
        for axle in [-1.4,1.4]:cut(panel,raw_cyl('door_arch',(axle,0,.39),.468,2.3,'y',64))
        molding=box(name+'_molding',((x0+x1)/2,s*.925,.70),(x1-x0-.045,.026,.065),'black',name,.009)
        rocker=box(name+'_rocker_line',((x0+x1)/2,s*.921,.51),(x1-x0-.04,.012,.017),'chrome',name,.004)
        for part in [molding,rocker]:
            for axle in [-1.4,1.4]:cut(part,raw_cyl('trim_arch',(axle,0,.39),.474,2.3,'y',64))
        box(name+'_handle_recess',(x0+.20,s*.926,1.063),(.21,.025,.086),'black',name,.014,3)
        box(name+'_handle',(x0+.20,s*.947,1.078),(.17,.025,.033),'black',name,.008)
        if name=='door'+lr:
            cylinder(name+'_lock',(x0+.16,s*.946,1.021),.012,.012,'y','chrome',name,16)
    # Separate window loops form open frames; glazing is recessed from the gasket.
    front=[(-.11,1.23),(.98,1.23),(.43,1.73),(-.11,1.73)]
    rear=[(-1.37,1.23),(-.18,1.23),(-.18,1.73),(-.91,1.73)]
    for name,outer in [('door'+lr,front),('doorRear'+lr,rear)]:
        cx=sum(x for x,z in outer)/4;cz=sum(z for x,z in outer)/4
        inner=[(cx+(x-cx)*.94,cz+(z-cz)*.91) for x,z in outer]
        ring(name+'_window_frame',outer,inner,s,.047,'white',name,y_skin=.835,bevel=.009)
        inset=[(cx+(x-cx)*.89,cz+(z-cz)*.87) for x,z in inner]
        ring(name+'_gasket',inner,inset,s,.022,'black',name,y_skin=.861,bevel=.005)
        plate(name+'_glass',inset,s,.012,'glass',name,y_skin=.853,bevel=.009)
    # Rear quarter pane divider and B pillar.
    plate('quarter_pillar'+lr,[(-1.21,1.27),(-1.17,1.27),(-.82,1.69),(-.86,1.69)],s,.025,'black','doorRear'+lr,y_skin=.866)
    box('B_pillar'+lr,(-.145,s*.866,1.49),(.052,.044,.55),'black',STATIC,.007)
    box('roof_rain_gutter'+lr,(-.25,s*.878,1.765),(1.52,.022,.020),'white',STATIC,.008)
    # Mirror mounts follow the front doors.
    plate('mirror_triangle'+lr,[(.72,1.24),(.97,1.24),(.80,1.44)],s,.032,'black','door'+lr,y_skin=.875)
    box('mirror_stalk'+lr,(.85,s*.981,1.30),(.065,.17,.055),'black','door'+lr,.012)
    box('mirror_housing'+lr,(.83,s*1.078,1.36),(.19,.23,.145),'black','door'+lr,.035,4)
    box('mirror_painted_cap'+lr,(.867,s*1.078,1.382),(.124,.22,.11),'white','door'+lr,.027,3)
    box('mirror_glass'+lr,(.727,s*1.078,1.36),(.013,.175,.10),'chrome','door'+lr,.014,3)
    for x in [-1.4,1.4]:
        outer=[(x+.51*math.cos(t),.39+.51*math.sin(t)) for t in [PI*i/32 for i in range(33)]]
        inner=[(x+.467*math.cos(t),.39+.467*math.sin(t)) for t in [PI*i/32 for i in range(32,-1,-1)]]
        plate('arch_lip'+lr+str(x),outer+inner,s,.035,'white',STATIC,y_skin=.896,bevel=.008)
    box('fender_marker'+lr,(1.08,s*.925,1.055),(.10,.024,.036),'amber',STATIC,.009)
    # Rocker under closed doors; dark wheel wells stay inside the shell.
    sill=box('sill'+lr,(-.14,s*.843,.448),(1.83,.10,.055),'white',STATIC,.015)
    for axle in [-1.4,1.4]:cut(sill,raw_cyl('sill_arch',(axle,0,.39),.476,2.3,'y',64))
box('chassis',(0,0,.41),(3.99,1.43,.115),'black',STATIC,.035)
for x in [-1.4,1.4]:cylinder('axle',(x,0,.39),.045,1.63,'y','black',STATIC)
# Roof, raked windshield, rear glass and purposeful cabin fittings.
box('roof',(-.24,0,1.765),(1.50,1.76,.12),'white',STATIC,.065,4)
def raked_screen(name,xb,zb,xt,zt,width):
    angle=math.atan2(xt-xb,zt-zb)
    length=math.hypot(xt-xb,zt-zb)
    c=((xt+xb)/2,0,(zt+zb)/2)
    box(name+'_gasket',c,(.034,width,length),'black',STATIC,.027,3,rot=(0,angle,0))
    # Normal offset guarantees separation, including glTF depth precision.
    normal=Vector((math.cos(angle),0,-math.sin(angle)))
    sign=1 if xb>0 else -1
    cc=Vector(c)+normal*(.024*sign)
    box(name,cc,(.012,width-.09,length-.065),'glass',STATIC,.020,3,rot=(0,angle,0))
raked_screen('windshield',1.035,1.22,.46,1.745,1.66)
raked_screen('rear_window',-1.48,1.22,-.95,1.745,1.66)
for s in [-1,1]:
    prism('A_pillar',[(1.12,1.20),(1.02,1.20),(.41,1.78),(.53,1.78)],s*.81-.04,s*.81+.04,'white',STATIC,.022,3)
    prism('C_pillar',[(-1.55,1.19),(-1.36,1.19),(-.88,1.76),(-1.03,1.76)],s*.82-.05,s*.82+.05,'white',STATIC,.024,3)
    box('front_seat',(.05,s*.42,.96),(.46,.54,.15),'black',STATIC,.055,3)
    box('front_seat_back',(-.15,s*.42,1.19),(.16,.52,.48),'black',STATIC,.055,3,rot=(0,-.12,0))
    box('headrest',(-.18,s*.42,1.48),(.14,.27,.18),'black',STATIC,.045,3)
box('rear_bench',(-.94,0,1.07),(.40,1.37,.15),'black',STATIC,.05)
box('rear_backrest',(-1.17,0,1.30),(.14,1.37,.38),'black',STATIC,.045)
box('dashboard',(.77,0,1.21),(.31,1.50,.14),'black',STATIC,.038,3)
box('dash_instrument_hood',(.65,-.41,1.30),(.23,.36,.10),'black',STATIC,.028)
lathe('steering_wheel',[(.145,-.018),(.173,-.018),(.173,.018),(.145,.018),(.145,-.018)],(.49,-.42,1.31),'x','black',STATIC,40)
cylinder('steering_hub',(.49,-.42,1.31),.052,.038,'x','black',STATIC,24)
box('steering_spoke',(.49,-.42,1.31),(.029,.27,.025),'black',STATIC,.006)
box('interior_mirror',(.48,0,1.60),(.042,.22,.09),'black',STATIC,.018)
box('mirror_mount',(.44,0,1.68),(.035,.03,.085),'black',STATIC,.007)
# Hood and trunk are gently raked, with actual proud seam channels.
prism('hood',[(1.06,1.15),(2.16,1.07),(2.16,1.145),(1.06,1.245)],-.863,.863,'white',STATIC,.027,3)
for s in [-1,1]:
    prism('hood_seam',[(1.09,1.252),(2.10,1.160),(2.10,1.166),(1.09,1.258)],s*.70-.004,s*.70+.004,'chrome',STATIC,.001)
    box('wiper_arm',(.99,s*.37,1.272),(.028,.43,.018),'black',STATIC,.005,rot=(0,-.25,.16*s))
    box('wiper_blade',(.94,s*.37,1.30),(.028,.43,.027),'black',STATIC,.007,rot=(0,-.35,0))
prism('trunk',[(-2.16,1.09),(-1.49,1.16),(-1.49,1.24),(-2.16,1.18)],-.865,.865,'white',STATIC,.022,3)
box('trunk_seam',(-1.96,0,1.215),(.009,1.64,.009),'chrome',STATIC,.002)
# Front grille recess / grille slats stand clear of the backing.
box('grille_bezel',(2.205,0,.997),(.06,.92,.35),'chrome',STATIC,.026,3)
box('grille_back',(2.242,0,.997),(.025,.84,.28),'black',STATIC,.012)
for z in [.91,.994,1.078]:box('grille_slat',(2.266,0,z),(.025,.81,.020),'chrome',STATIC,.004)
for y in [-.30,-.15,0,.15,.30]:box('grille_support',(2.263,y,.995),(.019,.017,.26),'black',STATIC,.003)
group('lightsFront',parent=STATIC);group('lightsBrake',parent=STATIC)
for s,lr in [(-1,'L'),(1,'R')]:
    y=s*.668
    box('headlight_bezel'+lr,(2.208,y,1.0),(.072,.385,.35),'chrome',STATIC,.023,3)
    g=group('lampHead'+lr,(2.263,y,1.0),'lightsFront');moving.add(g)
    box('headlamp_gasket'+lr,(2.249,y,1.0),(.038,.335,.295),'black',g.name,.016)
    box('headlamp_lens'+lr,(2.274,y,1.0),(.026,.268,.25),'head',g.name,.024,4)
    box('headlamp_indicator'+lr,(2.275,s*.83,1.0),(.030,.065,.252),'amber',g.name,.013)
    for j in range(7):box('lens_flute'+lr+str(j),(2.290,y-.106+j*.035,1.0),(.006,.003,.204),'head',g.name,.001)
    rear=group('lampBrake'+lr,(-2.206,s*.695,1.005),'lightsBrake');moving.add(rear)
    box('rear_lamp_gasket'+lr,(-2.202,s*.695,1.005),(.055,.37,.28),'black',STATIC,.015)
    box('brake_lens'+lr,(-2.238,s*.695,.977),(.025,.337,.164),'lamp',rear.name,.012)
    box('rear_signal'+lr,(-2.24,s*.695,1.105),(.025,.337,.078),'amber',rear.name,.012)
    for z in [.962,1.025,1.100]:box('tail_lens_rib',(-2.255,s*.695,z),(.004,.304,.006),'lamp',rear.name,.001)
    for n,pos,kind,emitnode in [('headlight'+lr,(2.31,y,1.0),'spot','lampHead'+lr+'_emi_windowGlow'),('brake'+lr,(-2.27,s*.695,1.0),'point','lampBrake'+lr+'_emi_sirenRed')]:
        a=group('light:'+n,pos,STATIC)
        a.rotation_euler=Vector((1 if kind=='spot' else -1,0,-.08)).to_track_quat('-Z','Y').to_euler()
        a['ss_light']={'type':kind,'color':'light_window_warm' if kind=='spot' else 'light_siren_red','intensity':3 if kind=='spot' else 1,'range':20 if kind=='spot' else 2,'angle':48,'penumbra':.4,'pool':kind=='spot','beam':'soft' if kind=='spot' else 'none','flare':True,'reflect':True,'shadow':'hero' if kind=='spot' else 'none','heroPriority':2 if kind=='spot' else 0,'flicker':'none','powerGroup':'self','breakable':True,'emissiveNodes':[emitnode],'tiers':'all'}
# Dark bumpers with inset amber slots and blank reference-style plates.
for x in [-2.24,2.25]:
    bumper=box('bumper',(x,0,.631),(.26,1.94,.24),'black',STATIC,.072,4)
    face=x+math.copysign(.14,x)
    if x>0:
        for y in [-.65,.65]:
            cut(bumper,raw_box('indicator_slot',(face,y,.625),(.10,.24,.092)))
            box('bumper_amber',(face-.048,y,.625),(.014,.203,.060),'amber',STATIC,.007)
    if x>0:
        box('plate_mount',(face+math.copysign(.008,x),0,.628),(.025,.40,.265),'black',STATIC,.012)
        box('license_plate',(face+math.copysign(.03,x),0,.628),(.014,.35,.235),'white',STATIC,.010)
        for y in [-.13,.13]:cylinder('plate_screw',(face+math.copysign(.04,x),y,.72),.005,.007,'x','chrome',STATIC,12)
box('rear_plate_recess',(-2.211,0,.993),(.024,.67,.235),'chrome',STATIC,.012)
box('rear_plate',(-2.234,0,.993),(.014,.40,.17),'white',STATIC,.01)
cylinder('trunk_lock',(-2.241,0,1.155),.018,.012,'x','chrome',STATIC,16)
cylinder('exhaust',(-2.185,-.60,.37),.048,.29,'x','black',STATIC,24)
# Rounded road tyres, vented steel rims and bolt circles.
TY=[(.23,-.13),(.32,-.135),(.375,-.10),(.39,-.065),(.392,0),(.39,.065),(.375,.10),(.32,.135),(.23,.13)]
RIM=[(.001,.075),(.235,.075),(.251,.11),(.247,.14),(.220,.145),(.200,.106),(.12,.090),(.001,.09)]
for x,ax in [(1.4,'F'),(-1.4,'R')]:
 for s,lr in [(-1,'L'),(1,'R')]:
    name='wheel'+ax+lr;c=(x,s*.831,.392);axis='-y' if s<0 else 'y'
    g=group(name,c,STATIC);moving.add(g)
    lathe(name+'_tire',TY,c,axis,'black',name,64)
    rim=lathe(name+'_rim',RIM,c,axis,'chrome',name,64)
    for k in range(10):
        t=2*PI*k/10
        cut(rim,raw_cyl('vent',(x+.171*math.cos(t),s*.96,.392+.171*math.sin(t)),.025,.21,'y',16))
    lathe('rim_lip',[(.221,.145),(.245,.151),(.254,.134),(.25,.120)],c,axis,'chrome',name,64)
    lathe('hub_cap',[(.001,.163),(.090,.163),(.112,.139),(.109,.096),(.001,.095)],c,axis,'chrome',name,48)
    for k in range(4):
        t=2*PI*k/4+PI/4
        cylinder('lug',(x+.124*math.cos(t),s*.963,.392+.124*math.sin(t)),.012,.020,'y','chrome',name,6)
    for r in [.309,.329]:lathe('sidewall_line',[(r,.131),(r+.006,.135),(r+.012,.130)],c,axis,'black',name,64)
    for k in range(48):
        t=2*PI*k/48
        box('tread',(x+.391*math.cos(t),s*.831,.392+.391*math.sin(t)),(.028,.155,.006),'black',name,.001,1,rot=(0,PI/2-t,0))
for name,loc in [('driverSeat',(.02,-.42,.98)),('exitL',(.36,-1.28,0)),('exitR',(.36,1.28,0))]:group(name,loc,STATIC)
col=group('col:body',(0,0,1.02),STATIC);col['collider']='cuboid';col['shape']='cuboid';col['size']=[4.7,1.83,1.61]
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
buckets={}
for o in list(CAR.objects):
    if o.type=='MESH':buckets.setdefault((motion_owner(o),o.data.materials[0].name),[]).append(o)
for (owner,matname),obs in buckets.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object
    world=o.matrix_world.copy();o.parent=owner or root;o.matrix_world=world
    o.name='body' if owner is None and matname=='pal_picketWhite' else (owner.name if owner else 'static')+'_'+matname
    o.data.name=o.name;scene.cursor.location=owner.matrix_world.translation if owner else (0,0,0)
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
for o in meshes:clean_mesh(o)
points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
min_z=min(v.z for v in points);cx=(min(v.x for v in points)+max(v.x for v in points))*.5
for o in list(root.children):o.location.z-=min_z;o.location.x-=cx
bpy.context.view_layer.update()
for o in meshes:o.data.calc_loop_triangles()
tris=sum(len(o.data.loop_triangles) for o in meshes)
draws=len(meshes)
required=['body','wheelFL','wheelFR','wheelRL','wheelRR','doorL','doorR','doorRearL','doorRearR','lightsFront','lightsBrake','driverSeat','exitL','exitR']
report={'id':'veh.sedan-white','tier':'Hero','triangles':tris,'draw_calls':draws,'materials':sorted({m.name for o in meshes for m in o.data.materials}),'nodes_ok':all(n in bpy.data.objects for n in required),'within_budget':tris<=80000 and draws<=40,'rounds':0,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'build-stats.json').write_text(json.dumps(report,indent=2)+'\n')
assert report['nodes_ok'] and report['within_budget'], report
print('BUILD OK',json.dumps(report))
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
    original={o:o.data for o in meshes}
    for level,ratio in [(1,.14),(2,.045)]:
        for o,me in original.items():
            o.data=me.copy();bpy.context.view_layer.objects.active=o
            d=o.modifiers.new('LOD','DECIMATE');d.ratio=ratio;bpy.ops.object.modifier_apply(modifier=d.name)
            clean_mesh(o)
        for obj in meshes: hard_normals(obj)
        export_glb(HERE/f'model.lod{level}.glb')
        for o,me in original.items():o.data=me

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
    views={'ref':((7,-9,5.4),7.0),'game':((8,-8,10),8.0),'front':((10,0,3),6.2),'rear':((-8,-5,3.8),6.8),'side':((0,-12,2.8),6.8)}
    loc,scale=views[view];cam.location=loc;cam.data.type='ORTHO';cam.data.ortho_scale=scale
    cam.rotation_euler=(Vector((0,0,.87))-cam.location).to_track_quat('-Z','Y').to_euler()
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
        scene.camera.location=(8,-8,10);scene.camera.data.ortho_scale=8
        scene.camera.rotation_euler=(Vector((0,0,.87))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
        game_path=path.with_name('game.png' if path.name=='hero.png' else path.name.replace('-ref','-game'))
        if path.name=='hero.png':
            scene.cycles.samples=24;scene.render.resolution_x=960;scene.render.resolution_y=540
        scene.render.filepath=str(game_path.resolve());bpy.ops.render.render(write_still=True);print('RENDER OK game')
