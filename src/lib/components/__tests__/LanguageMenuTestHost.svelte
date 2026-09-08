<script lang="ts">
  import LanguageMenu from '../LanguageMenu.svelte'
  import { createShareTextI18n, setI18nContext, type ShareTextI18n } from '$lib/i18n.svelte'

  interface Props {
    onReady: (i18n: ShareTextI18n) => void
  }

  let { onReady }: Props = $props()

  const i18n = setI18nContext(createShareTextI18n())

  let once = false
  $effect(() => {
    if (once) return
    once = true
    onReady(i18n)
  })
</script>

<LanguageMenu />
