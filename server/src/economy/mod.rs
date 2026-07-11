//! Building costs, salvage, storage, population, and aggregate spending.

mod population;
mod storage;

pub use population::{assign_building_labor, residence_population_for_parcel};
pub use storage::{
    building_storage_caps, credit_treasury_stone, credit_treasury_timber, deposit_building,
    residence_firewood_capacity, residence_water_capacity, spend_aggregate_stone, spend_aggregate_timber, total_stone,
    total_timber, withdraw_building,
};

pub use crate::balance_generated::{
    RESIDENCE_STONE_COST, RESIDENCE_TIMBER_COST, STARTING_STONE, STARTING_TIMBER,
    STONE_SALVAGE_FRACTION, TIMBER_SALVAGE_FRACTION,
};

pub struct ResourceAmount {
    pub timber: f64,
    pub stone: f64,
}

pub fn building_cost(kind: &str) -> Result<ResourceAmount, String> {
    let def = crate::building_defs::building_def_or_err(kind)?;
    Ok(ResourceAmount {
        timber: def.cost_timber,
        stone: def.cost_stone,
    })
}

pub fn building_salvage_refund(kind: &str) -> Result<ResourceAmount, String> {
    let cost = building_cost(kind)?;
    Ok(ResourceAmount {
        timber: (cost.timber * TIMBER_SALVAGE_FRACTION).round(),
        stone: (cost.stone * STONE_SALVAGE_FRACTION).round(),
    })
}

pub fn residence_zone_cost(residence_count: u32) -> ResourceAmount {
    ResourceAmount {
        timber: RESIDENCE_TIMBER_COST * residence_count as f64,
        stone: RESIDENCE_STONE_COST * residence_count as f64,
    }
}
