export type PlacementInteractionGate = {
  isRoadToolEnabled: () => boolean;
  isBuildingToolEnabled: () => boolean;
  isBurgageToolEnabled: () => boolean;
  isFirstPersonActive: () => boolean;
  isMenuOpen: () => boolean;
};

export function isBuildingPlacementBlocked(gate: PlacementInteractionGate): boolean {
  return gate.isRoadToolEnabled()
    || gate.isBurgageToolEnabled()
    || gate.isFirstPersonActive()
    || gate.isMenuOpen();
}

export function isBurgagePlacementBlocked(gate: PlacementInteractionGate): boolean {
  return gate.isRoadToolEnabled()
    || gate.isBuildingToolEnabled()
    || gate.isFirstPersonActive()
    || gate.isMenuOpen();
}

export function isWorldInspectionBlocked(gate: PlacementInteractionGate): boolean {
  return gate.isRoadToolEnabled()
    || gate.isBuildingToolEnabled()
    || gate.isBurgageToolEnabled()
    || gate.isFirstPersonActive()
    || gate.isMenuOpen();
}
