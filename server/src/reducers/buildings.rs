use spacetimedb::{reducer, ReducerContext};

use crate::db::*;
use crate::lifecycle::ensure_player_resources;
use crate::simulation::building_params;
use crate::tables::{Building, WorldConfig};

#[reducer]
pub fn place_building(ctx: &ReducerContext, kind: String, x: f64, z: f64) -> Result<(), String> {
    let (work_radius, _) = building_params(&kind)?;
    let owner = ctx.sender();
    ensure_player_resources(ctx, owner);

    let config = ctx
        .db
        .world_config()
        .id()
        .find(&0)
        .ok_or_else(|| "World not initialized.".to_string())?;

    let building_id = config.next_building_id;
    ctx.db.building().insert(Building {
        id: 0,
        owner,
        kind,
        x,
        z,
        work_radius,
        action_cooldown: 0.0,
    });

    ctx.db.world_config().id().update(WorldConfig {
        next_building_id: building_id + 1,
        ..config
    });

    Ok(())
}
