<script lang="ts">
  interface Props {
    className?: string
  }

  let { className = '' }: Props = $props()
</script>

<svg viewBox="0 0 280 280" aria-hidden="true" class={className}>
  <path d="M84 120 V80 a56 56 0 0 1 112 0 V120" fill="none" stroke="currentColor" stroke-width="24" />
  <rect
    x="42"
    y="110"
    width="196"
    height="148"
    rx="30"
    fill="none"
    stroke="currentColor"
    stroke-width="24"
    stroke-linejoin="round" />
  <circle cx="140" cy="167" r="21" fill="currentColor" />
  <path d="M140 170 v40" stroke="currentColor" stroke-width="17" stroke-linecap="round" />
</svg>