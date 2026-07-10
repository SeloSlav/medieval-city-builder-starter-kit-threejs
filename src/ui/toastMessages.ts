import type { RoadPlacementFailureReason } from '../roads/RoadPlacementValidation.ts';
import type { BuildingPlacementFailureReason } from '../buildings/BuildingPlacementValidation.ts';
import type { BurgagePlacementFailureReason } from '../residences/burgagePlacementValidation.ts';

export const TOAST_MESSAGES = {
  'road.placement.river': 'A river was in the way',
  'road.placement.river_too_wide': 'The river is too wide for a wooden bridge',
  'road.placement.rocks': 'Rocks were in the way',
  'road.placement.too_steep': 'The slope is too steep for a road',
  'building.placement.water': 'Cannot build on water',
  'building.placement.too_steep': 'The slope is too steep here',
  'building.placement.too_close': 'Too close to another building',
  'building.placement.within_reforester_radius': 'Within an existing reforester hut\'s work area',
  'building.placement.insufficient_resources': 'Not enough wood or stone',
  'burgage.placement.water': 'Cannot place residences on water',
  'burgage.placement.too_steep': 'The slope is too steep here',
  'burgage.placement.invalid_shape': 'Invalid residence plot shape',
  'burgage.placement.too_small': 'Residence plot is too small',
  'burgage.placement.no_road_frontage': 'Frontage must face a road',
  'burgage.placement.insufficient_resources': 'Not enough wood or stone',
  'burgage.placement.no_fit': 'Residences do not fit in this zone',
} as const;

export type ToastMessageId = keyof typeof TOAST_MESSAGES;

export function getToastMessage(id: ToastMessageId): string {
  return TOAST_MESSAGES[id];
}

export function roadPlacementReasonToToastId(reason: RoadPlacementFailureReason): ToastMessageId | null {
  switch (reason) {
    case 'river':
      return 'road.placement.river';
    case 'river_too_wide':
      return 'road.placement.river_too_wide';
    case 'rocks':
      return 'road.placement.rocks';
    case 'too_steep':
      return 'road.placement.too_steep';
    case 'too_short':
      return null;
    default: {
      const unhandled: never = reason;
      return unhandled;
    }
  }
}

export function burgagePlacementReasonToToastId(reason: BurgagePlacementFailureReason): ToastMessageId {
  switch (reason) {
    case 'water':
      return 'burgage.placement.water';
    case 'too_steep':
      return 'burgage.placement.too_steep';
    case 'invalid_shape':
      return 'burgage.placement.invalid_shape';
    case 'too_small':
      return 'burgage.placement.too_small';
    case 'no_road_frontage':
      return 'burgage.placement.no_road_frontage';
    case 'insufficient_resources':
      return 'burgage.placement.insufficient_resources';
    case 'no_fit':
      return 'burgage.placement.no_fit';
    default: {
      const unhandled: never = reason;
      return unhandled;
    }
  }
}

export function buildingPlacementReasonToToastId(reason: BuildingPlacementFailureReason): ToastMessageId {
  switch (reason) {
    case 'water':
      return 'building.placement.water';
    case 'too_steep':
      return 'building.placement.too_steep';
    case 'too_close':
      return 'building.placement.too_close';
    case 'within_reforester_radius':
      return 'building.placement.within_reforester_radius';
    case 'insufficient_resources':
      return 'building.placement.insufficient_resources';
    default: {
      const unhandled: never = reason;
      return unhandled;
    }
  }
}
