use spacetimedb::{reducer, ReducerContext, Table};

use crate::db::*;
use crate::constants::{
    LUMBER_MILL_PICK_RADIUS, LUMBER_MILL_RADIUS, REFORESTER_PICK_RADIUS, STONE_QUARRY_PICK_RADIUS,
    STONE_QUARRY_RADIUS, WOODCUTTERS_LODGE_PICK_RADIUS,
};
use crate::economy::{
    assign_building_labor as set_building_labor, building_cost, building_salvage_refund,
    credit_treasury_stone, credit_treasury_timber, spend_aggregate_stone, spend_aggregate_timber,
    total_stone, total_timber, ResourceAmount,
};
use crate::lifecycle::ensure_player_resources;
use crate::placement_validation::{building_overlaps_residence_zone, is_on_quarry_pit};
use crate::roads::has_building_road_access;
use crate::simulation::building_params;
use crate::tables::{Building, WorldConfig};

fn pick_radius(kind: &str) -> Result<f64, String> {
    match kind {
        "lumber_mill" => Ok(LUMBER_MILL_PICK_RADIUS),
        "reforester" => Ok(REFORESTER_PICK_RADIUS),
        "woodcutters_lodge" => Ok(WOODCUTTERS_LODGE_PICK_RADIUS),
        "stone_quarry" => Ok(STONE_QUARRY_PICK_RADIUS),
        _ => Err(format!("Unknown building kind: {kind}")),
    }
}

fn is_within_same_kind_work_radius(ctx: &ReducerContext, kind: &str, x: f64, z: f64) -> bool {
    for building in ctx.db.building().iter() {
        if building.kind != kind || building.work_radius <= 0.0 {
            continue;
        }
        let dx = building.x - x;
        let dz = building.z - z;
        if dx * dx + dz * dz < building.work_radius * building.work_radius {
            return true;
        }
    }
    false
}

fn is_too_close_to_buildings(ctx: &ReducerContext, kind: &str, x: f64, z: f64) -> bool {
    let Ok(candidate_pick) = pick_radius(kind) else {
        return false;
    };
    let min_separation = candidate_pick * 1.85;

    for building in ctx.db.building().iter() {
        let Ok(other_pick) = pick_radius(&building.kind) else {
            continue;
        };
        let required = min_separation.max((candidate_pick + other_pick) * 0.9);
        let dx = building.x - x;
        let dz = building.z - z;
        if dx * dx + dz * dz < required * required {
            return true;
        }
    }
    false
}

fn has_mature_tree_in_radius(ctx: &ReducerContext, x: f64, z: f64, radius: f64) -> bool {
    let radius_sq = radius * radius;
    for tree in ctx.db.tree_entity().iter() {
        if tree.phase != "mature" {
            continue;
        }
        let dx = tree.x - x;
        let dz = tree.z - z;
        if dx * dx + dz * dz <= radius_sq {
            return true;
        }
    }
    false
}

fn has_quarry_stone_in_radius(ctx: &ReducerContext, x: f64, z: f64, radius: f64) -> bool {
    let radius_sq = radius * radius;
    for quarry in ctx.db.quarry().iter() {
        if quarry.remaining <= 0.0 {
            continue;
        }
        let dx = quarry.x - x;
        let dz = quarry.z - z;
        if dx * dx + dz * dz <= radius_sq {
            return true;
        }
    }
    false
}

#[reducer]
pub fn place_building(ctx: &ReducerContext, kind: String, x: f64, z: f64) -> Result<(), String> {
    let (work_radius, _) = building_params(&kind)?;
    let owner = ctx.sender();
    ensure_player_resources(ctx, owner);

    if kind != "stone_quarry" && is_on_quarry_pit(ctx, x, z) {
        return Err("Cannot build on a quarry pit.".to_string());
    }

    if building_overlaps_residence_zone(ctx, &kind, x, z) {
        return Err("Cannot build inside a residence plot.".to_string());
    }

    if is_within_same_kind_work_radius(ctx, &kind, x, z) {
        return Err("Another building of the same type already covers this area.".to_string());
    }

    if kind == "lumber_mill" && !has_mature_tree_in_radius(ctx, x, z, LUMBER_MILL_RADIUS) {
        return Err("No mature trees within work range.".to_string());
    }

    if kind == "stone_quarry" && !has_quarry_stone_in_radius(ctx, x, z, STONE_QUARRY_RADIUS) {
        return Err("No quarry stone within work range.".to_string());
    }

    if is_too_close_to_buildings(ctx, &kind, x, z) {
        return Err("Too close to another building.".to_string());
    }

    if matches!(kind.as_str(), "lumber_mill" | "woodcutters_lodge")
        && !has_building_road_access(ctx, owner, x, z)
    {
        return Err("Building must be placed near a road.".to_string());
    }

    let cost = building_cost(&kind)?;
    if total_timber(ctx, owner) + 1e-6 < cost.timber {
        return Err(format!(
            "Not enough timber (need {} timber).",
            cost.timber.round() as i64
        ));
    }
    if total_stone(ctx, owner) + 1e-6 < cost.stone {
        return Err(format!(
            "Not enough stone (need {} stone).",
            cost.stone.round() as i64
        ));
    }
    spend_aggregate_timber(ctx, owner, cost.timber)?;
    spend_aggregate_stone(ctx, owner, cost.stone)?;

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
        timber: 0.0,
        firewood: 0.0,
        stone: 0.0,
        assigned_labor: 0,
    });

    ctx.db.world_config().id().update(WorldConfig {
        next_building_id: building_id + 1,
        ..config
    });

    Ok(())
}

#[reducer]
pub fn assign_building_labor(
    ctx: &ReducerContext,
    building_id: u64,
    labor: u32,
) -> Result<(), String> {
    let owner = ctx.sender();
    ensure_player_resources(ctx, owner);
    set_building_labor(ctx, owner, building_id, labor)
}

#[reducer]
pub fn demolish_building(ctx: &ReducerContext, building_id: u64) -> Result<(), String> {
    let owner = ctx.sender();
    ensure_player_resources(ctx, owner);

    let building = ctx
        .db
        .building()
        .id()
        .find(&building_id)
        .ok_or_else(|| "Building not found.".to_string())?;

    if building.owner != owner {
        return Err("You do not own this building.".to_string());
    }

    let refund = building_salvage_refund(&building.kind)?;
    credit_treasury_timber(ctx, owner, refund.timber + building.timber);
    credit_treasury_stone(ctx, owner, refund.stone + building.stone);
    if building.firewood > 0.0 {
        if let Some(mut treasury) = ctx.db.player_resources().owner().find(&owner) {
            treasury.firewood += building.firewood;
            ctx.db.player_resources().owner().update(treasury);
        }
    }

    ctx.db.building().id().delete(building_id);

    Ok(())
}
