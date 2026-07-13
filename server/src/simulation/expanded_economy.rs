use spacetimedb::ReducerContext;

use crate::balance_generated::{
    APIARY_FOOD_PER_CYCLE, APIARY_HONEY_PER_CYCLE, BREWERY_ALE_PER_CYCLE,
    BREWERY_GRAIN_PER_CYCLE, BREWERY_WATER_PER_CYCLE, FERRY_GOLD_PER_DAY,
    GRAIN_PER_FIELD_CYCLE, GRAIN_TRANSFER_PER_TRIP, GRANARY_FLOUR_PER_CYCLE,
    GRANARY_FOOD_PER_CYCLE, MONASTERY_FOOD_PER_CYCLE, MONASTERY_GRAIN_PER_CYCLE,
    MONASTERY_PILGRIMAGE_GOLD_PER_DAY, MONASTERY_UNLINKED_PRODUCTIVITY,
    SMOKEHOUSE_FIREWOOD_PER_CYCLE, SMOKEHOUSE_FOOD_PER_CYCLE, SMOKEHOUSE_PRESERVED_FOOD_PER_CYCLE,
    SPECIALTY_EXPORT_GOLD_PER_ALE, SPECIALTY_EXPORT_GOLD_PER_HONEY,
    SPECIALTY_EXPORT_GOLD_PER_WINE, TICK_DT, TIMBER_DELIVERY_SPEED_MPS,
    TIMBER_DELIVERY_UNLOAD_SEC, VINEYARD_FOOD_PER_CYCLE, VINEYARD_WINE_PER_CYCLE,
    WATERMILL_FLOUR_PER_CYCLE, WATERMILL_GRAIN_PER_CYCLE, WATERMILL_WATER_PER_CYCLE,
    CALENDAR_SECONDS_PER_DAY, FOOD_DELIVERY_SPEED_MPS, FOOD_DELIVERY_UNLOAD_SEC,
};
use crate::building_defs::building_def;
use crate::db::*;
use crate::economy::{
    building_commodity_cap, building_commodity_room, building_commodity_stock,
    credit_treasury_gold, deposit_building_commodity, withdraw_building_commodity,
    CommodityKind,
};
use crate::simulation::delivery_trips::{
    building_has_active_trip, building_has_inbound_supply_trip,
    try_start_building_supply_trip, try_start_delivery_trip,
};
use crate::simulation::game_calendar::GameClock;
use crate::simulation::labor_and_logistics_paused;
use crate::simulation::residence_needs::{apply_need_delivery, load_needs, need_stock, ResidenceNeedKind};
use crate::simulation::tick_context::SimTickContext;
use crate::simulation::water_logistics::ensure_building_water;
use crate::tables::{Building, Residence};

pub fn step_grain_field(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    clock: &GameClock,
    building: Building,
) {
    let mut field = step_simple_producer(
        ctx,
        clock,
        building,
        &[(CommodityKind::Grain, GRAIN_PER_FIELD_CYCLE)],
    );
    dispatch_to_building(
        ctx,
        tick,
        clock,
        &mut field,
        CommodityKind::Grain,
        &["threshing_barn"],
    );
    ctx.db.building().id().update(field);
}

pub fn step_threshing_barn(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    clock: &GameClock,
    mut building: Building,
) {
    if !labor_and_logistics_paused(ctx, building.owner, clock) && building.assigned_labor > 0 {
        dispatch_to_building(
            ctx,
            tick,
            clock,
            &mut building,
            CommodityKind::Grain,
            &["watermill", "brewery", "granary", "monastery"],
        );
    }
    ctx.db.building().id().update(building);
}

pub fn step_watermill(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    clock: &GameClock,
    building: Building,
) {
    let mut mill = ensure_water_for_process(ctx, tick, building, WATERMILL_WATER_PER_CYCLE);
    mill = step_processor(
        ctx,
        clock,
        mill,
        &[
            (CommodityKind::Grain, WATERMILL_GRAIN_PER_CYCLE),
            (CommodityKind::Water, WATERMILL_WATER_PER_CYCLE),
        ],
        &[(CommodityKind::Flour, WATERMILL_FLOUR_PER_CYCLE)],
    );
    dispatch_to_building(
        ctx,
        tick,
        clock,
        &mut mill,
        CommodityKind::Flour,
        &["granary"],
    );
    ctx.db.building().id().update(mill);
}

pub fn step_granary(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    clock: &GameClock,
    building: Building,
) {
    let mut granary = step_processor(
        ctx,
        clock,
        building,
        &[(CommodityKind::Flour, GRANARY_FLOUR_PER_CYCLE)],
        &[(CommodityKind::Food, GRANARY_FOOD_PER_CYCLE)],
    );
    dispatch_to_building(ctx, tick, clock, &mut granary, CommodityKind::Food, &["smokehouse"]);
    dispatch_need(ctx, tick, clock, &mut granary, ResidenceNeedKind::Food, 4.0);
    ctx.db.building().id().update(granary);
}

pub fn step_brewery(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    clock: &GameClock,
    building: Building,
) {
    let mut brewery = ensure_water_for_process(ctx, tick, building, BREWERY_WATER_PER_CYCLE);
    brewery = step_processor(
        ctx,
        clock,
        brewery,
        &[
            (CommodityKind::Grain, BREWERY_GRAIN_PER_CYCLE),
            (CommodityKind::Water, BREWERY_WATER_PER_CYCLE),
        ],
        &[(CommodityKind::Ale, BREWERY_ALE_PER_CYCLE)],
    );
    dispatch_to_building(ctx, tick, clock, &mut brewery, CommodityKind::Ale, &["monastery"]);
    dispatch_need(ctx, tick, clock, &mut brewery, ResidenceNeedKind::Ale, 3.0);
    export_specialty(
        ctx,
        tick,
        &mut brewery,
        CommodityKind::Ale,
        SPECIALTY_EXPORT_GOLD_PER_ALE,
    );
    ctx.db.building().id().update(brewery);
}

pub fn step_smokehouse(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    clock: &GameClock,
    building: Building,
) {
    let mut smokehouse = building;
    request_connected_commodity(
        ctx,
        tick,
        clock,
        &smokehouse,
        CommodityKind::Food,
        &["hunters_hall", "foragers_shed", "granary"],
        SMOKEHOUSE_FOOD_PER_CYCLE * 2.0,
    );
    request_connected_commodity(ctx, tick, clock, &smokehouse, CommodityKind::Firewood, &["woodcutters_lodge"], SMOKEHOUSE_FIREWOOD_PER_CYCLE * 3.0);
    smokehouse = step_processor(
        ctx,
        clock,
        smokehouse,
        &[(CommodityKind::Food, SMOKEHOUSE_FOOD_PER_CYCLE), (CommodityKind::Firewood, SMOKEHOUSE_FIREWOOD_PER_CYCLE)],
        &[(CommodityKind::PreservedFood, SMOKEHOUSE_PRESERVED_FOOD_PER_CYCLE)],
    );
    dispatch_need(
        ctx,
        tick,
        clock,
        &mut smokehouse,
        ResidenceNeedKind::PreservedFood,
        3.0,
    );
    ctx.db.building().id().update(smokehouse);
}

pub fn step_apiary(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    clock: &GameClock,
    building: Building,
) {
    let mut apiary = step_simple_producer(
        ctx,
        clock,
        building,
        &[
            (CommodityKind::Honey, APIARY_HONEY_PER_CYCLE),
            (CommodityKind::Food, APIARY_FOOD_PER_CYCLE),
        ],
    );
    export_specialty(
        ctx,
        tick,
        &mut apiary,
        CommodityKind::Honey,
        SPECIALTY_EXPORT_GOLD_PER_HONEY,
    );
    dispatch_need(ctx, tick, clock, &mut apiary, ResidenceNeedKind::Food, 2.0);
    ctx.db.building().id().update(apiary);
}

pub fn step_vineyard(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    clock: &GameClock,
    building: Building,
) {
    let mut vineyard = step_simple_producer(
        ctx,
        clock,
        building,
        &[
            (CommodityKind::Wine, VINEYARD_WINE_PER_CYCLE),
            (CommodityKind::Food, VINEYARD_FOOD_PER_CYCLE),
        ],
    );
    export_specialty(
        ctx,
        tick,
        &mut vineyard,
        CommodityKind::Wine,
        SPECIALTY_EXPORT_GOLD_PER_WINE,
    );
    dispatch_need(ctx, tick, clock, &mut vineyard, ResidenceNeedKind::Food, 2.0);
    ctx.db.building().id().update(vineyard);
}

pub fn step_monastery(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    clock: &GameClock,
    building: Building,
) {
    let linked = monastery_has_parish_link(ctx, tick, &building);
    let productivity = if linked { 1.0 } else { MONASTERY_UNLINKED_PRODUCTIVITY };
    let mut monastery = step_autonomous_processor(
        ctx,
        clock,
        building,
        &[(CommodityKind::Grain, MONASTERY_GRAIN_PER_CYCLE * productivity)],
        &[(CommodityKind::Food, MONASTERY_FOOD_PER_CYCLE * productivity)],
    );

    if linked && owner_has_connected_marketplace(ctx, tick, &monastery) {
        let gold = MONASTERY_PILGRIMAGE_GOLD_PER_DAY * TICK_DT / CALENDAR_SECONDS_PER_DAY;
        credit_treasury_gold(ctx, monastery.owner, gold);
        if let Some(mut treasury) = ctx.db.player_resources().owner().find(&monastery.owner) {
            treasury.monastery_pilgrimage_gold_total += gold;
            ctx.db.player_resources().owner().update(treasury);
        }
    }
    dispatch_need(ctx, tick, clock, &mut monastery, ResidenceNeedKind::Food, 4.0);
    dispatch_need(ctx, tick, clock, &mut monastery, ResidenceNeedKind::Ale, 3.0);
    run_monastery_feast(ctx, tick, clock, &mut monastery);
    ctx.db.building().id().update(monastery);
}

pub fn step_ferry_landing(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    clock: &GameClock,
    building: Building,
) {
    if !labor_and_logistics_paused(ctx, building.owner, clock)
        && building.assigned_labor > 0
        && owner_has_connected_marketplace(ctx, tick, &building)
    {
        let gold = FERRY_GOLD_PER_DAY * building.assigned_labor as f64 * TICK_DT
            / CALENDAR_SECONDS_PER_DAY;
        credit_treasury_gold(ctx, building.owner, gold);
    }
    ctx.db.building().id().update(building);
}

pub fn step_carpenter(ctx: &ReducerContext, clock: &GameClock, mut building: Building) {
    if labor_and_logistics_paused(ctx, building.owner, clock) {
        return;
    }
    building.action_cooldown = (building.action_cooldown - TICK_DT).max(0.0);
    ctx.db.building().id().update(building);
}

fn step_simple_producer(
    ctx: &ReducerContext,
    clock: &GameClock,
    mut building: Building,
    outputs: &[(CommodityKind, f64)],
) -> Building {
    if !cycle_ready(ctx, clock, &mut building, false) {
        return building;
    }
    let labor = building.assigned_labor.max(1) as f64;
    for (kind, amount) in outputs {
        deposit_building_commodity(&mut building, *kind, amount * labor);
    }
    reset_cycle(&mut building, labor);
    building
}

fn step_processor(
    ctx: &ReducerContext,
    clock: &GameClock,
    mut building: Building,
    inputs: &[(CommodityKind, f64)],
    outputs: &[(CommodityKind, f64)],
) -> Building {
    if !cycle_ready(ctx, clock, &mut building, false) {
        return building;
    }
    let labor = building.assigned_labor.max(1) as f64;
    process_batch(&mut building, inputs, outputs, labor);
    reset_cycle(&mut building, labor);
    building
}

fn step_autonomous_processor(
    ctx: &ReducerContext,
    clock: &GameClock,
    mut building: Building,
    inputs: &[(CommodityKind, f64)],
    outputs: &[(CommodityKind, f64)],
) -> Building {
    if !cycle_ready(ctx, clock, &mut building, true) {
        return building;
    }
    process_batch(&mut building, inputs, outputs, 1.0);
    reset_cycle(&mut building, 1.0);
    building
}

fn process_batch(
    building: &mut Building,
    inputs: &[(CommodityKind, f64)],
    outputs: &[(CommodityKind, f64)],
    labor: f64,
) {
    let mut scale = labor;
    for (kind, amount) in inputs {
        if *amount > 1e-6 {
            scale = scale.min(building_commodity_stock(building, *kind) / amount);
        }
    }
    for (kind, amount) in outputs {
        if *amount > 1e-6 {
            scale = scale.min(building_commodity_room(building, *kind) / amount);
        }
    }
    if scale <= 1e-6 {
        return;
    }
    for (kind, amount) in inputs {
        withdraw_building_commodity(building, *kind, amount * scale);
    }
    for (kind, amount) in outputs {
        deposit_building_commodity(building, *kind, amount * scale);
    }
}

fn cycle_ready(
    ctx: &ReducerContext,
    clock: &GameClock,
    building: &mut Building,
    autonomous: bool,
) -> bool {
    if labor_and_logistics_paused(ctx, building.owner, clock) {
        return false;
    }
    building.action_cooldown = (building.action_cooldown - TICK_DT).max(0.0);
    building.action_cooldown <= 1e-6 && (autonomous || building.assigned_labor > 0)
}

fn reset_cycle(building: &mut Building, labor: f64) {
    let interval = building_def(&building.kind)
        .map(|def| def.action_interval)
        .unwrap_or(1.0);
    building.action_cooldown = interval / labor.max(1.0);
}

fn ensure_water_for_process(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    building: Building,
    needed: f64,
) -> Building {
    let Some(network) = tick.road_network(building.owner) else {
        return building;
    };
    ensure_building_water(ctx, tick, network, building, needed)
}

fn dispatch_to_building(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    clock: &GameClock,
    source: &mut Building,
    commodity: CommodityKind,
    target_kinds: &[&str],
) {
    if source.assigned_labor == 0 || building_has_active_trip(ctx, source.id) {
        return;
    }
    let Some(network) = tick.road_network(source.owner) else {
        return;
    };
    let mut targets: Vec<Building> = ctx
        .db
        .building()
        .owner()
        .filter(&source.owner)
        .filter(|target| {
            target.id != source.id
                && target_kinds.contains(&target.kind.as_str())
                && building_commodity_room(target, commodity) > 1e-6
                && !building_has_inbound_supply_trip(ctx, target.id)
        })
        .collect();
    targets.sort_by(|a, b| {
        let da = network
            .road_path_distance(source.x, source.z, a.x, a.z)
            .unwrap_or(f64::INFINITY);
        let db = network
            .road_path_distance(source.x, source.z, b.x, b.z)
            .unwrap_or(f64::INFINITY);
        da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
    });
    let Some(target) = targets.first() else {
        return;
    };
    let needed = building_commodity_room(target, commodity);
    try_start_building_supply_trip(
        ctx,
        clock,
        network,
        source,
        target,
        1,
        commodity,
        TIMBER_DELIVERY_SPEED_MPS,
        TIMBER_DELIVERY_UNLOAD_SEC,
        GRAIN_TRANSFER_PER_TRIP,
        needed,
    );
}

fn dispatch_need(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    clock: &GameClock,
    supplier: &mut Building,
    need_kind: ResidenceNeedKind,
    per_delivery: f64,
) {
    if building_has_active_trip(ctx, supplier.id)
        || building_commodity_stock(supplier, need_to_commodity(need_kind)) <= 1e-6
    {
        return;
    }
    let Some(network) = tick.road_network(supplier.owner) else {
        return;
    };
    let mut targets: Vec<Residence> = ctx
        .db
        .residence()
        .owner()
        .filter(&supplier.owner)
        .filter(|residence| {
            !residence.abandoned
                && need_kind.is_active_for_tier(residence.tier)
                && network
                    .road_path_distance(supplier.x, supplier.z, residence.x, residence.z)
                    .is_some()
        })
        .collect();
    targets.sort_by(|a, b| {
        let sa = need_stock(&load_needs(ctx, a.id), need_kind);
        let sb = need_stock(&load_needs(ctx, b.id), need_kind);
        sa.partial_cmp(&sb).unwrap_or(std::cmp::Ordering::Equal)
    });
    try_start_delivery_trip(
        ctx,
        clock,
        network,
        supplier,
        1,
        &targets,
        need_kind,
        FOOD_DELIVERY_SPEED_MPS,
        FOOD_DELIVERY_UNLOAD_SEC,
        per_delivery,
    );
}

fn need_to_commodity(kind: ResidenceNeedKind) -> CommodityKind {
    match kind {
        ResidenceNeedKind::Firewood => CommodityKind::Firewood,
        ResidenceNeedKind::Water => CommodityKind::Water,
        ResidenceNeedKind::Food => CommodityKind::Food,
        ResidenceNeedKind::Ale => CommodityKind::Ale,
        ResidenceNeedKind::PreservedFood => CommodityKind::PreservedFood,
    }
}

fn request_connected_commodity(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    clock: &GameClock,
    target: &Building,
    commodity: CommodityKind,
    source_kinds: &[&str],
    desired: f64,
) {
    if building_commodity_stock(&target, commodity) + 1e-6 >= desired {
        return;
    }
    let Some(network) = tick.road_network(target.owner) else {
        return;
    };
    let mut sources: Vec<Building> = ctx
        .db
        .building()
        .owner()
        .filter(&target.owner)
        .filter(|source| {
            source_kinds.contains(&source.kind.as_str())
                && building_commodity_stock(source, commodity) > 1e-6
                && !building_has_active_trip(ctx, source.id)
                && network
                    .road_path_distance(source.x, source.z, target.x, target.z)
                    .is_some()
        })
        .collect();
    sources.sort_by_key(|source| source.id);
    for mut source in sources {
        let request = (desired - building_commodity_stock(target, commodity)).max(0.0);
        if try_start_building_supply_trip(ctx, clock, network, &mut source, target, 1, commodity, TIMBER_DELIVERY_SPEED_MPS, TIMBER_DELIVERY_UNLOAD_SEC, GRAIN_TRANSFER_PER_TRIP, request) {
            ctx.db.building().id().update(source);
            break;
        }
    }
}

fn run_monastery_feast(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    clock: &GameClock,
    monastery: &mut Building,
) {
    let first_tick_of_minute = clock.sim_tick % (60.0 / TICK_DT).round() as u64 == 0;
    let feast_day = matches!((clock.month, clock.month_day), (1, 6) | (6, 29) | (8, 15) | (9, 14) | (12, 25));
    let enabled = ctx.db.player_resources().owner().find(&monastery.owner)
        .map(|resources| resources.monastery_feasts_enabled).unwrap_or(false);
    if !enabled || !feast_day || clock.hour != 12 || clock.minute != 0 || !first_tick_of_minute {
        return;
    }
    let Some(network) = tick.road_network(monastery.owner) else { return; };
    let available_food = withdraw_building_commodity(monastery, CommodityKind::Food, 18.0);
    let available_ale = withdraw_building_commodity(monastery, CommodityKind::Ale, 10.0);
    if available_food <= 1e-6 && available_ale <= 1e-6 { return; }
    let residences: Vec<Residence> = ctx.db.residence().owner().filter(&monastery.owner)
        .filter(|home| !home.abandoned && network.road_path_distance(monastery.x, monastery.z, home.x, home.z).is_some())
        .collect();
    let count = residences.len().max(1) as f64;
    for home in &residences {
        apply_need_delivery(ctx, home.id, ResidenceNeedKind::Food, available_food / count);
        if home.tier >= 3 { apply_need_delivery(ctx, home.id, ResidenceNeedKind::Ale, available_ale / count); }
    }
    if let Some(mut resources) = ctx.db.player_resources().owner().find(&monastery.owner) {
        resources.monastery_food_charity_total += available_food;
        ctx.db.player_resources().owner().update(resources);
    }
}

fn export_specialty(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    building: &mut Building,
    commodity: CommodityKind,
    gold_per_unit: f64,
) {
    if !owner_has_connected_marketplace(ctx, tick, building) {
        return;
    }
    let cap = building_commodity_cap(&building.kind, commodity);
    let reserve = cap * 0.25;
    let sellable = (building_commodity_stock(building, commodity) - reserve).max(0.0);
    let sold = withdraw_building_commodity(building, commodity, sellable.min(0.5));
    credit_treasury_gold(ctx, building.owner, sold * gold_per_unit);
}

fn owner_has_connected_marketplace(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    building: &Building,
) -> bool {
    let Some(network) = tick.road_network(building.owner) else {
        return false;
    };
    ctx.db.building().owner().filter(&building.owner).any(|market| {
        market.kind == "marketplace"
            && network
                .road_path_distance(building.x, building.z, market.x, market.z)
                .is_some()
    })
}

fn monastery_has_parish_link(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    monastery: &Building,
) -> bool {
    let Some(network) = tick.road_network(monastery.owner) else {
        return false;
    };
    ctx.db.building().owner().filter(&monastery.owner).any(|chapel| {
        chapel.kind == "chapel"
            && chapel.assigned_labor > 0
            && network
                .road_path_distance(monastery.x, monastery.z, chapel.x, chapel.z)
                .is_some()
    })
}
