"""Lightweight timber bundle with minimal bevels and low-segment bindings."""
import argparse, json, math, random, sys
from pathlib import Path
import bpy
from mathutils import Vector
p=argparse.ArgumentParser()
for n in ('render','glb'): p.add_argument('--'+n)
p.add_argument('--lod',type=int,choices=(0,1,2),default=0)
p.add_argument('--view',default='ref'); p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
rng=random.Random(27)
root=bpy.data.objects.new('root',None); bpy.context.collection.objects.link(root)
root['asset_id']='prop.plank-stack'; root['category']='prop'
root['ss_physics']={'class':'heavy','mass':95,'friction':.75,'restitution':.05,'centerOfMass':[0,.34,0],'pushable':True,'kickable':False,'flammable':True,'vaultable':True,'barricadeValue':1.0,'barricadeHP':250}
def material(token,hex):
    m=bpy.data.materials.new('pal_'+token); m.use_nodes=True
    c=[int(hex[i:i+2],16)/255 for i in (0,2,4)]
    c=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c)+(1,)
    m.diffuse_color=c; b=m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value=c; b.inputs['Roughness'].default_value=.83
    return m
wood=material('woodWarm','b0703f'); grain=material('brick','a8483a'); rope=material('windowGlow','ffc773')
def box(name,loc,size,mat,bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(mat); o.parent=root
    if bevel:
        b=o.modifiers.new('Soft timber edges','BEVEL'); b.width=bevel; b.segments=1
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=b.name)
        b=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=b.name)
    return o
# Preserve the approved staggered silhouette; consume the former detail RNG draws.
for row in range(5):
    for col in range(3):
        x=rng.uniform(-.11,.11); y=(col-1)*.285+rng.uniform(-.008,.008); z=.074+row*.127
        length=2.48+rng.uniform(-.10,.10)
        o=box('plank',(x,y,z),(length,.267,.115),wood,.012 if a.lod==0 else 0)
        o.data.materials.append(grain)
        # End-grain colour is on existing board faces, with no overlay geometry.
        for face in o.data.polygons:
            if face.normal.x < -.9:face.material_index=1
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.separate(type='MATERIAL'); bpy.ops.object.mode_set(mode='OBJECT')
        for _ in range(30+int((row+col)%2==0)):rng.random()
# Rounded rectangular rope path in Y/Z; coarse laid strands at LOD0, single tubes at lower LODs.
def binding(x):
    cz=.329; hy=.454; hz=.334; corner=.055
    points=[]
    # clockwise traversal of the four corners, with two samples per quadrant
    corners=[(hy-corner,hz-corner,0),(-hy+corner,hz-corner,90),(-hy+corner,-hz+corner,180),(hy-corner,-hz+corner,270)]
    for yy,zz,start in corners:
        for i in range(3):
            t=math.radians(start+i*90/2)
            points.append(Vector((x,yy+corner*math.cos(t),cz+zz+corner*math.sin(t))))
    # Resample by arc length so braid pitch remains constant along straight stretches.
    lengths=[0]
    for i in range(len(points)): lengths.append(lengths[-1]+(points[(i+1)%len(points)]-points[i]).length)
    count=(36,24,16)[a.lod]; path=[]
    for i in range(count):
        s=i*lengths[-1]/count; j=next(j for j in range(len(points)) if lengths[j+1]>=s)
        path.append(points[j].lerp(points[(j+1)%len(points)],(s-lengths[j])/(lengths[j+1]-lengths[j])))
    for strand in range(3 if a.lod==0 else 1):
        centers=[]
        for i,v in enumerate(path):
            tangent=(path[(i+1)%count]-path[(i-1)%count]).normalized(); normal=Vector((0,-tangent.z,tangent.y))
            angle=2*math.pi*(6*i/count+strand/3)
            centers.append(v+Vector((1,0,0))*(.014*math.cos(angle))+normal*(.014*math.sin(angle)) if a.lod==0 else v)
        verts=[]; faces=[]; sides=(4,6,4)[a.lod]
        for i,v in enumerate(centers):
            tangent=(centers[(i+1)%count]-centers[(i-1)%count]).normalized()
            u=tangent.cross(Vector((1,0,0))).normalized(); w=tangent.cross(u).normalized()
            for j in range(sides):
                t=2*math.pi*j/sides; verts.append(v+(.018 if a.lod==0 else .030)*(u*math.cos(t)+w*math.sin(t)))
        for i in range(count):
            for j in range(sides): faces.append((i*sides+j,i*sides+(j+1)%sides,((i+1)%count)*sides+(j+1)%sides,((i+1)%count)*sides+j))
        me=bpy.data.meshes.new('braid'); me.from_pydata(verts,[],faces); me.update()
        o=bpy.data.objects.new('rope',me); bpy.context.collection.objects.link(o); o.parent=root; me.materials.append(rope)
        for f in me.polygons:f.use_smooth=True
for x in (-.82,.82):binding(x)
# Ground contact is the underside of the bindings, not a plank center.
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
low=min((o.matrix_world @ v.co).z for o in meshes for v in o.data.vertices)
for o in meshes:o.location.z-=low
for x in (-.82,.82):box('binding_shoe',(x,0,.022),(.10,.94,.044),wood,0)
# Material separation can retain unused slots; each static object has one colour.
for o in [o for o in bpy.context.scene.objects if o.type=='MESH']:
    m=o.data.materials[o.data.polygons[0].material_index]
    o.data.materials.clear(); o.data.materials.append(m)
    for face in o.data.polygons:face.material_index=0
objects=[]
for m,name in [(wood,'body'),(grain,'timberGrain'),(rope,'ropeGold')]:
    group=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials[0]==m]
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0]; bpy.ops.object.join(); group[0].name=name; objects.append(group[0])
for name,loc in [('front',(1.3,0,.33)),('col:bundle',(0,0,.35))]:
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.parent=root; o.location=loc
    if name.startswith('col:'):o['collider']='cuboid'; o['shape']='cuboid'; o['size']=[2.69,.73,.97]
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.render.bake.target='VERTEX_COLORS'
for o in objects:
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    c=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER'); o.data.color_attributes.active_color=c
    bpy.ops.object.bake(type='AO')
tri=sum(len(f.vertices)-2 for o in objects for f in o.data.polygons)
Path(__file__).with_name('metrics.json' if a.lod==0 else f'metrics.lod{a.lod}.json').write_text(json.dumps({'triangles':tri,'draw_calls':len(objects),'materials':[m.name for m in (wood,grain,rope)]}))
if a.glb:
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
if a.render:
    scene.cycles.samples=a.samples; scene.cycles.use_denoising=True
    scene.world=bpy.data.worlds.new('Studio'); scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.055,.045,.065,1); scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
    target=Vector((0,0,.33))
    for name,loc,power,color in [('key',(-1,-3,5),650,(1,.78,.55)),('fill',(-3,-1,2),260,(.70,.63,1)),('rim',(2,3,4),700,(1,.65,.32))]:
        d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.size=4; d.color=color; o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=loc; o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    cam=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera')); scene.collection.objects.link(cam)
    direction={'ref':(-3,-5,2.8),'game':(4,-4,5),'front':(5,0,1),'side':(0,-5,2),'rear':(-5,0,1)}[a.view]
    cam.location=target+Vector(direction); cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=4.4 if a.view=='game' else 3.55; scene.camera=cam
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(Path(a.render).resolve()); Path(a.render).parent.mkdir(parents=True,exist_ok=True); bpy.ops.render.render(write_still=True)
print('OK plank-stack',tri,'triangles',len(objects),'draw calls')
