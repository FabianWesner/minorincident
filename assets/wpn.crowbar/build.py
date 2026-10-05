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
    w=width/2;d=depth/2;b=min(.006,d*.4,w*.35)
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
        exposed=k<13+round(4*math.sin(j*.63)+2*math.sin(j*1.6))
        scar=(19<=k<=25 and j in [0,1]) or (36<=k<=43 and j==0) or (47<=k<=52 and j==30)
        tarnish=(k<10 and j in [27,28]) or (17<=k<=23 and j==1)
        indices.append((2 if tarnish else 1) if exposed or scar else 0)
# Centre fans avoid collinear triangles along the subdivided cap perimeter.
for ring,idx,reverse in [(rings[0],1,True),(rings[-1],0,False)]:
    centre=sum((Vector(verts[i]) for i in ring),Vector())/len(ring)
    ci=len(verts);verts.append(tuple(centre))
    for j in range(len(ring)):
        edge=(ring[j],ring[(j+1)%len(ring)])
        faces.append((ci,*reversed(edge)) if reverse else (ci,*edge));indices.append(idx)
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
mesh.calc_loop_triangles()
assert all(t.area>1e-12 for t in mesh.loop_triangles), 'Degenerate crowbar triangle'
triangles=len(mesh.loop_triangles)
report=dict(id='wpn.crowbar',tier='Side',triangles=triangles,draw_calls=3,materials=[m.name for m in mesh.materials],nodes_ok=all(bpy.data.objects.get(n) is not None for n in ['root','grip','tip']),within_budget=triangles<=6000 and len(mesh.materials)<=30,rounds=4,webgpu_ok=False,webgl2_ok=False,gaps=[])
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
    views={'ref':(1.7,-3,1.25),'game':(2,-2,3),'front':(3,0,.8),'side':(0,-3,.8),'rear':(-1,3,1.3)}
    bpy.ops.object.camera_add(location=views[a.view]);cam=bpy.context.object;aim(cam);cam.data.type='ORTHO';cam.data.ortho_scale=1.65;scene.camera=cam
    scene.view_settings.view_transform='AgX';scene.view_settings.exposure=-.35
    scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
    scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
    if a.view=='ref':
        cam.location=views['game'];aim(cam);scene.cycles.samples=24
        scene.render.resolution_x=960;scene.render.resolution_y=540
        scene.render.filepath=str(Path(a.render).with_name(('game.png' if Path(a.render).name=='hero.png' else Path(a.render).stem+'-game.png')).resolve());bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
