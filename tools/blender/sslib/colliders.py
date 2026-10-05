from .sockets import empty


def cuboid(name, size, position=(0, 0, 0), parent=None):
    obj = empty('col:' + name, position, parent)
    obj['collider'] = 'cuboid'
    obj['size'] = list(size)
    return obj
