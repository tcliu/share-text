<script lang="ts">
  interface Props {
    className?: string
  }

  let { className = '' }: Props = $props()
</script>

<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class={className}>
  <circle cx="10" cy="10" r="7.5" />
  <path d="M7.75 7.75a2.5 2.5 0 1 1 3.3 2.2c-.72.3-1.3 1-1.3 1.9V12" />
  <path d="M10 14.6h.01" />
</svg>
