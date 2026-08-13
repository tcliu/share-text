<script lang="ts">
  interface Props {
    className?: string
  }

  let { className = '' }: Props = $props()
</script>

<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class={className}>
  <path d="M8.5 11.5a3.5 3.5 0 0 0 5.28.38l2.12-2.12a3.5 3.5 0 0 0-4.95-4.95l-1.2 1.2" />
  <path d="M11.5 8.5a3.5 3.5 0 0 0-5.28-.38L4.1 10.24a3.5 3.5 0 0 0 4.95 4.95l1.2-1.2" />
</svg>