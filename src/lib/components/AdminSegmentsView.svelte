<script lang="ts">
  import { t } from '$lib/i18n.svelte'
  import type { AdminSegments } from '$lib/use-admin-segments.svelte'

  interface Props {
    segmentsState: AdminSegments
  }

  let { segmentsState }: Props = $props()

  const langLabels: Record<string, string> = {
    en: 'English',
    zh: '中文',
    ja: '日本語',
  }
</script>

<div class="flex h-full min-h-0 flex-col gap-3 md:flex-row">
  <section
    aria-labelledby="admin-segments-input"
    class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50 transition focus-within:border-cyan-500 md:w-1/2">
    <header class="flex flex-none items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
      <h2 id="admin-segments-input" class="text-sm font-medium text-slate-200">{t('admin.segments.input')}</h2>
      <span class="text-xs tabular-nums text-slate-400">
        {t('admin.segments.summary', {
          chars: segmentsState.input.length,
          segments: segmentsState.segments.length,
          max: segmentsState.maxSegmentLength,
        })}
      </span>
    </header>
    <textarea
      bind:value={segmentsState.input}
      spellcheck="false"
      aria-labelledby="admin-segments-input"
      placeholder={t('admin.segments.inputPlaceholder')}
      class="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500"></textarea>
  </section>

  <section
    aria-labelledby="admin-segments-output"
    class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50 md:w-1/2">
    <header class="flex flex-none items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
      <h2 id="admin-segments-output" class="text-sm font-medium text-slate-200">{t('admin.segments.output')}</h2>
      <span class="text-xs tabular-nums text-slate-400">
        {t('admin.segments.segmentCount', { n: segmentsState.segments.length })}
      </span>
    </header>
    {#if segmentsState.segments.length === 0}
      <p class="p-4 text-sm text-slate-400">{t('admin.segments.empty')}</p>
    {:else}
      <div class="min-h-0 flex-1 overflow-y-auto">
        <table class="w-full border-collapse text-sm">
          <thead class="sticky top-0 z-10 bg-slate-950">
            <tr class="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-400">
              <th class="px-3 py-2 font-medium">#</th>
              <th class="px-3 py-2 font-medium">{t('admin.segments.lang')}</th>
              <th class="px-3 py-2 font-medium">{t('admin.segments.range')}</th>
              <th class="px-3 py-2 font-medium">{t('admin.segments.text')}</th>
            </tr>
          </thead>
          <tbody>
            {#each segmentsState.segments as segment, i}
              <tr class="border-b border-slate-800/60 align-top">
                <td class="px-3 py-2 tabular-nums text-slate-400">{i}</td>
                <td class="px-3 py-2">
                  <span
                    class="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs font-medium text-slate-300">
                    {langLabels[segment.lang] ?? segment.lang}
                  </span>
                </td>
                <td class="px-3 py-2 whitespace-nowrap tabular-nums text-slate-400">
                  {segment.indexStart ?? '–'}–{segment.indexEnd ?? '–'}
                </td>
                <td class="px-3 py-2 whitespace-pre-wrap break-words text-slate-200">{segment.text}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</div>
