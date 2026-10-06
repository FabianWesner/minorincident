"""Firecracker lure: hollow paper tubes, tied cord, braided fuse and ignition spark."""
import argparse,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
H=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for k in ['render','glb']:p.add_argument('--'+k)
p.add_argument('--view',default='ref')
for k,v in [('samples',24),('width',960),('height',540)]:p.add_argument('--'+k,type=int,default=v)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system='METRIC'
def material(token,h,emission=0):
    c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in c]
    m=bpy.data.materials.new(('emi_' if emission else 'pal_')+token);m.use_nodes=True
    s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=(*c,1);s.inputs['Roughness'].default_value=.62
    if emission:s.inputs['Emission Color'].default_value=(*c,1);s.inputs['Emission Strength'].default_value=emission
    return m
red=material('survivorRed','d9363e');darkred=material('blood','b3121f');rim=material('brick','a8483a');paper=material('woodWarm','b0703f');fuse=material('sidewalk','b9a4a0');braid=material('picketWhite','f2e6dc');yellow=material('windowGlow','ffc773',12);hot=material('schoolBusYellow','f2b630',6)
mats=[red,darkred,rim,paper,fuse,braid,yellow,hot]
def mesh(name,v,f,m):
    d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.data.materials.append(m);return o
def profile(name,x,y,rings,m,n=16):
    v=[(x+r*math.cos(t*2*math.pi/n),y+r*math.sin(t*2*math.pi/n),z) for z,r in rings for t in range(n)]
    f=[(k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i) for k in range(len(rings)-1) for i in range(n)]
    return mesh(name,v,f,m)
def rope(name,points,r,m,sides=8):
    v=[]
    for i,pt in enumerate(points):
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        q=tangent.to_track_quat('Z','Y')
        v.extend(tuple(Vector(pt)+q@Vector((r*math.cos(j*2*math.pi/sides),r*math.sin(j*2*math.pi/sides),0))) for j in range(sides))
    faces=[(i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j) for i in range(len(points)-1) for j in range(sides)]
    faces.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+j for j in range(sides))])
    return mesh(name,v,faces,m)
# Six closely packed cylinders, uneven ends and thick rolled paper rims.
for i,(x,y,z,h) in enumerate([(-.049,-.027,0,.19),(.007,-.033,.009,.17),(.059,-.008,.003,.18),(-.047,.029,.012,.19),(.006,.026,0,.207),(.055,.047,.012,.168)]):
    r=.029;top=z+h
    profile('paper_shell',x,y,[(z,.024),(z+.004,r),(top-.007,r),(top-.002,.027),(top,.025),(top,.020),(top-.007,.020)],red)
    profile('dark_mouth',x,y,[(top-.007,.020),(top-.040,.019),(top-.040,0)],darkred)
    profile('rolled_lip',x,y,[(top-.006,.0295),(top-.002,.030),(top+.004,.027),(top+.004,.020),(top-.005,.0195)],rim)
    profile('bottom_plug',x,y,[(z+.001,0),(z+.001,.023),(z+.005,.025)],paper)
    for zz in [z+.013,top-.020]:
        profile('raised_paper_band',x,y,[(zz,.032),(zz+.004,.032),(zz+.004,.029)],darkred)
# Binding cord is visibly raised and follows an elliptical path around the entire cluster.
for z in [.051,.135]:
    pts=[(.095*math.cos(i*2*math.pi/32),.078*math.sin(i*2*math.pi/32)+.009,z+.003*math.sin(i*4*math.pi/32)) for i in range(33)]
    rope('binding',pts,.006,darkred,6)
    rope('binding_fold',[(.069,-.046,z-.008),(.071,-.052,z),(.063,-.058,z+.008),(.050,-.062,z+.002)],.008,red)
# Thick S-curved fuse, with spiral wrapping above its surface.
pts=[]
for i in range(37):
    t=i/36;pts.append((.005+.026*math.sin(t*math.pi*2)+.084*t*t,.010,.193+.195*t))
rope('fuse',pts,.009,fuse,8)
spiral=[]
for i in range(97):
    t=i/96;idx=min(int(t*36),35);u=t*36-idx;c=Vector(pts[idx]).lerp(Vector(pts[idx+1]),u)
    q=(Vector(pts[idx+1])-Vector(pts[idx])).to_track_quat('Z','Y');ang=t*math.pi*18
    spiral.append(tuple(c+q@Vector((.009*math.cos(ang),.009*math.sin(ang),0))))
rope('fuse_braid',spiral,.0018,braid,4)
# Low-poly 3D burst with tapered rays; authored emission stays texture-free.
end=Vector(pts[-1])
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.014,location=end);bpy.context.object.name='spark_core';bpy.context.object.data.materials.append(yellow)
for i in range(13):
    ang=i*2*math.pi/13;direction=Vector((math.cos(ang),.25*math.sin(i*2.4),math.sin(ang))).normalized();length=.032+(i%3)*.012
    q=direction.to_track_quat('Z','Y');base=end-direction*.005
    v=[tuple(base+q@Vector((.006*math.cos(j*math.pi/2),.006*math.sin(j*math.pi/2),0))) for j in range(4)]+[tuple(end+direction*length)]
    mesh('spark_ray',v,[(0,1,2,3)]+[(j,(j+1)%4,4) for j in range(4)],yellow if i%2 else hot)
for i in range(7):
    t=i*2.399;c=end+Vector((math.cos(t)*.062,.008*math.sin(t),math.sin(t)*.062))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.0035,location=c);bpy.context.object.data.materials.append(hot)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='thr.firecracker-lure'
root['ss_physics']={'class':'light','mass':.35,'friction':.6,'restitution':.15,'centerOfMass':[0,.1,0],'pushable':True,'kickable':True,'flammable':True}
for m in mats:
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials[0]==m]
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object;o.name='body' if m==red else ('fuse' if m==fuse else 'fuseWrap' if m==braid else 'sparkCore' if m==yellow else 'sparkRays' if m==hot else 'static_'+m.name);o.parent=root
    bpy.context.scene.cursor.location=end if m in [yellow,hot] else (0,0,.193) if m in [fuse,braid] else (0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
for name,loc in [('grip',(0,0,.10)),('col:body',(0,.01,.105))]:
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=root;o.location=loc
    if name.startswith('col:'):o['collider']='cuboid';o['shape']='cuboid';o['halfExtents']=[.095,.079,.105]
light=bpy.data.objects.new('light:fuse',None);bpy.context.collection.objects.link(light);light.parent=root;light.location=end
light['ss_light']={'type':'point','color':'light_fire','intensity':1.5,'range':1.2,'pool':True,'beam':'none','flare':True,'reflect':True,'shadow':'none','heroPriority':0,'flicker':'fire','animation':None,'powerGroup':'self','breakable':False,'emissiveNodes':['sparkCore','sparkRays'],'tiers':'all'}
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=0;scene.render.bake.target='VERTEX_COLORS'
for o in meshes:
    attr=o.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER');o.data.color_attributes.active_color=attr
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.bake(type='AO')
tri=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
report=dict(id='thr.firecracker-lure',tier='Side',triangles=tri,draw_calls=len(meshes),materials=[m.name for m in mats],nodes_ok=all(bpy.data.objects.get(n) is not None for n in ['root','grip','body','fuse','sparkCore','sparkRays','col:body','light:fuse']),within_budget=tri<=6000 and len(meshes)<=30)
(H/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_extras=True)
if a.render:
    scene.cycles.samples=a.samples;scene.cycles.use_denoising=True;scene.world.color=(.11,.11,.11)
    stage=material('stage','292630');bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(stage);bpy.context.object.location.z=-.001
    target=Vector((.015,0,.20))
    def aim(o):o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    for loc,power,size,color in [((.4,-.5,.8),9,.5,(1,.8,.65)),((-.4,-.1,.5),4,.4,(.66,.72,1)),((.3,.5,.6),10,.3,(1,.52,.24))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;aim(o)
    views={'ref':(.5,-.85,.65),'game':(.65,-.65,1),'front':(.9,0,.4),'side':(0,-.9,.4),'rear':(-.7,.7,.6)}
    bpy.ops.object.camera_add(location=views[a.view]);o=bpy.context.object;aim(o);o.data.type='ORTHO';o.data.ortho_scale=.88;scene.camera=o
    scene.view_settings.view_transform='AgX';scene.view_settings.exposure=-.5;scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
    scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
    if a.view=='ref':
        scene.camera.location=views['game'];aim(scene.camera);scene.cycles.samples=24;scene.render.resolution_x=960;scene.render.resolution_y=540
        scene.render.filepath=str(Path(a.render).with_name('game.png' if Path(a.render).name=='hero.png' else Path(a.render).stem.replace('ref','game')+'.png').resolve());bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
