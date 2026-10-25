import type { EmbeddedArchiveInfo, PathInfo, ViewId } from '../lib/api';
import { api } from '../lib/api';
import type { PathKind } from '../lib/format';
import { t } from '../lib/i18n/index.svelte';

type StatusLevel = 'idle' | 'busy' | 'success' | 'error';

interface AppStatus {
  message: string;
  level: StatusLevel;
}

class AppStore {
  sfxError = $state<string | null>(null);
  supportsSfx = /Windows/i.test(navigator.userAgent);
  currentView = $state<ViewId>('compress');
  sfxInfo = $state<EmbeddedArchiveInfo | null>(null);
  status = $state<AppStatus>({ message: t('status.ready'), level: 'idle' });

  // 跨视图共享的数据源；这是唯一的真源，视图不再各自保留副本。
  // Data sources shared across views; this is the single source of truth, and
  // views no longer keep their own copies.
  compressSources = $state<string[]>([]);
  compressItems = $state<PathInfo[]>([]);
  get compressSource(): string { return this.compressSources[0] ?? ''; }
  compressKind = $state<PathKind>('file');
  decompressSource = $state('');
  benchmarkSource = $state('');
  benchmarkKind = $state<PathKind>('file');

  /** 压缩源的实测大小，提交前展示以管理预期。 / Measured size of the compression source, shown before submitting to set expectations. */
  compressInfo = $state<PathInfo | null>(null);
  compressInfoLoading = $state(false);

  /** 压缩等级存在 store 中，使基准视图可以一键把推荐值写到此处。 / The compression level lives in the store so the benchmark view can write its recommendation here in one click. */
  compressLevel = $state(3);

  /** 递增序号，用于丢弃过期的检查结果，使旧结果在源快速变化时不会覆盖新结果。 / Incrementing sequence number for discarding stale inspect results, so older ones never overwrite newer ones while the source changes rapidly. */
  #inspectSeq = 0;

  get isSfx(): boolean {
    return this.sfxInfo !== null || this.sfxError !== null;
  }

  setView(view: ViewId): void {
    this.currentView = view;
  }

  setStatus(message: string, level: StatusLevel): void {
    this.status = { message, level };
  }

  setCompressSource(path: string, kind: PathKind): Promise<PathInfo | null> {
    return this.setCompressSources(path ? [path] : [], kind);
  }

  async setCompressSources(paths: string[], kind: PathKind = 'file'): Promise<PathInfo | null> {
    const seq = ++this.#inspectSeq;
    this.compressSources = [...new Set(paths.map((path) => path.trim()).filter(Boolean))];
    this.compressKind = this.compressSources.length > 1 ? 'folder' : kind;
    this.compressInfo = null;
    this.compressItems = [];
    this.compressInfoLoading = this.compressSources.length > 0;
    if (!this.compressSources.length) {
      void api.inspectPath('').catch(() => {});
      return null;
    }
    try {
      const items: PathInfo[] = [];
      const started = performance.now();
      for (const path of this.compressSources) {
        const info = await api.inspectPath(path);
        if (seq !== this.#inspectSeq) return null;
        items.push(info);
        if (performance.now() - started > 2000) break;
      }
      const first = items[0];
      const multiple = this.compressSources.length > 1;
      this.compressItems = items;
      this.compressKind = multiple || first.isDir ? 'folder' : 'file';
      this.compressInfo = {
        path: first.path,
        exists: items.every((item) => item.exists),
        isDir: multiple || first.isDir,
        sizeBytes: items.reduce((sum, item) => sum + item.sizeBytes, 0),
        fileCount: items.reduce((sum, item) => sum + item.fileCount, 0),
        truncated: items.length < this.compressSources.length || items.some((item) => item.truncated)
      };
      return this.compressInfo;
    } catch {
      return null;
    } finally {
      if (seq === this.#inspectSeq) this.compressInfoLoading = false;
    }
  }

  setDecompressSource(path: string): void {
    this.decompressSource = path;
  }

  setBenchmarkSource(path: string, kind: PathKind): void {
    this.benchmarkSource = path;
    this.benchmarkKind = kind;
  }

  /** 应用基准推荐的等级并跳回压缩视图。 / Apply the level recommended by the benchmark and jump back to the Compress view. */
  applyRecommendedLevel(level: number): void {
    this.compressLevel = level;
    this.setView('compress');
    this.setStatus(t('status.recommendApplied', { level }), 'success');
  }

  async initSfx(): Promise<void> {
    try {
      const info = await api.getEmbeddedInfo();
      this.sfxError = null;
      if (!info) return;
      this.sfxInfo = info;
      this.decompressSource = info.hostPath;
      this.setView('decompress');
      this.setStatus(t('status.sfxMode'), 'success');
    } catch (error) {
      this.sfxError = String(error);
      this.setStatus(t('audit.sfxError'), 'error');
    }
  }
}

export const app = new AppStore();
