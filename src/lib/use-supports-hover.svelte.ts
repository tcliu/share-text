// Reactive `(hover: hover)` capability signal. `true` when the primary pointer
// can hover (mouse, trackpad, stylus); `false` on touch-only devices. Use it to
// gate hover-dependent affordances (e.g. replacing inline copy/edit icons with
// plain values on touch). When `window` is unavailable (SSR) it reports the
// touch-safe default of `false`; the authenticated admin shell renders after
// mount, so the client value is already correct on the first paint of the
// table.
export function useSupportsHover() {
  const supportsHover = $derived(
    typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover)').matches,
  )
  return supportsHover
}
