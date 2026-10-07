"""Retro neon jukebox, measured from reference-upscaled.png.
Image: body spans x 156..886, z(pixel) 65..1385. Front face spans 160..792;
arch spring at pixel y438, apex y95; control cards y465..573; console y590..658;
speaker y670..1025; side pillars x175..253 and 666..775; base y1240..1370.
World: height 2.15m, width 1.04m, depth .55m. Arch radius .49, spring 1.48.
Front drawn in local X/Z then root rotated 90deg: world +X front, -Y near.
"""
import math, sys, json
from pathlib import Path
import bmesh, bpy
from mathutils import Matrix, Vector
HERE=Path(__file__).resolve().parent
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(name,default=None): return ARGS[ARGS.index(name)+1] if name in ARGS else default
PI=math.pi
W=.29
FONT='/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf'
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
TRUCK=bpy.data.collections.new('Jukebox'); STAGE=bpy.data.collections.new('Stage')
scene.collection.children.link(TRUCK); scene.collection.children.link(STAGE)
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


def box(name, center, size, mat, parent=None, bevel=0.02, segs=2, rot=(0, 0, 0)):
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



def stage(view):
    world = bpy.data.worlds.new('studio')
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    env = nt.nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(str(Path(bpy.utils.resource_path('LOCAL')) / 'datafiles/studiolights/world/studio.exr'))
    bg = nt.nodes['Background']
    bg.inputs['Strength'].default_value = 0.38
    nt.links.new(env.outputs['Color'], bg.inputs['Color'])
    # light-grey backdrop like the reference
    lp = nt.nodes.new('ShaderNodeLightPath')
    mix = nt.nodes.new('ShaderNodeMixShader')
    flat = nt.nodes.new('ShaderNodeBackground')
    flat.inputs['Color'].default_value = (1.4, 1.4, 1.4, 1)
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
    light('key', 'AREA', (4, -5, 6), 650, 4, (1.0, 0.93, 0.84))
    light('fill', 'AREA', (-4, -3, 4), 250, 4, (0.8, 0.88, 1.0))
    light('rim', 'AREA', (-3, 4, 5), 450, 3, (1.0, 0.85, 0.75))

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
        'ref': ((5.0, 1.9, 2.38), (0, 0, 1.08), 43),
        'front': ((5, 0, 1.2), (0, 0, 1.08), 55),
        'side': ((0, -5, 1.6), (0, 0, 1.08), 43),
        'rear': ((-5, -2, 2.5), (0, 0, 1.08), 43),
        'far': ((5, -2, 2.4), (0, 0, 1.08), 43),
        'top': ((3, -3, 6), (0, 0, 1), 43),
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



M={
'wood':material('oxblood lacquered walnut','#3b2019',.43,coat=.25),
'panel':material('dark burgundy enamel','#2d181e',.38,.18,coat=.35),
'chrome':material('aged polished nickel','#ad9493',.26,.8),
'gold':material('antique brass','#b88132',.37,.58),
'red':material('ruby red enamel','#c50019',.16,.25,coat=1),
'black':material('recess shadow','#09080c',.55),
'glass':material('smoked violet window','#211c2b',.16,.22,coat=1),
'paper':material('warm ivory song cards','#c6a48a',.65),
'ink':material('card printing','#58352d',.65),
'neon':material('warm honey illuminated diffuser','#ffc239',.27,emit='#ff9a11',strength=2.3),
'core':material('ivory light core','#fff0a5',.23,emit='#ffdf75',strength=3.2),
'edge':material('red neon piping','#c71305',.24,emit='#ff0a02',strength=1.1),
}
M['speakercloth']=material('woven_gold_cloth','#af8037',.82,.12,emit='#a4772f',strength=.45)
M['cover']=material('smoked_display_cover','#7d607d',.19,coat=.6,alpha=.075)
group('jukebox')
for g in ['cabinet','neon_arch','selection_console','speaker','ornament','back_service']:
    group(g,parent='jukebox')

def tube(name,pts,r,mat,parent='ornament'):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=1;cu.bevel_depth=r;cu.bevel_resolution=1
    sp=cu.splines.new('POLY');sp.points.add(len(pts)-1)
    for p,co in zip(sp.points,pts):p.co=(*co,1)
    o=bpy.data.objects.new(name,cu);TRUCK.objects.link(o);o.data.materials.append(M[mat])
    bpy.context.view_layer.objects.active=o
    for ob in bpy.context.view_layer.objects:ob.select_set(False)
    o.select_set(True);bpy.ops.object.convert(target='MESH');TRUCK.objects.unlink(o)
    return finish(o,None,parent,smooth=True)
def path(name,pts,r,mat,y=-.34,parent='ornament'):return tube(name,[(x,y,z) for x,z in pts],r,mat,parent)
def arch(r,z=1.48):return arc(0,z,r,0,PI,64)
def frontpanel(name,pts,mat,depth=.035,y=.3,bevel=.01,parent='cabinet'):
    return prism(name,pts,-y-depth,-y,mat,parent,bevel)
# continuous solid arched cabinet and layered rear seam
outline=[(-.52,.10),(.52,.10),(.52,1.48)]+arch(.52)[1:]+[(-.52,.10)]
prism('arched_walnut_cabinet',outline,-.26,.30,'wood','cabinet',.028,4)
prism('rear_arch_service_skin',outline,.301,.317,'panel','back_service',.012)
box('plinth', (0,0,.105),(1.13,.66,.17),'wood','cabinet',.035)
for z in [.055,.19]:box('plinth_nickel_edge',(0,-.03,z),(1.12,.65,.024),'chrome','cabinet',.01)
frontpanel('front_burgundy_face',[(-.46,.20),(.46,.20),(.46,1.48)]+arch(.46)[1:],'panel',y=.28)
# outer illuminated top arch: two glowing bands framed in ruby and nickel
for r,rad,mat in [(.495,.025,'edge'),(.477,.014,'chrome'),(.456,.033,'neon'),(.423,.010,'edge'),(.400,.036,'neon'),(.365,.012,'chrome')]:
    path('upper_arch_'+str(r),arch(r),rad,mat,y=-.325,parent='neon_arch')
for r in [.452,.396]:path('upper_arch_ivory_core'+str(r),arch(r),.009,'core',y=-.359,parent='neon_arch')
# lower U-shaped light chamber
u=[(-.216,1.12),(-.216,.72)]+arc(0,.72,.216,PI,2*PI,56)[1:]+[(.216,1.12)]
for r,mat,yy in [(.056,'edge',-.321),(.046,'neon',-.338),(.013,'core',-.384)]:path('lower_U_'+mat,u,r,mat,y=yy,parent='neon_arch')
for x in [-.283,.283]:path('inner_U_border'+str(x),[(x,1.12),(x,.72)]+[(x*math.cos(t),.72+.283*math.sin(t)) for t in ([PI+i*PI/40 for i in range(41)] if x<0 else [])],.010,'chrome',y=-.326)
# large vertical side columns with glossy dark lower shafts
for s in [-1,1]:
 x=s*.455
 cylinder('pillar_lower_'+str(s),(x,-.325,.445),.078,.48,'z','panel','cabinet',32)
 cylinder('pillar_luminous_'+str(s),(x,-.325,1.09),.061,.73,'z','neon','neon_arch',48)
 for dx in [-.046,.046]:path('pillar_red_rail'+str(s)+str(dx),[(x+dx,.72),(x+dx,1.45)],.009,'edge',y=-.369,parent='neon_arch')
 path('pillar_light_core'+str(s),[(x,.72),(x,1.45)],.012,'core',y=-.389,parent='neon_arch')
 for z,r,h in [(.10,.086,.045),(.155,.087,.027),(.193,.081,.024),(.233,.082,.025),(.69,.084,.027),(1.40,.078,.034),(1.44,.081,.029),(1.50,.079,.028)]:
  cylinder('pillar_collar_'+str(s)+str(z),(x,-.326,z),r,h,'z','chrome','cabinet',32,.005)
 for z in [.13,.175,.215,1.465]:cylinder('ruby_collar_'+str(s)+str(z),(x,-.325,z),.075,.025,'z','red','ornament',32,.004)
 # broad red capsule at control height
 box('shoulder_red_capsule'+str(s),(x,-.373,1.355),(.145,.073,.045),'red','ornament',.021,5)
 for z in [1.312,1.397]:box('shoulder_chrome_bumper'+str(s)+str(z),(x,-.357,z),(.17,.106,.033),'chrome','ornament',.016,5)
 for z in [1.15,.74]:cylinder('inner_light_brass_clamp'+str(s)+str(z),(s*.216,-.332,z),.055,.023,'z','gold','ornament',40,.004)
# upper arched window with layered bezel
win=[(-.326,1.475),(.326,1.475)]+arc(0,1.475,.326,0,PI,56)[1:]
frontpanel('arched_display_recess',win,'black',y=.319,parent='selection_console')
frontpanel('smoked_display', [(-.303,1.49),(.303,1.49)]+arc(0,1.49,.303,0,PI,56)[1:],'glass',y=.345,depth=.007,parent='selection_console')
path('display_nickel_arch',arc(0,1.48,.328,0,PI,64)+[(-.328,1.48),(.328,1.48)],.012,'chrome',y=-.368,parent='selection_console')
# visible fan of record changer cards inside window
for i in range(23):
 t=PI*.13+i*(PI*.74/22)
 x=.238*math.cos(t);z=1.5+.238*math.sin(t)
 o=box('changer_record_tab_'+str(i),(x,-.358,z),(.040,.006,.079),'gold','selection_console',.002,rot=(0,-t+PI/2,0))
 for j in range(2):path('changer_mark_'+str(i)+str(j),[(x-.012,z+j*.013),(x+.012,z+j*.013)],.001,'ink',y=-.363,parent='selection_console')
cylinder('visible_vinyl',(0,-.368,1.545),.091,.008,'y','black','selection_console',64)
for r in [.052,.06,.069,.079,.086]:path('vinyl_groove'+str(r),arc(0,1.545,r,0,2*PI,64),.0009,'chrome',y=-.375,parent='selection_console')
cylinder('record_label',(0,-.377,1.545),.026,.005,'y','gold','selection_console',40)
cylinder('record_spindle',(0,-.383,1.545),.004,.009,'y','chrome','selection_console',20)
# Layered brass record-changer rails beneath a lightly tinted cover.
for r in [.129,.157,.192,.219,.263]:
 path('changer_concentric_rail'+str(r),arc(0,1.496,r,.07*PI,.93*PI,48),.0028,'gold',y=-.376,parent='selection_console')
for s in [-1,1]:
 for j in range(5):
  x=s*(.09+j*.036);z=1.517+.021*j
  box('changer_key'+str(s)+str(j),(x,-.377,z),(.024,.006,.037),'gold','selection_console',.002)
frontpanel('display_tinted_cover',[(-.304,1.492),(.304,1.492)]+arc(0,1.492,.304,0,PI,48)[1:],'cover',y=.39,depth=.002,bevel=.002,parent='selection_console')

# rectangular selector housing, 40 song cards, rows of real lettering
box('song_selector_surround',(0,-.327,1.345),(.655,.072,.208),'red','selection_console',.022)
box('song_selector_nickel_frame',(0,-.369,1.345),(.635,.016,.19),'chrome','selection_console',.012)
box('song_selector_inset',(0,-.382,1.345),(.604,.013,.168),'black','selection_console',.006)
for side in [-1,1]:
 for col in range(4):
  x=side*(.077+col*.062)
  for row in range(4):
   z=1.28+row*.043
   box(f'song_card_{side}_{col}_{row}',(x,-.394,z),(.055,.008,.034),'paper','selection_console',.003)
   for k in range(2):path(f'card_rule_{side}_{col}_{row}_{k}',[(x-.020,z-.009+k*.017),(x+.019,z-.009+k*.017)],.0007,'ink',y=-.4,parent='selection_console')
   text(f'card_title_{side}_{col}_{row}','HITS' if row%2 else 'MUSIC',.006,(x,-.402,z),'-y','ink','selection_console',depth=.0003)
 for col in range(5):box(f'selector_vertical_{side}_{col}',(side*(.046+col*.062),-.406,1.345),(.005,.010,.169),'chrome','selection_console',.002)
box('selection_center_panel',(0,-.411,1.345),(.079,.035,.202),'panel','selection_console',.012)
for x in [-.041,.041]:path('center_selector_border'+str(x),[(x,1.24),(x,1.446)],.005,'chrome',y=-.433,parent='selection_console')
for x in [-.020,.020]:
 for i in range(3):box('selection_button'+str(x)+str(i),(x,-.437,1.28+i*.043),(.019,.020,.030),'red','selection_console',.009,4)
box('top_selector_latch',(0,-.423,1.46),(.025,.03,.07),'chrome','selection_console',.011)
box('top_selector_latch_ruby',(0,-.441,1.46),(.012,.014,.053),'red','selection_console',.006)
# console horizontal dashboard
box('control_dashboard',(0,-.326,1.167),(.647,.072,.105),'wood','selection_console',.017)
for x in [-.268,.268]:
 frontpanel('wing_control'+str(x),[(x-.049,1.132),(x+.049,1.132),(x+.042,1.201),(x-.042,1.201)],'chrome',y=.371,depth=.012,parent='selection_console')
 cylinder('dashboard_bezel'+str(x),(x,-.388,1.166),.019,.018,'y','chrome','selection_console',32)
 cylinder('dashboard_ruby'+str(x),(x,-.401,1.166),.012,.012,'y','red','selection_console',32)
for x in [-.125,.125]:box('coin_trim'+str(x),(x,-.38,1.167),(.019,.020,.071),'chrome','selection_console',.006)
box('coin_bank_frame',(0,-.373,1.169),(.139,.022,.066),'chrome','selection_console',.008)
box('coin_bank',(0,-.391,1.169),(.116,.018,.045),'gold','selection_console',.007)
for x in [-.041,.041]:box('coin_slot'+str(x),(x,-.404,1.169),(.007,.006,.037),'black','selection_console',.002)
cylinder('credit_button',(0,-.409,1.169),.019,.014,'y','red','selection_console',40,.003)
# speaker oval shadow with fine brass diamond mesh and thick nickel fretwork
sp=[(-.157,1.103),(.157,1.103),(.157,.72)]+arc(0,.72,.157,0,-PI,40)[1:]
frontpanel('speaker_recess',sp,'black',y=.305,parent='speaker')
frontpanel('gold_speaker_fabric',sp,'speakercloth',y=.348,depth=.008,parent='speaker')
for slope in [-1.7,1.7]:
 for i in range(-45,46):
  intercept=.84+i*.018
  pts=[]
  for j in range(101):
   z=.56+j*.0054;x=(z-intercept)/slope
   if abs(x)<.152 and (z>=.72 or x*x+(z-.72)**2<.152**2):pts.append((x,z))
  if len(pts)>1:path('woven_grille_'+str(slope)+'_'+str(i),[pts[0],pts[-1]],.0012,'gold',y=-.362,parent='speaker')
for slope in [-1.75,1.75]:
 for intercept in [.53,.76,.99,1.22]:
  pts=[]
  for j in range(161):
   z=.56+j*.0034;x=(z-intercept)/slope
   if abs(x)<.15 and (z>=.72 or x*x+(z-.72)**2<.15**2):pts.append((x,z))
  if len(pts)>1:
   path('fret_dark_'+str(slope)+str(intercept),[pts[0],pts[-1]],.010,'panel',y=-.369,parent='speaker')
   path('fret_nickel_'+str(slope)+str(intercept),[pts[0],pts[-1]],.006,'chrome',y=-.38,parent='speaker')
path('speaker_perimeter',sp+[sp[0]],.009,'chrome',y=-.369,parent='speaker')
# sculpted decorative scrolls and teardrop crown
for s in [-1,1]:
 for cz,sz in [(1.075,.9),(.68,.7),(.585,.55)]:
  pts=[]
  for i in range(49):
   t=i/48*PI*2.2;r=.043*(1-i/66)*sz
   pts.append((s*(.087+r*math.cos(t)),cz+r*math.sin(t)))
  path('art_deco_scroll'+str(s)+str(cz),pts,.008,'chrome',y=-.394)
 path('speaker_leaf'+str(s),[(0,1.014),(s*.008,1.06),(s*.035,1.099),(s*.071,1.119)],.009,'chrome',y=-.395)
cylinder('speaker_medallion_nickel',(0,-.401,.721),.055,.012,'y','chrome','ornament',32)
cylinder('speaker_ruby_medallion',(0,-.414,.721),.044,.012,'y','red','ornament',32)
text('medallion_music_note','♫',.055,(0,-.425,.721),'-y','gold','ornament',font='/System/Library/Fonts/Supplemental/Arial.ttf',depth=.001)
# crown bulb shaped shield and trailing base ornament
crown=[(-.078,1.86),(-.098,2.025),(-.058,2.071),(0,2.103),(.058,2.071),(.098,2.025),(.078,1.86),(0,1.846)]
frontpanel('crown_chrome_shield',crown,'chrome',y=.36,depth=.055,bevel=.025,parent='ornament')
frontpanel('crown_ruby_insert',[(x*.72,1.86+(z-1.86)*.94) for x,z in crown],'red',y=.42,depth=.035,bevel=.02,parent='ornament')
for x in [-.057,-.032,0,.032,.057]:
 path('crown_fluting'+str(x),[(x*.55,1.865),(x,1.95),(x*.9,2.055)],.007,'chrome' if abs(x)>.04 else 'red',y=-.465)
for x in [-.046,-.031,-.016,0,.016,.031,.046]:
 path('lower_deco_fan'+str(x),[(x,.232),(x,.398),(x*.42,.459),(x*.42,.548)],.007,'chrome',y=-.355)
for x in [-.265,.265]:
 cylinder('lower_panel_rivet'+str(x),(x,-.321,.46),.014,.012,'y','chrome','cabinet',24)
for s in [-1,1]:
 cylinder('front_brass_foot'+str(s),(s*.455,-.326,.042),.083,.070,'z','gold','cabinet',32,.008)
# sides, rear panel seams, vents, service handle and rubber feet
for s in [-1,1]:
 for y in [-.20,.245]:box('side_long_inlay'+str(s)+str(y),(s*.52,y,.81),(.012,.009,1.37),'gold','cabinet',.003)
for z in [.44,1.15]:
 for i in range(9):box('rear_vent_'+str(z)+str(i),(0,.332,z+i*.025),(.41,.014,.009),'black','back_service',.003)
box('rear_service_access',(0,.331,.80),(.72,.014,.46),'wood','back_service',.02)
box('rear_handle',(0,.359,.96),(.14,.044,.018),'chrome','back_service',.006)
text('rear_manufacturer','SUNSET SOUND',.043,(0,.348,.83),'+y','gold','back_service',depth=.001)
text('rear_serial','STEREOPHONIC • MODEL 1957',.018,(0,.35,.77),'+y','gold','back_service',depth=.001)
for x in [-.45,.45]:
 for y in [-.20,.24]:cylinder('rubber_foot'+str(x)+str(y),(x,y,.027),.06,.054,'z','black','cabinet',32)
# Sparse individually coloured patina facets, consolidated into one mesh.
# Geometry only: no procedural shading or image textures, fully portable glTF.
import random
rng=random.Random(1957)
patina=[material('walnut_patina_'+str(i),c,.55,.12) for i,c in enumerate(['#3e211b','#43251c','#321b17','#4c2a20','#392019'])]
verts=[];faces=[];ids=[]
for side in [-1,1]:
 for i in range(1000):
  y=rng.uniform(-.245,.294);z=rng.uniform(.215,1.475);w=rng.uniform(.0005,.003);h=rng.uniform(.003,.017)
  k=len(verts);verts.extend([(side*.521,y-w,z-h),(side*.521,y+w,z-h*.7),(side*.521,y+w*.7,z+h),(side*.521,y-w*.7,z+h*.8)])
  faces.append((k,k+1,k+2,k+3));ids.append(rng.randrange(5))
for i in range(1800):
 x=rng.uniform(-.42,.42);z=rng.uniform(.225,1.84)
 if z>1.48 and x*x+(z-1.48)**2>.36**2:continue
 w=rng.uniform(.0005,.004);h=rng.uniform(.0007,.007)
 k=len(verts);verts.extend([(x-w,-.318,z-h),(x+w,-.318,z-h*.7),(x+w*.5,-.318,z+h),(x-w*.8,-.318,z+h*.7)])
 faces.append((k,k+1,k+2,k+3));ids.append(rng.randrange(5))
me=bpy.data.meshes.new('patina_mesh');me.from_pydata(verts,[],faces);me.update()
o=bpy.data.objects.new('subtle_walnut_grain_and_age',me)
for m in patina:me.materials.append(m)
for f,mi in zip(me.polygons,ids):f.material_index=mi
finish(o,None,'cabinet',smooth=False)

# Consolidate repeated fine detail for efficient realtime draw calls.
for prefix,name in [('woven_grille_','speaker_brass_woven_mesh'),('card_rule_','song_card_print_rules'),('card_title_','song_card_print_titles'),('changer_mark_','changer_tab_printing')]:
 obs=[o for o in TRUCK.objects if o.type=='MESH' and o.name.startswith(prefix)]
 if obs:
  for o in bpy.context.view_layer.objects:o.select_set(False)
  for o in obs:
   bpy.context.view_layer.objects.active=o;o.select_set(True)
   for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
  bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=name

GROUPS['jukebox'].rotation_euler.z=PI/2
bpy.context.view_layer.update()
tris=0;meshes=0;dg=bpy.context.evaluated_depsgraph_get()
for o in TRUCK.objects:
 if o.type=='MESH':
  meshes+=1;ev=o.evaluated_get(dg);me=ev.to_mesh();me.calc_loop_triangles();tris+=len(me.loop_triangles);ev.to_mesh_clear()
print(f'BUILD OK: {meshes} meshes, {tris} triangles')
(HERE/'stats.json').write_text(json.dumps({'triangles':tris,'meshes':meshes}))
if arg('--blend'):bpy.ops.wm.save_as_mainfile(filepath=str(Path(arg('--blend')).resolve()))
if arg('--glb'):
 for o in bpy.context.view_layer.objects:o.select_set(o.name in TRUCK.objects)
 bpy.ops.export_scene.gltf(filepath=str(Path(arg('--glb')).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_lights=False,export_cameras=False)
 print('GLB OK')
if arg('--render'):
 stage(arg('--view','ref'));scene.render.filepath=str(Path(arg('--render')).resolve());bpy.ops.render.render(write_still=True);print('RENDER OK')
