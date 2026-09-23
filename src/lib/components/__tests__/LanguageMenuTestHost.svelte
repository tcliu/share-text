<script lang="ts">
  import LanguageMenu from '../LanguageMenu.svelte'
  import { createAppI18n, setI18nContext, type I18nStore } from '$lib/i18n.svelte'

  interface Props {
    onReady: (i18n: I18nStore) => void
  }

  let { onReady }: Props = $props()

  const i18n = setI18nContext(createAppI18n())

  let once = false
  $effect(() => {
    if (once) return
    once = true
    onReady(i18n)
  })
</script>

<LanguageMenu />
