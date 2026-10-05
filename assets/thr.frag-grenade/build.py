"""Palette-only segmented frag grenade. Metres, +X lever/front, Z-up."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE = Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for flag in ['render','glb']: p.add_argument('--'+flag)
p.add_argument('--view',default='ref')
for flag,default in [('samples',24),('width',960),('height',540)]: p.add_argument('--'+flag,type=int,default=default)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system='METRIC'
def mat(token,hexcode,metal=0):
    rgb=[int(hexcode[i:i+2],16)/255 for i in (0,2,4)]
    rgb=[v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m=bpy.data.materials.new('pal_'+token);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1)
    bs.inputs['Roughness'].default_value=.48;bs.inputs['Metallic'].default_value=metal
    return m
olive=mat('grass','6f8f3a');dark=mat('uiDark','25222c',.45)
yellow=mat('schoolBusYellow','f2b630');steel=mat('sidewalk','b9a4a0',.7)
def finish(o,m,bevel=0):
    o.data.materials.append(m)
    if bevel:
        mod=o.modifiers.new('rounded casting','BEVEL');mod.width=bevel;mod.segments=1
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def mesh(name,verts,faces,m,bevel=0):
    d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update()
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);return finish(o,m,bevel)
def profile(name,rings,m):
    n=32;v=[(r*math.cos(i*2*math.pi/n),r*math.sin(i*2*math.pi/n),z) for z,r in rings for i in range(n)]
    f=[(k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i) for k in range(len(rings)-1) for i in range(n)]
    if rings[0][0]==rings[-1][0]:
        k=len(rings)-1
        f.extend((k*n+i,k*n+(i+1)%n,(i+1)%n,i) for i in range(n))
    else:
        f.extend([tuple(reversed(range(n))),tuple((len(rings)-1)*n+i for i in range(n))])
    return mesh(name,v,f,m)
def box(name,loc,size,m,bevel=.002):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,m,bevel)
def cyl(name,loc,r,depth,m,axis=(0,0,1),n=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=depth,location=loc);o=bpy.context.object;o.name=name
    o.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    return finish(o,m,.001)
# Deep continuous grooves under forty separately chamfered cast segments.
profile('cast_core',[(0,.024),(.01,.034),(.035,.047),(.075,.057),(.115,.057),(.15,.047),(.171,.032)],olive)
rows=[(.009,.034,.033,.047),(.038,.075,.047,.057),(.080,.117,.057,.057),(.122,.150,.057,.047)]
for row,(z0,z1,r0,r1) in enumerate(rows):
    for j in range(10):
        t=j*2*math.pi/10;h=math.pi/10-.055
        # Outer pads are 4 mm above the groove shell; edge chamfers catch light.
        v=[]
        for z,r in [(z0,r0),(z1,r1)]:
            for radius in [r-.003,r+.006]:
                v.extend([(radius*math.cos(t-h),radius*math.sin(t-h),z),(radius*math.cos(t+h),radius*math.sin(t+h),z)])
        mesh('segment',v,[(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3),(0,1,3,2),(4,6,7,5)],olive,.002)
# Shoulder band is a solid raised conical ring, not a coplanar decal.
profile('yellow_band',[(.151,.057),(.155,.055),(.166,.045),(.167,.044),(.167,.032),(.151,.042)],yellow)
profile('fuse_collar',[(.174,.033),(.177,.036),(.185,.036),(.188,.029)],dark)
box('fuse_head',(0,0,.205),(.046,.044,.038),dark,.003)
cyl('hinge',(-.019,0,.216),.008,.06,steel,(0,1,0))
cyl('pin_boss',(.013,-.027,.207),.004,.012,steel,(0,1,0))
# Extruded dog-leg safety spoon with its joint at the fuse hinge.
outline=[(-.024,.227),(.032,.227),(.037,.209),(.062,.183),(.082,.152),(.084,.061),(.079,.032),(.064,.034),(.069,.067),(.068,.148),(.050,.177),(.027,.203),(-.024,.214)]
v=[(x,y,z) for y in [-.011,.011] for x,z in outline];n=len(outline)
f=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
lever=mesh('safetyLever',v,f,dark,.002)
# Pull ring in XZ plane; true hole and rounded metal profile.
bpy.ops.mesh.primitive_torus_add(major_segments=40,minor_segments=8,location=(.040,-.034,.206),major_radius=.029,minor_radius=.0032,rotation=(math.pi/2,0,0))
ring=bpy.context.object;ring.name='pullRing';finish(ring,steel)
ring.scale.z=1.17;bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='thr.frag-grenade'
root['ss_physics']={'class':'light','mass':.4,'friction':.65,'restitution':.15,'centerOfMass':[0,.1,0],'pushable':True,'kickable':True,'flammable':False}
for o,pivot in [(lever,(-.019,0,.216)),(ring,(.017,-.034,.22))]:
    bpy.context.scene.cursor.location=pivot;bpy.context.view_layer.objects.active=o
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');o.parent=root
for m in [olive,dark,yellow,steel]:
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o not in [lever,ring] and o.data.materials[0]==m]
    if not obs:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object;o.name='body' if m==olive else 'static_'+m.name;o.parent=root
for name,loc in [('grip',(0,0,.095)),('col:body',(0,0,.11))]:
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=root
    if name.startswith('col:'):o['shape']='cuboid';o['halfExtents']=[.086,.12,.066];o['collider']='cuboid'
# Broader egg silhouette; preserve the fuse hardware and joint positions.
body=bpy.data.objects['body'];body.scale.x=1.12;body.scale.y=1.12
bpy.context.view_layer.objects.active=body;body.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
# Bake deterministic ambient occlusion into the runtime color attribute.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=0
scene.render.bake.target='VERTEX_COLORS'
for o in meshes:
    attr=o.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER')
    o.data.color_attributes.active_color=attr
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.bake(type='AO')
triangles=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
report=dict(id='thr.frag-grenade',tier='Side',triangles=triangles,draw_calls=len(meshes),materials=[m.name for m in [olive,dark,yellow,steel]],nodes_ok=all(bpy.data.objects.get(n) for n in ['root','grip','body','safetyLever','pullRing']),within_budget=triangles<=6000 and len(meshes)<=30)
(HERE/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
if a.render:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=True
    scene.world.color=(.13,.13,.13)
    floor=mat('stage','2a2730');bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(floor);bpy.context.object.location.z=-.001
    target=Vector((.015,0,.12))
    def aim(o):o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    for loc,power,size,color in [((.4,-.5,.7),16,.4,(1,.8,.57)),((-.4,-.1,.4),8,.3,(.62,.72,1)),((.2,.4,.5),20,.3,(1,.62,.27))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;aim(o)
    views={'ref':(.42,-.65,.36),'game':(.5,-.5,.70),'front':(.7,0,.2),'side':(0,-.7,.2),'rear':(-.5,.5,.35)}
    bpy.ops.object.camera_add(location=views[a.view]);o=bpy.context.object;aim(o);o.data.type='ORTHO';o.data.ortho_scale=.48;scene.camera=o
    scene.view_settings.view_transform='AgX';scene.view_settings.exposure=-.65;scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
    scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
    if Path(a.render).name=='hero.png':
        scene.camera.location=views['game'];aim(scene.camera);scene.cycles.samples=24
        scene.render.resolution_x=960;scene.render.resolution_y=540
        scene.render.filepath=str(HERE/'renders/game.png');bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
