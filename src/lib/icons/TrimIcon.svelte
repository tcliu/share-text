<script lang="ts">
  interface Props {
    className?: string
  }

  let { className = '' }: Props = $props()
</script>

<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class={className}>
  <rect x="3" y="3" width="14" height="14" rx="1" />
  <path d="M3 8h14M8 3v14" />
  <path d="M9 10h4" />
  <path d="M12 8l2 2-2 2" />
</svg>