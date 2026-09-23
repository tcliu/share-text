<script lang="ts">
  import ThemeMenu from '../ThemeMenu.svelte'
  import { createAppI18n, setI18nContext } from '$lib/i18n.svelte'

  setI18nContext(createAppI18n())
</script>

<ThemeMenu />
