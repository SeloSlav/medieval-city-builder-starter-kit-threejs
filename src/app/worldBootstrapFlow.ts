import { clearStoredSpacetimeToken } from '../network/identityPersistence.ts';
import { WorldSetupPanel } from '../ui/WorldSetupPanel.ts';
import {
  DEFAULT_WORLD_GENERATION_SETTINGS,
  clearStoredWorldGenerationSettings,
  loadStoredWorldGenerationSettings,
  shouldShowWorldSetup,
  type WorldGenerationSettings,
} from '../world/worldGenerationSettings.ts';

export async function resolveWorldGenerationSettings(
  root: HTMLElement,
): Promise<WorldGenerationSettings> {
  if (shouldShowWorldSetup()) {
    return WorldSetupPanel.prompt(root);
  }
  return loadStoredWorldGenerationSettings() ?? DEFAULT_WORLD_GENERATION_SETTINGS;
}

export function beginNewWorld(): void {
  const confirmed = window.confirm(
    'Start a new world? This clears your saved world settings and local player identity, then reloads the page.',
  );
  if (!confirmed) return;
  clearStoredWorldGenerationSettings();
  clearStoredSpacetimeToken('city-builder');
  const url = new URL(window.location.href);
  url.searchParams.set('new', '1');
  window.location.assign(url.toString());
}
