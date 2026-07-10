use spacetimedb::{reducer, ReducerContext};

use crate::burgage::{compute_burgage_layout, ZoneCorners};
use crate::db::*;
use crate::economy::{residence_zone_cost, spend};
use crate::lifecycle::ensure_player_resources;
use crate::tables::{BurgageZone, PlayerResources, Residence};

fn player_resources_amount(resources: &PlayerResources) -> crate::economy::ResourceAmount {
    crate::economy::ResourceAmount {
        wood: resources.wood,
        stone: resources.stone,
    }
}

fn update_player_resources(
    ctx: &ReducerContext,
    owner: spacetimedb::Identity,
    amount: crate::economy::ResourceAmount,
) {
    if let Some(existing) = ctx.db.player_resources().owner().find(&owner) {
        ctx.db.player_resources().owner().update(PlayerResources {
            wood: amount.wood,
            stone: amount.stone,
            ..existing
        });
    }
}

#[reducer]
pub fn place_burgage_zone(
    ctx: &ReducerContext,
    corner_ax: f64,
    corner_az: f64,
    corner_bx: f64,
    corner_bz: f64,
    corner_cx: f64,
    corner_cz: f64,
    corner_dx: f64,
    corner_dz: f64,
    frontage_edge: u8,
    plot_count: u32,
) -> Result<(), String> {
    let owner = ctx.sender();
    ensure_player_resources(ctx, owner);

    let layout = compute_burgage_layout(
        &ZoneCorners {
            a: crate::burgage::Point2 {
                x: corner_ax,
                z: corner_az,
            },
            b: crate::burgage::Point2 {
                x: corner_bx,
                z: corner_bz,
            },
            c: crate::burgage::Point2 {
                x: corner_cx,
                z: corner_cz,
            },
            d: crate::burgage::Point2 {
                x: corner_dx,
                z: corner_dz,
            },
        },
        frontage_edge,
        plot_count,
    )
    .ok_or_else(|| "Could not fit residences in this zone.".to_string())?;

    let cost = residence_zone_cost(layout.plot_count);
    let resources = ctx
        .db
        .player_resources()
        .owner()
        .find(&owner)
        .ok_or_else(|| "Player resources not found.".to_string())?;
    let mut amount = player_resources_amount(&resources);
    spend(&mut amount, &cost)?;
    update_player_resources(ctx, owner, amount);

    ctx.db.burgage_zone().insert(BurgageZone {
        id: 0,
        owner,
        corner_ax,
        corner_az,
        corner_bx,
        corner_bz,
        corner_cx,
        corner_cz,
        corner_dx,
        corner_dz,
        frontage_edge,
        plot_count: layout.plot_count,
    });

    let zone_id = ctx
        .db
        .burgage_zone()
        .iter()
        .map(|zone| zone.id)
        .max()
        .ok_or_else(|| "Failed to resolve residence zone id.".to_string())?;

    for residence in layout.residences {
        ctx.db.residence().insert(Residence {
            id: 0,
            zone_id,
            owner,
            parcel_index: residence.parcel_index,
            x: residence.x,
            z: residence.z,
            yaw: residence.yaw,
        });
    }

    Ok(())
}

#[reducer]
pub fn demolish_burgage_zone(ctx: &ReducerContext, zone_id: u64) -> Result<(), String> {
    let owner = ctx.sender();
    let zone = ctx
        .db
        .burgage_zone()
        .id()
        .find(&zone_id)
        .ok_or_else(|| "Residence zone not found.".to_string())?;

    if zone.owner != owner {
        return Err("You do not own this residence zone.".to_string());
    }

    let residence_count = ctx
        .db
        .residence()
        .zone_id()
        .filter(&zone_id)
        .count() as u32;
    let refund = residence_zone_cost(residence_count);
    let salvage = crate::economy::ResourceAmount {
        wood: (refund.wood * crate::economy::WOOD_SALVAGE_FRACTION).round(),
        stone: (refund.stone * crate::economy::STONE_SALVAGE_FRACTION).round(),
    };

    if let Some(resources) = ctx.db.player_resources().owner().find(&owner) {
        let mut amount = player_resources_amount(&resources);
        crate::economy::credit(&mut amount, &salvage);
        update_player_resources(ctx, owner, amount);
    }

    for residence in ctx.db.residence().zone_id().filter(&zone_id) {
        ctx.db.residence().id().delete(residence.id);
    }
    ctx.db.burgage_zone().id().delete(zone_id);
    Ok(())
}
