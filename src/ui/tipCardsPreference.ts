const STORAGE_KEY = 'medieval-road-system.tipsDisabled';

const listeners = new Set<() => void>();

export function areTipCardsDisabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setTipCardsDisabled(disabled: boolean): void {
  try {
    if (disabled) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore private browsing / blocked storage.
  }
  for (const listener of listeners) listener();
}

export function subscribeTipCardsPreference(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
