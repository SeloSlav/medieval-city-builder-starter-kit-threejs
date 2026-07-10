use spacetimedb::ReducerContext;

use crate::constants::{POPULATION_PER_RESIDENCE, STARTING_POPULATION};
use crate::db::*;
use crate::tables::Building;

pub fn starting_population() -> u32 {
    STARTING_POPULATION
}

pub fn residence_population() -> u32 {
    POPULATION_PER_RESIDENCE
}

pub fn total_population(ctx: &ReducerContext, owner: spacetimedb::Identity) -> u32 {
    let from_residences: u32 = ctx
        .db
        .residence()
        .owner()
        .filter(&owner)
        .filter(|residence| !residence.abandoned)
        .map(|residence| residence.population)
        .sum();
    STARTING_POPULATION.saturating_add(from_residences)
}

pub fn total_assigned_labor(ctx: &ReducerContext, owner: spacetimedb::Identity) -> u32 {
    ctx.db
        .building()
        .owner()
        .filter(&owner)
        .map(|building| building.assigned_labor)
        .sum()
}

pub fn available_labor(ctx: &ReducerContext, owner: spacetimedb::Identity) -> u32 {
    total_population(ctx, owner).saturating_sub(total_assigned_labor(ctx, owner))
}

pub fn assign_building_labor(
    ctx: &ReducerContext,
    owner: spacetimedb::Identity,
    building_id: u64,
    requested_labor: u32,
) -> Result<(), String> {
    let building = ctx
        .db
        .building()
        .id()
        .find(&building_id)
        .ok_or_else(|| "Building not found.".to_string())?;
    if building.owner != owner {
        return Err("You do not own this building.".to_string());
    }
    if !building_accepts_labor(&building.kind) {
        return Err("This building does not use labor.".to_string());
    }

    let assigned_elsewhere = total_assigned_labor(ctx, owner).saturating_sub(building.assigned_labor);
    let max_allowed = total_population(ctx, owner).saturating_sub(assigned_elsewhere);
    if requested_labor > max_allowed {
        return Err(format!(
            "Only {} workers available ({} population assigned elsewhere).",
            max_allowed, assigned_elsewhere
        ));
    }

    ctx.db.building().id().update(Building {
        assigned_labor: requested_labor,
        ..building
    });
    Ok(())
}

pub fn building_accepts_labor(kind: &str) -> bool {
    matches!(kind, "lumber_mill" | "woodcutters_lodge" | "stone_quarry")
}
