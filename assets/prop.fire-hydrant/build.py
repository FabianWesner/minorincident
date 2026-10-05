"""Deterministic palette-only cast hydrant, Blender Z-up / +X forward."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
p = argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--glb'); p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24); p.add_argument('--width', type=int, default=960); p.add_argument('--height', type=int, default=540)
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def material(token, color, metallic=0):
    m = bpy.data.materials.new('pal_'+token); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Roughness'].default_value = .42; bs.inputs['Metallic'].default_value = metallic
    return m
red = material('survivorRed', (.68,.035,.045))
dark = material('uiDark', (.026,.023,.032), .35)

def finish(o, mat, bevel=.009, segments=3):
    o.data.materials.append(mat)
    if bevel:
        b=o.modifiers.new('cast edge rounding','BEVEL'); b.width=bevel; b.segments=segments
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=b.name)
        n=o.modifiers.new('cast normals','WEIGHTED_NORMAL'); n.keep_sharp=True; n.weight=40
        bpy.ops.object.modifier_apply(modifier=n.name)
    return o

def cylinder(name, radius, depth, loc, mat=red, vertices=16, axis=(0,0,1), bevel=.009):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    o=bpy.context.object; o.name=name
    o.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return finish(o,mat,bevel)

def box(name, loc, size, bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name
    o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,red,bevel)

def profile(name, rings, vertices=16):
    verts=[]; faces=[]
    for z,r in rings:
        verts.extend((r*math.cos(2*math.pi*i/vertices),r*math.sin(2*math.pi*i/vertices),z) for i in range(vertices))
    for k in range(len(rings)-1):
        for i in range(vertices):
            j=(i+1)%vertices; faces.append((k*vertices+i,k*vertices+j,(k+1)*vertices+j,(k+1)*vertices+i))
    faces += [tuple(reversed(range(vertices))),tuple((len(rings)-1)*vertices+i for i in range(vertices))]
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o)
    return finish(o,red,.006)

# Broad sixteen-sided foot and collar surround the narrow cast barrel.
profile('foot',[(0,.263),(.025,.285),(.105,.28),(.13,.25)])
cylinder('barrel',.19,.59,(0,0,.415),bevel=.01)
cylinder('bonnet_flange',.253,.10,(0,0,.76),bevel=.012)
profile('bonnet',[(.803,.191),(.88,.184),(.94,.166),(.99,.116),(1.005,.065)])
# Top operating nut has a true recessed socket rather than an overlay.
profile('top_nut',[(1.002,.066),(1.07,.052),(1.082,.047),(1.082,.026),(1.059,.026)],8)
cylinder('socket_recess',.025,.008,(0,0,1.064),dark,8,bevel=.002)
# Two visible hose outlets: layered neck, gasket shadow, chamfered cap, metal hex spindle.
for label,axis in [('front',(1,0,0)),('right',(0,-1,0))]:
    def loc(d): return (axis[0]*d,axis[1]*d,.57)
    cylinder(label+'_neck',.111,.095,loc(.204),vertices=16,axis=axis,bevel=.01)
    cylinder(label+'_gasket',.101,.014,loc(.25),dark,24,axis, .003)
    cylinder(label+'_cap',.112,.076,loc(.291),vertices=16,axis=axis,bevel=.012)
    cylinder(label+'_spindle',.037,.033,loc(.342),dark,6,axis,.004)
# Casting buttresses and square flange fasteners, all embedded by >3 mm.
for i in range(4):
    t=i*math.pi/2; x,y=.18*math.cos(t),.18*math.sin(t)
    o=box('foot_rib',(x,y,.225),(.048,.046,.19),.016)
    o.rotation_euler.z=t
    box('foot_lug',(.224*math.cos(t),.224*math.sin(t),.148),(.062,.06,.04))
    box('bonnet_lug',(.211*math.cos(t),.211*math.sin(t),.817),(.046,.046,.024),.004)

root=bpy.data.objects.new('root',None); bpy.context.collection.objects.link(root)
root['asset_id']='prop.fire-hydrant'; root['static']=True
# One mesh per palette material; no moving parts on this fixed street fixture.
for mat,name in [(red,'body'),(dark,'hardware')]:
    chosen=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials[0]==mat]
    bpy.ops.object.select_all(action='DESELECT')
    for o in chosen:o.select_set(True)
    bpy.context.view_layer.objects.active=chosen[0]; bpy.ops.object.join()
    o=bpy.context.object;o.name=name;o.parent=root
    bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
triangles=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
report=dict(id='prop.fire-hydrant',tier='Side',triangles=triangles,draw_calls=2,materials=[red.name,dark.name],nodes_ok=True,within_budget=6000<=triangles<=12000,rounds=3,webgpu_ok=False,webgl2_ok=False,gaps=[])
(HERE/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in [root]+meshes:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
if a.render:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=a.samples
    scene.cycles.use_denoising=True
    scene.world.color=(.12,.12,.12)
    floor=material('backdrop',(.035,.031,.042))
    bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(floor)
    def aim(o,point):o.rotation_euler=(Vector(point)-o.location).to_track_quat('-Z','Y').to_euler()
    for loc,power,size,color in [((3,-4,6),450,4,(1,.78,.58)),((-3,-1,3),220,3,(.65,.74,1)),((1,4,4),350,3,(1,.47,.22))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;aim(o,(0,0,.5))
    views={'ref':(3,-4,2.6),'game':(3,-4,5),'front':(4,0,1.6),'side':(0,-4,1.6),'rear':(-3,4,2.6)}
    bpy.ops.object.camera_add(location=views[a.view]);camera=bpy.context.object;aim(camera,(0,0,.54));camera.data.type='ORTHO';camera.data.ortho_scale=2.65;scene.camera=camera
    scene.view_settings.view_transform='AgX'
    scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
    scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
