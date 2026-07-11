export type AmbientLayerId =
  | 'birds_wind_day'
  | 'village_day'
  | 'open_wind_overview';

export type AudioClipDefinition = {
  path: string;
  volume?: number;
  loop?: boolean;
};

export const AMBIENT_LAYERS: Record<AmbientLayerId, AudioClipDefinition> = {
  birds_wind_day: { path: '/sounds/ambient/birds_wind_day.mp3', volume: 0.2, loop: true },
  village_day: { path: '/sounds/ambient/village_day.mp3', volume: 0.12, loop: true },
  open_wind_overview: { path: '/sounds/ambient/open_wind_overview.mp3', volume: 0.28, loop: true },
};
