use spacetimedb::ReducerContext;

use crate::db::*;

use crate::constants::{LUMBER_MILL_INTERVAL, LUMBER_MILL_RADIUS, TICK_DT};
use crate::simulation::spatial::find_nearest_mature_tree;
use crate::tables::{Building, TreeEntity};

pub fn step_lumber_mill(ctx: &ReducerContext, building: Building) {
    let cooldown = (building.action_cooldown - TICK_DT).max(0.0);
    if cooldown > 0.0 {
        ctx.db.building().id().update(Building {
            action_cooldown: cooldown,
            ..building
        });
        return;
    }

    let Some(target) = find_nearest_mature_tree(ctx, building.x, building.z, LUMBER_MILL_RADIUS) else {
        ctx.db.building().id().update(Building {
            action_cooldown: LUMBER_MILL_INTERVAL,
            ..building
        });
        return;
    };

    ctx.db.tree_entity().tree_id().update(TreeEntity {
        phase: "stump".to_string(),
        growth_progress: 0.0,
        ..target
    });

    if let Some(mut resources) = ctx.db.player_resources().owner().find(&building.owner) {
        resources.wood += target.wood_yield;
        ctx.db.player_resources().owner().update(resources);
    }

    ctx.db.building().id().update(Building {
        action_cooldown: LUMBER_MILL_INTERVAL,
        ..building
    });
}
