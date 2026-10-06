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
export function button(id: string, label: string, click: () => void): HTMLButtonElement {
  const element = node('button', id, label);
  element.type = 'button'; element.addEventListener('click', click);
  return element;
}
