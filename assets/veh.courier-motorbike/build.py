"""Courier motorbike with attached sidecar. Deterministic metres, +X forward, Z up."""
import bpy
import json
import math
from mathutils import Vector
from sslib import palette, sockets

M = {name: palette.mat(token) for name, token in {
    'red': 'survivorRed', 'dark': 'uiDark', 'silver': 'silver',
    'seat': 'asphalt', 'lamp': 'windowGlow', 'tail': 'sirenRed',
    'teal': 'backpackTeal',
}.items()}


def build(ctx):
    root = ctx.root
    root.name = 'root'
    root['ss_physics'] = json.dumps({'class': 'light', 'mass': 180, 'friction': .8, 'restitution': .08,
        'centerOfMass': [-.05, .46, .16], 'pushable': False, 'kickable': False,
        'vaultable': False, 'flammable': True, 'sounds': 'vehicle.engine-low'})
    n = {'wheel': 16 if ctx.quality == 'high' else 8, 'cyl': 12 if ctx.quality == 'high' else 8}

    def empty(name, location=(0, 0, 0), parent=root):
        return sockets.empty(name, location, parent)

    def mesh_node(name, location=(0, 0, 0), parent=root):
        node = empty(name, location, parent)
        return node

    def box(name, loc, size, material, parent=root, bevel=.025):
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
        obj = bpy.context.object
        obj.name = name
        obj.dimensions = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        obj.data.materials.append(M[material])
        if bevel and ctx.quality == 'high':
            mod = obj.modifiers.new('soft bevel', 'BEVEL'); mod.width = bevel; mod.segments = 2
            bpy.context.view_layer.objects.active = obj; bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.context.view_layer.update(); world = obj.matrix_world.copy(); obj.parent = parent; obj.matrix_world = world
        return obj

    def tube(name, a, b, radius, material, parent=root, vertices=None):
        start, end = Vector(a), Vector(b)
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices or n['cyl'], radius=radius, depth=(end-start).length, location=(start+end)/2)
        obj = bpy.context.object; obj.name = name; obj.rotation_euler = (end-start).to_track_quat('Z', 'Y').to_euler()
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True); obj.data.materials.append(M[material])
        bpy.context.view_layer.update(); world = obj.matrix_world.copy(); obj.parent = parent; obj.matrix_world = world
        return obj

    def wheel(name, x, y, z, radius, parent=root):
        pivot = mesh_node(name, (x, y, z), parent)
        bpy.ops.mesh.primitive_torus_add(major_segments=n['wheel'], minor_segments=6 if ctx.quality == 'high' else 4,
            major_radius=radius-.045, minor_radius=.045, location=(x, y, z), rotation=(math.pi/2, 0, 0))
        tire = bpy.context.object; tire.name = f'{name}_tire'; tire.data.materials.append(M['dark'])
        bpy.context.view_layer.update(); world = tire.matrix_world.copy(); tire.parent = pivot; tire.matrix_world = world
        tube(f'{name}_hub', (x,y-.06,z), (x,y+.06,z), .06, 'silver', pivot, 8)
        for i in range(8 if ctx.quality == 'high' else 4):
            angle = math.tau*i/(8 if ctx.quality == 'high' else 4)
            tube(f'{name}_spoke', (x, y, z), (x+math.cos(angle)*(radius-.08), y, z+math.sin(angle)*(radius-.08)), .009, 'silver', pivot, 4)
        return pivot

    body = mesh_node('body')
    empty('front', (1.2, 0, .45), root)
    rear = wheel('wheel_rear', -.73, 0, .36, .36)
    front = wheel('wheel_front', .92, 0, .36, .36)
    empty('wheelR', parent=rear); empty('wheelF', parent=front)
    side_wheel = wheel('sidecar_wheel', -.3, -1.8, .34, .34)
    tube('frame_spine', (-.65,0,.42), (.9,0,.43), .055, 'red', body)
    tube('frame_down', (-.65,0,.42), (.12,0,.96), .05, 'red', body)
    tube('frame_seat', (-.65,0,.42), (-.48,0,1.04), .045, 'red', body)
    tube('front_fork', (.92,0,.36), (.7,0,1.08), .04, 'silver', body)
    box('engine_block', (-.16,0,.47), (.47,.42,.4), 'silver', body, .07)
    box('fuel_tank', (.3,0,.82), (.55,.42,.34), 'red', body, .09)
    box('driver_saddle', (-.49,0,1.02), (.55,.34,.11), 'seat', body, .05)
    seat = empty('seat', (-.49,0,1.08), root)
    handle = mesh_node('handlebar', (.69,0,1.05))
    tube('bar', (.69,-.35,1.05), (.69,.35,1.05), .035, 'dark', handle, 8)
    empty('grip_l', (0,.29,0), handle); empty('grip_r', (0,-.29,0), handle)
    rests = empty('footrests', (-.17,0,.38), root)
    empty('pedal_l', (0,.23,0), rests); empty('pedal_r', (0,-.23,0), rests)
    side = mesh_node('sidecar', (-.35,-1.15,0))
    box('sidecar_frame', (-.26,-1.15,.35), (1.2,.12,.1), 'silver', side, .025)
    box('sidecar_tub', (-.3,-1.15,.52), (1.6,1.1,.5), 'red', side, .12)
    box('sidecar_inner', (-.3,-1.15,.77), (1.3,.8,.09), 'seat', side, .04)
    box('sidecar_cushion', (-.28,-1.15,.81), (.9,.7,.1), 'teal', side, .04)
    empty('sidecar_seat', (-.28,-1.15,.84), root)
    lights = mesh_node('lightsFront', (.94,0,.76))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12 if ctx.quality == 'high' else 8, ring_count=6, radius=.12, location=(.94,0,.76))
    lamp=bpy.context.object; lamp.name='headlamp'; lamp.data.materials.append(M['lamp']); bpy.context.view_layer.update(); world=lamp.matrix_world.copy(); lamp.parent=lights; lamp.matrix_world=world
    brake = mesh_node('lightsBrake', (-.86,0,.66))
    box('tail_lamp', (-.86,0,.66), (.12,.18,.1), 'tail', brake, .02)
    empty('exitL', (-.8,-.95,0), root); empty('exitR', (-.8,.95,0), root)
    tube('exhaust', (-.5,-.2,.34), (-.98,-.2,.34), .055, 'silver', body, 8)
    return root
