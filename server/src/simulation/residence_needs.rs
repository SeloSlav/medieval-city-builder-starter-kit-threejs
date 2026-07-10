use spacetimedb::ReducerContext;

use crate::constants::{ABANDON_AFTER_DEFICIT_TICKS, RESIDENCE_FIREWOOD_PER_PERSON_PER_SEC, TICK_DT};
use crate::db::*;
use crate::tables::Residence;

pub fn step_residence_needs(ctx: &ReducerContext, residence: Residence) {
    if residence.abandoned || residence.population == 0 {
        return;
    }

    let demand = residence.population as f64 * RESIDENCE_FIREWOOD_PER_PERSON_PER_SEC * TICK_DT;
    if demand <= 1e-9 {
        return;
    }

    if residence.firewood_stock + 1e-9 >= demand {
        ctx.db.residence().id().update(Residence {
            firewood_stock: residence.firewood_stock - demand,
            needs_deficit_ticks: 0,
            ..residence
        });
        return;
    }

    let next_deficit = residence.needs_deficit_ticks.saturating_add(1);
    let abandoned = next_deficit >= ABANDON_AFTER_DEFICIT_TICKS;
    ctx.db.residence().id().update(Residence {
        firewood_stock: 0.0,
        needs_deficit_ticks: next_deficit,
        abandoned,
        population: if abandoned { 0 } else { residence.population },
        ..residence
    });
}
