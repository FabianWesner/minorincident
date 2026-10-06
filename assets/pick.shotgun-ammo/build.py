"""Deterministic, texture-free shotgun ammunition pickup. +X is the label/front."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parent
ASSET = {'id': 'pick.shotgun-ammo', 'category': 'prop', 'tier': 'Side'}
p = argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--glb'); p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24); p.add_argument('--width', type=int, default=960); p.add_argument('--height', type=int, default=540)
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
COLORS = {'woodWarm':'b0703f', 'picketWhite':'f2e6dc', 'survivorRed':'d9363e', 'blood':'b3121f', 'schoolBusYellow':'f2b630', 'uiDark':'25222c'}
M = {}
for token, hx in COLORS.items():
    m = bpy.data.materials.new('pal_'+token); m.use_nodes=True
    rgb = [int(hx[i:i+2],16)/255 for i in (0,2,4)]
    rgb = [v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    bs = m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*rgb,1)
    bs.inputs['Roughness'].default_value=.38 if token=='schoolBusYellow' else .72
    bs.inputs['Metallic'].default_value=.65 if token=='schoolBusYellow' else 0
    M[token]=m
root=bpy.data.objects.new('root',None); bpy.context.collection.objects.link(root); root['asset_id']=ASSET['id']

def finish(o, name, token):
    o.name=name; o.data.materials.append(M[token]); o.parent=root
    return o

def box(name, loc, size, token, bevel=.003):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object
    o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('soft cardboard edges','BEVEL'); mod.width=bevel; mod.segments=1
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,name,token)

def lathe(name,x,y,z,profile,token):
    n=8; vs=[(x+t,y+r*math.cos(i*2*math.pi/n),z+r*math.sin(i*2*math.pi/n)) for t,r in profile for i in range(n)]
    fs=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(profile)-1) for i in range(n)]
    fs += [tuple(range(n-1,-1,-1)),tuple((len(profile)-1)*n+i for i in range(n))]
    me=bpy.data.meshes.new(name); me.from_pydata(vs,[],fs); me.update()
    o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o)
    return finish(o,name,token)

def label(text, y, z, size, token, x=.189):
    bpy.ops.object.text_add(location=(x,y,z)); o=bpy.context.object
    o.data.body=text; o.data.font=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Arial Bold.ttf'); o.data.size=size; o.data.align_x='CENTER'; o.data.align_y='CENTER'; o.data.extrude=0; o.data.bevel_depth=0; o.data.resolution_u=1
    # local text X -> world -Y, local Y -> world Z, normal -> +X
    o.rotation_euler=(math.pi/2,0,math.pi/2)
    bpy.ops.object.convert(target='MESH'); finish(bpy.context.object,'marking_'+text,token)

box('carton floor',(0,0,.009),(.36,.56,.018),'woodWarm')
box('front cardboard',(.173,0,.115),(.014,.56,.23),'woodWarm')
box('rear cardboard',(-.173,0,.115),(.014,.56,.23),'woodWarm')
for s in [-1,1]:
    box('side cardboard',(0,s*.273,.115),(.36,.014,.23),'woodWarm')
    box('side cream print',(0,s*.283,.113),(.35,.006,.217),'picketWhite')
    box('side red band',(0,s*.289,.113),(.105,.006,.217),'blood')
    box('fold rim',(0,s*.274,.234),(.36,.018,.012),'woodWarm')
# Upright lid leans slightly backward, attached at rear rim.
lid=box('open lid',(-.196,0,.313),(.012,.555,.17),'woodWarm'); lid.rotation_euler.y=math.radians(-14)
for y in [-.272,.272]:
    edge=box('lid red edge',(-.199,y,.313),(.018,.013,.168),'blood'); edge.rotation_euler.y=math.radians(-14)
box('front cream label',(.183,0,.116),(.006,.546,.212),'picketWhite')
box('12 gauge band',(.189,0,.18),(.006,.546,.078),'blood')
box('bottom red band',(.189,0,.024),(.006,.546,.023),'blood')
label('12 GA',-.143,.18,.075,'picketWhite',.195)
label('AMMO',0,.084,.080,'blood',.189)
box('shell support tray',(0,0,.14),(.28,.52,.03),'woodWarm')
# Three chunky cartridge bundles replace the five detailed individual rounds.
# Eight radial segments and simple collars preserve the red/gold pickup cue.
for y in [-.17,0,.17]:
    lathe('red shell bundle',0,y,.232,[(-.145,.074),(.045,.074)],'survivorRed')
    lathe('brass bundle collar',0,y,.232,[(.045,.075),(.098,.075),(.098,.079),(.112,.079)],'schoolBusYellow')
    lathe('dark base marker',0,y,.232,[(.116,.018),(.119,.018)],'uiDark')
# Static material batches keep draw calls low.
for token,mat in M.items():
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials[0]==mat]
    if not obs: continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); obs[0].name='body' if token=='woodWarm' else 'static_'+token
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
sys.path.insert(0, str(OUT.parents[1]/'tools'/'blender'))
from sslib import ao
ao.bake_all(meshes, samples=32)
tris=sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in meshes)
report={'id':ASSET['id'],'tier':'Side','triangles':tris,'draw_calls':len(meshes),'materials':[m.name for m in M.values()], 'nodes_ok':all(bpy.data.objects.get(n) is not None for n in ['root','body','static_blood','static_picketWhite','static_schoolBusYellow','static_survivorRed','static_uiDark']), 'within_budget':tris<=2500 and len(meshes)<=6,'rounds':4,'webgpu_ok':False,'webgl2_ok':False,'gaps':['Individual shell detail replaced with three eight-sided red/gold bundles; label reduced to 12 GA / AMMO; fine wear omitted.']}
bpy.context.scene.unit_settings.system='METRIC'
if a.glb:
    bpy.ops.object.select_all(action='SELECT')
    def export_glb(path):
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
    output=Path(a.glb)
    export_glb(output)
    report['lods']={}
    for level,ratio in [(1,.5),(2,.25)]:
        for o in meshes:
            mod=o.modifiers.new('LOD simplification','DECIMATE'); mod.ratio=ratio; mod.use_collapse_triangulate=True
        bpy.context.view_layer.update()
        deps=bpy.context.evaluated_depsgraph_get(); count=0
        for o in meshes:
            evaluated=o.evaluated_get(deps); me=evaluated.to_mesh(); me.calc_loop_triangles(); count+=len(me.loop_triangles); evaluated.to_mesh_clear()
        export_glb(output.with_name(output.stem+'.lod'+str(level)+output.suffix))
        report['lods']['lod'+str(level)]={'triangles':count,'draw_calls':len(meshes)}
        for o in meshes: o.modifiers.remove(o.modifiers['LOD simplification'])
elif (OUT/'report.json').exists():
    report['lods']=json.loads((OUT/'report.json').read_text()).get('lods',{})
(OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
if a.render:
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=a.samples
    scene.world.color=(.20,.20,.20)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.004)); ground=bpy.context.object
    mat=bpy.data.materials.new('stage');mat.use_nodes=True; mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.035,.028,.042,1); mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.85;ground.data.materials.append(mat)
    target=Vector((0,0,.19))
    for loc,power,col,size in [((1,-2,3),180,(1,.80,.61),2),((-2,1,2),130,(.65,.73,1),2)]:
        bpy.ops.object.light_add(type='AREA',location=loc); light=bpy.context.object;light.data.energy=power;light.data.color=col;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
    az=math.radians(38 if a.view=='ref' else 45); el=math.radians(28 if a.view=='ref' else 48)
    if a.view in ['front','rear','side']:az={'front':0,'rear':180,'side':90}[a.view]*math.pi/180;el=.15
    bpy.ops.object.camera_add();cam=bpy.context.object;cam.location=target+Vector((math.cos(az)*math.cos(el),-math.sin(az)*math.cos(el),math.sin(el)))*2.3
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.40 if a.view=='ref' else 1.40;scene.camera=cam
    scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=a.render
    Path(a.render).parent.mkdir(parents=True,exist_ok=True);bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
