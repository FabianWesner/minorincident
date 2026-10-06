"""Palette-only smoke canister. Metres, +X lever/front, Z-up."""
import argparse, json, math, random, sys
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
olive=mat('grass','596c32');dark=mat('uiDark','25222c',.45)
cream=mat('picketWhite','f2e6dc');steel=mat('woodWarm','b0703f',.7)
smoke_mat=mat('sidewalk','b9a4a0')
smoke_mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.95
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
# Rolled canister shell, raised end seams and cream identification band.
profile('shell',[(0,.067),(.005,.075),(.018,.078),(.265,.078),(.278,.076),(.29,.060),(.3,.04)],olive)
profile('base_rim',[(.002,.068),(.005,.081),(.017,.081),(.021,.076)],olive)
profile('shoulder_rim',[(.256,.078),(.259,.081),(.275,.081),(.28,.075)],olive)
profile('identification_band',[(.068,.0815),(.071,.082),(.109,.082),(.112,.0815),(.112,.077),(.068,.077)],cream)
profile('fuse_collar',[(.295,.043),(.3,.049),(.316,.049),(.32,.038)],steel)
# Hollow fuse chimney with recessed black opening.
profile('fuse_head',[(.315,.031),(.377,.031),(.382,.027),(.382,.020),(.370,.020),(.370,.001)],dark)
profile('mouth_rim',[(.377,.032),(.383,.032),(.386,.027),(.386,.020),(.379,.020),(.377,.025)],steel)
box('hinge_plate',(.031,0,.357),(.015,.054,.025),olive,.003)
cyl('hinge',(.035,0,.361),.008,.066,steel,(0,1,0))
cyl('pin_shaft',(.021,-.040,.353),.004,.034,steel,(0,1,0))
outline=[(-.021,.382),(.040,.382),(.061,.363),(.091,.311),(.098,.174),(.105,.151),(.093,.146),(.084,.172),(.079,.305),(.048,.351),(-.021,.369)]
v=[(x,y,z) for y in [-.012,.012] for x,z in outline];n=len(outline)
f=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
lever=mesh('safetyLever',v,f,steel,.003)
bpy.ops.mesh.primitive_torus_add(major_segments=48,minor_segments=10,location=(.040,-.085,.327),major_radius=.048,minor_radius=.004,rotation=(math.pi/2,0,0))
ring=bpy.context.object;ring.name='pullRing';finish(ring,steel)
ring.scale.y=1.16;bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
# Sparse exposed metal chips, all 3 mm clear of the shell.
rng=random.Random(29)
for i in range(26):
    t=rng.uniform(-math.pi,math.pi);z=rng.choice([rng.uniform(.025,.06),rng.uniform(.12,.15),rng.uniform(.225,.251)])
    h=rng.uniform(.003,.009)
    verts=[(.082*math.cos(t+dt),.082*math.sin(t+dt),z+dz) for dt,dz in [(-.025,0),(.025,.001),(.012,h),(-.009,h*.7)]]
    mesh('paint_chip',verts,[(0,1,2,3)],steel)
# Individual curved lettering sits at least 4 mm above the painted shell.
for i,ch in enumerate('SMOKE'):
    t=-1.04+(i-2)*.30
    bpy.ops.object.text_add(location=(.083*math.cos(t),.083*math.sin(t),.164))
    o=bpy.context.object;o.name='stencil_'+ch;o.data.body=ch;o.data.align_x='CENTER';o.data.size=.043;o.data.extrude=.0008;o.data.resolution_u=2
    o.rotation_euler=(math.pi/2,0,t+math.pi/2)
    bpy.ops.object.convert(target='MESH');finish(bpy.context.object,cream)
# Deterministic faceted billows; separate from the throwable's rigid body.
cloud=[]
for i,(loc,r,scale) in enumerate([
    ((-.023,.004,.400),.021,(1,1,1)),((-.044,.006,.424),.029,(1,1,1)),
    ((-.076,.006,.45),.036,(1.2,1,1)),((-.108,.015,.475),.043,(1,1,1.2)),
    ((-.143,.007,.503),.05,(1.1,1,1)),((-.184,.020,.532),.054,(1,1,1.2)),
    ((-.151,.027,.561),.043,(1,1,1)),((-.207,.008,.571),.047,(1,1,1)),
    ((-.224,.022,.517),.042,(1,1,1)),((-.11,-.014,.522),.039,(1,1,1))]):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=r,location=loc)
    o=bpy.context.object;o.location.x=-o.location.x;o.scale=scale
    rng=random.Random(80+i)
    for v in o.data.vertices:v.co*=rng.uniform(.92,1.08)
    finish(o,smoke_mat);cloud.append(o)
    for poly in o.data.polygons:poly.use_smooth=True
bpy.ops.object.select_all(action='DESELECT')
for o in cloud:o.select_set(True)
bpy.context.view_layer.objects.active=cloud[0];bpy.ops.object.join();smoke=bpy.context.object;smoke.name='smokePuff'
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='thr.smoke-grenade'
smoke['presentation_only']=True
root['ss_physics']={'class':'light','mass':.4,'friction':.65,'restitution':.15,'centerOfMass':[0,.19,0],'pushable':True,'kickable':True,'flammable':False}
for o,pivot in [(lever,(.035,0,.361)),(ring,(.021,-.085,.375)),(smoke,(0,0,.382))]:
    bpy.context.scene.cursor.location=pivot;bpy.context.view_layer.objects.active=o
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');o.parent=root
for m in [olive,dark,cream,steel]:
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o not in [lever,ring,smoke] and o.data.materials[0]==m]
    if not obs:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object;o.name='body' if m==olive else 'static_'+m.name;o.parent=root
for name,loc in [('grip',(0,0,.15)),('front',(.105,0,.25)),('col:body',(0,0,.19))]:
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=root
    if name.startswith('col:'):o['shape']='cuboid';o['halfExtents']=[.105,.195,.083];o['collider']='cuboid';o['size']=[.21,.39,.166]
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
report=dict(id='thr.smoke-grenade',tier='Side',triangles=triangles,draw_calls=len(meshes),materials=[m.name for m in [olive,dark,cream,steel,smoke_mat]],nodes_ok=all(bpy.data.objects.get(n) for n in ['root','grip','front','body','safetyLever','pullRing','smokePuff','col:body']),within_budget=triangles<=6000 and len(meshes)<=30)
(HERE/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
if a.render:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=True
    scene.world.color=(.13,.13,.13)
    floor=mat('stage','2a2730');bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(floor);bpy.context.object.location.z=-.001
    target=Vector((-.06,0,.30))
    def aim(o):o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    for loc,power,size,color in [((.4,-.5,.7),16,.4,(1,.8,.57)),((-.4,-.1,.4),8,.3,(.62,.72,1)),((.2,.4,.5),20,.3,(1,.62,.27))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;aim(o)
    views={'ref':(.65,-1.1,.74),'game':(.85,-.85,1.35),'front':(.7,0,.2),'side':(0,-.7,.2),'rear':(-.5,.5,.35)}
    bpy.ops.object.camera_add(location=views[a.view]);o=bpy.context.object;aim(o);o.data.type='ORTHO';o.data.ortho_scale=1.25;scene.camera=o
    scene.view_settings.view_transform='AgX';scene.view_settings.exposure=-.65;scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
    scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
    if a.view=='ref':
        scene.camera.location=views['game'];aim(scene.camera);scene.cycles.samples=24
        scene.render.resolution_x=960;scene.render.resolution_y=540
        scene.render.filepath=str(Path(a.render).with_name(Path(a.render).stem.replace('ref','game')+'.png') if Path(a.render).name!='hero.png' else HERE/'renders/game.png');bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
