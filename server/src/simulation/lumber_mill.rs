use spacetimedb::ReducerContext;

use crate::constants::{LUMBER_MILL_INTERVAL, LUMBER_MILL_RADIUS, TICK_DT};
use crate::db::*;
use crate::economy::{building_storage_caps, deposit_building};
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

    if building.assigned_labor == 0 {
        ctx.db.building().id().update(Building {
            action_cooldown: LUMBER_MILL_INTERVAL,
            ..building
        });
        return;
    }

    let caps = building_storage_caps(&building.kind);
    if building.timber >= caps.timber - 1e-6 {
        ctx.db.building().id().update(Building {
            action_cooldown: LUMBER_MILL_INTERVAL,
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

    let (_, _, _, mut updated) = deposit_building(&building, caps, target.wood_yield, 0.0, 0.0);
    updated.action_cooldown = LUMBER_MILL_INTERVAL;
    ctx.db.building().id().update(updated);
}
