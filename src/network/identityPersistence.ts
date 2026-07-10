/**
 * SpacetimeDB identity persistence for local dev.
 *
 * SpacetimeDB 2.x issues a signed JWT on connect. Store that token (keyed by
 * database name) so refresh keeps the same player identity. Do not invent tokens
 * client-side — random UUIDs are rejected with 401 Unauthorized.
 *
 * Migration path: replace `getStoredSpacetimeToken` with an OAuth/OpenAuth token
 * from a real auth provider (see selo-empire AuthContext + SpacetimeDBContext).
 */

const STORAGE_PREFIX = 'medieval-road-system:spacetime-token';

function storageKey(dbName: string): string {
  return `${STORAGE_PREFIX}:${dbName}`;
}

export function getStoredSpacetimeToken(dbName: string): string | null {
  try {
    const existing = localStorage.getItem(storageKey(dbName));
    if (existing && existing.length > 0) return existing;
  } catch {
    // Private browsing or blocked storage.
  }
  return null;
}

export function setStoredSpacetimeToken(dbName: string, token: string): void {
  if (!token) return;
  try {
    localStorage.setItem(storageKey(dbName), token);
  } catch {
    // Session-only if storage unavailable.
  }
}

export function clearStoredSpacetimeToken(dbName: string): void {
  try {
    localStorage.removeItem(storageKey(dbName));
  } catch {
    // ignore
  }
}
