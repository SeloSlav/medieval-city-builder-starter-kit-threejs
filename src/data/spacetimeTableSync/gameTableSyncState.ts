import type { DeliveryTripState } from '../../logistics/deliveryTrips.ts';
import type { RegionalMarketState } from '../../economy/regionalMarket.ts';
import type { ParishPolicyState } from '../../economy/chapelParish.ts';
import type { RoadNetworkSnapshot } from '../../roads/RoadNetwork.ts';
import type { AuthoritativeWorldGeneration } from '../../world/worldConfigAuthority.ts';
import type {
  BackyardGardenState,
  BuildingState,
  BurgageZoneState,
  ForagingNodeState,
  ResourceNodeState,
  ResidenceState,
  ResourceStockpile,
  TreeEntityState,
} from '../../resources/types.ts';

export type GameTableSyncState = {
  identityHex: string | null;
  simTick: number;
  worldGeneration: AuthoritativeWorldGeneration | null;
  stockpile: ResourceStockpile;
  economicActivityTaxRate: number;
  parishPolicy: ParishPolicyState;
  marketState: RegionalMarketState;
  quarries: Map<string, ResourceNodeState>;
  foragingNodes: Map<string, ForagingNodeState>;
  trees: Map<string, TreeEntityState>;
  buildings: Map<string, BuildingState>;
  burgageZones: Map<string, BurgageZoneState>;
  residences: Map<string, ResidenceState>;
  backyardGardens: Map<string, BackyardGardenState>;
  deliveryTrips: Map<string, DeliveryTripState>;
  roads: RoadNetworkSnapshot | null;
};
