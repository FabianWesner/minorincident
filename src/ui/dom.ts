/** Every UI node has a stable test ID, including decorative children. */
export function node<K extends keyof HTMLElementTagNameMap>(tag: K, id: string, text = ''): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.dataset.testid = id;
  if (text) element.textContent = text;
  return element;
}
export function text(element: HTMLElement, value: string): void {
  if (element.textContent !== value) element.textContent = value;
}
/** Avoid invalidating style/layout when a frame presents the same HUD state. */
export function setHidden(element: HTMLElement, value: boolean): void {
  if (element.hidden !== value) element.hidden = value;
}
// These helpers own their inline properties and attributes. Retain the last
// requested value rather than materializing native DOM strings on every frame.
const attributes = new WeakMap<HTMLElement, Map<string, string>>();
export function attribute(element: HTMLElement, name: string, value: string): void {
  let saved = attributes.get(element);
  if (saved?.get(name) === value) return;
  element.setAttribute(name, value);
  if (!saved) { saved = new Map(); attributes.set(element, saved); }
  saved.set(name, value);
}
const styles = new WeakMap<HTMLElement, Map<string, string>>();
export function style(element: HTMLElement, name: string, value: string): void {
  let saved = styles.get(element);
  // Compare the input, not CSSOM's rounded serialization of projected positions.
  if (saved?.get(name) === value) return;
  element.style.setProperty(name, value);
  if (!saved) { saved = new Map(); styles.set(element, saved); }
  saved.set(name, value);
}
export function button(id: string, label: string, click: () => void): HTMLButtonElement {
  const element = node('button', id, label);
  element.type = 'button'; element.addEventListener('click', click);
  return element;
}
