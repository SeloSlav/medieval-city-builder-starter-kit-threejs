//! Building costs, salvage, storage, population, and aggregate spending.

mod population;
mod storage;

pub use population::{
    assign_building_labor, available_labor, residence_population, starting_population,
    total_assigned_labor, total_population,
};
pub use storage::{
    building_storage_caps, credit_treasury_stone, credit_treasury_timber, deposit_building,
    residence_firewood_capacity, spend_aggregate_stone, spend_aggregate_timber,
    total_firewood, total_stone, total_timber, withdraw_building,
};

pub struct ResourceAmount {
    pub timber: f64,
    pub stone: f64,
}

pub const STARTING_TIMBER: f64 = 120.0;
pub const STARTING_STONE: f64 = 140.0;

pub const STONE_SALVAGE_FRACTION: f64 = 0.92;
pub const TIMBER_SALVAGE_FRACTION: f64 = 0.70;

pub fn building_cost(kind: &str) -> Result<ResourceAmount, String> {
    match kind {
        "lumber_mill" => Ok(ResourceAmount {
            timber: 45.0,
            stone: 15.0,
        }),
        "reforester" => Ok(ResourceAmount {
            timber: 35.0,
            stone: 10.0,
        }),
        "woodcutters_lodge" => Ok(ResourceAmount {
            timber: 40.0,
            stone: 12.0,
        }),
        "stone_quarry" => Ok(ResourceAmount {
            timber: 25.0,
            stone: 40.0,
        }),
        _ => Err(format!("Unknown building kind: {kind}")),
    }
}

pub fn building_salvage_refund(kind: &str) -> Result<ResourceAmount, String> {
    let cost = building_cost(kind)?;
    Ok(ResourceAmount {
        timber: (cost.timber * TIMBER_SALVAGE_FRACTION).round(),
        stone: (cost.stone * STONE_SALVAGE_FRACTION).round(),
    })
}

pub const RESIDENCE_TIMBER_COST: f64 = 8.0;
pub const RESIDENCE_STONE_COST: f64 = 12.0;

pub fn residence_zone_cost(residence_count: u32) -> ResourceAmount {
    ResourceAmount {
        timber: RESIDENCE_TIMBER_COST * residence_count as f64,
        stone: RESIDENCE_STONE_COST * residence_count as f64,
    }
}

pub fn credit(resources: &mut ResourceAmount, refund: &ResourceAmount) {
    resources.timber += refund.timber;
    resources.stone += refund.stone;
}
