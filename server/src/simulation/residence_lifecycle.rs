use spacetimedb::ReducerContext;

use crate::db::*;
use crate::simulation::game_calendar::GameClock;
use crate::simulation::landmark_access::residence_has_chapel_access;
use crate::simulation::residence_needs::{step_residence_needs, step_residence_recovery};
use crate::simulation::residence_settlement::step_residence_settlement;
use crate::simulation::tick_context::SimTickContext;
use crate::tables::{Building, Residence};

pub fn step_residence(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    chapels: &[Building],
    residence: Residence,
    clock: &GameClock,
) {
    let residence_id = residence.id;
    let has_chapel_access =
        residence_has_chapel_access(tick, residence.owner, &residence, chapels);

    step_residence_recovery(ctx, tick, residence, has_chapel_access);

    let Some(residence) = ctx.db.residence().id().find(&residence_id) else {
        return;
    };

    step_residence_settlement(ctx, residence, has_chapel_access);

    let Some(residence) = ctx.db.residence().id().find(&residence_id) else {
        return;
    };

    step_residence_needs(ctx, residence, has_chapel_access, clock);
}
