<script lang="ts">
  interface Props {
    className?: string
  }

  let { className = '' }: Props = $props()
</script>

<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class={className}>
  <path d="M9 15 3.75 9.75 9 4.5" />
  <path d="M3.75 9.75H13.5a3.75 3.75 0 0 1 0 7.5H12" />
</svg>