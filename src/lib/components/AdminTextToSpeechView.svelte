<script lang="ts">
  import Tabs from './Tabs.svelte'
  import AdminSegmentsView from './AdminSegmentsView.svelte'
  import AdminTtsVoicesView from './AdminTtsVoicesView.svelte'
  import { t } from '$lib/i18n.svelte'
  import type { useAdminSegments } from '$lib/use-admin-segments.svelte'
  import type { useAdminTtsVoices } from '$lib/use-admin-tts-voices.svelte'

  interface Props {
    segmentsState: ReturnType<typeof useAdminSegments>
    voicesState: ReturnType<typeof useAdminTtsVoices>
  }

  let { segmentsState, voicesState }: Props = $props()
</script>

{#snippet voicesContent()}
  <AdminTtsVoicesView {voicesState} />
{/snippet}

{#snippet segmentsContent()}
  <AdminSegmentsView {segmentsState} />
{/snippet}

<div class="flex min-h-0 flex-1 flex-col gap-4">
  <Tabs
    tabs={[
      { label: t('admin.tts.voices'), path: 'voices', content: voicesContent },
      { label: t('admin.tts.segments'), path: 'segments', content: segmentsContent },
    ]}
    state={{}}
    ariaLabel={t('admin.tts.views')} />
</div>
