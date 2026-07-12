//! Authoritative road delivery agents — cargo unloads when the agent reaches the destination.

use spacetimedb::ReducerContext;

use crate::constants::TICK_DT;
use crate::db::*;
use crate::economy::{building_storage_caps, credit_treasury_timber, deposit_building, withdraw_building};
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

pub const DELIVERY_DESTINATION_RESIDENCE: u8 = 0;
pub const DELIVERY_DESTINATION_BUILDING: u8 = 1;
pub const CARGO_KIND_TIMBER: u8 = 3;

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

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum TripCargoKind {
    ResidenceNeed(ResidenceNeedKind),
    Timber,
}

impl TripCargoKind {
    fn from_trip(trip: &DeliveryTrip) -> Option<Self> {
        if trip.cargo_kind == CARGO_KIND_TIMBER {
            return Some(Self::Timber);
        }
        ResidenceNeedKind::from_u8(trip.cargo_kind).map(Self::ResidenceNeed)
    }
}

#[derive(Clone, Copy, Debug)]
enum TripDestination {
    Residence { id: u64, x: f64, z: f64 },
    Building { id: u64, x: f64, z: f64 },
}

impl TripDestination {
    fn to_row_fields(self) -> (u8, u64, u64) {
        match self {
            Self::Residence { id, .. } => (DELIVERY_DESTINATION_RESIDENCE, id, 0),
            Self::Building { id, .. } => (DELIVERY_DESTINATION_BUILDING, 0, id),
        }
    }

    fn end_point(self) -> (f64, f64) {
        match self {
            Self::Residence { x, z, .. } | Self::Building { x, z, .. } => (x, z),
        }
    }
}

struct StartTripSpec {
    origin: Building,
    destination: TripDestination,
    cargo_kind: u8,
    delivery_workers: u32,
    speed_mps: f64,
    unload_seconds: f64,
    load_amount: f64,
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

pub fn building_has_inbound_supply_trip(ctx: &ReducerContext, building_id: u64) -> bool {
    ctx.db
        .delivery_trip()
        .target_building_id()
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
        if trip.cargo_kind == CARGO_KIND_TIMBER {
            return_timber_cargo_to_building(ctx, trip.building_id, trip.amount);
        } else if let Some(kind) = ResidenceNeedKind::from_u8(trip.cargo_kind) {
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

    try_start_road_trip(
        ctx,
        clock,
        network,
        StartTripSpec {
            origin: building.clone(),
            destination: TripDestination::Residence {
                id: residence_id,
                x: residence_x,
                z: residence_z,
            },
            cargo_kind: need_kind.as_u8(),
            delivery_workers,
            speed_mps,
            unload_seconds,
            load_amount,
        },
        |origin, amount| withdraw_delivery_cargo(origin, need_kind, amount),
        |origin| *building = origin.clone(),
    )
}

pub fn try_start_timber_supply_trip(
    ctx: &ReducerContext,
    clock: &GameClock,
    network: &RoadNetwork,
    mill: &mut Building,
    lodge: &Building,
    delivery_workers: u32,
    speed_mps: f64,
    unload_seconds: f64,
    per_delivery_amount: f64,
    needed: f64,
) -> bool {
    if delivery_workers == 0 || building_has_active_trip(ctx, mill.id) {
        return false;
    }

    if labor_and_logistics_paused(ctx, mill.owner, clock) {
        return false;
    }

    if mill.timber <= 1e-6 {
        return false;
    }

    let caps = building_storage_caps(&lodge.kind);
    let lodge_room = (caps.timber - lodge.timber).max(0.0);
    if lodge_room <= 1e-6 {
        return false;
    }

    let batch = per_delivery_amount * delivery_workers as f64;
    let load = mill.timber.min(lodge_room).min(batch).min(needed);
    if load <= 1e-6 {
        return false;
    }

    try_start_road_trip(
        ctx,
        clock,
        network,
        StartTripSpec {
            origin: mill.clone(),
            destination: TripDestination::Building {
                id: lodge.id,
                x: lodge.x,
                z: lodge.z,
            },
            cargo_kind: CARGO_KIND_TIMBER,
            delivery_workers,
            speed_mps,
            unload_seconds,
            load_amount: load,
        },
        |origin, amount| {
            let (withdrawn, _, _, updated) = withdraw_building(origin, amount, 0.0, 0.0);
            *origin = updated;
            withdrawn
        },
        |origin| *mill = origin.clone(),
    )
}

fn try_start_road_trip(
    ctx: &ReducerContext,
    clock: &GameClock,
    network: &RoadNetwork,
    spec: StartTripSpec,
    withdraw: impl FnOnce(&mut Building, f64) -> f64,
    write_origin: impl FnOnce(&Building),
) -> bool {
    if labor_and_logistics_paused(ctx, spec.origin.owner, clock) {
        return false;
    }

    let (dest_x, dest_z) = spec.destination.end_point();
    let Some(route) = network.road_path_route(spec.origin.x, spec.origin.z, dest_x, dest_z) else {
        return false;
    };
    if route.distance <= 1e-6 {
        return false;
    }

    let mut origin = spec.origin;
    let withdrawn = withdraw(&mut origin, spec.load_amount);
    if withdrawn <= 1e-6 {
        return false;
    }
    write_origin(&origin);

    let (destination_kind, residence_id, target_building_id) = spec.destination.to_row_fields();
    let (start_x, start_z) = RoadNetwork::sample_polyline_xz(&route.polyline, 0.0);

    ctx.db.delivery_trip().insert(DeliveryTrip {
        id: 0,
        owner: origin.owner,
        building_id: origin.id,
        residence_id,
        destination_kind,
        target_building_id,
        cargo_kind: spec.cargo_kind,
        amount: withdrawn,
        phase: DeliveryTripPhase::Outbound.as_u8(),
        x: start_x,
        z: start_z,
        progress: 0.0,
        speed_mps: spec.speed_mps,
        unload_seconds: spec.unload_seconds,
        unload_remaining: 0.0,
        delivery_workers: spec.delivery_workers,
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
                complete_unload(ctx, &mut trip);
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
    match trip.destination_kind {
        DELIVERY_DESTINATION_BUILDING => {
            let target = ctx.db.building().id().find(&trip.target_building_id)?;
            network.road_path_route(building.x, building.z, target.x, target.z)
        }
        _ => {
            let residence = ctx.db.residence().id().find(&trip.residence_id)?;
            network.road_path_route(building.x, building.z, residence.x, residence.z)
        }
    }
}

fn complete_unload(ctx: &ReducerContext, trip: &mut DeliveryTrip) {
    match TripCargoKind::from_trip(trip) {
        Some(TripCargoKind::Timber) => unload_timber_to_lodge(ctx, trip),
        Some(TripCargoKind::ResidenceNeed(need_kind)) => {
            unload_need_to_residence(ctx, trip, need_kind);
        }
        None => {}
    }
}

fn unload_timber_to_lodge(ctx: &ReducerContext, trip: &mut DeliveryTrip) {
    let Some(mut lodge) = ctx.db.building().id().find(&trip.target_building_id) else {
        return;
    };
    let caps = building_storage_caps(&lodge.kind);
    let (_, timber_added, _, updated) = deposit_building(&mut lodge, caps, trip.amount, 0.0, 0.0);
    if timber_added > 1e-6 {
        trip.amount = (trip.amount - timber_added).max(0.0);
        ctx.db.building().id().update(updated);
    }
}

fn unload_need_to_residence(
    ctx: &ReducerContext,
    trip: &mut DeliveryTrip,
    need_kind: ResidenceNeedKind,
) {
    let room = residence_delivery_room(ctx, trip.residence_id, need_kind);
    let delivered = trip.amount.min(room);
    if delivered > 1e-6 {
        apply_need_delivery(ctx, trip.residence_id, need_kind, delivered);
        trip.amount = (trip.amount - delivered).max(0.0);
    }
}

fn finish_inbound_trip(ctx: &ReducerContext, trip: DeliveryTrip) {
    return_trip_cargo_to_building(ctx, &trip);
    ctx.db.delivery_trip().id().delete(trip.id);
}

fn return_trip_cargo_to_building(ctx: &ReducerContext, trip: &DeliveryTrip) {
    if trip.amount <= 1e-6 {
        return;
    }
    match TripCargoKind::from_trip(trip) {
        Some(TripCargoKind::Timber) => return_timber_cargo_to_building(ctx, trip.building_id, trip.amount),
        Some(TripCargoKind::ResidenceNeed(need_kind)) => {
            return_need_cargo_to_building(ctx, trip.building_id, need_kind, trip.amount)
        }
        None => {}
    }
}

fn return_need_cargo_to_building(
    ctx: &ReducerContext,
    building_id: u64,
    need_kind: ResidenceNeedKind,
    amount: f64,
) {
    let Some(mut building) = ctx.db.building().id().find(&building_id) else {
        return;
    };
    let deposited = deposit_delivery_cargo(&mut building, need_kind, amount);
    let remainder = (amount - deposited).max(0.0);
    if remainder > 1e-6 {
        credit_undeposited_delivery_cargo(ctx, building.owner, need_kind, remainder);
    }
    ctx.db.building().id().update(building);
}

fn return_timber_cargo_to_building(ctx: &ReducerContext, building_id: u64, amount: f64) {
    if amount <= 1e-6 {
        return;
    }
    let Some(mut building) = ctx.db.building().id().find(&building_id) else {
        return;
    };
    let caps = building_storage_caps(&building.kind);
    let (_, timber_added, _, updated) = deposit_building(&mut building, caps, amount, 0.0, 0.0);
    let remainder = (amount - timber_added).max(0.0);
    if remainder > 1e-6 {
        credit_treasury_timber(ctx, building.owner, remainder);
    }
    ctx.db.building().id().update(updated);
}
