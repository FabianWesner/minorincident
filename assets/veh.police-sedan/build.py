"""Sunset Grove police sedan. Metres, +X forward, +Z up, tyre contact z=0.
Deterministic hero geometry; rigid door/wheel/light assemblies have joint origins.
Static geometry is evaluated and merged by material before GLB export.
Run exclusively through experiment/tools/blender_run.py.
"""
import math
import sys
import json
from pathlib import Path
import bmesh
import bpy
from mathutils import Matrix, Vector
HERE = Path(__file__).resolve().parent
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PI = math.pi
W = .91
FONT = '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf'
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
ASSET_COLLECTION = bpy.data.collections.new('PoliceSedan')
STAGE = bpy.data.collections.new('Stage')
scene.collection.children.link(ASSET_COLLECTION)
scene.collection.children.link(STAGE)
GROUPS = {}

def arg(name, default=None):
    return ARGS[ARGS.index(name) + 1] if name in ARGS else default

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

def group(name, location=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.3
    e.location = location
    ASSET_COLLECTION.objects.link(e)
    if parent:
        e.parent = GROUPS[parent]
        e.matrix_parent_inverse = GROUPS[parent].matrix_world.inverted()
    bpy.context.view_layer.update()
    GROUPS[name] = e
    return e

def finish(obj, mat, parent, bevel=0.0, segs=3, smooth=True, harden=True, angle=40):
    ASSET_COLLECTION.objects.link(obj)
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
    ASSET_COLLECTION.objects.link(o)
    o.data.materials.append(M[mat] if isinstance(mat, str) else mat)
    bpy.context.view_layer.objects.active = o
    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.view_layer.objects.active
    ASSET_COLLECTION.objects.unlink(o)
    if parent:
        o.parent = None
    return finish(o, None, parent, smooth=False)

def cut(target, cutter_obj):
    """Apply an exact solid subtraction and discard its temporary cutter."""
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
    return mesh(name,verts,faces,mat,bevel=.065)

def surf(name,vs,mat,par='body'):
    o=mesh(name,vs,[tuple(range(len(vs)))],mat,par,0)
    sol=o.modifiers.new('panel thickness','SOLIDIFY'); sol.thickness=.012
    return o

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
        'ref': ((6.7, 9.0, 4.7), (0, 0, .85), 61),
        'game': ((8.4, -8.4, 9.2), (0, 0, .8), 48),
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
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.render.resolution_x = int(arg('--width', 1837))
    scene.render.resolution_y = int(arg('--height', 856))

# Nine shared palette materials, scalar Principled shading only.
M = {
    'paint': material('pal_uiDark', '#25222c', .39, .05, .3),
    'white': material('pal_picketWhite', '#f2e6dc', .36, 0, .4),
    'glass': material('pal_asphalt', '#5b4f5c', .25, .05, .25, alpha=.88),
    'metal': material('pal_sidewalk', '#b9a4a0', .25, .75),
    'gold': material('pal_schoolBusYellow', '#f2b630', .32, .55),
    'badgeblue': material('pal_policeBlue', '#2f6bff', .35),
    'red': material('emi_sirenRed', '#ff2d2d', .23, emit='#ff2d2d', strength=1.4),
    'blue': material('emi_policeBlue', '#2f6bff', .23, emit='#2f6bff', strength=1.5),
    'head': material('emi_windowGlow', '#ffc773', .2, emit='#ffc773', strength=2.2),
}
# Rubber, grille, trim, steel wheel and body use the same dark material.
M['black'] = M['rubber'] = M['paint']
root = group('veh.police-sedan')
group('body', parent='veh.police-sedan')
group('lightsFront',(2.48,0,.83),parent='body')
group('lightsBrake',(-2.49,0,.79),parent='body')
root['assetId'] = 'veh.police-sedan'
root['tier'] = 'Hero'
root['aoAttribute'] = 'COLOR_0'
root['lodFiles'] = json.dumps(['model.glb','model.lod1.glb','model.lod2.glb'])
root['ss_physics'] = json.dumps({'class':'heavy', 'mass':1750, 'friction':.7, 'restitution':.08,
    'centerOfMass':[0,.65,0], 'pushable':False, 'kickable':False, 'flammable':True})

# Body loft follows the curved nose, fender shoulders, belt and rear deck.
body = loft('body_shell', [(-2.48,.83,.35,.86,.96),(-2.25,.93,.34,1.02,1.07),
    (-1.5,.94,.32,1.05,1.11),(-.7,.93,.32,1.06,1.12),(.9,.93,.32,1.04,1.10),
    (1.7,.92,.34,.98,1.04),(2.38,.87,.36,.86,.94),(2.48,.80,.40,.82,.89)], 'paint')
for ax in [-1.47,1.44]:
    cut(body,raw_cyl('arch_cut',(ax,0,.40),.455,2.4))
box('undercarriage',(0,0,.29),(4.5,1.5,.15),'black','body',.045)
cab = loft('cabin_shell',[(-1.46,.88,1.02,1.08,1.10),(-.95,.77,1.05,1.48,1.60),
    (-.64,.75,1.06,1.58,1.67),(.52,.75,1.06,1.57,1.65),(1.22,.87,1.02,1.09,1.12)],'white')
cut(cab,raw_box('hollow_cabin',(-.10,0,1.30),(2.6,1.35,.58)))
SIDES = [(-1,'L'),(1,'R')]
window_names = []
for side,sn in SIDES:
    sy=lambda y:side*y
    front='door'+sn; rear='doorRear'+sn
    group(front,(1.14,sy(.94),.95),parent='body')
    group(rear,(.04,sy(.94),.95),parent='body')
    # Doors contain their own glass, handles, frames and livery.
    for xa,xb,g in [(-1.23,.065,rear),(.085,1.17,front)]:
        door=plate('panel_'+g,[(xa,.43),(xb,.43),(xb,1.09),(xa,1.09)],side,.028,
                   'white',g,y_skin=.936,bevel=.025)
        for ax in [-1.47,1.44]:cut(door,raw_cyl('door_arch',(ax,0,.40),.463,2.4))
        box('handle_'+g,(xa+.18,sy(.986),1.005),(.205,.04,.06),'black',g,.024)
        box('sill_'+g,((xa+xb)/2,sy(.961),.415),(xb-xa,.031,.065),'black',g,.015)
    for name,pts,g in [('front_window_'+sn,[(.14,sy(.893),1.115),(1.08,sy(.871),1.115),
                           (.485,sy(.772),1.574),(.14,sy(.769),1.585)],front),
                       ('rear_window_'+sn,[(-1.265,sy(.873),1.12),(.025,sy(.893),1.115),
                           (.025,sy(.769),1.586),(-.73,sy(.783),1.575)],rear)]:
        surf(name,pts,'glass',g);window_names.append(name)
    box('B_pillar_'+sn,(.085,sy(.813),1.35),(.06,.035,.51),'white','body',.012,rot=(side*.20,0,0))
    # Solid livery is split at the door seam; both halves follow their door.
    livery=text('livery_'+sn,'POLICE',.52,(-.25,sy(.981),.745),
                '-y' if side<0 else '+y','black',front,
                font='/System/Library/Fonts/Supplemental/Impact.ttf',stretch=1.02)
    back=livery.copy();back.data=livery.data.copy();ASSET_COLLECTION.objects.link(back)
    mw=livery.matrix_world.copy();back.parent=GROUPS[rear]
    back.matrix_world=mw;back.name='livery_rear_'+sn
    cut(livery,raw_box('letter_split_front',(-4.911,sy(.981),.75),(10,1,2)))
    cut(back,raw_box('letter_split_rear',(5.061,sy(.981),.75),(10,1,2)))
    # Gold shield, blue enamel center, raised star and ornamental outline.
    bx,bz=.82,.755
    shield=[(bx+.165*u,bz+.235*v) for u,v in [(0,1),(.35,.75),(.8,.67),(1,.4),
             (.78,-.55),(0,-1),(-.78,-.55),(-1,.4),(-.8,.67),(-.35,.75)]]
    plate('shield_'+sn,shield,side,.015,'gold',front,y_skin=.976,bevel=.004)
    inset=[(bx+(x-bx)*.82,bz+(z-bz)*.83) for x,z in shield]
    plate('shield_inset_'+sn,inset,side,.007,'black',front,y_skin=.994,bevel=.003)
    cylinder('shield_enamel_'+sn,(bx,sy(1.008),bz),.115,.016,'y','badgeblue',front,segs=40)
    star=[]
    for k in range(10):
        a=PI/2+k*PI/5;r=.095 if k%2==0 else .042
        star.append((bx+r*math.cos(a),bz+r*math.sin(a)))
    plate('badge_star_'+sn,star,side,.009,'gold',front,y_skin=1.02,bevel=.002)
    text('badge_label_'+sn,'POLICE',.046,(bx,sy(1.014),bz+.158),'-y' if side<0 else '+y',
         'gold',front,font='/System/Library/Fonts/Supplemental/Arial Bold.ttf',depth=.006)
    text('town_'+sn,'SUNSET GROVE',.031,(bx,sy(1.014),bz-.17),'-y' if side<0 else '+y',
         'gold',front,font='/System/Library/Fonts/Supplemental/Arial Bold.ttf',depth=.006)
    text('emergency_'+sn,'911',.17,(-1.99,sy(.955),.92),'-y' if side<0 else '+y',
         'white','body',font='/System/Library/Fonts/Supplemental/Arial Bold.ttf')
    box('mirror_arm_'+sn,(.94,sy(.96),1.12),(.11,.24,.06),'black',front,.023)
    box('mirror_'+sn,(.96,sy(1.075),1.18),(.255,.17,.16),'paint',front,.065,segs=4)
    box('mirror_lens_'+sn,(.827,sy(1.075),1.18),(.009,.12,.095),'glass',front,.012)
    box('side_indicator_'+sn,(1.75,sy(.936),.93),(.085,.025,.037),'head','lightsFront',.01)
    box('fuel_flap_'+sn,(-1.80,sy(.948),.9),(.17,.015,.16),'paint','body',.026)
    for ax,an in [(-1.47,'rear'),(1.44,'front')]:
        plate('arch_lip_'+an+sn,arc(ax,.40,.48,0,PI,32)+arc(ax,.40,.457,PI,0,32),
              side,.022,'paint','body',y_skin=.946,bevel=.006)

surf('windshield',[(1.185,-.78,1.164),(1.185,.78,1.164),(.557,.672,1.645),(.557,-.672,1.645)],'glass')
surf('rear_windshield',[(-1.41,.82,1.142),(-1.41,-.82,1.142),(-.83,-.705,1.612),(-.83,.705,1.612)],'glass')
window_names += ['windshield','rear_windshield']
# Genuine apertures in the white shell. The glass is offset >3mm outside their lip.
for name in window_names:
    original=bpy.data.objects[name];cutter=original.copy();cutter.data=original.data.copy();ASSET_COLLECTION.objects.link(cutter)
    mw=original.matrix_world.copy();cutter.parent=None;cutter.matrix_world=mw
    for mod in list(cutter.modifiers):cutter.modifiers.remove(mod)
    solid=cutter.modifiers.new('aperture','SOLIDIFY');solid.thickness=.25;solid.offset=0
    bpy.context.view_layer.objects.active=cutter;bpy.ops.object.modifier_apply(modifier=solid.name)
    cut(cab,cutter)
for y in [-.39,.39]:box('wiper_'+str(y),(1.075,y,1.20),(.027,.61,.026),'black','body',.009,rot=(0,.63,-.13))
hood=text('hood_police','POLICE',.31,(1.76,0,1.081),'-y','white','body',depth=.006,
          font='/System/Library/Fonts/Supplemental/Arial Bold.ttf')
hood.rotation_euler=(.14,0,PI/2)
hood.location.z=1.047
# Recessed hood outline and trunk seam, fine but visible at hero distance.
for side,sn in SIDES:
    box('hood_seam_'+sn,(1.76,side*.655,1.069),(.94,.014,.015),'black','body',.005,rot=(0,.105,0))
box('trunk_seam',(-1.9,0,1.086),(.012,1.52,.018),'black','body',.004)

# Four tyre profiles close at the bead; 10 physical steel vent openings per rim.
for ax,an in [(-1.47,'R'),(1.44,'F')]:
    cylinder('axle_'+an,(ax,0,.40),.06,1.7,'y','black','body',segs=24)
    for side,sn in SIDES:
        g='wheel'+an+sn;c=(ax,side*.895,.40);group(g,c,parent='body');out='-y' if side<0 else 'y'
        lathe(g+'_tyre',[(.26,-.143),(.334,-.145),(.375,-.115),(.393,-.07),(.40,0),
              (.393,.07),(.375,.115),(.334,.145),(.26,.143),(.26,-.143)],c,out,'rubber',g,segs=48)
        rim=lathe(g+'_steel',[(.001,.10),(.14,.10),(.19,.075),(.237,.08),(.265,.123),
                  (.278,.128),(.286,.105),(.28,-.10),(.001,-.10)],c,out,'black',g,segs=48)
        for k in range(10):
            a=k*2*PI/10
            cut(rim,raw_cyl('vent',(ax+.215*math.cos(a),side*1.01,.40+.215*math.sin(a)),.026,.19,segs=12))
        lathe(g+'_hub',[(.001,.164),(.09,.16),(.116,.14),(.12,.11)],c,out,'metal',g,segs=40)
        lathe(g+'_rimlip',[(.268,.126),(.28,.131),(.287,.12),(.28,.11)],c,out,'metal',g,segs=48)
        for k in range(5):
            a=k*2*PI/5;cylinder(g+'_lug'+str(k),(ax+.139*math.cos(a),side*1.022,.40+.139*math.sin(a)),
                               .013,.021,'y','metal',g,segs=8)
        for k in range(44):
            a=k*2*PI/44
            box(g+'_tread'+str(k),(ax+.397*math.cos(a),side*.895,.40+.397*math.sin(a)),
                (.012,.235,.006),'black',g,.002,segs=1,rot=(0,PI/2-a,0))

# Bumpers, recessed lattice grille, headlights, tail lights and rubber push bar.
for x,n in [(2.43,'front'),(-2.44,'rear')]:
    box(n+'_bumper',(x,0,.50),(.24,1.80,.29),'paint','body',.095,segs=4)
    box(n+'_rub_strip',(x+(.129 if x>0 else -.129),0,.57),(.026,1.65,.063),'black','body',.018)
box('grille_bezel',(2.485,0,.82),(.048,.94,.27),'metal','body',.027)
box('grille_recess',(2.514,0,.82),(.025,.88,.21),'black','body',.018)
for i in range(16):
    y=-.41+i*.055
    for angle in [-.55,.55]:
        box('grille_diamond',(2.536,y,.82),(.012,.009,.215),'metal','body',.003,segs=2,rot=(angle,0,0))
# Fictional Sunset Grove star instead of a real automobile brand.
cylinder('grille_medallion',(2.55,0,.82),.035,.014,'x','metal','body',segs=24)
for side,sn in SIDES:
    box('headlight_frame_'+sn,(2.432,side*.65,.825),(.09,.40,.255),'metal','body',.041)
    box('headlight_'+sn,(2.485,side*.61,.835),(.055,.28,.20),'head','lightsFront',.027)
    box('front_turn_'+sn,(2.47,side*.805,.825),(.04,.105,.19),'head','lightsFront',.023)
    for k in range(6):box('lens_flute_'+sn+str(k),(2.518,side*.61-.10+k*.039,.835),(.006,.005,.173),
                           'head','lightsFront',.002,segs=1)
    box('tail_lamp_'+sn,(-2.487,side*.72,.80),(.045,.205,.25),'red','lightsBrake',.044)
    box('tail_reverse_'+sn,(-2.515,side*.72,.80),(.012,.155,.062),'head','lightsBrake',.009)
    box('push_upright_'+sn,(2.69,side*.52,.64),(.16,.13,.81),'black','body',.06,segs=4,rot=(0,-.10,0))
    box('push_pad_'+sn,(2.79,side*.52,.72),(.057,.135,.63),'rubber','body',.025)
    for z in [.43,.94]:cylinder('push_bolt_'+sn,(2.827,side*.52,z),.016,.018,'x','metal','body',segs=10)
    box('lower_intake_'+sn,(2.562,side*.63,.42),(.016,.31,.079),'black','body',.015)
    cylinder('fog_lens_'+sn,(2.575,side*.66,.42),.033,.013,'x','head','lightsFront',segs=24)
for z in [.32,.62,.97]:box('push_crossbar',(2.69,0,z),(.11,1.04,.08),'black','body',.028)
for x in [2.585,-2.585]:
    box('license',(x,0,.47),(.016,.32,.135),'white','body',.009)
    text('license_text','SG 104',.042,(x+(.013 if x>0 else -.013),0,.47),'+x' if x>0 else '-x',
         'black','body',depth=.006,font='/System/Library/Fonts/Supplemental/Arial Bold.ttf')
group('spotlight',(1.13,-1.,1.34),parent='body')
cylinder('spotlight_stalk',(1.13,-1.,1.31),.027,.22,'z','black','spotlight',segs=24)
lathe('spotlight_shell',[(.001,-.09),(.066,-.07),(.096,-.015),(.10,.045),(.078,.067)],
      (1.17,-1.,1.43),'x','black','spotlight',segs=32)
cylinder('spotlight_lens',(1.245,-1.,1.43),.075,.01,'x','metal','spotlight',segs=32)
cylinder('antenna',(-1.88,.54,1.3),.008,.48,'z','black','body',segs=12)

# Seats and dashboard behind the tinted glazing.
for y in [-.38,.38]:
    box('seat_cushion',(.10,y,1.09),(.44,.44,.13),'black','body',.07)
    box('seat_back',(-.09,y,1.28),(.15,.43,.39),'black','body',.065,rot=(0,-.12,0))
    box('headrest',(-.10,y,1.53),(.14,.27,.17),'black','body',.05)
box('rear_bench',(-.87,0,1.2),(.23,1.21,.31),'black','body',.07)
box('dashboard',(.81,0,1.18),(.29,1.43,.16),'black','body',.05)
lathe('steering_wheel',[(.125,-.008),(.143,-.005),(.149,.009),(.143,.02),(.125,.018)],
      (.55,-.39,1.32),'x','black','body',segs=32)
box('steering_hub',(.55,-.39,1.32),(.02,.16,.06),'black','body',.015)

# Red caps, blue center, inset LED strips, and a separately pivoted lightbar.
group('lightbar',(0,0,1.71),parent='body')
group('sirenL',(0,-.60,1.84),parent='lightbar')
group('sirenR',(0,.0,1.84),parent='lightbar')
for y in [-.58,.58]:box('lightbar_mount',(0,y,1.70),(.30,.13,.10),'black','lightbar',.024)
box('lightbar_base',(0,0,1.765),(.32,1.57,.065),'black','lightbar',.026)
for i in range(8):
    y=-.665+i*.19;red=i in [0,1,6,7];g='sirenL' if red else 'sirenR'
    box('lightbar_lens'+str(i),(0,y,1.852),(.30,.183,.155),'red' if red else 'blue',g,.026,segs=4)
    for x in [-.155,.155]:
        box('LED_frame',(x,y,1.852),(.014,.145,.082),'black','lightbar',.007)
        for k in range(4):box('LED',(x*1.04,y-.05+k*.033,1.852),(.01,.023,.053),'head',g,.003,segs=2)

# Apply modifiers and join each rigid assembly by material; keep its joint empty.
# This produces one primitive per material, with no disconnected animation parts.
for ob in list(ASSET_COLLECTION.objects):
    if ob.type!='MESH':continue
    bpy.context.view_layer.objects.active=ob
    for mod in list(ob.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
for g in GROUPS.values():
    mats=set(o.data.materials[0] for o in g.children if o.type=='MESH')
    for mat in sorted(mats,key=lambda m:m.name):
        obs=[o for o in g.children if o.type=='MESH' and o.data.materials[0]==mat]
        bpy.ops.object.select_all(action='DESELECT')
        for ob in obs:ob.select_set(True)
        ob=obs[0];bpy.context.view_layer.objects.active=ob
        bpy.ops.object.join();ob.name=g.name+'_'+mat.name
        # Exact pivot at parent joint, not the first component's origin.
        bpy.context.scene.cursor.location=g.matrix_world.translation
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
        ob['assembly']=g.name

for name,loc in [('driverSeat',(.1,-.38,1.10)),('exitL',(.5,-1.5,0)),('exitR',(.5,1.5,0))]:
    group(name,loc,parent='veh.police-sedan')
col=group('col:chassis',(0,0,.94),parent='veh.police-sedan')
col['collider']='cuboid';col['shape']='cuboid';col['size']=[5.1,1.85,1.65]

def anchor(name,loc,kind,color,nodes,intensity=3,range_=8,strobe=False):
    ob=group('light:'+name,loc,parent='veh.police-sedan')
    ob['ss_light']=json.dumps(dict(type=kind,color=color,intensity=intensity,range=range_,
        angle=48,penumbra=.35,pool=True,beam='soft' if kind=='spot' else 'none',
        flare=True,reflect=True,shadow='hero' if kind=='spot' else 'none',heroPriority=2,
        flicker='none',animation={'strobe':'police'} if strobe else None,powerGroup='self',
        breakable=True,emissiveNodes=nodes,tiers='all'))
    if kind=='spot':ob.rotation_euler=Vector((1,0,-.085)).to_track_quat('-Z','Y').to_euler()
    return ob
for side,sn in SIDES:
    anchor('headlight'+sn,(2.53,side*.61,.835),'spot','light_window_warm',
           ['lightsFront_emi_windowGlow'],5,24)
    anchor('brake'+sn,(-2.52,side*.72,.8),'point','light_siren_red',['lightsBrake_emi_sirenRed'],2,3)
anchor('sirenL',(0,-.60,1.86),'beacon','light_siren_red',['sirenL_emi_sirenRed','sirenL_emi_windowGlow'],5,12,True)
anchor('sirenR',(0,0,1.86),'beacon','light_siren_blue',['sirenR_emi_policeBlue','sirenR_emi_windowGlow'],5,12,True)
# Reverse and indicator emitters belong to the same controllable lamp assemblies.
for ob in ASSET_COLLECTION.objects:
    if ob.type=='MESH' and any(m.name.startswith('emi_') for m in ob.data.materials):ob['decorativeEmissive']=True

# Center the complete silhouette (including the push bar) on X/Y.
# Keep root at the origin; all joint and socket placements receive the same offset.
for ob in list(root.children):ob.location.x-=.12
bpy.context.view_layer.update()

lod=int(arg('--lod',0))
if lod:
    for ob in ASSET_COLLECTION.objects:
        if ob.type!='MESH':continue
        dec=ob.modifiers.new('LOD simplification','DECIMATE');dec.ratio=.14 if lod==1 else .04
        bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=dec.name)
# Remove numerical slivers from boolean cuts and LOD collapse. No visual-size faces
# are removed; the cutoff is less than one millionth of a square metre.
for ob in ASSET_COLLECTION.objects:
    if ob.type!='MESH':continue
    bm=bmesh.new();bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces))
    tiny=[f for f in bm.faces if f.calc_area()<1e-8]
    if tiny:bmesh.ops.delete(bm,geom=tiny,context='FACES_ONLY')
    loose=[v for v in bm.verts if not v.link_faces]
    if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
    bm.to_mesh(ob.data);bm.free();ob.data.update()

# Optional deterministic vertex AO bake on final mesh assemblies, no texture assets.
if arg('--glb') and '--skip-ao' not in ARGS:
    scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=104
    scene.cycles.device='CPU';scene.render.bake.target='VERTEX_COLORS'
    for ob in ASSET_COLLECTION.objects:
        if ob.type!='MESH':continue
        attr=ob.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER')
        ob.data.color_attributes.active_color=attr
        bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
        bpy.ops.object.bake(type='AO')

bpy.context.view_layer.update()
tris=0
for ob in ASSET_COLLECTION.objects:
    if ob.type=='MESH':ob.data.calc_loop_triangles();tris+=len(ob.data.loop_triangles)
draws=sum(len(set(ob.data.materials)) for ob in ASSET_COLLECTION.objects if ob.type=='MESH')
print(f'BUILD OK: {tris} triangles, {draws} draw calls')
if arg('--glb'):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in ASSET_COLLECTION.objects:ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(arg('--glb')).resolve()),export_format='GLB',
        use_selection=True,export_apply=True,export_yup=True,export_extras=True,
        export_lights=False,export_cameras=False)
    print('GLB OK',arg('--glb'))
if arg('--render'):
    stage(arg('--view','ref'))
    scene.render.filepath=str(Path(arg('--render')).resolve());bpy.ops.render.render(write_still=True)
    print('RENDER OK',arg('--render'))
