// js/config/GameConfig.js
const CFG = {

  // ── Map ──────────────────────────────────────────────────────────────────
  MAP_JSON : 'assets/world/2dmap.json?v=2',
  TILE_SIZE: 16,

  // ── All tilesets in the exact order they appear in 2dmap.json ───────────
  // The path values match the `image` field in the JSON (relative to assets/world/).
  // Collection tilesets (Dynamic_props) have no `image` and are skipped by _buildMeta.
  TILESETS: [
    // ── Original tilesets ────────────────────────────────────────────────
    /* 00 */ { key:'grass_base',           path:'assets/world/craftpix-net-189510-grassland-top-down-tileset-pixel-art/PNG/Grassland_Base_Ground.png' },
    /* 01 */ { key:'Flowing_water_3',      path:'assets/world/craftpix-net-189510-grassland-top-down-tileset-pixel-art/PNG/Grassland_water_detilazation_v2.png' },
    /* 02 */ { key:'dessert_beach',        path:'assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/PNG/Desert_Ground_grass.png' },
    /* 03 */ { key:'grass_side_water',     path:'assets/world/craftpix-net-189510-grassland-top-down-tileset-pixel-art/PNG/Grassland_Water_coasts.png' },
    /* 04 */ { key:'farm_house',           path:'assets/world/craftpix-net-471853-top-down-farm-with-animals-pixel-art-asset-pack/PNG/Farm_Houses.png' },
    /* 05 */ { key:'vegetables',           path:'assets/world/craftpix-net-471853-top-down-farm-with-animals-pixel-art-asset-pack/PNG/Barn_interior.png' },
    /* 06 */ { key:'forest_and_bricks',    path:'assets/world/craftpix-net-189510-grassland-top-down-tileset-pixel-art/PNG/Grassland_Trees_rocks.png' },
    /* 07 */ { key:'trees_veggies',        path:'assets/world/craftpix-net-471853-top-down-farm-with-animals-pixel-art-asset-pack/PNG/Farm_Plants.png' },
    /* 08 */ { key:'Trees_rocks',          path:'assets/world/craftpix-net-189510-grassland-top-down-tileset-pixel-art/PNG/Grassland_Trees_rocks.png' },
    /* 09 */ { key:'Grassland_details',    path:'assets/world/craftpix-net-189510-grassland-top-down-tileset-pixel-art/PNG/Grassland_Details.png' },
    /* 10 */ { key:'dungeon_left_assets',  path:'assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/PNG/Desert_Objects_animated.png' },
    /* 11 */ { key:'fruit_trees',          path:'assets/world/craftpix-net-471853-top-down-farm-with-animals-pixel-art-asset-pack/Tiled_files/Farm2_trees.png' },
    /* 12 */ { key:'fence_animation',      path:'assets/world/craftpix-net-471853-top-down-farm-with-animals-pixel-art-asset-pack/Tiled_files/Farm2_wicket_animation.png' },
    /* 13 */ { key:'Farm_Road',            path:'assets/world/craftpix-net-471853-top-down-farm-with-animals-pixel-art-asset-pack/Tiled_files/Farm2_Road.png' },
    /* 14 */ { key:'ground_grass_bricks',  path:'assets/world/craftpix-net-471853-top-down-farm-with-animals-pixel-art-asset-pack/Tiled_files/Farm2_ground_grass_bricks.png' },
    /* 15 */ { key:'Houses',               path:'assets/world/craftpix-net-471853-top-down-farm-with-animals-pixel-art-asset-pack/Tiled_files/Farm2_Houses.png' },
    /* 16 */ { key:'Chicken_animation',    path:'assets/world/craftpix-net-471853-top-down-farm-with-animals-pixel-art-asset-pack/Tiled_files/Farm2_Chicken_animation.png' },
    /* 17 */ { key:'veggies_Plants_farm',  path:'assets/world/craftpix-net-471853-top-down-farm-with-animals-pixel-art-asset-pack/Tiled_files/Farm2_Plants.png' },
    /* 18 */ { key:'Flowing_water_1',      path:'assets/world/craftpix-net-471853-top-down-farm-with-animals-pixel-art-asset-pack/Tiled_files/Farm2_water_detilazation.png' },
    /* 19 */ { key:'More_trees_green',     path:'assets/world/craftpix-net-471853-top-down-farm-with-animals-pixel-art-asset-pack/Tiled_files/Farm2_Objects_outside.png' },
    /* 20 */ { key:'fishes',               path:'assets/world/craftpix-net-471853-top-down-farm-with-animals-pixel-art-asset-pack/Tiled_files/Farm2_fishes.png' },
    /* 21 */ { key:'Cow_animation',        path:'assets/world/craftpix-net-471853-top-down-farm-with-animals-pixel-art-asset-pack/Tiled_files/Farm2_Cow_animation.png' },
    /* 22 */ { key:'Ground_grass_details', path:'assets/world/craftpix-net-471853-top-down-farm-with-animals-pixel-art-asset-pack/Tiled_files/Farm2_Ground_grass_details.png' },
    /* 23 */ { key:'house_windows',        path:'assets/world/craftpix-net-471853-top-down-farm-with-animals-pixel-art-asset-pack/Tiled_files/Farm2_house_windows.png' },
    /* 24 */ { key:'Doors',                path:'assets/world/craftpix-net-471853-top-down-farm-with-animals-pixel-art-asset-pack/Tiled_files/Farm2_Doors.png' },
    /* 25 */ { key:'bridge',               path:'assets/world/craftpix-net-189510-grassland-top-down-tileset-pixel-art/Tiled_files/Ground_Water_coasts.png' },
    /* 26 */ { key:'Ground_grass',         path:'assets/world/craftpix-net-189510-grassland-top-down-tileset-pixel-art/Tiled_files/ground_grasss.png' },
    /* 27 */ { key:'Right_dungeon',        path:'assets/world/craftpix-net-695666-free-undead-tileset-top-down-pixel-art/Tiled_files/undead_Objects_animated.png' },
    /* 28 */ { key:'dungeon_wall',         path:'assets/world/craftpix-net-688848-cave-tileset-top-down-pixel-art/Tiled_files/cave_Ground.png' },
    /* 29 */ { key:'mines_details',        path:'assets/world/craftpix-net-688848-cave-tileset-top-down-pixel-art/Tiled_files/cave_details.png' },
    /* 30 */ { key:'Crystals_rocks',       path:'assets/world/craftpix-net-688848-cave-tileset-top-down-pixel-art/Tiled_files/cave_Objects.png' },
    /* 31 */ { key:'dark_mine_spots',      path:'assets/world/craftpix-net-688848-cave-tileset-top-down-pixel-art/Tiled_files/cave_spots.png' },
    /* 32 */ { key:'dark_brown_coast',     path:'assets/world/craftpix-net-688848-cave-tileset-top-down-pixel-art/Tiled_files/cave_Water_coasts.png' },
    /* 33 */ { key:'volcano_yellow_small', path:'assets/world/craftpix-net-688848-cave-tileset-top-down-pixel-art/PNG/cave_bubbles_source.png' },
    /* 34 */ { key:'Lava',                 path:'assets/world/craftpix-net-688848-cave-tileset-top-down-pixel-art/Tiled_files/cave_Lava.png' },
    /* 35 */ { key:'Flowingg_water_4',     path:'assets/world/craftpix-net-189510-grassland-top-down-tileset-pixel-art/Tiled_files/Ground_water_detilazation_v2.png' },
    /* 36 */ { key:'road_Details',         path:'assets/world/craftpix-net-189510-grassland-top-down-tileset-pixel-art/Tiled_files/Ground_Details.png' },
    /* 37 */ { key:'Trees_rocks_v1',       path:'assets/world/craftpix-net-189510-grassland-top-down-tileset-pixel-art/Tiled_files/Ground_Trees_rocks.png' },
    /* 38 */ { key:'Flowing_water_2',      path:'assets/world/craftpix-net-189510-grassland-top-down-tileset-pixel-art/Tiled_files/Ground_water_detilazation.png' },
    /* 39 */ { key:'beach_coast_sand',     path:'assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/Tiled_files/dessert_Water_coasts.png' },
    /* 40 */ { key:'lite_dessert_spots',   path:'assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/Tiled_files/dessert_spots.png' },
    /* 41 */ { key:'Dessert_Objects',      path:'assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/Tiled_files/dessert_Objects.png' },
    /* 42 */ { key:'sand_flowing',         path:'assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/Tiled_files/dessert_sand.png' },
    /* 43 */ { key:'rocks_details',        path:'assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/Tiled_files/dessert_rocks_details.png' },
    /* 44 */ { key:'dessert_grass_path',   path:'assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/Tiled_files/dessert_Ground_grass.png' },
    /* 45 */ { key:'Dessert_Details',      path:'assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/Tiled_files/dessert_Details.png' },

    // ── cave_Objects appears at two firstgids (same image — load once, key both) ─
    /* 46 */ { key:'cave_objects_b',       path:'assets/world/craftpix-net-688848-cave-tileset-top-down-pixel-art/Tiled_files/cave_Objects.png' },

    // ── Top-extension tilesets ─────────────────────────────────────────────
    /* 47 */ { key:'objects_animated_top',    path:'assets/world/top_map_extension/map/Tiled_files/Objects_animated.png'  },
    /* 48 */ { key:'water_coasts_top',        path:'assets/world/top_map_extension/map/Tiled_files/Water_coasts.png'      },
    /* 49 */ { key:'crystals_rocks_top',      path:'assets/world/top_map_extension/map/Tiled_files/Objects.png'           },
    /* 50 */ { key:'lava_top',                path:'assets/world/top_map_extension/map/Tiled_files/Lava.png'              },
    /* 51 */ { key:'bubbles_top',             path:'assets/world/top_map_extension/map/Tiled_files/bubbles.png'           },
    /* 52 */ { key:'details_top',             path:'assets/world/top_map_extension/map/Tiled_files/details.png'           },
    /* 53 */ { key:'ground_top',              path:'assets/world/top_map_extension/map/Tiled_files/Ground.png'            },
    /* 54 */ { key:'objects_animated2_top',   path:'assets/world/top_map_extension/map/Tiled_files/Objects_animated2.png' },
    /* 55 */ { key:'lava_detilazation_top',   path:'assets/world/top_map_extension/map/Tiled_files/lava_detilazation.png' },
    /* 56 */ { key:'spots_top',               path:'assets/world/top_map_extension/map/Tiled_files/spots.png'             },
    /* 57 */ { key:'water_detilazation2_top', path:'assets/world/top_map_extension/map/Tiled_files/Water_detilazation2.png' },

    // ── Left-extension tilesets ───────────────────────────────────────────
    /* 58 */ { key:'spots_left',              path:'assets/world/left_map_extention/map/Tiled_files/spots.png'            },
    /* 59 */ { key:'sand_left',               path:'assets/world/left_map_extention/map/Tiled_files/sand.png'             },
    /* 60 */ { key:'objects_left',            path:'assets/world/left_map_extention/map/Tiled_files/Objects.png'          },
    /* 61 */ { key:'rocks_details_left',      path:'assets/world/left_map_extention/map/Tiled_files/rocks_details.png'    },
    /* 62 */ { key:'animated_objects_left',   path:'assets/world/left_map_extention/map/Tiled_files/Animated_objects.png' },
    /* 63 */ { key:'ground_grass_left',       path:'assets/world/left_map_extention/map/Tiled_files/Ground_grass.png'     },
    /* 64 */ { key:'details_left',            path:'assets/world/left_map_extention/map/Tiled_files/Details.png'          },
    /* 65 */ { key:'water_detilazation_left', path:'assets/world/left_map_extention/map/Tiled_files/water_detilazation.png' },
    /* 66 */ { key:'water_coasts_left',       path:'assets/world/left_map_extention/map/Tiled_files/Water_coasts.png'     },
    // shared Water_detilazation2.png (TSX reference – same image as top_map_extension)
    /* 67 */ { key:'water_detilazation2_left',path:'assets/world/left_map_extention/map/Tiled_files/Water_detilazation2.png' },

    // ── Right-extension tilesets (Skeleton Dungeon) ───────────────────────
    /* 68 */ { key:'water_detilazation_right',  path:'assets/world/right_map_extention/Skeleton Dungeon/map/Tiled_files/water_detilazation.png'  },
    /* 69 */ { key:'water_coasts_right',         path:'assets/world/right_map_extention/Skeleton Dungeon/map/Tiled_files/water_coasts.png'        },
    /* 70 */ { key:'objects_animated3_right',    path:'assets/world/right_map_extention/Skeleton Dungeon/map/Tiled_files/Objects_animated3.png'   },
    /* 71 */ { key:'ground_rocks_right',         path:'assets/world/right_map_extention/Skeleton Dungeon/map/Tiled_files/Ground_rocks.png'        },
    /* 72 */ { key:'objects_right',              path:'assets/world/right_map_extention/Skeleton Dungeon/map/Tiled_files/Objects.png'             },
    /* 73 */ { key:'objects_animated_right',     path:'assets/world/right_map_extention/Skeleton Dungeon/map/Tiled_files/Objects_animated.png'    },
    /* 74 */ { key:'details_right',              path:'assets/world/right_map_extention/Skeleton Dungeon/map/Tiled_files/details.png'             },
  ],

  // ── Player / Swordsman Lv1 ───────────────────────────────────────────────
  PLAYER: {
    SPEED        : 100,
    RUN_SPEED    : 160,
    START_X      : 552,
    START_Y      : 1488,  // farm area center in the 180x140 map
    SCALE        : 1.0,
    BODY_W       : 12,
    BODY_H       : 18,
    INTERACT_DIST: 72,
    OFFSET_Y     : 28,
    FRAME_W      : 64,
    FRAME_H      : 64,
    BASE_PATH    : 'assets/characters/swordsman/swordsman_level_1/',
    SHEETS: {
      idle    : { file:'Swordsman_lvl1_Idle_with_shadow.png',        frames:12 },
      walk    : { file:'Swordsman_lvl1_Walk_with_shadow.png',        frames:6  },
      run     : { file:'Swordsman_lvl1_Run_with_shadow.png',         frames:8  },
      attack  : { file:'Swordsman_lvl1_attack_with_shadow.png',      frames:8  },
      walkAtk : { file:'Swordsman_lvl1_Walk_Attack_with_shadow.png', frames:6  },
      runAtk  : { file:'Swordsman_lvl1_Run_Attack_with_shadow.png',  frames:8  },
      hurt    : { file:'Swordsman_lvl1_Hurt_with_shadow.png',        frames:5  },
      death   : { file:'Swordsman_lvl1_Death_with_shadow.png',       frames:7  },
    },
    DIRS: ['down','up','left','right'],
  },

  // ── Farming ──────────────────────────────────────────────────────────────
  FARMING: {
    STAGE_MS : 20_000,
    STAGES   : 4,
    YIELD    : 3,
    SOIL_SIZE: 32,
    SEEDS: {
      blue_berries: { name:'Blue Berries', color:0x4488FF },
      EggPlant:     { name:'Egg Plant',    color:0x8800AA },
      corn:         { name:'Corn',         color:0xFFDD00 },
      pumpkin:      { name:'Pumpkin',      color:0xFF6600 },
      red_berries:  { name:'Red Berries',  color:0xFF2244 },
      spinach:      { name:'Spinach',      color:0x22CC44 },
      tomato:       { name:'Tomato',       color:0xFF3300 },
      watermelon:   { name:'Watermelon',   color:0x33CC33 },
    },
  },

  // ── Trees ────────────────────────────────────────────────────────────────
  TREES: {
    CHOP_HITS  : 3,
    SCALE      : 2.2,
    RESPAWN_MS : 60_000,
    YIELD_WOOD : 3,
    AXES: {
      oak:    'oak_axe',
      pine:   'pine_axe',
      walnut: 'walnut_axe',
    },
  },

  // ── Mining ───────────────────────────────────────────────────────────────
  MINING: {
    RESPAWN_MS: 90_000,
    PICKAXES: {
      stone_pickaxe:  { tier:1, label:'Stone Pickaxe'  },
      bronze_pickaxe: { tier:2, label:'Bronze Pickaxe' },
      gold_pickaxe:   { tier:3, label:'Gold Pickaxe'   },
    },
  },

  // ── Inventory ────────────────────────────────────────────────────────────
  INVENTORY: {
    COLS:5, ROWS:4, SLOT_SIZE:48, GAP:6,
  },

  // ── Hotkeys ──────────────────────────────────────────────────────────────
  KEY_INTERACT : 'F',
  KEY_INVENTORY: 'I',
  KEY_RUN      : 'SHIFT',
};