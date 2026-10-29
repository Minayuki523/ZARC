<script lang="ts">
  import { app } from '../stores/app.svelte';
  import { task } from '../stores/task.svelte';
  import { toasts } from '../stores/toast.svelte';
  import { api, pickPath, pickPaths, type OperationReport, type OutputKind } from '../lib/api';
  import { emptyToNull, formatBytes, formatCount, pathBaseName } from '../lib/format';
  import { t } from '../lib/i18n/index.svelte';
  import OutputPreview from './OutputPreview.svelte';
  import Card from './ui/Card.svelte';
  import Button from './ui/Button.svelte';
  import Field from './ui/Field.svelte';
  import PathInput from './ui/PathInput.svelte';
  import PasswordInput from './ui/PasswordInput.svelte';
  import Segmented, { type SegmentOption } from './ui/Segmented.svelte';
  import Slider from './ui/Slider.svelte';
  import NumberInput from './ui/NumberInput.svelte';
  import Toggle from './ui/Toggle.svelte';
  import Tag from './ui/Tag.svelte';
  import Icon from './ui/Icon.svelte';
  import ResultCard from './ResultCard.svelte';

  let output = $state('');
  let archiveName = $state('');
  let outputKind = $state<OutputKind>('archive');
  let splitSize = $state(0);
  /** 0 表示由后端按核心数决定。 / 0 lets the backend decide based on the core count. */
  let threads = $state(0);
  let includeRootDir = $state(false);
  let encrypt = $state(false);
  let password = $state('');
  let enableLogging = $state(false);
  let deleteSourceAfter = $state(false);
  let advanced = $state(false);
  let report = $state<OperationReport | null>(null);
  let touched = $state(false);

  // 应用 store 持有数据源的唯一副本，文件对话框与拖拽均写回同一处。
  // The app store holds the only copy of the data source; file dialogs and
  // drag-and-drop both write back to it.
  let source = $derived(app.compressSource);
  let sources = $derived(app.compressSources);
  let multiple = $derived(sources.length > 1);
  let sourceInfo = $derived(new Map(app.compressItems.map((item) => [item.path, item])));
  let kind = $derived(app.compressKind);
  let info = $derived(app.compressInfo);
  // 压缩等级也存于 store，基准视图的「使用推荐等级」可直接落到这里。
  // The level also lives in the store so the benchmark view's "Use recommended
  // level" can land here directly.
  let level = $derived(app.compressLevel);

  let isSfx = $derived(outputKind === 'sfxExe');
  let busy = $derived(task.busy);
  let running = $derived(task.activeKind === 'compress');

  let sourceError = $derived(
    !touched ? undefined : !source ? t('compress.error.noSource') : undefined
  );
  let passwordError = $derived(
    touched && encrypt && !emptyToNull(password) ? t('compress.error.passwordRequired') : undefined
  );

  let outputOptions: SegmentOption<OutputKind>[] = $derived([
    {
      value: 'archive',
      label: t('compress.output.archive.label'),
      icon: 'archive',
      hint: t('compress.output.archive.hint')
    },
    {
      value: 'sfxExe',
      label: t('compress.output.sfx.label'),
      icon: 'app',
      hint: t('compress.output.sfx.hint')
    }
  ].filter((option) => app.supportsSfx || option.value !== 'sfxExe') as SegmentOption<OutputKind>[]);

  let levelMarks = $derived([
    { at: 1, label: t('compress.level.fastest') },
    { at: 8, label: t('compress.level.balanced') },
    { at: 15, label: t('compress.level.high') },
    { at: 22, label: t('compress.level.ultra') }
  ]);

  let levelHint = $derived(
    level <= 4
      ? t('compress.levelHint.low')
      : level <= 12
        ? t('compress.levelHint.mid')
        : level <= 21
          ? t('compress.levelHint.high')
          : t('compress.levelHint.extreme')
  );

  // 自解压归档必须是单文件，此处分卷无意义。 / A self-extracting archive must be a single file, so splitting makes no sense here.
  $effect(() => {
    if (isSfx) splitSize = 0;
  });

  async function pickFile(): Promise<void> {
    const selected = await pickPaths({ title: t('compress.dialog.pickFile') });
    if (selected.length) void app.setCompressSources([...sources, ...selected]);
  }

  async function pickDirectory(): Promise<void> {
    const selected = await pickPaths({ title: t('compress.dialog.pickFolder'), directory: true });
    if (selected.length) void app.setCompressSources([...sources, ...selected], 'folder');
  }

  async function pickOutput(): Promise<void> {
    const selected = await pickPath({ title: t('compress.dialog.pickOutputFolder'), directory: true });
    if (selected) output = selected;
  }

  function removeSource(path: string): void {
    void app.setCompressSources(sources.filter((source) => source !== path));
  }

  async function submit(): Promise<void> {
    touched = true;
    if (!source) {
      app.setStatus(t('compress.error.sourceRequired'), 'error');
      toasts.warn(t('toast.noSource'), t('compress.hint.noSource'));
      return;
    }
    const pw = encrypt ? emptyToNull(password) : null;
    if (encrypt && !pw) {
      app.setStatus(t('compress.error.passwordRequired'), 'error');
      toasts.warn(t('compress.toast.missingPassword'), t('compress.hint.missingPassword'));
      return;
    }

    const ok = await task.run('compress', t('compress.running', { name: multiple ? t('compress.selectionCount', { count: sources.length }) : pathBaseName(source) }), async () => {
      report = await api.compress({
        sourcePath: source,
        sourcePaths: sources,
        archiveName: emptyToNull(archiveName),
        outputDirectory: emptyToNull(output),
        outputPath: null,
        outputKind,
        level,
        includeRootDir,
        password: pw,
        splitSizeMib: isSfx || splitSize <= 0 ? null : splitSize,
        enableLogging,
        deleteSourceAfter,
        threads: threads > 0 ? threads : null
      });
      password = '';
      app.setStatus(t('compress.status.done', { path: report.outputPath }), 'success');
    });

    if (ok && report) {
      toasts.success(
        t('toast.compressionComplete'),
        report.sidecarPath
          ? t('compress.hint.sidecar')
          : pathBaseName(report.outputPath)
      );
    }
  }
</script>

<div class="flex flex-col gap-4">
  <Card title={t('compress.sourceCard.title')} icon="folder">
    {#snippet actions()}
      <Tag tone={source ? 'accent' : 'neutral'}>{multiple ? t('compress.selectionCount', { count: sources.length }) : source ? t(kind === 'folder' ? 'kind.folder' : 'kind.file') : t('notSelected')}</Tag>
    {/snippet}

    <div class="flex flex-col gap-4">
      <Field label={t('compress.sourcePath')} error={sourceError}>
        {#snippet aside()}
          {#if app.compressInfoLoading}
            {t('compress.measuring')}
          {:else if info?.exists}
            {formatBytes(info.sizeBytes)}{info.isDir
              ? ` ${t('compress.fileCount', { count: formatCount(info.fileCount) })}`
              : ''}{info.truncated ? t('compress.countTruncated') : ''}
          {:else if source}
            {t('compress.pathMissing')}
          {/if}
        {/snippet}
        {#if multiple}
          <div class="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon="file" onclick={pickFile}>{t('compress.addFiles')}</Button>
            <Button variant="ghost" size="sm" icon="folder" onclick={pickDirectory}>{t('compress.addFolders')}</Button>
            <Button variant="subtle" size="sm" icon="close" aria-label={t('compress.clearSourcesLabel')} onclick={() => app.setCompressSources([])}>{t('compress.clearSources')}</Button>
          </div>
          <ul class="mt-3 flex max-h-52 flex-col divide-y divide-line overflow-y-auto rounded-control border border-line bg-inset">
            {#each sources as path (path)}
              <li class="flex items-center gap-3 px-3 py-2 [content-visibility:auto] [contain-intrinsic-size:3.5rem]">
                <Icon name={sourceInfo.get(path)?.isDir ? 'folder' : 'file'} size={17} class="shrink-0 text-fg-faint" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium text-fg">{pathBaseName(path)}</span>
                  <span class="block truncate text-xs text-fg-faint" title={path}>{path}</span>
                </span>
                <Button variant="subtle" size="sm" icon="close" aria-label={t('compress.removeSource', { name: pathBaseName(path) })} onclick={() => removeSource(path)}>{t('compress.remove')}</Button>
              </li>
            {/each}
          </ul>
        {:else}
        <PathInput
          value={source}
          onCommit={(next) => app.setCompressSource(next, kind)}
          icon={kind === 'folder' ? 'folder' : 'file'}
          invalid={Boolean(sourceError)}
          placeholder={t('compress.sourcePlaceholder')}
        >
          {#snippet actions()}
            <Button variant="ghost" size="sm" icon="file" onclick={pickFile}>{t('compress.addFiles')}</Button>
            <Button variant="ghost" size="sm" icon="folder" onclick={pickDirectory}>{t('compress.addFolders')}</Button>
          {/snippet}
        </PathInput>
        {/if}
      </Field>

      <Field label={t('compress.archiveName')} hint={t('compress.archiveNameHint')}>
        <PathInput bind:value={archiveName} icon="archive" placeholder={t('compress.archiveNamePlaceholder')} />
      </Field>
      <Field
        label={t('compress.outputDirectory')}
        hint={t('compress.outputHint')}
      >
        <PathInput bind:value={output} icon="folder" placeholder={t('compress.outputPlaceholder')}>
          {#snippet actions()}
            <Button variant="ghost" size="sm" icon="folder" onclick={pickOutput}>{t('browse')}</Button>
          {/snippet}
        </PathInput>
      </Field>
    </div>
  </Card>

  <OutputPreview {source} output="" sourcePaths={sources} {archiveName} outputDirectory={output} encrypted={encrypt} {outputKind} splitSizeMib={splitSize} />

  <Card title={t('compress.settingsCard.title')} icon="sliders">
    <div class="flex flex-col gap-5">
      <Field label={t('compress.outputType')} hint={isSfx
        ? t('compress.outputTypeHint.sfx')
        : t('compress.outputTypeHint.archive')}>
        <Segmented bind:value={outputKind} options={outputOptions} ariaLabel={t('compress.outputType')} />
      </Field>

      <Field label={t('compress.level')} hint={levelHint}>
        {#snippet aside()}
          <span class="text-sm font-bold text-accent-ink tabular-nums">{level}</span>
        {/snippet}
        <Slider
          bind:value={app.compressLevel}
          min={1}
          max={22}
          marks={levelMarks}
          ariaLabel={t('compress.level')}
        />
      </Field>

      <div class="grid grid-cols-2 gap-2 rounded-[0.875rem] bg-inset p-1.5">
        <Toggle
          bind:checked={includeRootDir}
          label={t('compress.includeRootDir')}
          description={t('compress.includeRootDirDesc')}
          icon="layers"
          disabled={multiple || kind === 'file'}
        />
        <Toggle
          bind:checked={encrypt}
          label={t('compress.encrypt')}
          description="Argon2id + XChaCha20-Poly1305"
          icon="shield"
        />
      </div>

      {#if encrypt}
        <Field label={t('compress.password')} error={passwordError}>
          <PasswordInput
            bind:value={password}
            showStrength
            placeholder={t('compress.passwordPlaceholder')}
          />
        </Field>
      {/if}

      <div class="border-t border-line pt-1">
        <button
          type="button"
          onclick={() => (advanced = !advanced)}
          aria-expanded={advanced}
          class="flex w-full items-center gap-2 rounded-control px-1 py-2 text-xs font-semibold text-fg-soft transition-colors hover:text-fg"
        >
          <span class="transition-transform duration-150 {advanced ? 'rotate-90' : ''}">
            <Icon name="chevronRight" size={14} />
          </span>
          {t('compress.advanced')}
        </button>

        {#if advanced}
          <div class="flex flex-col gap-4 pt-3">
            <div class="grid grid-cols-2 gap-4">
              <Field
                label={t('compress.splitSize')}
                hint={isSfx ? t('compress.splitHint.sfx') : t('compress.splitHint.off')}
              >
                <NumberInput bind:value={splitSize} suffix="MiB" min={0} disabled={isSfx} />
              </Field>
              <Field label={t('compress.threads')} hint={t('compress.threadsHint')}>
                <NumberInput bind:value={threads} suffix={t('compress.threadsSuffix')} min={0} max={256} />
              </Field>
            </div>

            <div class="grid grid-cols-2 gap-2 rounded-[0.875rem] bg-inset p-1.5">
              <Toggle
                bind:checked={enableLogging}
                label={t('compress.writeLog')}
                description={t('compress.writeLogDesc')}
                icon="text"
              />
              <Toggle
                bind:checked={deleteSourceAfter}
                label={t('compress.deleteSource')}
                description={t('compress.deleteSourceDesc')}
                icon="trash"
                danger
              />
            </div>
          </div>
        {/if}
      </div>

      <div class="flex items-center gap-3 border-t border-line pt-4">
        <Button icon="play" loading={running} disabled={busy && !running} onclick={submit}>
          {t('compress.submit')}
        </Button>
        {#if running}
          <Button variant="danger" icon="stop" disabled={task.aborting} onclick={() => task.requestAbort()}>
            {task.aborting ? t('task.stopping') : t('task.stop')}
          </Button>
        {/if}
        <span class="ml-auto text-xs text-fg-faint">Ctrl + Enter</span>
      </div>
    </div>
  </Card>

  {#if report}
    <ResultCard title={t('toast.compressionComplete')} {report} onDismiss={() => (report = null)} />
  {/if}
</div>
