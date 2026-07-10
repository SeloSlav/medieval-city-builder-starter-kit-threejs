use spacetimedb::ReducerContext;

use crate::constants::{
    LUMBER_MILL_TIMBER_CAPACITY, RESIDENCE_FIREWOOD_CAPACITY, STONE_QUARRY_STONE_CAPACITY,
    WOODCUTTERS_LODGE_FIREWOOD_CAPACITY, WOODCUTTERS_LODGE_TIMBER_CAPACITY,
};
use crate::db::*;
use crate::tables::Building;

#[derive(Clone, Copy, Debug, Default)]
pub struct StorageCaps {
    pub timber: f64,
    pub firewood: f64,
    pub stone: f64,
}

pub fn building_storage_caps(kind: &str) -> StorageCaps {
    match kind {
        "lumber_mill" => StorageCaps {
            timber: LUMBER_MILL_TIMBER_CAPACITY,
            firewood: 0.0,
            stone: 0.0,
        },
        "woodcutters_lodge" => StorageCaps {
            timber: WOODCUTTERS_LODGE_TIMBER_CAPACITY,
            firewood: WOODCUTTERS_LODGE_FIREWOOD_CAPACITY,
            stone: 0.0,
        },
        "stone_quarry" => StorageCaps {
            timber: 0.0,
            firewood: 0.0,
            stone: STONE_QUARRY_STONE_CAPACITY,
        },
        _ => StorageCaps::default(),
    }
}

pub fn residence_firewood_capacity() -> f64 {
    RESIDENCE_FIREWOOD_CAPACITY
}

pub fn total_timber(ctx: &ReducerContext, owner: spacetimedb::Identity) -> f64 {
    treasury_timber(ctx, owner)
        + building_sum(ctx, owner, |building| building.timber)
}

pub fn total_stone(ctx: &ReducerContext, owner: spacetimedb::Identity) -> f64 {
    treasury_stone(ctx, owner) + building_sum(ctx, owner, |building| building.stone)
}

pub fn total_firewood(ctx: &ReducerContext, owner: spacetimedb::Identity) -> f64 {
    treasury_firewood(ctx, owner)
        + building_sum(ctx, owner, |building| building.firewood)
        + residence_firewood_sum(ctx, owner)
}

pub fn deposit_building(building: &Building, caps: StorageCaps, timber: f64, firewood: f64, stone: f64) -> (f64, f64, f64, Building) {
    let mut next = building.clone();
    let timber_room = (caps.timber - next.timber).max(0.0);
    let firewood_room = (caps.firewood - next.firewood).max(0.0);
    let stone_room = (caps.stone - next.stone).max(0.0);
    let timber_deposited = timber.min(timber_room);
    let firewood_deposited = firewood.min(firewood_room);
    let stone_deposited = stone.min(stone_room);
    next.timber += timber_deposited;
    next.firewood += firewood_deposited;
    next.stone += stone_deposited;
    (timber_deposited, firewood_deposited, stone_deposited, next)
}

pub fn withdraw_building(building: &Building, timber: f64, firewood: f64, stone: f64) -> (f64, f64, f64, Building) {
    let mut next = building.clone();
    let timber_withdrawn = timber.min(next.timber);
    let firewood_withdrawn = firewood.min(next.firewood);
    let stone_withdrawn = stone.min(next.stone);
    next.timber -= timber_withdrawn;
    next.firewood -= firewood_withdrawn;
    next.stone -= stone_withdrawn;
    (timber_withdrawn, firewood_withdrawn, stone_withdrawn, next)
}

pub fn spend_aggregate_timber(ctx: &ReducerContext, owner: spacetimedb::Identity, amount: f64) -> Result<(), String> {
    if amount <= 0.0 {
        return Ok(());
    }
    let mut remaining = amount;
    if let Some(mut treasury) = ctx.db.player_resources().owner().find(&owner) {
        let from_treasury = remaining.min(treasury.timber);
        treasury.timber -= from_treasury;
        remaining -= from_treasury;
        ctx.db.player_resources().owner().update(treasury);
    }
    if remaining <= 1e-6 {
        return Ok(());
    }
    for building in ctx.db.building().owner().filter(&owner) {
        if remaining <= 1e-6 {
            break;
        }
        let withdraw = remaining.min(building.timber);
        if withdraw <= 0.0 {
            continue;
        }
        ctx.db.building().id().update(Building {
            timber: building.timber - withdraw,
            ..building
        });
        remaining -= withdraw;
    }
    if remaining > 1e-6 {
        return Err(format!(
            "Not enough timber (need {} more).",
            remaining.round() as i64
        ));
    }
    Ok(())
}

pub fn spend_aggregate_stone(ctx: &ReducerContext, owner: spacetimedb::Identity, amount: f64) -> Result<(), String> {
    if amount <= 0.0 {
        return Ok(());
    }
    let mut remaining = amount;
    if let Some(mut treasury) = ctx.db.player_resources().owner().find(&owner) {
        let from_treasury = remaining.min(treasury.stone);
        treasury.stone -= from_treasury;
        remaining -= from_treasury;
        ctx.db.player_resources().owner().update(treasury);
    }
    if remaining <= 1e-6 {
        return Ok(());
    }
    for building in ctx.db.building().owner().filter(&owner) {
        if remaining <= 1e-6 {
            break;
        }
        let withdraw = remaining.min(building.stone);
        if withdraw <= 0.0 {
            continue;
        }
        ctx.db.building().id().update(Building {
            stone: building.stone - withdraw,
            ..building
        });
        remaining -= withdraw;
    }
    if remaining > 1e-6 {
        return Err(format!(
            "Not enough stone (need {} more).",
            remaining.round() as i64
        ));
    }
    Ok(())
}

pub fn credit_treasury_timber(ctx: &ReducerContext, owner: spacetimedb::Identity, amount: f64) {
    if amount <= 0.0 {
        return;
    }
    if let Some(mut treasury) = ctx.db.player_resources().owner().find(&owner) {
        treasury.timber += amount;
        ctx.db.player_resources().owner().update(treasury);
    }
}

pub fn credit_treasury_stone(ctx: &ReducerContext, owner: spacetimedb::Identity, amount: f64) {
    if amount <= 0.0 {
        return;
    }
    if let Some(mut treasury) = ctx.db.player_resources().owner().find(&owner) {
        treasury.stone += amount;
        ctx.db.player_resources().owner().update(treasury);
    }
}

fn treasury_timber(ctx: &ReducerContext, owner: spacetimedb::Identity) -> f64 {
    ctx.db
        .player_resources()
        .owner()
        .find(&owner)
        .map(|row| row.timber)
        .unwrap_or(0.0)
}

fn treasury_stone(ctx: &ReducerContext, owner: spacetimedb::Identity) -> f64 {
    ctx.db
        .player_resources()
        .owner()
        .find(&owner)
        .map(|row| row.stone)
        .unwrap_or(0.0)
}

fn treasury_firewood(ctx: &ReducerContext, owner: spacetimedb::Identity) -> f64 {
    ctx.db
        .player_resources()
        .owner()
        .find(&owner)
        .map(|row| row.firewood)
        .unwrap_or(0.0)
}

fn building_sum<F>(ctx: &ReducerContext, owner: spacetimedb::Identity, pick: F) -> f64
where
    F: Fn(&Building) -> f64,
{
    ctx.db
        .building()
        .owner()
        .filter(&owner)
        .map(|building| pick(&building))
        .sum()
}

fn residence_firewood_sum(ctx: &ReducerContext, owner: spacetimedb::Identity) -> f64 {
    ctx.db
        .residence()
        .owner()
        .filter(&owner)
        .map(|residence| residence.firewood_stock)
        .sum()
}
