use spacetimedb::ReducerContext;

use crate::building_defs::building_def;
use crate::constants::{
    RESIDENCE_WATER_PER_PERSON_PER_SEC, TICK_DT, WELL_BASE_REFILL_PER_SEC,
    WELL_SURGE_AMOUNT_MAX, WELL_SURGE_AMOUNT_MIN, WELL_SURGE_CHANCE_PER_TICK,
    WELL_SURGE_COOLDOWN_SEC,
};
use crate::db::*;
use crate::hydrology::sample_hydrology_score;
use crate::simulation::residence_needs::{
    apply_need_delivery, load_needs, need_stock, ResidenceNeedKind,
};
use crate::simulation::residence_needs::water;
use crate::tables::{Building, Residence};

pub fn step_well(ctx: &ReducerContext, sim_tick: u64, building: Building) {
    let Some(def) = building_def(&building.kind) else {
        return;
    };

    let hydrology = sample_hydrology_score(building.x, building.z);
    let mut well = building;
    let capacity = if well.water_capacity > 0.0 {
        well.water_capacity
    } else {
        crate::hydrology::well_capacity_from_hydrology(def.storage_water, hydrology)
    };

    well.water_capacity = capacity;
    well.water = (well.water + WELL_BASE_REFILL_PER_SEC * hydrology * TICK_DT).min(capacity);
    well.delivery_cooldown = (well.delivery_cooldown - TICK_DT).max(0.0);

    if well.delivery_cooldown <= 0.0 && should_surge(well.id, sim_tick, hydrology) {
        let surge = lerp(WELL_SURGE_AMOUNT_MIN, WELL_SURGE_AMOUNT_MAX, hydrology);
        well.water = (well.water + surge).min(capacity);
        well.delivery_cooldown = WELL_SURGE_COOLDOWN_SEC;
    }

    if well.work_radius > 0.0 && well.water > 0.0 {
        deliver_to_residences(ctx, &mut well);
    }

    ctx.db.building().id().update(well);
}

pub fn residence_has_well_supply(ctx: &ReducerContext, owner: spacetimedb::Identity, residence: &Residence) -> bool {
    let radius_sq = |radius: f64| radius * radius;
    for building in ctx.db.building().owner().filter(&owner) {
        if building.kind != "well" || building.work_radius <= 0.0 {
            continue;
        }
        let dx = building.x - residence.x;
        let dz = building.z - residence.z;
        if dx * dx + dz * dz <= radius_sq(building.work_radius) {
            return true;
        }
    }
    false
}

fn deliver_to_residences(ctx: &ReducerContext, well: &mut Building) {
    let radius_sq = well.work_radius * well.work_radius;
    let mut targets: Vec<(Residence, f64)> = Vec::new();

    for residence in ctx.db.residence().owner().filter(&well.owner) {
        if residence.abandoned || residence.population == 0 {
            continue;
        }
        let dx = residence.x - well.x;
        let dz = residence.z - well.z;
        if dx * dx + dz * dz > radius_sq {
            continue;
        }

        let needs = load_needs(ctx, residence.id);
        let stock = need_stock(&needs, ResidenceNeedKind::Water);
        if !water::has_stock_room(stock) {
            continue;
        }

        let demand = residence.population as f64 * RESIDENCE_WATER_PER_PERSON_PER_SEC * TICK_DT;
        if demand <= 1e-9 {
            continue;
        }

        let distance = (dx * dx + dz * dz).sqrt();
        targets.push((residence, distance));
    }

    targets.sort_by(|(left, left_distance), (right, right_distance)| {
        left_distance
            .partial_cmp(right_distance)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| left.id.cmp(&right.id))
    });

    for (residence, _) in targets {
        if well.water <= 1e-9 {
            break;
        }

        let needs = load_needs(ctx, residence.id);
        let stock = need_stock(&needs, ResidenceNeedKind::Water);
        if !water::has_stock_room(stock) {
            continue;
        }

        let demand = residence.population as f64 * RESIDENCE_WATER_PER_PERSON_PER_SEC * TICK_DT;
        let room = water::stock_capacity() - stock;
        let deliver = demand.min(room).min(well.water);
        if deliver <= 1e-9 {
            continue;
        }

        apply_need_delivery(ctx, residence.id, ResidenceNeedKind::Water, deliver);
        well.water -= deliver;
    }
}

fn should_surge(building_id: u64, sim_tick: u64, hydrology: f64) -> bool {
    if hydrology <= 0.05 {
        return false;
    }
    let hash = building_id
        .wrapping_mul(0x9E37_79B9_7F4A_7C15)
        .wrapping_add(sim_tick.wrapping_mul(0x517c_c1b7_2722_0a95));
    let roll = (hash % 10_000) as f64 / 10_000.0;
    roll < WELL_SURGE_CHANCE_PER_TICK * hydrology
}

fn lerp(min: f64, max: f64, t: f64) -> f64 {
    min + (max - min) * t.clamp(0.0, 1.0)
}
