<script lang="ts">
  interface Props {
    className?: string
  }

  let { className = '' }: Props = $props()
</script>

<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" class={className}>
  <path d="M4 2l4 4-4 4z" />
</svg>