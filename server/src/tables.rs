use spacetimedb::{Identity};

#[spacetimedb::table(accessor = world_config, public)]
pub struct WorldConfig {
    #[primary_key]
    pub id: u8,
    pub seed: u64,
    pub next_building_id: u64,
    pub sim_tick: u64,
}

#[spacetimedb::table(accessor = player_resources, public)]
pub struct PlayerResources {
    #[primary_key]
    pub owner: Identity,
    pub wood: f64,
    pub stone: f64,
    pub water: f64,
}

#[spacetimedb::table(accessor = quarry, public)]
pub struct Quarry {
    #[primary_key]
    pub quarry_id: String,
    pub x: f64,
    pub z: f64,
    pub max_yield: f64,
    pub remaining: f64,
}

#[spacetimedb::table(accessor = tree_entity, public)]
pub struct TreeEntity {
    #[primary_key]
    pub tree_id: String,
    pub layout_index: u32,
    pub phase: String,
    pub growth_progress: f64,
    pub wood_yield: f64,
    pub x: f64,
    pub z: f64,
}

#[spacetimedb::table(accessor = building, public, index(accessor = owner, btree(columns = [owner])))]
pub struct Building {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub owner: Identity,
    pub kind: String,
    pub x: f64,
    pub z: f64,
    pub work_radius: f64,
    pub action_cooldown: f64,
}

#[spacetimedb::table(accessor = road_network_state, public)]
pub struct RoadNetworkState {
    #[primary_key]
    pub owner: Identity,
    pub snapshot_json: String,
}
