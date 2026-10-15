"""Small +X-facing courier cap, built headless; local origin is the head node."""
from pathlib import Path
import bpy, math, json
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
root = Path(__file__).resolve().parents[2]
def mat(name, color, emission=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    return m
teal=mat('cap_teal',(.035,.21,.19));dark=mat('strap_charcoal',(.025,.03,.04));gold=mat('housing_amber',(.8,.42,.08));lens=mat('emi_lens',(.95,.85,.57),1)
def cube(name, at, size, material):
    bpy.ops.mesh.primitive_cube_add(size=1,location=at);o=bpy.context.object;o.name=name;o.dimensions=size;o.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
# Hemisphere made from five rings; 108 triangles, visibly a cap at game zoom.
v=[];f=[]
for j in range(5):
    a=j*math.pi/8
    for i in range(12):
        t=i*math.tau/12;v.append((.19*math.cos(a)*math.cos(t),.23*math.cos(a)*math.sin(t),.09+.15*math.sin(a)))
for j in range(4):
    for i in range(12):
        a=j*12+i;b=j*12+(i+1)%12;f.append((a,b,b+12,a+12))
mesh=bpy.data.meshes.new('cap');mesh.from_pydata(v,[],f);o=bpy.data.objects.new('cap',mesh);bpy.context.collection.objects.link(o);mesh.materials.append(teal)
cube('brim',(.18,0,.09),(.24,.37,.035),teal)
cube('band',(0,0,.105),(.4,.48,.045),dark)
cube('lamp_housing',(.24,0,.16),(.12,.16,.12),gold)
cube('lamp_lens',(.306,0,.16),(.018,.11,.075),lens)
triangles=sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons)
assert triangles<=800,triangles
bpy.ops.export_scene.gltf(filepath=str(root/'public/assets/models/acc.headlamp.glb'),export_format='GLB',export_yup=True)
print(json.dumps({'triangles':triangles}))
