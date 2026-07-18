use spacetimedb::Identity;

use crate::balance_generated::MONASTERY_COVERAGE_RADIUS;
use crate::simulation::tick_context::SimTickContext;
use crate::tables::{Building, Residence};

pub fn residence_has_road_landmark(
    tick: &SimTickContext,
    owner: Identity,
    residence: &Residence,
    landmarks: &[Building],
    kind: &str,
) -> bool {
    landmarks.iter().any(|landmark| {
        landmark.owner == owner
            && landmark.kind == kind
            && landmark.construction_complete
            && tick.road_connected(owner, residence.x, residence.z, landmark.x, landmark.z)
    })
}

pub fn residence_has_marketplace_access(
    tick: &SimTickContext,
    owner: Identity,
    residence: &Residence,
    landmarks: &[Building],
) -> bool {
    residence_has_road_landmark(tick, owner, residence, landmarks, "marketplace")
}

pub fn is_chapel_staffed(chapel: &Building) -> bool {
    chapel.kind == "chapel" && chapel.construction_complete && chapel.assigned_labor > 0
}

pub fn find_serving_chapel<'a>(
    tick: &SimTickContext,
    owner: Identity,
    residence: &Residence,
    chapels: &'a [Building],
) -> Option<&'a Building> {
    chapels.iter().find(|chapel| {
        chapel.owner == owner
            && is_chapel_staffed(chapel)
            && tick.road_connected(owner, residence.x, residence.z, chapel.x, chapel.z)
    })
}

pub fn residence_has_chapel_access(
    tick: &SimTickContext,
    owner: Identity,
    residence: &Residence,
    chapels: &[Building],
) -> bool {
    find_serving_chapel(tick, owner, residence, chapels).is_some()
}

pub fn monastery_linked_to_chapel(
    tick: &SimTickContext,
    monastery: &Building,
    chapels: &[Building],
) -> bool {
    let Some(network) = tick.road_network(monastery.owner) else {
        return false;
    };
    chapels.iter().any(|chapel| {
        chapel.owner == monastery.owner
            && is_chapel_staffed(chapel)
            && network
                .road_path_distance(monastery.x, monastery.z, chapel.x, chapel.z)
                .is_some()
    })
}

pub fn find_linked_monastery_in_coverage<'a>(
    tick: &SimTickContext,
    owner: Identity,
    residence: &Residence,
    monasteries: &'a [Building],
    chapels: &[Building],
) -> Option<&'a Building> {
    if !residence_has_chapel_access(tick, owner, residence, chapels) {
        return None;
    }

    let Some(network) = tick.road_network(owner) else {
        return None;
    };

    let mut candidates: Vec<&Building> = monasteries
        .iter()
        .filter(|monastery| {
            monastery.owner == owner
                && monastery.kind == "monastery"
                && monastery.construction_complete
                && monastery_linked_to_chapel(tick, monastery, chapels)
                && network
                    .road_path_distance(residence.x, residence.z, monastery.x, monastery.z)
                    .is_some_and(|distance| distance <= MONASTERY_COVERAGE_RADIUS)
        })
        .collect();
    candidates.sort_by_key(|monastery| monastery.id);
    candidates.into_iter().next()
}

pub fn residence_has_monastery_coverage(
    tick: &SimTickContext,
    owner: Identity,
    residence: &Residence,
    monasteries: &[Building],
    chapels: &[Building],
) -> bool {
    find_linked_monastery_in_coverage(tick, owner, residence, monasteries, chapels).is_some()
}
