// Aplicación del tema light/dark/system sobre <html data-theme>.

import type { Theme } from './core/types';

const media = window.matchMedia('(prefers-color-scheme: dark)');
let current: Theme = 'system';

function resolve(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return media.matches ? 'dark' : 'light';
  return theme;
}

function apply() {
  document.documentElement.dataset.theme = resolve(current);
}

media.addEventListener('change', () => {
  if (current === 'system') apply();
});

export function setTheme(theme: Theme): void {
  current = theme;
  apply();
}
