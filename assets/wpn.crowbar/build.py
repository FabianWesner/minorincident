"""Red forged crowbar; deterministic palette-only surface wear, metre units."""
import argparse,json,math,random,sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for key in ['render','glb']:p.add_argument('--'+key)
p.add_argument('--view',default='ref')
for key,val in [('samples',24),('width',960),('height',540)]:p.add_argument('--'+key,type=int,default=val)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.unit_settings.system='METRIC'
def material(token,color,metal,rough):
    m=bpy.data.materials.new('pal_'+token);m.use_nodes=True
    rgb=[int(color[i:i+2],16)/255 for i in (0,2,4)]
    rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1)
    bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
    return m
red=material('survivorRed','d9363e',.25,.36)
steel=material('sidewalk','b9a4a0',.78,.36)
dark=material('asphalt','5b4f5c',.72,.49)
# Sweep a chamfered rectangular forged section along the complete silhouette.
# The broad bottom flares and thins into a useful chisel, opposite the upper hook.
path=[]
for i in range(13):
    t=i/12;angle=-math.pi/2+t*math.pi/2
    path.append((-.100+.100*math.cos(angle),.122+.100*math.sin(angle),.012+.040*t,.067-.035*t))
for i in range(1,39):
    t=i/38;path.append((0,.122+.622*t,.052,.032))
for i in range(1,25):
    t=i/24;theta=math.pi-t*math.pi
    path.append((.067+.067*math.cos(theta),.744+.067*math.sin(theta),.052,.032))
for i in range(1,8):
    t=i/7;path.append((.134+.014*t,.744-.092*t,.052+.008*t,.032-.004*t))
# Cross section is bevelled; faces subdivide along and across for paint chips.
verts=[];rings=[];rng=random.Random(17)
for k,(x,z,width,depth) in enumerate(path):
    prev=Vector((path[max(0,k-1)][0],0,path[max(0,k-1)][1]))
    nxt=Vector((path[min(len(path)-1,k+1)][0],0,path[min(len(path)-1,k+1)][1]))
    tangent=(nxt-prev).normalized();normal=Vector((tangent.z,0,-tangent.x))
    w=width/2;d=depth/2;b=min(.006,d*.4)
    corners=[(-w+b,-d),(w-b,-d),(w,-d+b),(w,d-b),(w-b,d),(-w+b,d),(-w,d-b),(-w,-d+b)]
    ring=[]
    for j in range(8):
        u,v=corners[j];u1,v1=corners[(j+1)%8]
        for q in range(4):
            t=q/4+(rng.uniform(-.10,.10) if q else 0);pos=Vector((x,0,z))+normal*(u+(u1-u)*t)+Vector((0,v+(v1-v)*t,0))
            pos.x+=.18*pos.z
            ring.append(len(verts));verts.append(tuple(pos))
    rings.append(ring)
faces=[];indices=[]
for k in range(len(rings)-1):
    for j in range(32):
        faces.append((rings[k][j],rings[k][(j+1)%32],rings[k+1][(j+1)%32],rings[k+1][j]))
        # Exposed forged foot, irregular paint boundary, and long edge scrapes.
        exposed=k<11 or (k<21 and rng.random()<(21-k)/12)
        edge_scrape=(k<49 and j in [0,1,15,16] and rng.random()<.12)
        scar=(18<=k<=26 and j in [0,1,2]) or (39<=k<=44 and j in [29,30])
        indices.append((1 if rng.random()<.94 else 2) if exposed or edge_scrape or scar else 0)
faces.extend([tuple(reversed(rings[0])),tuple(rings[-1])]);indices.extend([1,0])
mesh=bpy.data.meshes.new('forged_crowbar');mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new('body',mesh);bpy.context.collection.objects.link(o)
for m in [red,steel,dark]:mesh.materials.append(m)
for f,idx in zip(mesh.polygons,indices):f.material_index=idx
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='wpn.crowbar';o.parent=root
for name,loc in [('grip',(0,0,.36)),('tip',(.148,0,.652))]:
    e=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(e);e.location=Vector(loc)+Vector((.18*loc[2],0,0));e.parent=root
# Centre the footprint and place the bottom exactly on the ground plane.
minx=min(v.co.x for v in mesh.vertices);maxx=max(v.co.x for v in mesh.vertices);minz=min(v.co.z for v in mesh.vertices)
shift=Vector((-(minx+maxx)/2,0,-minz))
for v in mesh.vertices:v.co+=shift
for name in ['grip','tip']:bpy.data.objects[name].location+=shift
bpy.context.view_layer.objects.active=o;o.select_set(True)
# AO is exported as a runtime colour attribute, independent of paint materials.
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=17
attr=mesh.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER');mesh.color_attributes.active_color=attr
scene.render.bake.target='VERTEX_COLORS';bpy.ops.object.bake(type='AO')
triangles=sum(len(f.vertices)-2 for f in mesh.polygons)
report=dict(id='wpn.crowbar',tier='Side',triangles=triangles,draw_calls=3,materials=[m.name for m in mesh.materials],nodes_ok=True,within_budget=triangles<=6000,rounds=3,webgpu_ok=False,webgl2_ok=False,gaps=[])
(HERE/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
if a.render:
    scene.cycles.samples=a.samples;scene.cycles.use_denoising=True;scene.world.color=(.16,.16,.16)
    floor=material('stage','2a2730',0,.8)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.004));bpy.context.object.data.materials.append(floor)
    target=Vector((0,0,.41))
    def aim(obj):obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
    for loc,power,size,color in [((1,-2,2.5),180,2,(1,.80,.65)),((-1,-.5,1.5),90,1.5,(.65,.72,1)),((.5,1,1.6),220,1,(1,.57,.32))]:
        bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.size=size;light.data.color=color;aim(light)
    views={'ref':(.9,-3,1.0),'game':(2,-2,3),'front':(3,0,.8),'side':(0,-3,.8),'rear':(-1,3,1.3)}
    bpy.ops.object.camera_add(location=views[a.view]);cam=bpy.context.object;aim(cam);cam.data.type='ORTHO';cam.data.ortho_scale=1.65;scene.camera=cam
    scene.view_settings.view_transform='AgX';scene.view_settings.exposure=-.35
    scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
    scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
    if a.view=='ref':
        cam.location=views['game'];aim(cam);scene.cycles.samples=24
        scene.render.resolution_x=960;scene.render.resolution_y=540
        scene.render.filepath=str(Path(a.render).with_name(Path(a.render).stem+'-game.png').resolve());bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
