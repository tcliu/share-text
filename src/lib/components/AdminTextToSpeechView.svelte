<script lang="ts">
  import Tabs from './Tabs.svelte'
  import AdminSegmentsView from './AdminSegmentsView.svelte'
  import { t } from '$lib/i18n.svelte'
  import type { useAdminSegments } from '$lib/use-admin-segments.svelte'

  interface Props {
    segmentsState: ReturnType<typeof useAdminSegments>
  }

  let { segmentsState }: Props = $props()
</script>

{#snippet segmentsContent()}
  <AdminSegmentsView {segmentsState} />
{/snippet}

<div class="flex min-h-0 flex-1 flex-col gap-4">
  <Tabs
    tabs={[
      { label: t('admin.tts.segments'), path: 'segments', content: segmentsContent },
    ]}
    state={{}}
    ariaLabel={t('admin.tts.views')} />
</div>
