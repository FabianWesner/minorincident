"""Lightweight stacked sandbags and timber pallet; three deterministic LODs."""
import argparse, json, math, random, sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/'tools/blender'))
from sslib import palette, ao
p=argparse.ArgumentParser()
for n in ('render','glb'):p.add_argument('--'+n)
p.add_argument('--lod',type=int,choices=(0,1,2),default=0)
p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root)
root['asset_id']='prop.sandbag-pallet';root['category']='prop'
M={t:palette.mat(t) for t in ['khaki','khakiLight','khakiSeam','canvasTan','woodWarm','leatherShadow','uiDark']}
for m in M.values():m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85
rng=random.Random(27)
def mesh(name,vs,fs,token):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update()
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.parent=root;o.data.materials.append(M[token]);return o
def box(name,loc,size,token,bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.parent=root;o.data.materials.append(M[token])
    if bevel and a.lod==0:
        mod=o.modifiers.new('soft edges','BEVEL');mod.width=bevel;mod.segments=1
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
def tube(name,points,r,token,sides=4,closed=True):
    vs=[];fs=[];n=len(points)
    for i,q in enumerate(points):
        tangent=Vector(points[(i+1)%n])-Vector(points[(i-1)%n]);tangent.normalize()
        u=tangent.cross(Vector((0,0,1))).normalized();v=tangent.cross(u).normalized()
        for k in range(sides):vs.append(Vector(q)+r*(math.cos(k*math.tau/sides)*u+math.sin(k*math.tau/sides)*v))
    for i in range(n if closed else n-1):
        for k in range(sides):fs.append((i*sides+k,i*sides+(k+1)%sides,((i+1)%n)*sides+(k+1)%sides,((i+1)%n)*sides+k))
    return mesh(name,vs,fs,token)
# Three skids and nine bearing blocks leave clear fork openings on both axes.
for y in [-.49,0,.49]:
    box('bottom_skid',(0,y,.023),(1.40,.16,.046),'woodWarm')
    for x in [-.59,0,.59]:box('bearing_block',(x,y,.107),(.19,.17,.122),'woodWarm',.012)
for y in [-.48,0,.48]:box('cross_rail',(0,y,.181),(1.40,.17,.04),'leatherShadow')
for x in [-.60,-.40,-.20,0,.20,.40,.60]:
    box('deck_board',(x,0,.223),(.178,1.19,.055),'woodWarm')
# Bevelled boxes retain the four-tier silhouette without dense cloth grids.
def bag(cx,cy,cz,angle,index):
    o=box('sack',(cx,cy,cz),(.667,.552,.265),'khaki',.065)
    if a.lod==1:
        mod=o.modifiers.new('sack corners','BEVEL');mod.width=.055;mod.segments=1
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    o.rotation_euler.z=angle
    o.data.materials.append(M['khakiLight'])
    for f in o.data.polygons:
        if f.normal.z>.5 and index%3==0:f.material_index=1
    if a.lod==0:
        # Eight corners, three tube sides: a coarse, raised perimeter seam.
        pts=[]
        for x,y in [(.334,.211),(.273,.276),(-.273,.276),(-.334,.211),(-.334,-.211),(-.273,-.276),(.273,-.276),(.334,-.211)]:
            pts.append((cx+x*math.cos(angle)-y*math.sin(angle),cy+x*math.sin(angle)+y*math.cos(angle),cz))
        tube('rolled_seam',pts,.006,'khakiSeam',3)
for layer in range(4):
    for ix in range(2):
        for iy in range(2):
            index=layer*4+ix*2+iy
            bag((ix-.5)*.665+rng.uniform(-.014,.014),(iy-.5)*.553+rng.uniform(-.012,.012),.365+layer*.216,rng.uniform(-.025,.025),index)
# Static geometry is consolidated into one primitive per palette material.
meshes=[]
for m in M.values():
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and m in list(o.data.materials)]
    # Separate the two sack cloth slots before merging by material.
    for o in obs:
        if len(o.data.materials)>1:
            bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
            bpy.ops.mesh.separate(type='MATERIAL')
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials[0]==m]
    if not obs:
        node=bpy.data.objects.new(m.name,None);bpy.context.collection.objects.link(node);node.parent=root
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name='body' if m==M['khaki'] else m.name;meshes.append(obs[0])
col=bpy.data.objects.new('col:body',None);bpy.context.collection.objects.link(col);col.parent=root;col.location=(0,0,.573)
col['collider']='cuboid';col['size']=[1.4,1.19,1.146]
ao.bake_all(meshes,32)
tri=0
for o in meshes:o.data.calc_loop_triangles();tri+=len(o.data.loop_triangles)
report={'id':'prop.sandbag-pallet','tier':'Side','triangles':tri,'draw_calls':len(meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials}),'nodes_ok':all(bpy.data.objects.get(n) is not None for n in ['root','body','col:body']),'within_budget':tri<=3000 and len(meshes)<=30,'rounds':5,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
if a.lod==0:(HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
(HERE/f'lod{a.lod}-stats.json').write_text(json.dumps({'triangles':tri,'draw_calls':len(meshes)},indent=2)+'\n')
if a.glb:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
print('BUILD OK',tri,len(meshes))
if a.render:
    scene=bpy.context.scene;scene.cycles.samples=a.samples;scene.cycles.use_denoising=True
    scene.world=bpy.data.worlds.new('studio');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.10,.15,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
    bpy.ops.mesh.primitive_plane_add(size=200);stage=bpy.context.object
    m=bpy.data.materials.new('stage');m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.045,.038,.055,1);stage.data.materials.append(m)
    target=Vector((0,0,.54))
    for loc,power,size,color in [((3,-4,5),450,4,(1,.80,.60)),((-3,-1,3),220,3,(.65,.58,1)),((1,3,4),350,3,(1,.75,.45))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam
    views={'ref':(3,-4,2.8),'game':(3,-3,4.3),'front':(4,0,.7),'side':(0,-4,.7),'rear':(-3,4,2.8)}
    cam.location=views[a.view];cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=3.45
    scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
    scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True);print('RENDER OK')
