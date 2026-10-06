"""Open nail ammunition carton. Metres, +X front, Z up; no textures."""
import argparse,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for k in ('render','glb'):p.add_argument('--'+k)
p.add_argument('--lod',type=int,choices=(0,1,2),default=0)
p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={}
old_node_names=['body_pal_brick','body_pal_schoolBusYellow','body_pal_sidewalk','body_pal_uiDark','body_pal_woodWarm','lid_pal_schoolBusYellow','lid_pal_woodWarm','flap_left_pal_schoolBusYellow','flap_left_pal_woodWarm','flap_right_pal_schoolBusYellow','flap_right_pal_woodWarm']
# woodWarm represents orange dyed cardboard; other tokens retain the shared palette.
for token,h in {'woodWarm':'e86d20','schoolBusYellow':'f2b630','sidewalk':'c4c7d6'}.items():
    rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    m=bpy.data.materials.new('pal_'+token);m.use_nodes=True
    bs=m.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
    bs.inputs['Roughness'].default_value=.31 if token=='sidewalk' else .73
    bs.inputs['Metallic'].default_value=0
    M[token]=m
# One vertex-colored material carries silver bundles and dark raised printing.
shared=M['sidewalk'];bs=shared.node_tree.nodes['Principled BSDF']
bs.inputs['Base Color'].default_value=(1,1,1,1);bs.inputs['Metallic'].default_value=0
vc=shared.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Color'
shared.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color'])

def empty(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc
    if parent:o.parent=parent
    return o
root=empty('root');root['asset_id']='pick.nail-ammo'
body=empty('body',parent=root)
lid=empty('lid',(-.18,0,.23),root)
flaps=[empty('flap_left',(0,-.33,.23),root),empty('flap_right',(0,.33,.23),root)]
def finish(o,name,mat,parent=body,bevel=0,segments=1):
    o.name=name
    if mat in ('uiDark','sidewalk'):
        color=(.019,.016,.026,1) if mat=='uiDark' else (.552,.571,.672,1)
        attr=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        for value in attr.data:value.color=color
        mat='sidewalk'
    o.data.materials.append(M[mat]);bpy.context.view_layer.objects.active=o
    if bevel:
        m=o.modifiers.new('edge rounding','BEVEL');m.width=bevel;m.segments=segments;bpy.ops.object.modifier_apply(modifier=m.name)
    m=o.modifiers.new('corner normals','WEIGHTED_NORMAL');m.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.context.view_layer.update();world=o.matrix_world.copy();o.parent=parent;o.matrix_world=world
    return o

def box(name,loc,size,mat='woodWarm',parent=body,bevel=0,segments=1):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent,min(bevel,min(size)*.35),segments)

# Thick folded carton, open at the top. Front and end panels overlap inside folds.
box('bottom',(0,0,.009),(.36,.66,.018))
for x in (-.174,.174):box('long_wall',(x,0,.123),(.012,.66,.23))
for y in (-.324,.324):box('end_wall',(0,y,.123),(.336,.012,.23))
# Chunky front and rear folded rims.
for x in (-.174,.174):box('top_fold',(x,0,.233),(.016,.666,.012),bevel=.002 if a.lod==0 else 0)
# Back flap pivots at its fold; local meshes are positioned in world then parented.
angle=math.radians(65)
center=Vector((-.18,0,.23))+Vector((-math.cos(angle)*.11,0,math.sin(angle)*.11))
o=box('back_lid',center,(.22,.66,.010),parent=lid);o.rotation_euler.y=angle
# End flaps angle outward like the reference.
for sign,parent in zip((-1,1),flaps):
    o=box('side_flap',(0,sign*.397,.263),(.35,.15,.010),parent=parent);o.rotation_euler.x=sign*math.radians(24)
# Three broad, low-segment bundles replace 24 individually modelled nails.
for y in ((-.19,0,.19) if a.lod<2 else (0,)):
    width=.16 if a.lod<2 else .56
    box('nail_bundle',(0,y,.173),(.282,width,.026),'sidewalk',bevel=.008 if a.lod==0 else 0)
    box('bundle_heads',(-.144,y,.173),(.023,width+.011,.043),'sidewalk',bevel=.006 if a.lod==0 else 0)
box('yellow_collation',(0,0,.188),(.058,.586,.030),'schoolBusYellow',bevel=.004 if a.lod==0 else 0)
# Front print, extruded beyond the wall by 4 mm.
label_font=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
def text(label,loc,size,parent=body):
    bpy.ops.object.text_add(location=loc,rotation=(math.pi/2,0,math.pi/2));o=bpy.context.object
    o.data.font=label_font;o.data.resolution_u=1;o.data.body=label;o.data.align_x='CENTER';o.data.align_y='CENTER';o.data.size=size;o.data.extrude=.0008;o.data.bevel_depth=0;o.data.bevel_resolution=1
    bpy.ops.object.convert(target='MESH');return finish(bpy.context.object,'print_'+label,'uiDark',parent)
text('NAIL AMMO',(.184,0,.143),.080)

# Diagonal hazard marking as clipped polygons on the front face, 4 mm proud.
def front_poly(name,pts,mat='uiDark',x=.184,parent=body):
    vertices=[(xx,-y if name.startswith('hazard') else y,z) for xx in (x,x+.001) for y,z in pts];n=len(pts)
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);return finish(o,name,mat,parent)
front_poly('hazard_band',[(-.306,.037),(-.264,.037),(-.208,.105),(-.247,.105)])
front_poly('hazard_triangle',[(-.306,.063),(-.306,.105),(-.275,.105)])
# Join static meshes by material within each joint assembly.
for parent in (body,lid,*flaps):
    for mat in M.values():
        obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==mat]
        if not obs:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=parent.name+'_'+mat.name
# Preserve all previously exported names, including removed detail meshes.
for name in old_node_names:
    if bpy.data.objects.get(name) is None:empty(name,parent=body if name.startswith('body') else lid if name.startswith('lid') else flaps[0] if name.startswith('flap_left') else flaps[1])
col=empty('col:body',(0,0,.12),root);col['collider']='cuboid';col['size']=[.36,.66,.24]
asset=list(bpy.context.scene.objects);meshes=[o for o in asset if o.type=='MESH'];tri=0
for o in meshes:o.data.calc_loop_triangles();tri+=len(o.data.loop_triangles)
report={'id':'pick.nail-ammo','tier':'Side','triangles':tri,'draw_calls':len(meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials}),'nodes_ok':all(bpy.data.objects.get(n) for n in ('root','body','lid','flap_left','flap_right','col:body',*old_node_names)),'within_budget':tri<=2500 and len(meshes)<=6,'rounds':5,'webgpu_ok':False,'webgl2_ok':False,'gaps':['Individual nails replaced by three chunky bundles; small barcode and wear removed. Silver and dark print share a vertex-colored material.']}
report_path=HERE/'report.json'
previous=json.loads(report_path.read_text()) if report_path.exists() else {}
report['lods']=previous.get('lods',{})
report['lods']['lod'+str(a.lod)]={'triangles':tri,'draw_calls':len(meshes)}
if a.lod==0:report_path.write_text(json.dumps(report,indent=2)+'\n')
else:
    previous['lods']=report['lods'];report_path.write_text(json.dumps(previous,indent=2)+'\n')
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
print('BUILD OK',tri,'triangles',len(meshes),'draw calls')
if a.render:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=True
    world=bpy.data.worlds.new('studio');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.21,.29,1);world.node_tree.nodes['Background'].inputs[1].default_value=.55
    bpy.ops.mesh.primitive_plane_add(size=200);stage=bpy.data.materials.new('stage');stage.use_nodes=True;stage.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.035,.029,.043,1);bpy.context.object.data.materials.append(stage)
    for loc,power,size,color in [((2,-3,4),240,3,(1,.83,.67)),((-2,1,3),180,2,(.65,.75,1))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,.2))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;target=Vector((0,0,.23))
    cam.location={'ref':(1.3,-.85,1.05),'game':(1.3,-1.3,1.8),'front':(2,0,.25),'side':(0,-2,.3),'rear':(-2,1,1)}[a.view]
    cam.data.type='ORTHO';cam.data.ortho_scale=1.65 if a.view=='game' else 1.35;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
    scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True);print('RENDER OK')
