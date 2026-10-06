/** Physical KeyboardEvent.code / mouse button tokens, mirrored across all schemes. */
export const defaultBindings = {
  moveUp: ['KeyW'], moveDown: ['KeyS'], moveLeft: ['KeyA'], moveRight: ['KeyD'],
  aimUp: ['ArrowUp'], aimDown: ['ArrowDown'], aimLeft: ['ArrowLeft'], aimRight: ['ArrowRight'],
  left: ['Mouse0', 'KeyJ', 'Space'], right: ['KeyK'],
  selector: ['Mouse2', 'KeyQ', 'KeyL'], interact: ['Mouse1', 'KeyF', 'KeyE'], pause: ['Escape', 'KeyP'],
  /** Hold to walk (E19 §5.5, 00 §5.3); running is the default. Alt also applies to mouse clicks. */
  walk: ['KeyC', 'AltLeft', 'AltRight'],
} satisfies Record<string, string[]>;
export type Action = keyof typeof defaultBindings;
export type BindingMap = Record<Action, string[]>;
