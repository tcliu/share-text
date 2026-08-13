<script lang="ts">
  interface Props {
    className?: string
  }

  let { className = '' }: Props = $props()
</script>

<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class={className}>
  <path d="M4 6h12" />
  <path d="M8 6V4h4v2" />
  <path d="M6 6l.7 10h6.6L14 6" />
  <path d="M9 9v4M11 9v4" />
</svg>