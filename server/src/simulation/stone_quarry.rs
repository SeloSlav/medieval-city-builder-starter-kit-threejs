use spacetimedb::ReducerContext;

use crate::db::*;

use crate::constants::{STONE_PER_HARVEST, STONE_QUARRY_INTERVAL, STONE_QUARRY_RADIUS, TICK_DT};
use crate::simulation::spatial::find_nearest_quarry;
use crate::tables::{Building, Quarry};

pub fn step_stone_quarry(ctx: &ReducerContext, building: Building) {
    let cooldown = (building.action_cooldown - TICK_DT).max(0.0);
    if cooldown > 0.0 {
        ctx.db.building().id().update(Building {
            action_cooldown: cooldown,
            ..building
        });
        return;
    }

    let Some(quarry) = find_nearest_quarry(ctx, building.x, building.z, STONE_QUARRY_RADIUS) else {
        ctx.db.building().id().update(Building {
            action_cooldown: STONE_QUARRY_INTERVAL,
            ..building
        });
        return;
    };

    let extracted = STONE_PER_HARVEST.min(quarry.remaining);
    if extracted <= 0.0 {
        ctx.db.building().id().update(Building {
            action_cooldown: STONE_QUARRY_INTERVAL,
            ..building
        });
        return;
    }

    ctx.db.quarry().quarry_id().update(Quarry {
        remaining: quarry.remaining - extracted,
        ..quarry
    });

    if let Some(mut resources) = ctx.db.player_resources().owner().find(&building.owner) {
        resources.stone += extracted;
        ctx.db.player_resources().owner().update(resources);
    }

    ctx.db.building().id().update(Building {
        action_cooldown: STONE_QUARRY_INTERVAL,
        ..building
    });
}
