use spacetimedb::ReducerContext;

use crate::constants::RESIDENCE_RECOVERY_FIREWOOD_MIN;
use crate::db::*;
use crate::simulation::road_logistics::{claim_residences_for_lodges, owner_lodges};
use crate::simulation::tick_context::SimTickContext;
use crate::tables::Residence;

pub fn step_residence_recovery(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    residence: Residence,
) {
    if !residence.abandoned {
        return;
    }
    if residence.firewood_stock + 1e-9 < RESIDENCE_RECOVERY_FIREWOOD_MIN {
        return;
    }

    let Some(network) = tick.road_network(residence.owner) else {
        return;
    };

    let lodges = owner_lodges(ctx, residence.owner);
    let claims = claim_residences_for_lodges(network, &lodges, std::slice::from_ref(&residence));
    if !claims.contains_key(&residence.id) {
        return;
    }

    ctx.db.residence().id().update(Residence {
        abandoned: false,
        needs_deficit_ticks: 0,
        settlement_ticks: 0,
        population: 0,
        ..residence
    });
}
