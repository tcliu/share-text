<script lang="ts">
  interface Props {
    className?: string
  }

  let { className = '' }: Props = $props()
</script>

<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class={className}>
  <path d="M5 3h2l1-1l2-1h2l2 1 1 1h2" />
  <path d="M6 5l1 12h6l1-12" />
  <path d="M9 8v6M11 8v6" />
</svg>