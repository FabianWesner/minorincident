"""Deterministic prototype flamethrower; +X muzzle, Z up, metres."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib import palette, ao

parser = argparse.ArgumentParser()
for key in ('render', 'glb'): parser.add_argument('--' + key)
parser.add_argument('--view', default='ref'); parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960); parser.add_argument('--height', type=int, default=540)
parser.add_argument('--lod', type=int, choices=(0, 1, 2), default=0)
parser.add_argument('--quality', choices=('high', 'low'), default='high')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
TOKENS = ('olive', 'oliveSeam', 'uiDark', 'asphalt', 'schoolBusYellow', 'survivorRed', 'brass')
M = {t: palette.mat(t) for t in TOKENS}
M['pilotGlow'] = palette.mat('schoolBusYellow', emissive=True)
for t in ('asphalt', 'uiDark'):
    shader = M[t].node_tree.nodes['Principled BSDF']; shader.inputs['Metallic'].default_value = .58; shader.inputs['Roughness'].default_value = .38
parts = []
lod2_shapes = {'receiver', 'rear_stock', 'burner_tube', 'heat_shroud', 'nozzle_collar', 'fuel_cylinder', 'front_grip', 'rear_grip', 'pilot_light'}
lod1_shapes = {'receiver', 'rear_stock', 'butt_pad', 'front_grip', 'rear_grip'}
lod1_cylinders = {'burner_tube', 'heat_shroud', 'nozzle_collar', 'nozzle_lip', 'nozzle_bore', 'fuel_cylinder', 'fuel_band', 'pilot_light', 'fuel_hose'}
def finish(obj, token, bevel=0):
    obj.data.materials.append(M[token]); bpy.context.view_layer.objects.active = obj
    if bevel:
        mod = obj.modifiers.new('soft tool edges', 'BEVEL'); mod.width = bevel; mod.segments = 1; bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = obj.modifiers.new('weighted corners', 'WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
    parts.append(obj); return obj
def box(name, loc, size, token, bevel=.003):
    if args.lod == 2 and name not in lod2_shapes: return None
    if args.lod == 1 and name not in lod1_shapes: return None
    bevel = min(bevel, min(size) * .4)  # Preserve faces on thin plates.
    if args.lod > 0: bevel = .008 if args.lod == 1 and name == 'receiver' else 0
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); obj=bpy.context.object; obj.name=name; obj.dimensions=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True); return finish(obj, token, bevel)
def cyl(name, loc, radius, depth, token, axis='X', sides=12):
    if args.lod == 2 and name not in lod2_shapes: return None
    if args.lod == 1 and name not in lod1_cylinders: return None
    if args.lod == 1: sides = min(sides, 10)
    if args.lod == 2: sides = min(sides, 8)
    rot={'X':(0, math.pi/2, 0), 'Y':(math.pi/2,0,0), 'Z':(0,0,0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=depth, location=loc, rotation=rot)
    obj=bpy.context.object; obj.name=name; return finish(obj, token)
def rod(name, start, end, radius, token, sides=8):
    if args.lod == 2 or args.lod == 1 and name != 'fuel_hose': return None
    delta=Vector(end)-Vector(start); obj=cyl(name, (Vector(start)+Vector(end))/2, radius, delta.length, token, 'Z', sides)
    obj.rotation_euler=delta.to_track_quat('Z','Y').to_euler(); return obj

# A compact two-hand burner with a chunky olive receiver and real fuel bottle.
box('receiver', (-.04,0,.31), (.40,.19,.19), 'olive', .025)
box('receiver_top', (-.03,0,.414), (.29,.15,.035), 'oliveSeam', .012)
box('side_plate', (-.10,-.101,.31), (.21,.012,.11), 'asphalt', .006)
box('safety_latch', (.01,-.11,.36), (.075,.018,.032), 'schoolBusYellow', .005)
box('rear_stock', (-.36,0,.31), (.26,.16,.12), 'oliveSeam', .018)
box('butt_pad', (-.50,0,.31), (.04,.18,.16), 'asphalt', .01)
# Barrel and broad, slotted burner head, oriented toward +X.
cyl('burner_tube', (.28,0,.31), .045, .46, 'uiDark', sides=16)
cyl('heat_shroud', (.43,0,.31), .071, .25, 'oliveSeam', sides=16)
cyl('nozzle_collar', (.57,0,.31), .078, .055, 'schoolBusYellow', sides=16)
cyl('nozzle_lip', (.61,0,.31), .059, .035, 'asphalt', sides=16)
cyl('nozzle_bore', (.631,0,.31), .039, .008, 'uiDark', sides=16)
# Fuel cylinder below the barrel; chunky bands preserve its readable silhouette at distance.
cyl('fuel_cylinder', (-.005,-.145,.125), .105, .43, 'olive', sides=16)
for x in (-.19,.18): cyl('fuel_band', (x,-.145,.125), .112, .035, 'schoolBusYellow', sides=16)
cyl('fuel_cap', (-.247,-.145,.125), .078, .045, 'asphalt', sides=12)
box('fuel_label', (-.005,-.254,.13), (.18,.012,.073), 'oliveSeam', .006)
# Raised twin grips and trigger guard, sized to the courier's two-hand long-gun hold.
box('front_grip', (.20,0,.19), (.095,.12,.16), 'asphalt', .016)
box('rear_grip', (-.22,0,.19), (.095,.12,.17), 'asphalt', .016)
if args.lod < 2:
    if args.lod == 0:
        rod('trigger_guard', (-.16,-.066,.25), (-.08,-.066,.20), .009, 'uiDark')
        rod('trigger_guard', (-.08,-.066,.20), (-.015,-.066,.255), .009, 'uiDark')
        rod('trigger', (-.115,-.072,.26), (-.135,-.072,.215), .008, 'schoolBusYellow')
# Braided fuel hose follows the side of the receiver and loops into the nozzle feed.
if args.lod < 2:
    hose=([(-.005,-.205,.20),(.10,-.205,.25),(.27,-.205,.255),(.40,-.205,.24),(.49,-.19,.30),(.52,-.14,.35),(.45,-.14,.39),(.31,-.14,.39),(.10,-.08,.33)] if args.lod == 0 else [(-.005,-.205,.20),(.25,-.205,.25),(.48,-.19,.30),(.45,-.04,.33)])
    for i in range(len(hose)-1): rod('fuel_hose', hose[i], hose[i+1], .012, 'brass', 6)
else:
    rod('fuel_hose',(-.02,-.20,.21),(.42,-.20,.26),.014,'brass',6)
# Pilot-light assembly sits just aft of the actual fire origin.
if args.lod == 0:
    box('pilot_bracket', (.50,-.10,.405), (.09,.06,.035), 'asphalt', .006)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=.012, radius2=0, depth=.045, location=(.62,-.105,.418), rotation=(0,math.pi/2,0))
    bpy.context.object.name='pilot_flame'; finish(bpy.context.object, 'pilotGlow')
cyl('pilot_light', (.57,-.105,.418), .018, .05, 'survivorRed', 'X', 10)
# Lift all geometry to ground contact while retaining predictable socket coordinates.
bottom=.013  # Shared ground and socket frame at every LOD (fuel-band contact).
for obj in parts: obj.location.z -= bottom
bpy.context.view_layer.update()
root=bpy.data.objects.new('root',None); bpy.context.collection.objects.link(root)
root['decorativeEmissive'] = True  # Tiny pilot flame; no additional dynamic light.
# Merge the rigid assembly by palette, retaining the named pilot assembly.
joined=[]
pilot=bpy.data.objects['pilot_light']
batches={token:[obj for obj in parts if obj.data.materials[0] == material and obj != pilot] for token,material in M.items()}
for token,material in M.items():
    batch=batches[token]
    if not batch: continue
    bpy.ops.object.select_all(action='DESELECT')
    for obj in batch: obj.select_set(True)
    bpy.context.view_layer.objects.active=batch[0]; bpy.ops.object.join()
    obj=bpy.context.object; obj.name='body' if token == 'olive' else 'static_' + token
    joined.append(obj)
parts=joined+[pilot]
for obj in parts:
    world=obj.matrix_world.copy(); obj.parent=root; obj.matrix_world=world
for name,loc in [('grip',(-.22,0,.19-bottom)),('muzzle',(.645,0,.31-bottom)),('flameOrigin',(.645,0,.31-bottom)),('front',(.65,0,.31-bottom))]:
    marker=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(marker); marker.location=loc; marker.parent=root
for obj in parts: obj.data.calc_loop_triangles()
tris=sum(len(obj.data.loop_triangles) for obj in parts)
report={'id':'wpn.flamethrower','lod':args.lod,'triangles':tris,'draw_calls':len(parts),'materials':sorted({obj.data.materials[0].name for obj in parts}),'nodes_ok':all(n in bpy.data.objects for n in ('root','grip','muzzle','flameOrigin','pilot_light'))}
(HERE/f'geometry.lod{args.lod}.json').write_text(json.dumps(report,indent=2)+'\n')
if args.glb:
    ao.bake_all(parts,samples=16)
    bpy.ops.object.select_all(action='DESELECT'); root.select_set(True)
    for child in root.children: child.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(Path(args.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True)
if args.render:
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=args.samples; scene.cycles.use_denoising=True
    scene.world=bpy.data.worlds.new('review world'); scene.world.use_nodes=True; scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.035,.03,.045,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
    def aim(obj,at): obj.rotation_euler=(Vector(at)-obj.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(); cam=bpy.context.object
    cam.location={'ref':(.35,-2.6,1.05),'game':(1.5,-2.3,2.4),'front':(3,0,.6),'side':(0,-3,.6),'rear':(-3,-1,.8)}[args.view]
    aim(cam,(.03,-.02,.27)); cam.data.type='ORTHO'; cam.data.ortho_scale=1.6; scene.camera=cam
    for loc,power,size,color in [((-1,-2,3),210,3,(1,.79,.57)),((1,2,2),230,2,(.60,.70,1)),((0,-1,1),35,2,(1,1,1))]:
        bpy.ops.object.light_add(type='AREA',location=loc); light=bpy.context.object; light.data.energy=power; light.data.shape='DISK'; light.data.size=size; light.data.color=color; aim(light,(0,0,.25))
    scene.view_settings.view_transform='AgX'; scene.render.resolution_x=args.width; scene.render.resolution_y=args.height; scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(Path(args.render).resolve()); bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
