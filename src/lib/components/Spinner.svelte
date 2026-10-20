<script lang="ts">
  import { resolveSize } from './size-metrics'
  import type { SizeInput } from '$lib/size-scale'

  interface Props {
    className?: string
    size?: SizeInput
  }

  // The spinner is a sized svg primitive on the shared `SIZE_PX` axis: its
  // `size` names alias that axis like every other component (`xs`12 … `xl`20),
  // so a spinner and an icon at the same step mean the same dimension. The glyph
  // is a thin ring, so it reads smaller than a stroke icon at the same box; a
  // fixed ratio scales the dimension once, the same `metric = ratio × dimension`
  // rule every sized component follows. Numbers are positions on that axis and
  // scale by the same ratio, so `size="md"` and `size={16}` render identically.
  // Attributes (not classes) so `size` composes with `className`: a tint-only
  // className does not drop the sizing, and an explicit size class in className
  // still wins (CSS beats attributes).
  const SPINNER_RATIO = 1.5

  function resolveSpinnerPx(size: SizeInput): number {
    return resolveSize(size) * SPINNER_RATIO
  }

  let { className = '', size = 'md' }: Props = $props()
</script>

<svg
  class={`${className} animate-spin motion-reduce:animate-none`}
  viewBox="0 0 20 20"
  fill="currentColor"
  aria-hidden="true"
  width={resolveSpinnerPx(size)}
  height={resolveSpinnerPx(size)}>
  <path
    fill-rule="evenodd"
    d="M10 3.5a6.5 6.5 0 1 0 6.112 8.707.75.75 0 1 1 1.409.517A8 8 0 1 1 10 2a.75.75 0 0 1 0 1.5Z"
    clip-rule="evenodd" />
</svg>
