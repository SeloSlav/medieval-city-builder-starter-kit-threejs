use spacetimedb::ReducerContext;

use crate::db::*;
use crate::schedule::SimTickSchedule;

pub fn run_sim_tick(ctx: &ReducerContext, _schedule: SimTickSchedule) {
    use crate::simulation::{
        step_lumber_mill, step_reforester, step_residence_needs, step_stone_quarry,
        step_woodcutters_lodge,
    };
    use crate::tables::WorldConfig;

    if let Some(config) = ctx.db.world_config().id().find(&0) {
        ctx.db.world_config().id().update(WorldConfig {
            sim_tick: config.sim_tick + 1,
            ..config
        });
    }

    let building_ids: Vec<u64> = ctx.db.building().iter().map(|b| b.id).collect();
    for building_id in building_ids {
        let Some(building) = ctx.db.building().id().find(&building_id) else {
            continue;
        };
        match building.kind.as_str() {
            "lumber_mill" => step_lumber_mill(ctx, building),
            "reforester" => step_reforester(ctx, building),
            "stone_quarry" => step_stone_quarry(ctx, building),
            "woodcutters_lodge" => step_woodcutters_lodge(ctx, building),
            _ => {}
        }
    }

    let residence_ids: Vec<u64> = ctx.db.residence().iter().map(|row| row.id).collect();
    for residence_id in residence_ids {
        let Some(residence) = ctx.db.residence().id().find(&residence_id) else {
            continue;
        };
        step_residence_needs(ctx, residence);
    }
}
