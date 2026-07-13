# Building Visual Language

This document is the source of truth for settlement architecture. Read it before creating or substantially revising any building or residence model.

The canonical reference is the chapel in `src/buildings/meshes/chapelMesh.ts`. New work should belong to the same village without copying the chapel literally.

## Locked direction

**Grounded Croatian/Gorski vernacular, stylized for strategy-camera readability.**

The settlement should feel built by local craftspeople from nearby limestone and timber, repaired over generations, and adapted to wet mountain weather. It is not high fantasy, storybook Tudor England, a pristine model village, or a photoreal historical reconstruction.

The image should feel warm, tactile, legible, and slightly irregular. Shapes are simplified, but construction should remain believable.

## Visual priorities

Judge every model in this order:

1. **Silhouette:** the building kind must be identifiable when small and untextured.
2. **Material blocks:** roof, wall, foundation, frame, and openings must separate clearly.
3. **Functional story:** visible props should explain what happens here.
4. **Craft detail:** close-range elements reward first-person inspection.

Do not trade silhouette clarity for more small geometry. Details that disappear at settlement zoom are supporting detail, never the main design.

## Shared shape grammar

- Prefer compact, useful footprints and steep roofs suited to rain and snow.
- Use deep eaves, visible ridge lines, and a strong roof-to-wall ratio.
- Anchor buildings with a stone plinth, foundation course, curb, or working yard.
- Use dark structural timber to frame pale walls and openings.
- Let civic buildings be more vertical; let production buildings spread horizontally.
- Use asymmetry through chimneys, lean-tos, stacked goods, porches, sheds, and work equipment.
- Allow modest hand-built irregularity: alternating stone sizes, slight rotations, uneven courses, and restrained color variation.
- Keep doors, windows, steps, tools, and carts believable relative to villagers.

Every building gets one signature silhouette feature. Examples include the chapel belfry, the mill's long saw hall, a quarry derrick, or the well's shelter roof. Do not give every building a tower, cross-gable, or ornamental roof.

## Materials and color

Use `src/buildings/buildingMaterials.ts` as the palette authority.

### Primary family

- Pale warm limestone: foundations, steps, buttresses, curbs, quoins, and civic trim.
- Warm limewash: residences and important enclosed buildings.
- Dark oak: structural frames, doors, braces, window divisions, and machinery.
- Weathered mid-tone timber: cladding, sheds, fences, racks, and working surfaces.
- Deep terracotta red: important tiled roofs and restrained painted accents.
- Brown wood shingles: humble, woodland, and utility buildings.
- Near-black iron: straps, hinges, tools, cranks, and structural hardware.
- Muted brass: rare focal hardware such as the chapel bell.

### Accent rules

- Folk red, blue, ochre, and green are accents, not facade-wide colors.
- Keep accent areas small enough that limestone, timber, and roof material remain dominant.
- Use saturation to create focal hierarchy, not random variety.
- Glass is dark blue-grey by day and may gain a restrained warm glow when occupied at night.
- Quarry stone remains cooler and greyer than village limestone.

Avoid pure white, pure black, neon color, broad glossy surfaces, and clean modern metal.

## Detail hierarchy

### Settlement view

The viewer should read:

- overall footprint and height;
- roof form and color;
- main openings;
- signature feature;
- one or two functional yard props.

### Working view

The viewer should discover:

- foundation courses and corner structure;
- doors, windows, braces, roof bands, chimneys, and lean-tos;
- stored resources and characteristic equipment;
- deliberate asymmetry.

### First-person view

The viewer may discover:

- iron straps, handles, mullions, tile courses, carved or painted trim;
- small construction offsets and material changes;
- believable attachment points and supports.

Do not build close details until the first two levels work.

## Building identities

| Building | Signature read | Material emphasis | Functional evidence |
| --- | --- | --- | --- |
| Chapel | Open oak belfry over a compact nave | Limewash, limestone, red tile, restrained folk trim | Bell, entrance steps, parish wall |
| Residence | Steep domestic gable with chimney and lived-in asymmetry | Limewash or timber, stone base, tile/shingle roof | Firewood, porch, shutters, small household props |
| Well | Sheltered vertical frame over a circular stone curb | Limestone, dark timber, iron | Crank, rope, bucket, worn apron |
| Lumber mill | Long, low saw hall with a dominant roof | Timber frame, stone plinth, red tile | Saw, intake bay, log stacks |
| Reforester | Compact woodland hut with a steep protective roof | Shingles, weathered timber, stone base | Sapling racks, tools, planting stock |
| Woodcutter's lodge | Sturdy processing hut with a busy side yard | Timber, shingles, iron | Chopping block, split logs, stacked firewood |
| Stone quarry | Rugged open worksite rather than a polished house | Cool quarry stone, timber machinery, iron | Derrick, cut blocks, spoil, tool shelter |
| Hunter's hall | Low forest hall with a lean-to profile | Dark timber, shingles, stone hearth | Drying rack, hides, bows or traps |
| Forager's shed | Smallest and lightest enclosed work building | Weathered timber, shingles | Baskets, herb racks, drying bundles |
| Marketplace | Broad open civic canopy or arcade | Timber posts, stone paving, selective tile or canvas | Stalls, crates, scales, barrels |

## Residence variants

Residence variety must not be color-only.

- Share a construction kit: foundations, wall systems, roof families, openings, chimneys, porches, and props.
- Vary at least two major traits per house: footprint/proportion, roof form, entry placement, chimney placement, porch/lean-to, or upper-storey treatment.
- Then vary secondary traits: facade color, roof material, shutters, firewood, garden clutter, and trim.
- Use deterministic seeds so a residence keeps its appearance across sessions.
- Keep the village palette bounded; repetition creates cohesion.
- Prefer three to five strong house archetypes with controlled variants over dozens of weak random combinations.

Narrow and wide parcels should affect the architecture, not merely stretch the same mesh.

## Procedural modeling rules

- Models remain native Three.js geometry unless an asset pipeline is explicitly approved.
- Build through the helpers in `src/buildings/buildingMaterials.ts` and `src/buildings/meshPrimitives.ts` where practical.
- Preserve the placement footprint defined in `BuildingTerrainLayout.ts`.
- When height changes materially, update both `BuildingPlacementPreview.ts` and `buildingShadowProxy.ts`.
- Use one invisible shadow proxy per building; detailed meshes should not all cast into the shadow pass.
- Reuse a small material vocabulary within a model.
- Put geometry where it changes silhouette, catches useful light, or explains function.
- Prefer low-sided cylinders and faceted curves consistent with the game's stylization.
- Avoid hidden interiors unless gameplay or a visible opening requires them.
- Ensure preview materials and disposal still work after introducing groups or custom geometry.

## Anti-drift rules

Do not introduce:

- generic high-fantasy castles, exaggerated spires, or ornamental clutter;
- ubiquitous Tudor half-timber patterns;
- pristine symmetry across every facade and yard;
- roof shapes chosen only for spectacle;
- color-only building differentiation;
- tiny repeated geometry that adds cost but no readable form;
- photoreal PBR assets that clash with the procedural environment;
- one-off palettes that do not use the shared limestone, timber, and roof family;
- oversized buildings that stop reading as parts of one village.

When historical authenticity and game readability conflict, keep the construction plausible but choose the clearer game silhouette.

## Review checklist

Before considering a model complete:

- [ ] It can be identified from its silhouette at settlement zoom.
- [ ] It has exactly one dominant signature feature.
- [ ] Roof, wall, foundation, frame, and openings separate clearly.
- [ ] Its props communicate gameplay function.
- [ ] It belongs beside the chapel without copying the chapel.
- [ ] It uses the shared palette and restrained accents.
- [ ] Doors, windows, steps, tools, and structural supports are plausibly scaled.
- [ ] It contains controlled asymmetry or hand-built variation.
- [ ] It has been checked from front three-quarter, rear three-quarter, and settlement distance.
- [ ] It has been checked under the game's daylight and shadow treatment.
- [ ] Placement footprint, preview height, shadow proxy, and disposal behavior still match.
- [ ] `npm run build` and the relevant tests pass.

## Workflow for the next model

1. Read this document and inspect the chapel mesh.
2. Name the building's signature silhouette and functional props before coding.
3. Block the largest masses and review at settlement distance.
4. Establish material blocks and mid-scale structure.
5. Add only the close details that reinforce craft or function.
6. Inspect in the actual renderer, correct silhouette/material balance, and repeat once.
7. Verify footprint, preview, shadow, build, and tests.

This direction is locked. Deviate only when the user explicitly requests a new architectural region, era, or visual style.
