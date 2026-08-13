<script lang="ts">
  interface Props {
    className?: string
  }

  let { className = '' }: Props = $props()
</script>

<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class={className}>
  <rect x="3" y="3" width="14" height="14" rx="1" />
  <path d="M3 13h14" />
  <path d="M10 13v4" />
</svg>