import { clampChroma, formatHex, formatRgb, modeLrgb, modeOklch, modeRgb, useMode, wcagContrast } from 'culori/fn';

useMode(modeLrgb);
const toRgb = useMode(modeRgb);
const toOklch = useMode(modeOklch);

/** 按角色生成配色：按钮保留原色，文字与表面使用同色相的明度变体。
 * Generate role-based colors: preserve the button seed and vary lightness for text and surfaces. */
export function colorTokens(hex: string, mode: 'dark' | 'light'): Record<string, string> {
  const dark = mode === 'dark';
  const seed = toOklch(hex)!;
  const neutral = seed.c < 0.015;
  const tone = (lightness: number, chroma = seed.c): string => formatHex(clampChroma({
    mode: 'oklch', l: Math.max(0, Math.min(1, lightness)), c: chroma, h: seed.h
  }, 'oklch'))!;
  const alpha = (color: string, opacity: number): string => formatRgb({ ...toRgb(color)!, alpha: opacity });

  const surfaceChroma = neutral ? seed.c * 0.35 : Math.min(seed.c * 0.5, 0.045);
  const canvas = tone(dark ? 0.17 : neutral ? 0.988 : 0.965, surfaceChroma);
  const panel = tone(dark ? 0.235 : 0.995, surfaceChroma * 0.45);
  const raised = tone(dark ? 0.275 : 1, surfaceChroma * 0.25);
  const wash = tone(dark ? 0.29 : 0.935, surfaceChroma);
  const inkSurface = dark ? '#383b48' : '#d4d7dd';
  let ink = hex;
  for (let step = 1; wcagContrast(ink, inkSurface) < 4.5 && step <= 100; step++) {
    ink = tone(seed.l + (dark ? step : -step) / 100);
  }

  const foreground = wcagContrast(hex, '#000000') >= wcagContrast(hex, '#ffffff') ? '#000000' : '#ffffff';
  const hover = tone(seed.l + (foreground === '#000000' ? 0.035 : -0.035));
  const textChroma = neutral ? seed.c * 0.25 : Math.min(seed.c * 0.35, 0.025);
  const foregroundSoft = tone(dark ? 0.8 : 0.44, textChroma);
  const edge = alpha(ink, dark ? 0.4 : 0.28);

  return {
    '--zarc-color': hex,
    '--zarc-canvas': canvas,
    '--zarc-panel': panel,
    '--zarc-panel-solid': panel,
    '--zarc-panel-raised': raised,
    '--zarc-inset': alpha(ink, dark ? 0.06 : 0.045),
    '--zarc-inset-strong': alpha(ink, dark ? 0.12 : 0.09),
    '--zarc-line': alpha(ink, dark ? 0.16 : 0.13),
    '--zarc-line-strong': alpha(ink, dark ? 0.28 : 0.24),
    '--zarc-fg': tone(dark ? 0.965 : 0.24, textChroma),
    '--zarc-fg-soft': foregroundSoft,
    '--zarc-fg-faint': tone(dark ? 0.73 : 0.49, textChroma),
    '--zarc-accent': hex,
    '--zarc-accent-ink': ink,
    '--zarc-accent-edge': edge,
    '--zarc-accent-strong': hover,
    '--zarc-accent-soft': tone(dark ? 0.85 : 0.8),
    '--zarc-accent-wash': wash,
    '--zarc-accent-fg': foreground
  };
}
