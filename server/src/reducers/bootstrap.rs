use spacetimedb::{reducer, ReducerContext};

use crate::db::*;
use crate::lifecycle::seed_world_entities;
use crate::tables::{Quarry, TreeEntity};
use crate::types::{QuarryBootstrap, TreeBootstrap};

#[reducer]
pub fn bootstrap_quarries(ctx: &ReducerContext, quarries: Vec<QuarryBootstrap>) -> Result<(), String> {
    if !quarries.is_empty() {
        for quarry in quarries {
            if quarry.quarry_id.is_empty() || quarry.max_yield <= 0.0 {
                continue;
            }
            if let Some(existing) = ctx.db.quarry().quarry_id().find(&quarry.quarry_id) {
                ctx.db.quarry().quarry_id().update(Quarry {
                    x: quarry.x,
                    z: quarry.z,
                    max_yield: quarry.max_yield,
                    remaining: existing.remaining.min(quarry.max_yield),
                    ..existing
                });
            } else {
                ctx.db.quarry().insert(Quarry {
                    quarry_id: quarry.quarry_id,
                    x: quarry.x,
                    z: quarry.z,
                    max_yield: quarry.max_yield,
                    remaining: quarry.max_yield,
                });
            }
        }
        return Ok(());
    }

    if ctx.db.quarry().iter().count() > 0 {
        return Ok(());
    }

    seed_world_entities(ctx);
    Ok(())
}

#[reducer]
pub fn bootstrap_trees(ctx: &ReducerContext, trees: Vec<TreeBootstrap>) -> Result<(), String> {
    if !trees.is_empty() {
        for tree in trees {
            if tree.tree_id.is_empty() {
                continue;
            }
            if ctx.db.tree_entity().tree_id().find(&tree.tree_id).is_some() {
                continue;
            }
            ctx.db.tree_entity().insert(TreeEntity {
                tree_id: tree.tree_id,
                layout_index: tree.layout_index,
                phase: "mature".to_string(),
                growth_progress: 1.0,
                wood_yield: tree.wood_yield.max(1.0),
                x: tree.x,
                z: tree.z,
            });
        }
        return Ok(());
    }

    if ctx.db.tree_entity().iter().count() > 0 {
        return Ok(());
    }

    seed_world_entities(ctx);
    Ok(())
}
