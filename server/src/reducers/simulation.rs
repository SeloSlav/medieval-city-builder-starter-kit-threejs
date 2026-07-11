use spacetimedb::ReducerContext;

use crate::building_defs::BuildingSimKind;
use crate::db::*;
use crate::schedule::SimTickSchedule;
use crate::simulation::SimTickContext;
use crate::simulation::{
    step_lumber_mill, step_reforester, step_residence_needs, step_residence_recovery,
    step_residence_settlement, step_stone_quarry, step_well, step_woodcutters_lodge,
};
use crate::tables::WorldConfig;

pub fn run_sim_tick(ctx: &ReducerContext, _schedule: SimTickSchedule) {
    if let Some(config) = ctx.db.world_config().id().find(&0) {
        ctx.db.world_config().id().update(WorldConfig {
            sim_tick: config.sim_tick + 1,
            ..config
        });
    }

    let tick = SimTickContext::new(ctx);
    let sim_tick = ctx
        .db
        .world_config()
        .id()
        .find(&0)
        .map(|config| config.sim_tick)
        .unwrap_or(0);

    let mut lumber_mill_ids: Vec<u64> = Vec::new();
    let mut reforester_ids: Vec<u64> = Vec::new();
    let mut stone_quarry_ids: Vec<u64> = Vec::new();
    let mut woodcutters_lodge_ids: Vec<u64> = Vec::new();
    let mut well_ids: Vec<u64> = Vec::new();

    for building in ctx.db.building().iter() {
        let Some(sim_kind) =
            crate::building_defs::building_def(&building.kind).and_then(|def| def.sim_kind)
        else {
            continue;
        };
        match sim_kind {
            BuildingSimKind::LumberMill => lumber_mill_ids.push(building.id),
            BuildingSimKind::Reforester => reforester_ids.push(building.id),
            BuildingSimKind::StoneQuarry => stone_quarry_ids.push(building.id),
            BuildingSimKind::WoodcuttersLodge => woodcutters_lodge_ids.push(building.id),
            BuildingSimKind::Well => well_ids.push(building.id),
        }
    }

    for building_id in reforester_ids {
        let Some(building) = ctx.db.building().id().find(&building_id) else {
            continue;
        };
        step_reforester(ctx, building);
    }

    for building_id in lumber_mill_ids {
        let Some(building) = ctx.db.building().id().find(&building_id) else {
            continue;
        };
        step_lumber_mill(ctx, building);
    }

    for building_id in stone_quarry_ids {
        let Some(building) = ctx.db.building().id().find(&building_id) else {
            continue;
        };
        step_stone_quarry(ctx, building);
    }

    for building_id in woodcutters_lodge_ids {
        let Some(building) = ctx.db.building().id().find(&building_id) else {
            continue;
        };
        step_woodcutters_lodge(ctx, &tick, building);
    }

    for building_id in well_ids {
        let Some(building) = ctx.db.building().id().find(&building_id) else {
            continue;
        };
        step_well(ctx, sim_tick, building);
    }

    let residence_ids: Vec<u64> = ctx.db.residence().iter().map(|row| row.id).collect();
    for residence_id in &residence_ids {
        let Some(residence) = ctx.db.residence().id().find(residence_id) else {
            continue;
        };
        step_residence_recovery(ctx, &tick, residence);
    }
    for residence_id in &residence_ids {
        let Some(residence) = ctx.db.residence().id().find(residence_id) else {
            continue;
        };
        step_residence_settlement(ctx, residence);
    }
    for residence_id in &residence_ids {
        let Some(residence) = ctx.db.residence().id().find(residence_id) else {
            continue;
        };
        step_residence_needs(ctx, residence);
    }
}
