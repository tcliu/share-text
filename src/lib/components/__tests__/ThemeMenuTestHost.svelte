<script lang="ts">
  import ThemeMenu from '../ThemeMenu.svelte'
  import { createShareTextI18n, setI18nContext } from '$lib/i18n.svelte'

  setI18nContext(createShareTextI18n())
</script>

<ThemeMenu />
