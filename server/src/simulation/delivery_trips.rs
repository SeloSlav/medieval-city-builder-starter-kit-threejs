//! Authoritative road delivery agents — cargo unloads when the agent reaches the residence.

use spacetimedb::ReducerContext;

use crate::constants::TICK_DT;
use crate::db::*;
use crate::simulation::delivery_cargo::{
    building_delivery_stock, credit_undeposited_delivery_cargo, deposit_delivery_cargo,
    pick_delivery_target, residence_delivery_room, withdraw_delivery_cargo, DeliveryCargoTotals,
};
use crate::roads::{RoadNetwork, RoadPathRoute};
use crate::simulation::game_calendar::GameClock;
use crate::simulation::labor_and_logistics_paused;
use crate::simulation::residence_needs::{
    apply_need_delivery, ResidenceNeedKind,
};
use crate::simulation::tick_context::SimTickContext;
use crate::tables::{Building, DeliveryTrip, Residence};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DeliveryTripPhase {
    Outbound = 0,
    Unloading = 1,
    Inbound = 2,
}

impl DeliveryTripPhase {
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(Self::Outbound),
            1 => Some(Self::Unloading),
            2 => Some(Self::Inbound),
            _ => None,
        }
    }

    pub fn as_u8(self) -> u8 {
        self as u8
    }
}

pub fn step_delivery_trips(ctx: &ReducerContext, tick: &SimTickContext, clock: &GameClock) {
    let trips: Vec<DeliveryTrip> = ctx.db.delivery_trip().iter().collect();
    for trip in trips {
        step_one_trip(ctx, tick, clock, trip);
    }
}

pub fn building_has_active_trip(ctx: &ReducerContext, building_id: u64) -> bool {
    ctx.db
        .delivery_trip()
        .building_id()
        .filter(&building_id)
        .next()
        .is_some()
}

/// Delete trips and return cart cargo totals without touching the building.
pub fn drain_trips_for_building(ctx: &ReducerContext, building_id: u64) -> DeliveryCargoTotals {
    let trips: Vec<DeliveryTrip> = ctx
        .db
        .delivery_trip()
        .building_id()
        .filter(&building_id)
        .collect();
    let mut totals = DeliveryCargoTotals::default();
    for trip in trips {
        if let Some(kind) = ResidenceNeedKind::from_u8(trip.cargo_kind) {
            totals.add(kind, trip.amount);
        }
        ctx.db.delivery_trip().id().delete(trip.id);
    }
    totals
}

pub fn cancel_trips_for_residence(ctx: &ReducerContext, residence_id: u64) {
    let trips: Vec<DeliveryTrip> = ctx
        .db
        .delivery_trip()
        .residence_id()
        .filter(&residence_id)
        .collect();
    for trip in trips {
        return_trip_cargo_to_building(ctx, &trip);
        ctx.db.delivery_trip().id().delete(trip.id);
    }
}

pub fn try_start_delivery_trip(
    ctx: &ReducerContext,
    clock: &GameClock,
    network: &RoadNetwork,
    building: &mut Building,
    delivery_workers: u32,
    targets: &[Residence],
    need_kind: ResidenceNeedKind,
    speed_mps: f64,
    unload_seconds: f64,
    per_delivery_amount: f64,
) -> bool {
    if delivery_workers == 0 || building_has_active_trip(ctx, building.id) {
        return false;
    }

    if labor_and_logistics_paused(ctx, building.owner, clock) {
        return false;
    }

    let available = building_delivery_stock(building, need_kind);
    if available <= 1e-6 {
        return false;
    }

    let batch = per_delivery_amount * delivery_workers as f64;
    let Some((residence_id, residence_x, residence_z, load_amount)) =
        pick_delivery_target(ctx, available, batch, targets, need_kind)
    else {
        return false;
    };

    let Some(route) = network.road_path_route(building.x, building.z, residence_x, residence_z) else {
        return false;
    };
    if route.distance <= 1e-6 {
        return false;
    }

    let withdrawn = withdraw_delivery_cargo(building, need_kind, load_amount);
    if withdrawn <= 1e-6 {
        return false;
    }

    let (start_x, start_z) = RoadNetwork::sample_polyline_xz(&route.polyline, 0.0);

    ctx.db.delivery_trip().insert(DeliveryTrip {
        id: 0,
        owner: building.owner,
        building_id: building.id,
        residence_id,
        cargo_kind: need_kind.as_u8(),
        amount: withdrawn,
        phase: DeliveryTripPhase::Outbound.as_u8(),
        x: start_x,
        z: start_z,
        progress: 0.0,
        speed_mps,
        unload_seconds,
        unload_remaining: 0.0,
        delivery_workers,
    });

    true
}

fn step_one_trip(ctx: &ReducerContext, tick: &SimTickContext, clock: &GameClock, mut trip: DeliveryTrip) {
    if labor_and_logistics_paused(ctx, trip.owner, clock) {
        return;
    }

    let Some(network) = tick.road_network(trip.owner) else {
        return_trip_cargo_to_building(ctx, &trip);
        ctx.db.delivery_trip().id().delete(trip.id);
        return;
    };

    let Some(route) = trip_route(ctx, &network, &trip) else {
        return_trip_cargo_to_building(ctx, &trip);
        ctx.db.delivery_trip().id().delete(trip.id);
        return;
    };

    let path_distance = route.distance;
    trip.progress = trip.progress.min(path_distance);

    let workers = trip.delivery_workers.max(1) as f64;
    let travel_speed = trip.speed_mps * workers;

    let Some(phase) = DeliveryTripPhase::from_u8(trip.phase) else {
        return_trip_cargo_to_building(ctx, &trip);
        ctx.db.delivery_trip().id().delete(trip.id);
        return;
    };

    match phase {
        DeliveryTripPhase::Outbound => {
            trip.progress += travel_speed * TICK_DT;
            if trip.progress >= path_distance {
                trip.progress = path_distance;
                trip.phase = DeliveryTripPhase::Unloading.as_u8();
                trip.unload_remaining = trip.unload_seconds / workers;
            }
            let (x, z) = RoadNetwork::sample_polyline_xz(&route.polyline, trip.progress);
            trip.x = x;
            trip.z = z;
            ctx.db.delivery_trip().id().update(trip);
        }
        DeliveryTripPhase::Unloading => {
            trip.unload_remaining = (trip.unload_remaining - TICK_DT).max(0.0);
            let (x, z) = RoadNetwork::sample_polyline_xz(&route.polyline, path_distance);
            trip.x = x;
            trip.z = z;

            if trip.unload_remaining <= 0.0 {
                trip = complete_unload(ctx, trip);
                trip.phase = DeliveryTripPhase::Inbound.as_u8();
                trip.progress = 0.0;
            }
            ctx.db.delivery_trip().id().update(trip);
        }
        DeliveryTripPhase::Inbound => {
            trip.progress += travel_speed * TICK_DT;
            if trip.progress >= path_distance {
                finish_inbound_trip(ctx, trip);
                return;
            }
            let (x, z) = RoadNetwork::sample_polyline_inbound_xz(&route.polyline, trip.progress);
            trip.x = x;
            trip.z = z;
            ctx.db.delivery_trip().id().update(trip);
        }
    }
}

fn trip_route(
    ctx: &ReducerContext,
    network: &RoadNetwork,
    trip: &DeliveryTrip,
) -> Option<RoadPathRoute> {
    let building = ctx.db.building().id().find(&trip.building_id)?;
    let residence = ctx.db.residence().id().find(&trip.residence_id)?;
    network.road_path_route(building.x, building.z, residence.x, residence.z)
}

fn complete_unload(ctx: &ReducerContext, mut trip: DeliveryTrip) -> DeliveryTrip {
    let Some(need_kind) = ResidenceNeedKind::from_u8(trip.cargo_kind) else {
        return trip;
    };

    let room = residence_delivery_room(ctx, trip.residence_id, need_kind);
    let delivered = trip.amount.min(room);
    if delivered > 1e-6 {
        apply_need_delivery(ctx, trip.residence_id, need_kind, delivered);
        trip.amount = (trip.amount - delivered).max(0.0);
    }
    trip
}

fn finish_inbound_trip(ctx: &ReducerContext, trip: DeliveryTrip) {
    return_trip_cargo_to_building(ctx, &trip);
    ctx.db.delivery_trip().id().delete(trip.id);
}

fn return_trip_cargo_to_building(ctx: &ReducerContext, trip: &DeliveryTrip) {
    if trip.amount <= 1e-6 {
        return;
    }
    let Some(mut building) = ctx.db.building().id().find(&trip.building_id) else {
        return;
    };
    let Some(need_kind) = ResidenceNeedKind::from_u8(trip.cargo_kind) else {
        return;
    };
    let deposited = deposit_delivery_cargo(&mut building, need_kind, trip.amount);
    let remainder = (trip.amount - deposited).max(0.0);
    if remainder > 1e-6 {
        credit_undeposited_delivery_cargo(ctx, building.owner, need_kind, remainder);
    }
    ctx.db.building().id().update(building);
}
