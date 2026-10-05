"""Sunset Fuel pump. Metres, +X front, Z up, ground at zero.
Self-contained because sslib is not yet present. Static meshes join by material;
service door and nozzle retain joint pivots. All applied markings clear 3 mm.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
for key in ('render', 'glb'):
    parser.add_argument('--' + key)
parser.add_argument('--view', default='ref')
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
a = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def material(token, color, metallic=0, emission=0):
    m = bpy.data.materials.new(('emi_' if emission else 'pal_') + token)
    rgb = [int(color[i:i+2], 16)/255 for i in (0, 2, 4)]
    rgba = tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in rgb) + (1,)
    m.diffuse_color = rgba
    m.use_nodes = True
    bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = rgba
    bs.inputs['Metallic'].default_value = metallic
    bs.inputs['Roughness'].default_value = .34 if token == 'survivorRed' else .55
    if emission:
        bs.inputs['Emission Color'].default_value = rgba
        bs.inputs['Emission Strength'].default_value = emission
    return m

red = material('survivorRed', 'd9363e')
cream = material('picketWhite', 'f2e6dc')
dark = material('uiDark', '25222c')
steel = material('sidewalk', 'b9a4a0', .65)
rust = material('woodWarm', 'b0703f')
glow = material('windowGlow', 'f2e6dc', emission=.12)
materials = [red, cream, dark, steel, rust, glow]

def empty(name, location=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    scene.collection.objects.link(o)
    o.location = location
    if parent:
        o.parent = parent
    return o

root = empty('root')
root['asset_id'] = 'prop.gas-pump'
body = empty('body', parent=root)
door = empty('door_service', (.28, .31, .28), root)
nozzle = empty('nozzle', (0, -.43, 1.64), root)
lamp = empty('lamp_globe', (0, 0, 2.455), root)

def finish(o, name, mat, parent=body, bevel=0, segments=2):
    o.name = name
    o.data.materials.append(mat)
    if bevel:
        mod = o.modifiers.new('rounded edges', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if o.type == 'MESH':
        for p in o.data.polygons:
            p.use_smooth = True
        mod = o.modifiers.new('weighted normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.update()
    world = o.matrix_world.copy()
    o.parent = parent
    o.matrix_world = world
    return o

def box(name, loc, size, mat, bevel=.015, parent=body):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, name, mat, parent, min(bevel, min(size)*.45))

def cylinder(name, loc, radius, depth, mat, axis='Z', parent=body, verts=32):
    rotation = {'X': (0, math.pi/2, 0), 'Y': (math.pi/2, 0, 0), 'Z': (0, 0, 0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rotation)
    return finish(bpy.context.object, name, mat, parent, .004, segments=1)

def tube(name, points, radius, mat, parent=body, resolution=8):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = resolution
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    curve.use_fill_caps = True
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for bp, point in zip(spline.bezier_points, points):
        bp.co = point
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    o = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.object, name, mat, parent)

def text(name, words, loc, size, mat, parent=door):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = words
    curve.align_x = curve.align_y = 'CENTER'
    curve.size = size
    curve.extrude = .0015
    curve.resolution_u = 3
    o = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (math.pi/2, 0, math.pi/2)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.object, name, mat, parent)

def rounded_loop(w, h, r):
    points = []
    for cy, cz, angle in [(w/2-r, h/2-r, 0), (-w/2+r, h/2-r, 90), (-w/2+r, -h/2+r, 180), (w/2-r, -h/2+r, 270)]:
        for i in range(7):
            t = math.radians(angle+i*90/6)
            points.append((cy+r*math.cos(t), cz+r*math.sin(t)))
    return points

def frame(name, x, z, w, h, bar, radius, mat, parent=door):
    outer = rounded_loop(w, h, radius)
    inner = rounded_loop(w-2*bar, h-2*bar, radius-bar)
    n = len(outer)
    verts = [(xx, y, zz+z) for xx in (x, x+.026) for loop in (outer, inner) for y, zz in loop]
    faces = []
    for i in range(n):
        j = (i+1)%n
        faces += [(i,j,n+j,n+i), (2*n+i,3*n+i,3*n+j,2*n+j), (i,2*n+i,2*n+j,j), (n+i,n+j,3*n+j,3*n+i)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    o = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(o)
    return finish(o, name, mat, parent)

# Tall enamel cabinet, rounded crown and heavy stepped cast plinth.
plinth = box('cast plinth', (0,0,.085), (.68,.94,.17), dark, .025)
for vertex in plinth.data.vertices:
    factor = 1 - .075 * (vertex.co.z/.17 + .5)
    vertex.co.x *= factor
    vertex.co.y *= factor
box('plinth metal bead', (0,0,.175), (.635,.88,.035), steel, .014)
box('red foot', (0,0,.215), (.59,.83,.075), red, .024)
box('cabinet shell', (0,0,1.075), (.51,.77,1.72), red, .06)
box('shoulder', (0,0,1.985), (.54,.79,.25), red, .105)
box('shoulder belt', (0,0,1.871), (.563,.817,.039), steel, .016)
box('door shadow seam', (.26,0,1.037), (.028,.638,1.627), dark, .023)
box('ivory enamel door', (.28,0,1.037), (.028,.613,1.61), cream, .021, door)
box('rear access panel', (-.262,0,1.04), (.025,.615,1.61), red, .023)
# Deep layered counter: actual open frame, ivory backing, dark drum apertures.
box('meter backing', (.302,0,1.519), (.012,.452,.546), cream, .035, door)
frame('counter outer bezel', .301,1.519,.486,.585,.034,.067,steel)
frame('counter shadow lip', .311,1.519,.418,.517,.008,.035,dark)
for row, (z, count, width) in enumerate([(1.684,4,.064),(1.50,3,.066),(1.355,2,.082)]):
    for i in range(count):
        y = (i-(count-1)/2)*(width+.010 if row<2 else .127)
        box('drum metal lip', (.315,y,z), (.014,width+.009,.096), steel,.007,door)
        box('counter drum', (.327,y,z), (.012,width,.083),dark,.005,door)
        text('mechanical zero','0',(.341,y,z),.073,cream)
for y in (-.253,.253):
    for z in (.32,1.14):
        cylinder('door screw', (.305,y,z), .016,.015,steel,'X',door,16)
        box('screw slot', (.319,y,z),(.006,.017,.0035),dark,0,door)
for z in (.55,.88):
    box('service hinge',(.282,.32,z),(.048,.038,.10),steel,.008)
box('shoulder inset outline',(.273,0,1.94),(.018,.62,.102),dark,.018)
box('shoulder raised panel',(.286,0,1.946),(.017,.598,.09),red,.016)
box('brand plaque',(.303,0,1.969),(.018,.35,.074),cream,.010)
text('fictional brand','SUNSET FUEL',(.320,0,1.969),.038,dark,body)
# Milk-glass star globe, with a distinct substantial red housing.
cylinder('neck dark footing',(0,0,2.132),.12,.040,dark)
cylinder('neck red collar',(0,0,2.157),.115,.026,red)
cylinder('globe shell',(0,0,2.455),.292,.15,red,'X',lamp,48)
for side in (-1,1):
    cylinder('globe rim',(side*.074,0,2.455),.277,.028,red,'X',lamp,48)
    cylinder('globe milk glass',(side*.093,0,2.455),.254,.019,glow,'X',lamp,48)
    vertices = [(side*.143,0,2.455)]
    for i in range(10):
        angle=math.pi/2+i*math.pi/5
        radius=.202 if i%2==0 else .084
        vertices.append((side*.111,radius*math.cos(angle),2.455+radius*math.sin(angle)))
    faces = [(0,1+i,1+(i+1)%10) if side==1 else (0,1+(i+1)%10,1+i) for i in range(10)]
    mesh=bpy.data.meshes.new('faceted star')
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    o=bpy.data.objects.new('embossed star',mesh)
    scene.collection.objects.link(o)
    finish(o,'embossed star',red,lamp)
    for p in mesh.polygons: p.use_smooth=False
anchor=empty('light:globe',(0,0,2.455),root)
anchor['ss_light']=json.dumps({'type':'point','color':'light_sodium','intensity':.5,'range':2.0,'pool':True,'beam':'none','flare':False,'reflect':True,'shadow':'none','heroPriority':0,'flicker':'none','animation':None,'powerGroup':'self','breakable':True,'emissiveNodes':['lamp_globe_emi_windowGlow'],'tiers':'all'})
# Generous loop, docked spout, grip, exposed trigger guard, and ferrules.
tube('fuel hose',[(0,-.421,.70),(0,-.455,.49),(.03,-.69,.35),(.08,-.85,.38),(.12,-.87,.60),(.13,-.69,.98),(.13,-.59,1.26)],.034,dark)
box('hose anchor',(0,-.407,.73),(.078,.042,.17),red,.014)
cylinder('nozzle dock',(0,-.411,1.64),.096,.047,steel,'Y')
cylinder('dock throat',(0,-.443,1.64),.067,.018,dark,'Y')
tube('bent nozzle spout',[(0,-.46,1.64),(0,-.51,1.63),(.05,-.565,1.59),(.10,-.586,1.53)],.029,steel,nozzle,6)
grip=box('nozzle grip',(.12,-.586,1.407),(.070,.075,.262),steel,.019,nozzle)
grip.rotation_euler.y=.12
box('nozzle head',(.105,-.582,1.529),(.10,.09,.09),steel,.020,nozzle)
cylinder('nozzle ferrule',(.13,-.586,1.275),.039,.047,steel,'Z',nozzle,32)
tube('trigger guard',[(.11,-.61,1.49),(.11,-.686,1.48),(.11,-.687,1.34),(.11,-.615,1.32)],.010,steel,nozzle,5)
box('trigger',(.11,-.656,1.415),(.018,.018,.112),dark,.005,nozzle)
box('nozzle bracket',(0,-.416,1.33),(.08,.045,.155),dark,.010)
# Selective broad wear, rather than hundreds of tiny polygons.
for i,(y,z,w,h) in enumerate([(-.26,.36,.017,.035),(.24,.52,.009,.031),(-.28,1.11,.014,.022),(.26,.90,.011,.018),(-.12,.27,.027,.006),(.18,.28,.018,.009)]):
    box('enamel chip',(.301,y,z),(.007,w,h),rust,0,door)
for x,z in [(-.19,.32),(.17,.29),(-.18,1.19),(.19,1.04)]:
    box('side edge chip',(x,-.393,z),(.012,.007,.031),steel,0)
# Merge per palette material inside each movable assembly, preserving joint origins.
for parent in (body,door,nozzle,lamp):
    for mat in materials:
        parts=[o for o in scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==mat]
        if not parts: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in parts:o.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        bpy.ops.object.join()
        o=parts[0]
        o.name=parent.name+'_'+mat.name
        scene.cursor.location=parent.matrix_world.translation
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
        bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
meshes=[o for o in scene.objects if o.type=='MESH']
# Deterministic ambient occlusion in the required vertex colour attribute.
bpy.context.view_layer.update()
vertices=[]; polygons=[]
for o in meshes:
    offset=len(vertices)
    vertices.extend(o.matrix_world @ v.co for v in o.data.vertices)
    polygons.extend(tuple(offset+i for i in p.vertices) for p in o.data.polygons)
bvh=BVHTree.FromPolygons(vertices,polygons)
for o in meshes:
    colors=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='POINT')
    o.data.color_attributes.active_color_index=0
    o.data.color_attributes.render_color_index=0
    normal_matrix=o.matrix_world.to_3x3().inverted().transposed()
    for v in o.data.vertices:
        n=(normal_matrix @ v.normal).normalized()
        tangent=n.cross(Vector((0,0,1)) if abs(n.z)<.9 else Vector((0,1,0))).normalized()
        bitangent=n.cross(tangent)
        origin=o.matrix_world @ v.co+n*.001
        hits=0
        for j in range(32):
            z=(j+.5)/32; angle=j*2.3999632297; radius=math.sqrt(1-z*z)
            direction=tangent*(radius*math.cos(angle))+bitangent*(radius*math.sin(angle))+n*z
            if bvh.ray_cast(origin,direction,.22)[0] is not None:hits+=1
        ao=1-.55*hits/32
        colors.data[v.index].color=(ao,ao,ao,1)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
stats={'id':'prop.gas-pump','tier':'Side','triangles':triangles,'draw_calls':len(meshes),'materials':[m.name for m in materials],'nodes_ok':all(bpy.data.objects.get(n) for n in ('root','body','door_service','nozzle','lamp_globe','light:globe')),'within_budget':6000<=triangles<=12000 and len(meshes)<=30}
(HERE/'stats.json').write_text(json.dumps(stats,indent=2))
print('BUILD OK',json.dumps(stats))
if a.glb:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_vertex_color='ACTIVE',export_all_vertex_colors=False,export_lights=False,export_cameras=False)
if a.render:
    stage_mat=material('stage','77717b')
    box('studio floor',(0,0,-.05),(200,200,.1),stage_mat,0,parent=root)
    scene.world=bpy.data.worlds.new('studio')
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.22,.22,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
    for name,loc,energy,color,size in [('key',(4,-4,7),650,(1,.86,.72),5),('fill',(-3,-2,4),350,(.72,.8,1),4),('rim',(-2,4,5),450,(1,.75,.58),3)]:
        bpy.ops.object.light_add(type='AREA',location=loc)
        o=bpy.context.object; o.name=name; o.data.energy=energy; o.data.color=color; o.data.size=size
        o.rotation_euler=(Vector((0,0,1.3))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add()
    cam=bpy.context.object
    target=Vector((0,-.14,1.37))
    if a.view=='game':
        cam.location=target+Vector((8,-8,8.2)); cam.data.type='PERSP'; cam.data.angle=math.radians(25)
    else:
        cam.location={'ref':(6,-3.7,3.25),'front':(8,0,1.5),'rear':(-6,-3.7,3.25),'side':(0,-8,1.5)}[a.view]
        cam.data.type='ORTHO'; cam.data.ortho_scale=5.65
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.camera=cam
    scene.render.engine='CYCLES'
    scene.cycles.samples=a.samples
    scene.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='METAL'; prefs.get_devices()
    for d in prefs.devices:d.use=True
    scene.cycles.device='GPU'
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    scene.render.filepath=str(Path(a.render).resolve())
    bpy.ops.render.render(write_still=True)
    print('RENDER OK',a.render)
