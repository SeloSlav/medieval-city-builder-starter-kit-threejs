use spacetimedb::ReducerContext;

use crate::building_defs::building_def;
use crate::constants::RESIDENCE_FIREWOOD_CAPACITY;
use crate::constants::RESIDENCE_WATER_CAPACITY;
use crate::db::*;
use crate::tables::Building;

#[derive(Clone, Copy, Debug, Default)]
pub struct StorageCaps {
    pub timber: f64,
    pub firewood: f64,
    pub stone: f64,
}

pub fn building_storage_caps(kind: &str) -> StorageCaps {
    let Some(def) = building_def(kind) else {
        return StorageCaps::default();
    };
    StorageCaps {
        timber: def.storage_timber,
        firewood: def.storage_firewood,
        stone: def.storage_stone,
    }
}

pub fn residence_firewood_capacity() -> f64 {
    RESIDENCE_FIREWOOD_CAPACITY
}

pub fn residence_water_capacity() -> f64 {
    RESIDENCE_WATER_CAPACITY
}

pub fn total_timber(ctx: &ReducerContext, owner: spacetimedb::Identity) -> f64 {
    treasury_timber(ctx, owner)
        + building_sum(ctx, owner, |building| building.timber)
}

pub fn total_stone(ctx: &ReducerContext, owner: spacetimedb::Identity) -> f64 {
    treasury_stone(ctx, owner) + building_sum(ctx, owner, |building| building.stone)
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

enum AggregateSpendField {
    Timber,
    Stone,
}

fn spend_aggregate(
    ctx: &ReducerContext,
    owner: spacetimedb::Identity,
    amount: f64,
    field: AggregateSpendField,
) -> Result<(), String> {
    if amount <= 0.0 {
        return Ok(());
    }

    let resource_name = match field {
        AggregateSpendField::Timber => "timber",
        AggregateSpendField::Stone => "stone",
    };

    let mut remaining = amount;
    if let Some(mut treasury) = ctx.db.player_resources().owner().find(&owner) {
        let from_treasury = match field {
            AggregateSpendField::Timber => {
                let withdraw = remaining.min(treasury.timber);
                treasury.timber -= withdraw;
                withdraw
            }
            AggregateSpendField::Stone => {
                let withdraw = remaining.min(treasury.stone);
                treasury.stone -= withdraw;
                withdraw
            }
        };
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
        let available = match field {
            AggregateSpendField::Timber => building.timber,
            AggregateSpendField::Stone => building.stone,
        };
        let withdraw = remaining.min(available);
        if withdraw <= 0.0 {
            continue;
        }
        let updated = match field {
            AggregateSpendField::Timber => Building {
                timber: building.timber - withdraw,
                ..building
            },
            AggregateSpendField::Stone => Building {
                stone: building.stone - withdraw,
                ..building
            },
        };
        ctx.db.building().id().update(updated);
        remaining -= withdraw;
    }

    if remaining > 1e-6 {
        return Err(format!(
            "Not enough {resource_name} (need {} more).",
            remaining.round() as i64
        ));
    }

    Ok(())
}

pub fn spend_aggregate_timber(ctx: &ReducerContext, owner: spacetimedb::Identity, amount: f64) -> Result<(), String> {
    spend_aggregate(ctx, owner, amount, AggregateSpendField::Timber)
}

pub fn spend_aggregate_stone(ctx: &ReducerContext, owner: spacetimedb::Identity, amount: f64) -> Result<(), String> {
    spend_aggregate(ctx, owner, amount, AggregateSpendField::Stone)
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
