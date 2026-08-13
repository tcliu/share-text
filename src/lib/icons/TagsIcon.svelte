<script lang="ts">
  interface Props {
    className?: string
  }

  let { className = '' }: Props = $props()
</script>

<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class={className}>
  <path d="M10.6 3H6a2 2 0 0 0-2 2v4.6a2 2 0 0 0 .59 1.41l4.4 4.4a2 2 0 0 0 2.83 0l3.58-3.58a2 2 0 0 0 0-2.83L11.99 3.6A2 2 0 0 0 10.6 3Z" />
  <circle cx="7.25" cy="7.25" r="1.25" />
</svg>