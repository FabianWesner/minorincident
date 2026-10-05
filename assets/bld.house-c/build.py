"""House C: deterministic, texture-free backyard diorama, +X front, metres."""
import argparse, json, math, random, sys
from pathlib import Path
import bpy
from mathutils import Vector
P=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
p.add_argument('--render');p.add_argument('--glb');p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24);p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
rng=random.Random(37);materials={};groups={}
def mat(t,h,em=False,metal=0):
 m=bpy.data.materials.new(('emi_' if em else 'pal_')+t);m.use_nodes=True
 c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
 m.diffuse_color=c;b=m.node_tree.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=c;b.inputs['Roughness'].default_value=.62;b.inputs['Metallic'].default_value=metal
 if em:b.inputs['Emission Color'].default_value=c;b.inputs['Emission Strength'].default_value=2.2
 materials[m.name]=m;return m
cream=mat('picketWhite','f2e6dc');siding=mat('sidewalk','d1b59b');wood=mat('woodWarm','b0703f');dark=mat('uiDark','30303e',metal=.15);slate=mat('asphalt','5b4f5c');green=mat('foliage','7da23c');grass=mat('grass','6f8f3a');red=mat('survivorRed','d9363e');yellow=mat('schoolBusYellow','f2b630');blue=mat('backpackTeal','2f6e6a');glow=mat('windowGlow','ffc773',True)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root)
def empty(n,loc=(0,0,0),parent=root):
 o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=parent;return o
roof=empty('roof');interior=empty('interior');door=empty('door_back',(0,-.46,.85));lid=empty('door_grill_lid',(1.35,-2.15,1.72))
def finish(o,m,b=0,group='body'):
 o.data.materials.append(m)
 if b:
  mod=o.modifiers.new('soft edges','BEVEL');mod.width=b;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 groups.setdefault((group,m.name),[]).append(o);return o
 defunused=0
