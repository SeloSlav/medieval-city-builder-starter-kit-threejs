//! Pure lodge/firewood logistics helpers shared by simulation and tests.

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LodgeLaborSplit {
    pub processing: u32,
    pub delivering: u32,
}

/// One deliverer when possible; remaining workers process. A lone worker alternates roles.
pub fn lodge_labor_split(assigned: u32) -> LodgeLaborSplit {
    match assigned {
        0 => LodgeLaborSplit {
            processing: 0,
            delivering: 0,
        },
        1 => LodgeLaborSplit {
            processing: 1,
            delivering: 1,
        },
        workers => LodgeLaborSplit {
            processing: workers - 1,
            delivering: 1,
        },
    }
}

pub fn residence_firewood_runway_seconds(
    abandoned: bool,
    population: u32,
    firewood_stock: f64,
    demand_per_person_per_sec: f64,
) -> f64 {
    if abandoned || population == 0 {
        return f64::INFINITY;
    }
    let demand = population as f64 * demand_per_person_per_sec;
    if demand <= 1e-9 {
        return f64::INFINITY;
    }
    firewood_stock / demand
}
