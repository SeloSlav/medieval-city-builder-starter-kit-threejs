const HYDROLOGY_OVERLAY_KEY = 'medieval-road-system.hydrologyOverlayEnabled';

const listeners = new Set<() => void>();

export function isHydrologyOverlayEnabled(): boolean {
  try {
    const stored = localStorage.getItem(HYDROLOGY_OVERLAY_KEY);
    if (stored !== null) {
      return stored !== '0';
    }
  } catch {
    // Ignore private browsing / blocked storage.
  }
  return false;
}

export function setHydrologyOverlayEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.removeItem(HYDROLOGY_OVERLAY_KEY);
    else localStorage.setItem(HYDROLOGY_OVERLAY_KEY, '0');
  } catch {
    // Ignore private browsing / blocked storage.
  }
  notifyHydrologyOverlayListeners();
}

export function subscribeHydrologyOverlayPreference(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notifyHydrologyOverlayListeners(): void {
  for (const listener of listeners) listener();
}
