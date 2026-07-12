export type PlacementInteractionGate = {
  isSessionReady: () => boolean;
  isRoadToolEnabled: () => boolean;
  isBuildingToolEnabled: () => boolean;
  isBurgageToolEnabled: () => boolean;
  isFirstPersonActive: () => boolean;
  isMenuOpen: () => boolean;
};

export function isSessionGameplayBlocked(gate: PlacementInteractionGate): boolean {
  return !gate.isSessionReady();
}

export function isBuildingPlacementBlocked(gate: PlacementInteractionGate): boolean {
  return isSessionGameplayBlocked(gate)
    || gate.isRoadToolEnabled()
    || gate.isBurgageToolEnabled()
    || gate.isFirstPersonActive()
    || gate.isMenuOpen();
}

export function isBurgagePlacementBlocked(gate: PlacementInteractionGate): boolean {
  return isSessionGameplayBlocked(gate)
    || gate.isRoadToolEnabled()
    || gate.isBuildingToolEnabled()
    || gate.isFirstPersonActive()
    || gate.isMenuOpen();
}

export function isRoadPlacementBlocked(gate: PlacementInteractionGate): boolean {
  return isSessionGameplayBlocked(gate)
    || gate.isBuildingToolEnabled()
    || gate.isBurgageToolEnabled()
    || gate.isFirstPersonActive()
    || gate.isMenuOpen();
}

export function isWorldInspectionBlocked(gate: PlacementInteractionGate): boolean {
  return isSessionGameplayBlocked(gate)
    || gate.isRoadToolEnabled()
    || gate.isBuildingToolEnabled()
    || gate.isBurgageToolEnabled()
    || gate.isFirstPersonActive()
    || gate.isMenuOpen();
}
