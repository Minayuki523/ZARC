import { themeColors } from '../lib/theme-colors';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'theme';
const COLOR_STORAGE_KEY = 'theme-color';

class ThemeStore {
  current = $state<ThemeMode>('dark');
  color = $state('default');

  get selectedColor() {
    return themeColors.find((color) => color.id === this.color);
  }
  /** 跟随系统直至用户手动选择主题；此后固定。外部只读 current 即可。
   *  Follows the system until the user picks a theme manually; from then on it sticks. */
  #followSystem = $state(true);

  #media: MediaQueryList | null = null;
  #onSystemChange = (event: MediaQueryListEvent): void => {
    if (!this.#followSystem) return;
    this.current = event.matches ? 'light' : 'dark';
  };

  init(): () => void {
    const storedColor = localStorage.getItem(COLOR_STORAGE_KEY);
    if (themeColors.some((color) => color.id === storedColor)) this.color = storedColor!;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      this.current = stored;
      this.#followSystem = false;
    } else if (typeof matchMedia !== 'undefined') {
      this.current = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    if (typeof matchMedia !== 'undefined') {
      this.#media = matchMedia('(prefers-color-scheme: light)');
      this.#media.addEventListener('change', this.#onSystemChange);
    }

    return () => this.#media?.removeEventListener('change', this.#onSystemChange);
  }

  toggle(): void {
    this.set(this.current === 'dark' ? 'light' : 'dark');
  }

  set(mode: ThemeMode): void {
    this.current = mode;
    this.#followSystem = false;
    localStorage.setItem(STORAGE_KEY, mode);
  }

  setColor(id: string): void {
    this.color = id;
    localStorage.setItem(COLOR_STORAGE_KEY, id);
  }
}

export const theme = new ThemeStore();
