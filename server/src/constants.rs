pub const DEFAULT_WORLD_SEED: u64 = 0x71a2e0d;

pub const TICK_MICROS: i64 = 200_000;
pub const TICK_DT: f64 = 0.2;

pub const LUMBER_MILL_RADIUS: f64 = 210.0;
/// One mature tree every 9s — visible harvest cadence without clearing forests instantly.
pub const LUMBER_MILL_INTERVAL: f64 = 9.0;
pub const LUMBER_MILL_PICK_RADIUS: f64 = 8.0;

pub const REFORESTER_RADIUS: f64 = 190.0;
pub const REFORESTER_PICK_RADIUS: f64 = 8.0;
/// ~71s stump-to-mature; paired with mill interval keeps ~8 trees in regrow per mill.
pub const REFORESTER_REGROW_PER_SEC: f64 = 0.014;

pub const WOODCUTTERS_LODGE_PICK_RADIUS: f64 = 8.0;
pub const WOODCUTTERS_LODGE_INTERVAL: f64 = 5.0;
pub const LODGE_TIMBER_PER_CYCLE: f64 = 3.0;
pub const LODGE_FIREWOOD_PER_CYCLE: f64 = 3.0;

/// How close a building must be to the road network to participate in logistics.
pub const BUILDING_ROAD_ACCESS_DISTANCE: f64 = 20.0;
/// Burgage frontage may face a road within this distance (more forgiving than before).
pub const BURGAGE_ROAD_FRONTAGE_DISTANCE: f64 = 16.0;

pub const LUMBER_MILL_TIMBER_CAPACITY: f64 = 240.0;
pub const WOODCUTTERS_LODGE_TIMBER_CAPACITY: f64 = 60.0;
pub const WOODCUTTERS_LODGE_FIREWOOD_CAPACITY: f64 = 120.0;
pub const STONE_QUARRY_STONE_CAPACITY: f64 = 180.0;
pub const RESIDENCE_FIREWOOD_CAPACITY: f64 = 40.0;

pub const STARTING_POPULATION: u32 = 6;
pub const POPULATION_PER_RESIDENCE: u32 = 4;
/// Sim only advances while connected — demand is tuned for in-session play, not real-time days.
/// A 4-person cottage burns ~0.08 firewood/s (~8 min to empty a full larder).
pub const RESIDENCE_FIREWOOD_PER_PERSON_PER_SEC: f64 = 0.02;
/// Continuous ticks with empty larder before abandonment (200 ms tick).
/// 3600 ticks ≈ 12 minutes of shortage after stock runs out — time to notice and fix logistics.
pub const ABANDON_AFTER_DEFICIT_TICKS: u32 = 3600;

pub const STONE_QUARRY_RADIUS: f64 = 55.0;
pub const STONE_QUARRY_PICK_RADIUS: f64 = 10.0;
/// 3 stone / 9s ≈ 20/min; large quarry (1500) lasts ~75 min of active harvesting.
pub const STONE_QUARRY_INTERVAL: f64 = 9.0;
pub const STONE_PER_HARVEST: f64 = 3.0;
