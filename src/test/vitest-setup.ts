import { vi } from 'vitest'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub)

vi.stubGlobal('matchMedia', (query: string) => ({
  matches: query === '(hover: hover)',
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
}))

// jsdom lacks the Web Animations API that Svelte 5 transitions drive.
// Resolve every test animation immediately so intro/outro lifecycles complete.
if (typeof Element !== 'undefined' && typeof Element.prototype.animate !== 'function') {
  Element.prototype.animate = function (this: Element) {
    const animation = {
      currentTime: 0,
      playState: 'finished',
      onfinish: null as (() => void) | null,
      cancel: () => {},
      finish: () => {},
    }
    queueMicrotask(() => animation.onfinish?.())
    return animation as unknown as Animation
  } as typeof Element.prototype.animate
}