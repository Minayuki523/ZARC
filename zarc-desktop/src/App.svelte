<script lang="ts">
  import { onMount } from 'svelte';
  import { theme } from './stores/theme.svelte';
  import { colorTokens } from './lib/color-tokens';
  import { app } from './stores/app.svelte';
  import { initProgressListener } from './lib/progress';
  import { initDragDrop } from './lib/dragdrop.svelte';
  import { t } from './lib/i18n/index.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import TitleBar from './components/TitleBar.svelte';
  import TopBar from './components/TopBar.svelte';
  import TaskHub from './components/TaskHub.svelte';
  import TaskStrip from './components/TaskStrip.svelte';
  import MasterDropZone from './components/MasterDropZone.svelte';
  import ToastHost from './components/ToastHost.svelte';
  import CompressView from './components/CompressView.svelte';
  import DecompressView from './components/DecompressView.svelte';
  import BenchmarkView from './components/BenchmarkView.svelte';

  let isSfx = $derived(app.isSfx);
  let view = $derived(isSfx ? 'decompress' : app.currentView);
  let visited = $state({ compress: false, decompress: false, benchmark: false });
  $effect(() => { visited[view] = true; });

  $effect(() => {
    document.documentElement.setAttribute('data-theme', theme.current);
    const color = theme.selectedColor;
    if (!color) return;
    const root = document.documentElement;
    const tokens = colorTokens(color.hex, theme.current);
    root.setAttribute('data-color', color.id);
    for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
    return () => {
      root.removeAttribute('data-color');
      for (const name of Object.keys(tokens)) root.style.removeProperty(name);
    };
  });

  onMount(() => {
    const cleanups: (() => void)[] = [theme.init()];
    let disposed = false;

    /**
     * 异步注册的监听器必须处理「注册完成前组件已卸载」的情况，
     * 已注册的立即注销，未完成的在注册后直接注销。
     * Asynchronously registered listeners must handle "the component unmounts
     * before registration completes": registered ones run now, pending ones
     * run immediately after registration.
     */
    function track(fn: () => void): void {
      if (disposed) fn();
      else cleanups.push(fn);
    }

    void initProgressListener().then(track);
    void initDragDrop().then(track);
    void app.initSfx();

    return () => {
      disposed = true;
      for (const fn of cleanups.splice(0)) fn();
    };
  });
</script>

<div class="relative h-full w-full overflow-hidden bg-canvas">
  <div class="ambient" aria-hidden="true"></div>

  <div class="relative z-10 flex h-full flex-col">
    <TitleBar />

    <div class="flex min-h-0 flex-1">
      {#if !isSfx}
        <Sidebar />
      {/if}

      <main class="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        <TopBar />

        {#if !isSfx}
          <div class="mx-auto w-full max-w-3xl min-[1180px]:hidden">
            <TaskStrip />
          </div>
        {/if}

        <div class="mx-auto w-full max-w-3xl flex-1 pb-6">
          {#if app.sfxError}
            <div class="panel flex flex-col gap-4 rounded-panel p-6" role="alert">
              <h2 class="text-lg font-bold text-danger">{t('audit.sfxError')}</h2>
              <p class="break-words text-sm text-fg-soft" data-selectable>{app.sfxError}</p>
              <button class="control" onclick={() => app.initSfx()}>{t('audit.retry')}</button>
            </div>
          {:else}
            {#if !isSfx && visited.compress}<div hidden={view !== 'compress'}><CompressView /></div>{/if}
            {#if visited.decompress}<div hidden={view !== 'decompress'}><DecompressView /></div>{/if}
            {#if !isSfx && visited.benchmark}<div hidden={view !== 'benchmark'}><BenchmarkView /></div>{/if}
          {/if}
        </div>
      </main>

      {#if !isSfx}
        <TaskHub />
      {/if}
    </div>
  </div>

  <MasterDropZone />
  <ToastHost />
</div>
