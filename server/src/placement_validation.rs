use spacetimedb::ReducerContext;
use spacetimedb::Identity;

use crate::burgage::{zone_corners_polygon, zone_overlaps_footprint, Point2, ZoneCorners};
use crate::building_defs::building_def;
use crate::db::*;
use crate::hydrology::sample_hydrology_score;
use crate::roads::load_owner_road_network;

const LARGE_QUARRY_PIT_RADIUS: f64 = 58.0;
const SMALL_QUARRY_PIT_RADIUS: f64 = 30.0;
const FOOTPRINT_SAMPLE_FRACTIONS: [f64; 3] = [0.0, 0.55, 0.82];
const OPEN_WATER_THRESHOLD: f64 = 0.999;
const MAX_ROAD_FRONTAGE_DISTANCE: f64 = 16.0;

struct BuildingPadParams {
    radius_x: f64,
    radius_z: f64,
    inner_fade: f64,
}

pub fn building_pick_radius(kind: &str) -> Option<f64> {
    building_def(kind).map(|def| def.pick_radius)
}

pub fn is_open_water(x: f64, z: f64) -> bool {
    sample_hydrology_score(x, z) >= OPEN_WATER_THRESHOLD
}

pub fn is_near_open_water(x: f64, z: f64, max_distance: f64) -> bool {
    for ring in [0.45, 0.72, 1.0] {
        let radius = max_distance * ring;
        for index in 0..16 {
            let angle = index as f64 / 16.0 * std::f64::consts::TAU;
            if is_open_water(x + angle.cos() * radius, z + angle.sin() * radius) {
                return true;
            }
        }
    }
    false
}

pub fn burgage_zone_on_water(corners: &ZoneCorners) -> bool {
    for corner in zone_corners_polygon(corners) {
        if is_open_water(corner.x, corner.z) {
            return true;
        }
    }
    false
}

pub fn burgage_frontage_edge_distance(
    ctx: &ReducerContext,
    owner: Identity,
    corners: &ZoneCorners,
    frontage_edge: u8,
) -> f64 {
    let Some(network) = load_owner_road_network(ctx, owner) else {
        return f64::INFINITY;
    };
    let (start, end) = zone_edge(corners, frontage_edge);
    let samples = 10;
    let mut min_distance = f64::INFINITY;
    for i in 0..=samples {
        let t = i as f64 / samples as f64;
        let x = start.x + (end.x - start.x) * t;
        let z = start.z + (end.z - start.z) * t;
        min_distance = min_distance.min(network.nearest_distance(x, z));
    }
    min_distance
}

pub fn burgage_zone_has_road_frontage(
    ctx: &ReducerContext,
    owner: Identity,
    corners: &ZoneCorners,
    frontage_edge: u8,
) -> bool {
    burgage_frontage_edge_distance(ctx, owner, corners, frontage_edge) <= MAX_ROAD_FRONTAGE_DISTANCE
}

fn zone_edge(corners: &ZoneCorners, edge: u8) -> (Point2, Point2) {
    match edge {
        0 => (corners.a, corners.b),
        1 => (corners.b, corners.c),
        2 => (corners.c, corners.d),
        _ => (corners.d, corners.a),
    }
}

pub fn building_overlaps_residence_zone(
    ctx: &ReducerContext,
    kind: &str,
    x: f64,
    z: f64,
) -> bool {
    let Some(pick_radius) = building_pick_radius(kind) else {
        return false;
    };

    for zone in ctx.db.burgage_zone().iter() {
        let zone_polygon = [
            crate::burgage::Point2 {
                x: zone.corner_ax,
                z: zone.corner_az,
            },
            crate::burgage::Point2 {
                x: zone.corner_bx,
                z: zone.corner_bz,
            },
            crate::burgage::Point2 {
                x: zone.corner_cx,
                z: zone.corner_cz,
            },
            crate::burgage::Point2 {
                x: zone.corner_dx,
                z: zone.corner_dz,
            },
        ];
        if zone_overlaps_footprint(&zone_polygon, x, z, pick_radius) {
            return true;
        }
    }

    false
}

pub fn burgage_zone_overlaps_buildings(ctx: &ReducerContext, corners: &ZoneCorners) -> bool {
    let candidate = zone_corners_polygon(corners);
    for building in ctx.db.building().iter() {
        let Some(pick_radius) = building_pick_radius(&building.kind) else {
            continue;
        };
        if zone_overlaps_footprint(&candidate, building.x, building.z, pick_radius) {
            return true;
        }
    }
    false
}

pub fn is_on_quarry_pit(ctx: &ReducerContext, x: f64, z: f64) -> bool {
    for quarry in ctx.db.quarry().iter() {
        let radius = if quarry.quarry_id.contains("large") {
            LARGE_QUARRY_PIT_RADIUS
        } else {
            SMALL_QUARRY_PIT_RADIUS
        };
        let dx = quarry.x - x;
        let dz = quarry.z - z;
        if dx * dx + dz * dz <= radius * radius {
            return true;
        }
    }
    false
}

pub fn building_overlaps_road_surface(
    ctx: &ReducerContext,
    owner: Identity,
    kind: &str,
    x: f64,
    z: f64,
) -> bool {
    let Some(network) = load_owner_road_network(ctx, owner) else {
        return false;
    };
    let pad = building_pad_params(kind);
    let yaw = building_placement_yaw(x, z);
    let cos = yaw.cos();
    let sin = yaw.sin();

    for &fraction in &FOOTPRINT_SAMPLE_FRACTIONS {
        for sx in [-1, 0, 1] {
            for sz in [-1, 0, 1] {
                if fraction == 0.0 && (sx != 0 || sz != 0) {
                    continue;
                }
                let local_x = sx as f64 * pad.radius_x * pad.inner_fade * fraction;
                let local_z = sz as f64 * pad.radius_z * pad.inner_fade * fraction;
                let sample_x = x + local_x * cos - local_z * sin;
                let sample_z = z + local_x * sin + local_z * cos;
                if network.is_on_road_surface(sample_x, sample_z) {
                    return true;
                }
            }
        }
    }

    false
}

fn building_pad_params(kind: &str) -> BuildingPadParams {
    match kind {
        "lumber_mill" => BuildingPadParams {
            radius_x: 10.2,
            radius_z: 4.8,
            inner_fade: 0.86,
        },
        "reforester" => BuildingPadParams {
            radius_x: 4.4,
            radius_z: 4.1,
            inner_fade: 0.88,
        },
        "woodcutters_lodge" => BuildingPadParams {
            radius_x: 4.6,
            radius_z: 4.3,
            inner_fade: 0.88,
        },
        "stone_quarry" => BuildingPadParams {
            radius_x: 10.5,
            radius_z: 10.5,
            inner_fade: 0.82,
        },
        "well" => BuildingPadParams {
            radius_x: 2.2,
            radius_z: 2.2,
            inner_fade: 0.9,
        },
        "hunters_hall" => BuildingPadParams {
            radius_x: 5.2,
            radius_z: 4.8,
            inner_fade: 0.88,
        },
        "foragers_shed" => BuildingPadParams {
            radius_x: 4.2,
            radius_z: 3.8,
            inner_fade: 0.88,
        },
        "chapel" => BuildingPadParams {
            radius_x: 3.4,
            radius_z: 4.2,
            inner_fade: 0.9,
        },
        "marketplace" => BuildingPadParams {
            radius_x: 4.2,
            radius_z: 3.4,
            inner_fade: 0.9,
        },
        _ => BuildingPadParams {
            radius_x: 10.5,
            radius_z: 10.5,
            inner_fade: 0.82,
        },
    }
}

fn building_placement_yaw(x: f64, z: f64) -> f64 {
    let degrees = (x * 0.017 + z * 0.013).sin().abs() * 6283.0;
    let degrees = degrees.floor() % 360.0;
    degrees.to_radians()
}
