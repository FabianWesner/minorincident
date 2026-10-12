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
export function attribute(element: HTMLElement, name: string, value: string): void {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}
const styles = new WeakMap<HTMLElement, Map<string, { input: string; serialized: string }>>();
export function style(element: HTMLElement, name: string, value: string): void {
  let saved = styles.get(element);
  const previous = saved?.get(name), actual = element.style.getPropertyValue(name);
  // CSSOM rounds fractional positions. Compare its canonical value as well as
  // our input, so an unchanged projection does not invalidate layout every frame.
  if (previous?.input === value && previous.serialized === actual) return;
  if (actual !== value) element.style.setProperty(name, value);
  const serialized = element.style.getPropertyValue(name);
  if (previous) { previous.input = value; previous.serialized = serialized; return; }
  if (!saved) { saved = new Map(); styles.set(element, saved); }
  saved.set(name, { input: value, serialized });
}
export function button(id: string, label: string, click: () => void): HTMLButtonElement {
  const element = node('button', id, label);
  element.type = 'button'; element.addEventListener('click', click);
  return element;
}
