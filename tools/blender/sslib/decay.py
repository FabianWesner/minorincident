import random
from . import palette


def dents(obj, seed, amount=.04):
    rng = random.Random(seed)
    for vertex in obj.data.vertices:
        for axis in range(3):
            vertex.co[axis] += rng.uniform(-amount, amount)


def char(obj):
    for index in range(len(obj.data.materials)):
        obj.data.materials[index] = palette.mat('uiDark')
