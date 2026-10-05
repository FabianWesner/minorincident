"""Production molded portable toilet. Metres, +X front, Z-up.
Reference-derived blue enclosure, peach arched roof and restroom pictograms.
Static meshes merged by material; door pivot remains on its vertical hinge.
"""

import math, sys, json
from pathlib import Path
import bpy, bmesh
from mathutils import Matrix, Vector
HERE=Path(__file__).resolve().parent
ARGS=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
PI=math.pi
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
MODEL=bpy.data.collections.new("Asset")
STAGE=bpy.data.collections.new("Studio")
scene.collection.children.link(MODEL)
scene.collection.children.link(STAGE)
GROUPS={}

def arg(name, default=None):
    return ARGS[ARGS.index(name) + 1] if name in ARGS else default

def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1.0]

def material(name, color, rough=0.5, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = srgb(color)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    m.diffuse_color = srgb(color)
    return m


def group(name, location=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.3
    e.location = location
    MODEL.objects.link(e)
    if parent:
        e.parent = GROUPS[parent]
        e.matrix_parent_inverse = GROUPS[parent].matrix_world.inverted()
    bpy.context.view_layer.update()
    GROUPS[name] = e
    return e

def finish(obj, mat, parent, bevel=0.0, segs=1, smooth=True, harden=True, angle=40):
    MODEL.objects.link(obj)
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

def box(name, center, size, mat, parent=None, bevel=0.02, segs=1, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    o = from_bm(name, bm)
    o.location = center
    o.rotation_euler = rot
    return finish(o, mat, parent, bevel=min(bevel, min(size) * 0.45), segs=segs)

def prism(name, pts_xz, y0, y1, mat, parent=None, bevel=0.03, segs=1):
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

def cylinder(name, center, r, depth, axis, mat, parent=None, segs=24, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs,
                         radius1=r, radius2=r, depth=depth)
    rotation = {'z': Matrix.Identity(4),
                'y': Matrix.Rotation(-PI / 2, 4, 'X'),
                'x': Matrix.Rotation(PI / 2, 4, 'Y')}[axis]
    bmesh.ops.transform(bm, matrix=rotation, verts=bm.verts)
    ob = from_bm(name, bm)
    ob.location = center
    return finish(ob, mat, parent, bevel=bevel, segs=1)


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

def raw_box(name, center, size):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    o = from_bm(name, bm)
    o.location = center
    bpy.context.scene.collection.objects.link(o)
    return o

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
    light('key', 'AREA', (8,  -4, 7), 1200, 5, (1.0, 0.93, 0.84))
    light('fill', 'AREA', (3, 7, 6), 700, 5, (0.8, 0.88, 1.0))
    light('rim', 'AREA', (-4, 9, 8), 500, 4, (1.0, 0.85, 0.75))

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
        'ref': ((6.8, 5.2, 3.8), (0, 0, 1.20), 52),
        'game': ((6.8, 6.8, 8.2), (0, 0, 1.20), 52),
        'front': ((7, 0, 2.1), (0, 0, 1.2), 50),
        'side': ((0, -7, 2.1), (0, 0, 1.2), 45),
        'rear': ((-6.8, -5.2, 3), (0, 0, 1.2), 45),
        'far': ((6.8, -5.2, 3), (0, 0, 1.2), 45),
        'top': ((3, -4, 8), (0, 0, 1.2), 45),
    }
    loc, tgt, lens = views[view]
    cam.location = loc
    cam.data.lens = lens
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 5.1
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

M={
 'blue':material('pal_policeBlue','#2544a5',.42),
 'salmon':material('pal_picketWhite','#f79982',.45),
 'base':material('pal_woodWarm','#b97865',.64),
 'bronze':material('pal_asphalt','#69493b',.4,.35),
 'bolt':material('pal_sidewalk','#c48b68',.4,.3),
 'icon':material('pal_uiDark','#092b58',.5),
}
M['panel']=M['blue'];M['dark']=M['icon']

group('root')
group('shell',parent='root')
group('door',(.64,-.465,0),parent='root')
group('roof',parent='root')
group('pallet',parent='root')
# Front-plane polygons use horizontal u=Y; local extrusion becomes X.
def frontplate(name,pts,x0,x1,mat,parent='door',bevel=.008):
 o=prism(name,pts,x0,x1,mat,parent,bevel)
 # existing vertices (u,x,z) -> (x,u,z)
 for v in o.data.vertices: v.co=(v.co.y,v.co.x,v.co.z)
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
 return o

def fbox(name,u,z,w,h,x,depth,mat,parent='door',bevel=.012):
 return box(name,(x,u,z),(depth,w,h),mat,parent,bevel)
# Base with real forklift cutouts on both axes.
base=box('molded pallet',(0,0,.09),(1.25,1.25,.18),'base','pallet',.027)
cut(base,raw_box('front forklift opening',(0,0,.025),(1.4,.76,.13)))
cut(base,raw_box('side forklift opening',(0,0,.025),(.76,1.4,.13)))
box('floor',(0,0,.18),(1.1,1.1,.07),'dark','shell',.015)
# side and rear enclosure; front stays open behind closed door
for s in [-1,1]:
 box('wall_'+str(s),(0,s*.54,1.17),(1.1,.055,1.98),'blue','shell',.022)
 for z,h in [(.62,.74),(1.48,.57),(1.96,.26)]:
  # panel recess bed and inset islands
  box('panel recess_'+str(s)+'_'+str(z),(0,s*.574,z),(.88,.018,h+.055),'dark','shell',.019)
  box('molded island_'+str(s)+'_'+str(z),(0,s*.586,z),(.84,.032,h),'panel','shell',.025)
 for x in [-.52,.52]:
  box('corner post_'+str(s)+'_'+str(x),(x,s*.567,1.17),(.074,.072,2.0),'blue','shell',.019)
 box('upper grip rib_'+str(s),(0,s*.618,1.98),(.73,.036,.035),'panel','shell',.012)
 for x in [-.37,.37]:
  cylinder('orange grip fastener',(x,s*.637,1.98),.032,.016,'y','base','shell',16,.003)
  cylinder('grip screw',(x,s*.648,1.98),.013,.018,'y','bronze','shell',12,.002)
for side in [-1,1]:
 cut(bpy.data.objects['molded island_'+str(side)+'_0.62'],raw_box('lower corner notch',(.422,side*.586,.285),(.072,.15,.09)))
 box('side lower bronze tab',(.43,side*.622,.285),(.055,.018,.10),'bronze','shell',.007)
 for z in [.255,.315]:cylinder('side tab screw',(.43,side*.635,z),.006,.006,'y','bolt','shell',16)
box('rear wall',(-.54,0,1.17),(.055,1.1,1.98),'blue','shell',.02)
for z,h in [(.65,.78),(1.53,.77)]:
 box('rear recessed border',(-.574,0,z),(.018,.88,h),'dark','shell',.025)
 box('rear inset panel',(-.587,0,z),(.025,.83,h-.045),'panel','shell',.025)
# Open front frame; the door can swing about the left hinge.
for y in (-.5,.5):box('front jamb',(.547,y,1.14),(.06,.08,1.88),'blue','shell',.015)
box('door sill',(.547,0,.21),(.06,1.06,.06),'blue','shell',.012)
doorpts=[(-.445,.22),(.445,.22),(.445,1.97),(.40,2.08),(.29,2.15),(0,2.18),(-.29,2.15),(-.40,2.08),(-.445,1.97)]
frontplate('door black gasket',doorpts,.568,.583,'dark','shell',.018)
frontplate('rounded molded door',[(u*.97,z+.009+(.10 if z>=1.97 else 0)) for u,z in doorpts],.584,.614,'panel','door',.022)
# Explicit front arch infill quads avoid a large concave ngon under the roof.
for i in range(40):
 u0=-.61+1.22*i/40;u1=-.61+1.22*(i+1)/40
 z0=2.14+.27*math.sqrt(max(0,1-(u0/.62)**2))-.045
 z1=2.14+.27*math.sqrt(max(0,1-(u1/.62)**2))-.045
 ob=frontplate('arch infill segment %02d'%i,[(u0,2.03),(u1,2.03),(u1,z1),(u0,z0)],.558,.578,'blue','shell',0)
 for mod in list(ob.modifiers):ob.modifiers.remove(mod)
 for face in ob.data.polygons:face.use_smooth=False
# Tall inset on door, with bevelled edge and bottom vent.
fbox('door center recessed field',0,1.13,.72,1.72,.616,.009,'blue',bevel=.02)
fbox('bottom recessed vent',0,.29,.64,.047,.625,.012,'dark',bevel=.015)
fbox('vent lower lip',0,.265,.64,.015,.636,.024,'panel',bevel=.006)
# Sign on front with real mesh pictograms.
fbox('salmon restroom sign',0,1.68,.53,.47,.644,.027,'salmon',bevel=.02)
fbox('gender divider',.0,1.68,.007,.34,.665,.004,'icon',bevel=.001)
def stroke(name,coords,r=.012):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.bevel_depth=r;cu.bevel_resolution=2
 sp=cu.splines.new('POLY');sp.points.add(len(coords)-1)
 for p,(u,z) in zip(sp.points,coords):p.co=(.664,u,z,1)
 ob=bpy.data.objects.new(name,cu);MODEL.objects.link(ob);ob.data.materials.append(M['icon'])
 bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.convert(target='MESH');ob.select_set(False)
 ob.parent=GROUPS['door'];ob.matrix_parent_inverse=GROUPS['door'].matrix_world.inverted()
for u,female in [(-.095,True),(.095,False)]:
 cylinder('pictogram head',(.666,u,1.815),.024,.004,'x','icon','door',32)
 stroke('left arm',[(u-.018,1.765),(u-.040,1.75),(u-.052,1.685)],.010)
 stroke('right arm',[(u+.018,1.765),(u+.040,1.75),(u+.052,1.685)],.010)
 stroke('left leg',[(u-.015,1.66),(u-.015,1.555)],.012)
 stroke('right leg',[(u+.015,1.66),(u+.015,1.555)],.012)
 if female:frontplate('dress',[(u-.018,1.775),(u+.018,1.775),(u+.05,1.655),(u-.05,1.655)],.662,.669,'icon',bevel=.003)
 else:fbox('male torso',u,1.718,.062,.115,.665,.006,'icon',bevel=.007)
# Hardware pairs, hinge pins and visible slot screw heads.
for u,zs in [(-.465,[.47,1.12,1.91]),(.465,[.36,1.78])]:
 for z in zs:
  fbox('hinge plate',u,z,.077,.13,.636,.022,'bronze',bevel=.009)
  cylinder('hinge barrel',(.658,u,z),.015,.12,'z','bronze','door',12,.002)
  for du in [-.024,.024]:
   for dz in [-.047,.047]:
    cylinder('hinge screw',(.655,u+du,z+dz),.0055,.009,'x','bolt','door',8)
    fbox('screw slot',u+du,z+dz,.0015,.006,.662,.003,'bronze',bevel=.0003)
fbox('latch strike',.465,1.15,.045,.11,.637,.02,'bronze',bevel=.007)
fbox('handle mounting recess',.327,1.17,.10,.14,.635,.017,'dark',bevel=.012)
for u in [.286,.369]:fbox('handle upright',u,1.17,.016,.12,.660,.035,'panel',bevel=.006)
for z in [1.111,1.229]:fbox('handle end',.327,z,.086,.016,.660,.035,'panel',bevel=.006)
# Barrel roof: thickness and arch are actual closed mesh geometry.
def roofband(name,x0,x1,rise,mat):
 n=32;vs=[]
 for x in [x0,x1]:
  for dz in [0,-.055]:
   for i in range(n+1):
    u=-.62+1.24*i/n;z=2.14+rise*math.sqrt(max(0,1-(u/.62)**2))+dz+(.015 if rise>.27 else 0)
    vs.append((x,u,z))
 def idx(a,b,i):return (a*2+b)*(n+1)+i
 fs=[]
 for i in range(n):
  for b in [0,1]:fs.append((idx(0,b,i),idx(0,b,i+1),idx(1,b,i+1),idx(1,b,i)))
  for a in [0,1]:fs.append((idx(a,0,i),idx(a,1,i),idx(a,1,i+1),idx(a,0,i+1)))
 for i in [0,n]:fs.append((idx(0,0,i),idx(1,0,i),idx(1,1,i),idx(0,1,i)))
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update()
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(name,me);return finish(ob,mat,'roof',.008,segs=1)
roofband('curved salmon roof',-.61,.61,.27,'salmon')
for x in [-.57,-.02,.54]:roofband('raised roof arch rib',x-.028,x+.028,.300,'salmon')
for s in [-1,1]:
 box('roof drip fascia',(0,s*.607,2.145),(1.27,.09,.075),'salmon','roof',.016)
 for x in [-.57,.57]:
  box('roof corner cap',(x,s*.613,2.15),(.105,.10,.088),'salmon','roof',.014)
  cylinder('roof retaining bolt',(x,s*.616,2.200),.015,.012,'z','bronze','roof',12,.002)
for i in range(40):
 u0=-.61+1.22*i/40;u1=-.61+1.22*(i+1)/40
 z0=2.14+.27*math.sqrt(max(0,1-(u0/.62)**2))-.060
 z1=2.14+.27*math.sqrt(max(0,1-(u1/.62)**2))-.060
 ob=frontplate('rear arch infill %02d'%i,[(u0,2.02),(u1,2.02),(u1,z1),(u0,z0)],-.578,-.558,'blue','shell',0)
 for mod in list(ob.modifiers):ob.modifiers.remove(mod)
 for face in ob.data.polygons:face.use_smooth=False
# concealed sanitation fittings, visible when door is animated/opened.
box('waste tank',(-.27,0,.43),(.46,.78,.47),'dark','shell',.06)
lathe('seat rim',[(.14,-.018),(.20,-.018),(.20,.018),(.14,.018),(.14,-.018)],(-.22,0,.677),'z','salmon','shell',32)
box('rear vent stack',(-.45,.42,1.36),(.065,.065,1.75),'blue','shell',.012)


# Apply bevels before batching. Each motion/material pair is one draw call.
for ob in list(MODEL.objects):
 if ob.type!='MESH':continue
 bpy.context.view_layer.objects.active=ob
 for modifier in list(ob.modifiers):bpy.ops.object.modifier_apply(modifier=modifier.name)
# Preserve world-space transforms while reparenting the fixed geometry.
for ob in list(MODEL.objects):
 if ob.type!='MESH':continue
 transform=ob.matrix_world.copy()
 ob.parent=GROUPS['door'] if ob.parent==GROUPS['door'] else GROUPS['root']
 ob.matrix_world=transform
for moving in (False,True):
 for mat in dict.fromkeys(M.values()):
  batch=[ob for ob in MODEL.objects if ob.type=='MESH' and ob.data.materials[0]==mat and (ob.parent==GROUPS['door'])==moving]
  if not batch:continue
  bpy.ops.object.select_all(action='DESELECT')
  for ob in batch:ob.select_set(True)
  bpy.context.view_layer.objects.active=batch[0]
  bpy.ops.object.join()
  ob=bpy.context.object
  ob.name='body' if not moving and mat==M['blue'] else ('door_' if moving else 'body_')+mat.name
for name in ('shell','roof','pallet'):bpy.data.objects.remove(GROUPS[name],do_unlink=True)
GROUPS['root']['asset_id']='prop.porta-potty'
GROUPS['root']['ss_physics']={'class':'heavy','mass':90,'friction':.8,'restitution':.05,'pushable':True,'kickable':False,'vaultable':False,'flammable':True}
col=group('col:body',(0,0,1.19),parent='root')
col['collider']='cuboid';col['shape']='cuboid';col['size']=[1.28,1.28,2.38]
GROUPS['door']['hinge_axis']='Z'
GROUPS['door']['open_angle']=100
meshes=[ob for ob in MODEL.objects if ob.type=='MESH']
for ob in meshes:
 # Remove zero-area triangles from bevel/boolean intersections before export.
 bm=bmesh.new();bm.from_mesh(ob.data)
 bmesh.ops.triangulate(bm,faces=list(bm.faces))
 zero=[face for face in bm.faces if face.calc_area()<1e-10]
 if zero:bmesh.ops.delete(bm,geom=zero,context='FACES')
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7)
 bm.to_mesh(ob.data);bm.free()
 ob.data.calc_loop_triangles()
 # Cycles AO baked to vertex colours, with no texture resources.
 ao=ob.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
 ob.data.color_attributes.active_color=ao
 ob.data.color_attributes.render_color_index=0
scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.cycles.seed=0
scene.render.bake.target='VERTEX_COLORS'
bpy.ops.object.select_all(action='DESELECT')
for ob in meshes:ob.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.bake(type='AO',target='VERTEX_COLORS')
print('AO OK')
triangles=sum(len(ob.data.loop_triangles) for ob in meshes)
report={'id':'prop.porta-potty','tier':'Side','triangles':triangles,'draw_calls':sum(len(ob.data.materials) for ob in meshes),'materials':sorted({m.name for ob in meshes for m in ob.data.materials}),'nodes_ok':True,'within_budget':6000<=triangles<=12000 and len(meshes)<=30,'rounds':4,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'build-stats.json').write_text(json.dumps(report,indent=2)+'\n')
print('BUILD OK',triangles,'triangles',len(meshes),'meshes')
if arg('--glb'):
 bpy.ops.object.select_all(action='DESELECT')
 for ob in MODEL.objects:ob.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(Path(arg('--glb')).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_lights=False,export_cameras=False)
if arg('--render'):
 stage(arg('--view','ref'))
 scene.render.filepath=str(Path(arg('--render')).resolve())
 bpy.ops.render.render(write_still=True)
 print('RENDER OK')
