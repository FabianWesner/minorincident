"""Sunset Grove wooden footbridge and creek tile. Deterministic, metres, +X forward."""
import argparse, json, math, random, sys
from pathlib import Path
import bpy
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/blender'))
from sslib import palette, ao
ASSET = {'id': 'kit.creek-bridge-wood', 'category': 'building'}
p = argparse.ArgumentParser()
for name in ('render', 'glb'): p.add_argument('--' + name)
p.add_argument('--view', default='ref'); p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960); p.add_argument('--height', type=int, default=540)
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
rng = random.Random(26)
root = bpy.data.objects.new('root', None); bpy.context.collection.objects.link(root)
root['asset_id'] = ASSET['id']; root['category'] = 'building'; root['forward'] = '+X'
materials = {}
def mat(token):
    if token not in materials:
        materials[token] = palette.mat(token)
        materials[token].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .83
    return materials[token]
def finish(o, name, token, bevel=0):
    o.name=name; o.parent=root; o.data.materials.append(mat(token))
    bpy.context.view_layer.objects.active=o
    if bevel:
        m=o.modifiers.new('soft timber edges','BEVEL'); m.width=bevel; m.segments=1
        bpy.ops.object.modifier_apply(modifier=m.name)
        m=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=m.name)
    return o
def box(name, pos, size, token='woodWarm', bevel=.018):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,token,bevel)
def mesh(name,verts,faces,token):
    d=bpy.data.meshes.new(name); d.from_pydata(verts,[],faces); d.update()
    o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o); return finish(o,name,token)
def beam(name,start,end,width,token):
    delta=Vector(end)-Vector(start)
    o=box(name,(Vector(start)+Vector(end))/2,(width,width,delta.length),token,0 if token=='grass' else .009)
    o.rotation_euler=delta.to_track_quat('Z','Y').to_euler(); return o
def rock(pos,size,token='asphalt'):
    if token=='schoolBusYellow':
        d=bpy.data.meshes.new('flower bud')
        d.from_pydata([(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)],[],[(0,2,4),(2,1,4),(1,3,4),(3,0,4),(2,0,5),(1,2,5),(3,1,5),(0,3,5)])
        d.update();o=bpy.data.objects.new('flower bud',d);bpy.context.collection.objects.link(o);o.location=pos
        bpy.context.view_layer.objects.active=o
    else:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=pos)
    if token!='schoolBusYellow':o=bpy.context.object
    o.scale=size; o.rotation_euler=(rng.uniform(-.3,.3),rng.uniform(-.3,.3),rng.random()*6.28)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); finish(o,'faceted creek stone',token)
# Tile banks: warm earthen cut sides with uneven, narrow green upper patches.
for side in (-1,1):
    inner=[1.22+.16*math.sin(j*1.4)+rng.uniform(-.08,.08) for j in range(13)]
    v=[]
    for j in range(13):
        y=-3+j*.5
        v.extend([(side*inner[j],y,.36),(side*3.95,y,.40+rng.uniform(-.03,.03)),(side*3.95,y,0),(side*inner[j],y,0)])
    f=[]
    for j in range(12):
        k=j*4; n=k+4
        f.extend([(k,n,n+1,k+1),(k+1,n+1,n+2,k+2),(k+2,n+2,n+3,k+3),(k+3,n+3,n,k)])
    f.extend([(0,1,2,3),(48,51,50,49)])
    mesh('earth bank',v,f,'woodWarm')
    for j in range(12):
        y=-2.75+j*.5
        if abs(y)>.95:
            x=side*(2.65+rng.uniform(-.2,.2))
            rock((x,y,.41),(.95,.36,.045),'grass')
# Faceted water surface: no transparent overlap, foam ribbons are 12 mm above water.
v=[]
for j in range(25):
    y=-3+j*.25
    for i in range(9):
        x=-1.5+i*.375; v.append((x,y,.20+.016*math.sin(i*2.1+j*1.7)))
f=[]
for j in range(24):
    for i in range(8):
        k=j*9+i; f.extend([(k,k+1,k+10),(k,k+10,k+9)])
o=mesh('flowing creek',v,f,'polo')
for token in ('tealDark','tealLight'):o.data.materials.append(mat(token))
for face in o.data.polygons:face.material_index=rng.choices([0,1,2],[6,2,2])[0]
for j in range(38):
    y=rng.uniform(-2.92,2.9); x=rng.uniform(-1.15,1.15)
    vv=[]
    for k in range(5):
        yy=y+k*.09; xx=x+.055*math.sin(k*1.8+j)
        zz=.245
        vv.extend([(xx-.009,yy,zz),(xx+.009,yy,zz)])
    mesh('water ripple',vv,[(k*2,k*2+1,k*2+3,k*2+2) for k in range(4)],'picketWhite')
# Bridge: six-metre plank span, railings with five capped square newels on each side.
for y in (-.91,.91):
    box('long bearer',(0,y,.83),(6.15,.20,.31),'leatherShadow',.025)
for x in (-2.86,-1.43,0,1.43,2.86):
    box('cross joist',(x,0,.78),(.18,2.04,.22),'leatherShadow')
for i in range(26):
    x=-2.98+i*.2384
    box('deck board',(x,0,1.035),(.227,2.18,.145),'woodWarm' if i%4 else 'brass',.018)
    # Sparse, raised grain slivers at least 4 mm above plank top.
    for k in range(1):
        yy=rng.uniform(-.8,.8)
        box('deck grain',(x+rng.uniform(-.06,.06),yy,1.113),(.012,rng.uniform(.14,.45),.009),'leatherShadow',0)
for y in (-1.0,1.0):
    for x in (-2.86,-1.43,0,1.43,2.86):
        bottom=.37 if abs(x)<2 else .45
        box('square timber newel',(x,y,(bottom+2.03)/2),(.21,.23,2.03-bottom),'leatherShadow',.02)
        box('post warm face',(x,y-.124,1.62),(.155,.018,.68),'woodWarm',0)
        box('newel cap',(x,y,2.075),(.29,.30,.11),'woodWarm',.025)
        box('post mounting collar',(x,y,1.00),(.285,.28,.13),'leatherShadow',.013)
        if abs(x)<2:
            box('stone pier',(x,y,.36),(.51,.49,.46),'denimLight',.045)
        for z in (.89,1.94):
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.032,location=(x,y-.151,z))
            finish(bpy.context.object,'iron pin','silver')
    for i in range(4):
        x=-2.145+i*1.43
        for z in (1.40,1.90):
            box('horizontal rail',(x,y,z),(1.43,.14,.15),'woodWarm',.02)
            box('rail shaded underside',(x,y-.004,z-.080),(1.37,.148,.025),'leatherShadow',0)
# Bank boulders and flat approach stepping stones.
for side in (-1,1):
    for j in range(12):
        y=-2.75+j*.5+rng.uniform(-.13,.13)
        if abs(y)<1.22:continue
        x=side*(1.43+rng.uniform(-.08,.28))
        s=rng.uniform(.32,.57)
        rock((x,y,.40+s*.45),(s,s*.80,s*.85),'asphalt' if j%3 else 'sidewalk')
    for x in (3.28,3.75):
        for y in (-.74,0,.74):box('approach paving',(side*x,y,.465),(.43,.67,.105),'khakiLight',.042)
    for j in range(8):
        x=side*rng.uniform(2.0,3.65); y=rng.choice([-1,1])*rng.uniform(1.35,2.8)
        rock((x,y,.48),(.28,.23,.16),'sidewalk')
# Clustered broad grass blades. Each tuft is one tiny mesh, not per-leaf objects.
def tuft(x,y,z,scale=1,flower=False):
    vv=[];ff=[]
    for k in range(9):
        th=k*2.399; h=rng.uniform(.24,.55)*scale; spread=rng.uniform(.14,.32)*scale
        dx,dy=math.cos(th),math.sin(th); w=(.115 if flower else .075)*scale
        base=len(vv)
        vv.extend([(x-dy*w,y+dx*w,z),(x+dy*w,y-dx*w,z),(x+dx*spread,y+dy*spread,z+h),(x+dx*spread*.38,y+dy*spread*.38,z+h*.5)])
        ff.extend([(base,base+1,base+3),(base+1,base+2,base+3),(base+2,base,base+3)])
    mesh('grass tuft',vv,ff,'foliage' if flower else 'grass')
    if flower:
        for k in range(4):
            th=k*2.4; dx,dy=math.cos(th)*.18,math.sin(th)*.18
            h=rng.uniform(.48,.78)*scale
            beam('flower stalk',(x+dx,y+dy,z),(x+dx*1.4,y+dy*1.4,z+h),.023,'grass')
            for t in (.65,1):rock((x+dx*1.4+.025,y+dy*1.4,z+h*t),(.047,.047,.058),'schoolBusYellow')
for side in (-1,1):
    for j in range(23):
        y=rng.uniform(-2.8,2.8); x=side*rng.uniform(1.9,3.75)
        if abs(y)<1.16:continue
        tuft(x,y,.44,rng.uniform(1.05,1.45),j%3==0)
    for j in range(16):
        y=-2.85+j*.38
        if abs(y)<1.2:continue
        tuft(side*(1.35+rng.uniform(.1,.4)),y,.44,.75)
# Static geometry merged by material, including multi-material creek partitions.
for o in list(root.children):
    if o.type=='MESH' and len(o.data.materials)>1:
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
for token,m in materials.items():
    obs=[o for o in root.children if o.type=='MESH' and o.data.materials[0]==m]
    if not obs:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name='static_'+m.name
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
meshes=[o for o in root.children if o.type=='MESH']
# Hidden semantic collision anchors: walkable deck and solid railing bands.
for name,pos,size in [('deck',(0,0,1.035),(6.2,2.18,.145)),('railL',(0,-1,1.59),(6,.22,1.06)),('railR',(0,1,1.59),(6,.22,1.06))]:
    c=bpy.data.objects.new('col:'+name,None);bpy.context.collection.objects.link(c);c.parent=root;c.location=pos
    c['collider']='cuboid';c['size']=list(size)
# Cycles AO is exported in COLOR_0, without textures.
ao.bake_all(meshes,samples=32)
triangles=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
report={'id':ASSET['id'],'tier':'Side','triangles':triangles,'draw_calls':len(meshes),'materials':sorted(m.name for m in materials.values()),'nodes_ok':bpy.data.objects.get('root') is not None,'within_budget':6000<=triangles<=10000 and len(meshes)<=30,'rounds':3,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
if a.glb:
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
    for o in root.children:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
    # Regenerated reduced meshes retain root and collider contracts.
    for label,ratio in [('lod1',.5),('lod2',.22)]:
        for o in meshes:
            mod=o.modifiers.new(label,'DECIMATE');mod.ratio=ratio
        bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).with_name('model.'+label+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
        for o in meshes:o.modifiers.remove(o.modifiers[-1])
Path(__file__).with_name('report.json').write_text(json.dumps(report,indent=2)+'\n')
if a.render:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=True
    scene.world.color=(.20,.20,.20)
    stage=bpy.data.materials.new('studio');stage.diffuse_color=(.026,.023,.033,1);stage.use_nodes=True;stage.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.026,.023,.033,1);stage.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.9
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.035));bpy.context.object.data.materials.append(stage)
    target=Vector((0,0,.72))
    for loc,power,color,size in [((-3,-4,8),1700,(1,.79,.56),5),((4,3,7),1250,(.65,.74,1),5)]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=12.0 if a.view=='ref' else 15.2
    az,elev=(60,35) if a.view=='ref' else (45,55)
    if a.view in ('front','side','rear'):az={'front':0,'side':90,'rear':180}[a.view];elev=20
    az,elev=math.radians(az),math.radians(elev)
    cam.location=target+Vector((math.cos(az)*math.cos(elev),-math.sin(az)*math.cos(elev),math.sin(elev)))*16
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
    scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.filepath=a.render;bpy.ops.render.render(write_still=True)
    if a.view=='ref':
        cam.data.ortho_scale=15.2
        az,elev=math.radians(45),math.radians(55)
        cam.location=target+Vector((math.cos(az)*math.cos(elev),-math.sin(az)*math.cos(elev),math.sin(elev)))*16
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.cycles.samples=24;scene.render.resolution_x=960;scene.render.resolution_y=540
        companion='game.png' if Path(a.render).name=='hero.png' else Path(a.render).name.replace('-ref','-game')
        scene.render.filepath=str(Path(a.render).with_name(companion));bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
