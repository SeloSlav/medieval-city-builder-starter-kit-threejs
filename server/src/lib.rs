//! Medieval Road System — SpacetimeDB server module.
//! Single-player localhost: anonymous identity per browser token; resources/buildings/roads scoped by owner.

mod balance_generated;
mod building_defs;
mod burgage;
mod constants;
mod economy;
mod farming;
mod hydrology;
mod hydrology_grid_generated;
mod placement_validation;
mod tables;
mod types;
mod world_gen;
mod schedule;
mod db;
mod lifecycle;
mod reducers;
mod roads;
mod simulation;
mod world_entities;

pub use constants::DEFAULT_WORLD_SEED;
