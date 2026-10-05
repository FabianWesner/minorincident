/** Physical KeyboardEvent.code / mouse button tokens, mirrored across all schemes. */
export const defaultBindings = {
  moveUp: ['KeyW'], moveDown: ['KeyS'], moveLeft: ['KeyA'], moveRight: ['KeyD'],
  aimUp: ['ArrowUp'], aimDown: ['ArrowDown'], aimLeft: ['ArrowLeft'], aimRight: ['ArrowRight'],
  left: ['Mouse0', 'KeyJ', 'Space'], right: ['Mouse2', 'KeyK', 'ShiftLeft', 'ShiftRight'],
  selector: ['KeyQ', 'KeyL'], interact: ['Mouse1', 'KeyE'], pause: ['Escape', 'KeyP'],
} satisfies Record<string, string[]>;
export type Action = keyof typeof defaultBindings;
export type BindingMap = Record<Action, string[]>;
