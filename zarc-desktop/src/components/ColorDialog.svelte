<script lang="ts">
  import { themeColors } from '../lib/theme-colors';
  import { theme } from '../stores/theme.svelte';
  import { t } from '../lib/i18n/index.svelte';
  import Icon from './ui/Icon.svelte';

  let { open, onClose }: { open: boolean; onClose: () => void } = $props();
  let dialog = $state<HTMLDialogElement>();
  let query = $state('');
  let filtered = $derived(themeColors.filter((color) =>
    `${color.name} ${color.hex}`.toLowerCase().includes(query.trim().toLowerCase())
  ));

  $effect(() => {
    if (open) {
      query = '';
      dialog?.showModal();
    } else {
      dialog?.close();
    }
  });
</script>

<dialog
  bind:this={dialog}
  onclose={onClose}
  onkeydown={(event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }}
  aria-labelledby="color-dialog-title"
  class="m-auto max-h-[80vh] w-[min(48rem,90vw)] overflow-hidden rounded-panel border border-line bg-panel-solid p-0 text-fg shadow-[var(--shadow-lift)] backdrop:bg-black/40"
>
  <div class="flex max-h-[80vh] flex-col">
    <div class="flex shrink-0 items-center justify-between gap-4 border-b border-line px-5 py-4">
      <h2 id="color-dialog-title" class="text-sm font-bold">{t('shell.colors.title')}</h2>
      <button
        type="button"
        onclick={onClose}
        aria-label={t('shell.close')}
        class="rounded-control p-1.5 text-fg-soft hover:bg-inset hover:text-fg"
      ><Icon name="close" size={17} /></button>
    </div>
    <div class="flex shrink-0 items-center gap-3 px-5 py-4">
      <label class="control flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
        <Icon name="search" size={16} class="text-fg-faint" />
        <input
          bind:value={query}
          type="search"
          aria-label={t('shell.colors.search')}
          placeholder={t('shell.colors.search')}
          class="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>
      <button
        type="button"
        onclick={() => theme.setColor('default')}
        aria-pressed={theme.color === 'default'}
        class="control flex w-auto shrink-0 items-center gap-2 px-3 py-2 text-sm"
      >
        {#if theme.color === 'default'}<Icon name="check" size={15} />{/if}
        {t('shell.colors.default')}
      </button>
    </div>
    <div class="min-h-0 overflow-y-auto px-5 pb-5">
      <div class="grid grid-cols-2 gap-2 min-[640px]:grid-cols-4">
        {#each filtered as color (color.id)}
          <button
            type="button"
            onclick={() => theme.setColor(color.id)}
            aria-pressed={theme.color === color.id}
            aria-label={`${color.name} ${color.hex}`}
            title={`${color.name} ${color.hex}`}
            class="flex items-center gap-2.5 rounded-control border p-2.5 text-left transition-colors {theme.color === color.id ? 'border-accent-ink bg-accent-wash' : 'border-line hover:border-line-strong hover:bg-inset'}"
          >
            <span class="h-8 w-8 shrink-0 rounded-lg border border-black/10" style:background={color.hex}></span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-xs font-semibold">{color.name}</span>
              <span class="mt-0.5 block font-mono text-xs text-fg-faint">{color.hex}</span>
            </span>
            {#if theme.color === color.id}<Icon name="check" size={14} class="shrink-0 text-accent-ink" />{/if}
          </button>
        {/each}
      </div>
      {#if filtered.length === 0}<p class="py-8 text-center text-sm text-fg-soft">{t('shell.colors.noMatch')}</p>{/if}
    </div>
  </div>
</dialog>
