/**
 * Centralized color theme.
 *
 * Every color token below has a `dark` value that exactly matches this
 * app's original (and default) hardcoded colors, plus a `light` value used
 * when the light theme is active. Components should never hardcode colors —
 * they reference `var(--cv-<token>)` (see the CSS custom property names in
 * `TOKENS` below), and `applyTheme()` is what defines those variables on
 * `document.documentElement` for the active mode.
 */

export type ThemeMode = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'csv-theme-mode';

interface TokenPair {
  dark: string;
  light: string;
}

// ---- Token table: cssVarName -> { dark, light } ----
// (cssVarName is used without the `--cv-` prefix here; see cssVarName() below)
const TOKENS: Record<string, TokenPair> = {
  // Backgrounds
  'bg-canvas': { dark: '#0a0a0f', light: '#ffffff' },
  'bg-code-block': { dark: '#0a0a14', light: '#f3f4f8' },
  'bg-timeline-header': { dark: '#0c0c14', light: '#fafafc' },
  'bg-inset': { dark: '#0d0d15', light: '#f0f1f5' },
  'bg-header-bar': { dark: '#0e0e16', light: '#f2f3f7' },
  'bg-error-root': { dark: '#0e0e18', light: '#ffffff' },
  'bg-tool-card': { dark: '#0f0f18', light: '#f4f5f9' },
  'bg-search-input': { dark: '#111119', light: '#f4f5f9' },
  'bg-menu': { dark: '#11111a', light: '#ffffff' },
  'bg-panel': { dark: '#12121a', light: '#f7f7fa' },
  'bg-summary-bar': { dark: '#13131f', light: '#f7f7fb' },
  'bg-tool-result': { dark: '#14141e', light: '#f3f4f9' },
  'bg-graph-tool-node': { dark: '#141422', light: '#f3f4f9' },
  'bg-elevated': { dark: '#1a1a2e', light: '#eef0f9' },
  'bg-active': { dark: '#1e1e3a', light: '#e4e7fb' },
  'bg-hover': { dark: '#15152a', light: '#f1f2f8' },
  'bg-pill-inactive': { dark: '#16161e', light: '#f0f0f4' },
  'bg-pill-blue-active': { dark: '#1e2a4a', light: '#dbe7fb' },
  'bg-pill-red-active': { dark: '#5c1a1a', light: '#fbdcdc' },
  'bg-owner-badge': { dark: '#1e293b', light: '#e7ebf1' },
  'bg-root-badge': { dark: '#312e81', light: '#e2e0fb' },
  'bg-agent-badge': { dark: '#2d1f4e', light: '#f1e5fd' },
  'bg-recovery-retried': { dark: '#1e3a5f', light: '#dbeafe' },
  'bg-recovery-tried': { dark: '#1a3329', light: '#dcfce7' },
  'bg-recovery-gave-up': { dark: '#3b1c1c', light: '#fee2e2' },
  'bg-error-message': { dark: '#1c1018', light: '#fef2f2' },

  // Borders
  'border-default': { dark: '#222238', light: '#e4e5ec' },
  'border-input': { dark: '#2a2a3e', light: '#d8dae2' },
  'border-subtle': { dark: '#1e1e30', light: '#e6e7ee' },
  'border-muted': { dark: '#333333', light: '#d5d7de' },
  'border-active': { dark: '#333355', light: '#c7cbf0' },
  'border-owner-badge': { dark: '#334155', light: '#c9d0dc' },
  'border-root-badge': { dark: '#4338ca', light: '#9891ec' },
  'border-pill-blue-active': { dark: '#3060b0', light: '#7fa8e8' },
  'border-pill-red-active': { dark: '#a03030', light: '#e79a9a' },
  'border-chart-axis': { dark: '#222222', light: '#dcdee4' },

  // Text
  'text-primary': { dark: '#e0e0e8', light: '#16161d' },
  'text-secondary': { dark: '#c0c0d0', light: '#3c3d49' },
  'text-code': { dark: '#c8c8d8', light: '#33343f' },
  'text-bold': { dark: '#e8e8f0', light: '#101015' },
  'text-error-root': { dark: '#d0d0e0', light: '#22232c' },
  'text-muted': { dark: '#8888a0', light: '#61626f' },
  'text-faint': { dark: '#6666a0', light: '#75768a' },
  'text-faintest': { dark: '#555570', light: '#8a8b9a' },
  'text-dim': { dark: '#6b7280', light: '#6b7280' },
  'text-subtle': { dark: '#555555', light: '#8a8a94' },
  'text-subtle-alt': { dark: '#666666', light: '#7c7c88' },
  'text-thinking': { dark: '#7a7a90', light: '#6f7080' },
  'text-thinking-content': { dark: '#9ca3af', light: '#565863' },
  'text-owner-badge': { dark: '#94a3b8', light: '#516072' },
  'text-result-content': { dark: '#b0b0c0', light: '#494a56' },
  'text-very-faint': { dark: '#444444', light: '#9a9aa4' },
  'text-running-label': { dark: '#a5b4fc', light: '#4338ca' },
  'text-chart-legend': { dark: '#aaaaaa', light: '#767680' },
  'text-chart-axis-label': { dark: '#888888', light: '#7c7c88' },
  'text-export-btn': { dark: '#cfd2ff', light: '#4338ca' },
  'bg-model-badge': { dark: '#1a2e1a', light: '#dcfce7' },
  'bg-toolbar-hover': { dark: '#252540', light: '#e4e7fb' },

  // Accent / status (reused consistently for the same meaning everywhere)
  'accent-indigo': { dark: '#6366f1', light: '#4f46e5' },
  'accent-indigo-strong': { dark: '#4f46e5', light: '#4338ca' },
  'accent-indigo-light': { dark: '#818cf8', light: '#4f46e5' },
  'status-success': { dark: '#22c55e', light: '#16a34a' },
  'status-success-bright': { dark: '#4ade80', light: '#15803d' },
  'status-danger': { dark: '#ef4444', light: '#dc2626' },
  'status-danger-bright': { dark: '#f87171', light: '#b91c1c' },
  'status-warning': { dark: '#f59e0b', light: '#b45309' },
  'status-warning-strong': { dark: '#b45309', light: '#92400e' },
  'status-orange': { dark: '#f97316', light: '#c2410c' },
  'status-purple': { dark: '#a855f7', light: '#9333ea' },
  'status-blue': { dark: '#3b82f6', light: '#2563eb' },
  'status-cyan': { dark: '#06b6d4', light: '#0891b2' },
  'status-pink': { dark: '#ec4899', light: '#db2777' },
  'pill-red-text': { dark: '#ff6b6b', light: '#b91c1c' },
  'pill-blue-text': { dark: '#8cb4ff', light: '#1d4ed8' },
  'recovery-retried-text': { dark: '#60a5fa', light: '#1d4ed8' },
  'agent-badge-text': { dark: '#c084fc', light: '#7e22ce' },
  'accent-violet': { dark: '#8b5cf6', light: '#7c3aed' },
  'accent-violet-light': { dark: '#a78bfa', light: '#6d28d9' },
  'text-on-accent': { dark: '#ffffff', light: '#ffffff' },
  'highlight-bg': { dark: 'rgba(250, 204, 21, 0.4)', light: 'rgba(250, 204, 21, 0.55)' },
  'highlight-text': { dark: '#fef08a', light: '#5b3a00' },

  // Overlays that need to invert direction between themes
  'overlay-faint': { dark: 'rgba(255, 255, 255, 0.03)', light: 'rgba(0, 0, 0, 0.035)' },
};

function cssVarName(token: string): string {
  return `--cv-${token}`;
}

/** Applies the given theme's CSS custom properties to the document root. */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const [token, pair] of Object.entries(TOKENS)) {
    root.style.setProperty(cssVarName(token), pair[mode]);
  }
  root.dataset.theme = mode;
}

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function storeTheme(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // localStorage unavailable (e.g. private mode) — theme just won't persist
  }
}
