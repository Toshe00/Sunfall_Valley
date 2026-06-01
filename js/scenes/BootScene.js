// js/scenes/BootScene.js
class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    this._buildLoadingBar();
    this.load.on('progress', v => {
      this._barFill.clear();
      this._barFill.fillStyle(0x44aaff, 1);
      this._barFill.fillRoundedRect(this.scale.width/2 - 196, this.scale.height/2 - 16, 392 * v, 32, 16);
      this._pct.setText(Math.floor(v * 100) + '%');
    });
    this.load.on('loaderror', f => {
      console.warn('[ASSET MISSING]', f.key, '→', f.src);
    });

    // ── Map JSON ──────────────────────────────────────────────────────────
    this.load.json('mapjson', CFG.MAP_JSON);

    // ── All tileset images (drives both tile rendering and _buildMeta) ────
    for (const ts of CFG.TILESETS) {
      this.load.image(ts.key, ts.path);
    }

    // ── Swordsman spritesheets ────────────────────────────────────────────
    const p = CFG.PLAYER;
    for (const [animKey, sheet] of Object.entries(p.SHEETS)) {
      this.load.spritesheet('sw_' + animKey, p.BASE_PATH + sheet.file,
        { frameWidth: p.FRAME_W, frameHeight: p.FRAME_H });
    }

    // forest_and_bricks also used by TreeSystem stump-baking
    this.load.image('forest_and_bricks',
      CFG.TILESETS.find(t => t.key === 'forest_and_bricks')?.path ?? '');

    // ── Farming ───────────────────────────────────────────────────────────
    this.load.image('dig_holes', 'assets/items/farm/dig_holes.png');

    // ── UI ────────────────────────────────────────────────────────────────
    this.load.image('ui_inventory_custom', 'assets/ui/PNG/inventory.png');
    this.load.image('ui_hotbar',           'assets/ui/PNG/Action_panel.png');
    this.load.image('ui_healthbar',        'assets/ui/PNG/HealthBar_full.png');

    // ── Axes ──────────────────────────────────────────────────────────────
    this.load.image('oak_axe',    'assets/items/weapons/oak_axe.png');
    this.load.image('pine_axe',   'assets/items/weapons/pine_axe.png');
    this.load.image('walnut_axe', 'assets/items/weapons/walnut_axe.png');
    this.load.image('gold_axe',   'assets/items/weapons/gold_axe.png');

    // ── Pickaxes ──────────────────────────────────────────────────────────
    this.load.image('stone_pickaxe',  'assets/items/weapons/stone_pick_Axe.png');
    this.load.image('bronze_pickaxe', 'assets/items/weapons/Bronze_pick_Axe.png');
    this.load.image('iron_pickaxe',   'assets/items/weapons/iron_pick_Axe.png');
    this.load.image('gold_pickaxe',   'assets/items/weapons/gold_pick_axe.png');

    // ── Crop sheets + harvest icons ───────────────────────────────────────
    const cropKeys = Object.keys(FarmingSystem.CROP_TYPES);
    for (const key of cropKeys) {
      this.load.image('crop_'     + key, `assets/items/farm/${key}.png`);
      this.load.image('inv_icon_' + key, `assets/items/inventory/${key}.png`);
    }

    // ── Seed icons ────────────────────────────────────────────────────────
    const seedIconMap = {
      blue_berries: 'blueberry_seeds',
      EggPlant:     'brinjal_seeds',
      corn:         'corn_seeds',
      pumpkin:      'pumpkin_seeeds',
      red_berries:  'redberries_seeds',
      spinach:      'spinach_seeds',
      tomato:       'tomato_seeds',
      watermelon:   'watermelon_seeds',
    };
    for (const [cropKey, iconFile] of Object.entries(seedIconMap)) {
      this.load.image('seed_icon_' + cropKey,
        `assets/items/Seeds/Icons/${iconFile}.png`);
    }

    this.load.image('no_fruit_tree', 'assets/items/farm/no_fruit_tree.png');

    // ── Ore inventory icons ───────────────────────────────────────────────
    this.load.image('inv_icon_stone',  'assets/items/ore_tree/PNG/rocks/rock_small.png');
    this.load.image('inv_icon_bronze', 'assets/items/ore_tree/PNG/bronze/Bronze_small.png');
    this.load.image('inv_icon_iron',   'assets/items/ore_tree/PNG/Iron/Iron_small.png');
    this.load.image('inv_icon_gold',   'assets/items/ore_tree/PNG/gold/gold_small.png');
    // Undead ore inventory icon — the small crystal from the right extension
    this.load.image('inv_icon_undead_ore',
      'assets/world/right_map_extention/Skeleton Dungeon/map/PNG/Objects_separately/Crystal_shadow1_3.png');
    // Lava ore inventory icon — same Volcano4 image used as the ore prop
    this.load.image('inv_icon_lava_ore',
      'assets/world/top_map_extension/map/PNG/Objects_separately/Volcano4_dark_shadow_frame5.png');

    // ── Wood inventory icons ──────────────────────────────────────────────
    this.load.image('inv_icon_oak_wood',    'assets/items/ore_tree/PNG/oak_wood_icon.png');
    this.load.image('inv_icon_pine_wood',   'assets/items/ore_tree/PNG/pine_wood_icon.png');
    this.load.image('inv_icon_walnut_wood', 'assets/items/ore_tree/PNG/wallnut_wood_icon.png');
    this.load.image('inv_icon_apple',       'assets/items/inventory/Apple_HL.png');

    // ── Helper: register a dynamic-prop image under key "dp_<resolvedPath>" ─
    const _dp = (path) => {
      const key = 'dp_' + path;
      if (!this.textures.exists(key)) this.load.image(key, path);
    };

    // ── Original dynamic props (assets/world/dynamic_props/) ─────────────
    [
      'Broken_tree1','Broken_tree2','Broken_tree4','Broken_tree5',
      'Bush1','Bush4','Bush5','Bush6','Bush7','Bush11','Bush12','Bush14','Bush19',
      'Cactus1_grass_shadow3',
      'Farm_Houses',
      'Flower1','Flower2','Flower3','Flower7','Flower8','Flower9','Flower10',
      'Grave_shadow2_5',
      'ground_element20','ground_element21',
      'Rock_grass_element13',
      'Rpck_grass1','Rpck_grass2','Rpck_grass3','Rpck_grass4','Rpck_grass5',
      'Stone1_ground_shadow','Stone2_ground_shadow',
      'Stone3_grass_shadow','Stone3_ground_shadow',
      'Stone4_grass_shadow','Stone4_ground_shadow',
      'Stone5_grass_shadow','Stone5_ground_shadow',
      'Tree1','Tree2','Tree3','Tree4','Tree5',
    ].forEach(f => _dp(`assets/world/dynamic_props/${f}.png`));

    // ── Ore prop images (big = placed prop, small = stump icon) ──────────
    [
      'assets/items/ore_tree/PNG/rocks/rock_big.png',
      'assets/items/ore_tree/PNG/rocks/rock_small.png',
      'assets/items/ore_tree/PNG/bronze/Bronze_big.png',
      'assets/items/ore_tree/PNG/bronze/Bronze_small.png',
      'assets/items/ore_tree/PNG/Iron/iron_big.png',
      'assets/items/ore_tree/PNG/Iron/Iron_small.png',
      'assets/items/ore_tree/PNG/gold/gold_big.png',
      'assets/items/ore_tree/PNG/gold/gold_small.png',
      // Legacy flat ore icons used by the old collection tileset entries
      'assets/items/ore_tree/PNG/bronze.png',
      'assets/items/ore_tree/PNG/gold.png',
      'assets/items/ore_tree/PNG/stone.png',
      'assets/items/ore_tree/PNG/iron.png',
    ].forEach(_dp);

    // ── Tree props ────────────────────────────────────────────────────────
    _dp('assets/items/trees/pine_tree.png');
    _dp('assets/items/trees/walnut_tree.png');

    // ── TOP-MAP EXTENSION dynamic prop objects (128px) ────────────────────
    [
      'Building1_dark_shadow','Building2_light_shadow','cocoon_web',
      'Demon_scull_dark_shadow',
      'Dinosaur_skeleton_part1_dark_shadow','Dinosaur_skeleton_part2_dark_shadow',
      'Gates_dark_shadow3',
      'white_crystal_light_shadow2','white_crystal_light_shadow3',
    ].forEach(f => _dp(`assets/world/top_map_extension/Object/PNG/Objects_separately/128/${f}.png`));

    // 256px
    ['centipede_dark_shadow2'].forEach(f =>
      _dp(`assets/world/top_map_extension/Object/PNG/Objects_separately/256/${f}.png`));

    // 64px
    [
      'Beige_rpck_dark_shadow3','Beige_rpck_light_shadow2','Beige_rpck_light_shadow3',
      'caveman_statue_dark_shadow2',
      'Dinosaur_skeleton__head_dark_shadow',
      'mushroom4_light_shadow2','white_crystal_light_shadow5',
    ].forEach(f => _dp(`assets/world/top_map_extension/Object/PNG/Objects_separately/64/${f}.png`));

    // 32px
    [
      'Blue-green_crystal_dark_shadow3',
      'crystal_blue-green_vertical2','crystal_blue-green_vertical4',
      'Human_skeleton_dark_shadow',
      'mushroom4_light_shadow3','white_crystal_dark_shadow3',
    ].forEach(f => _dp(`assets/world/top_map_extension/Object/PNG/Objects_separately/32/${f}.png`));

    // map-scale top objects
    [
      'black_stalagmites_dark_shadow1',
      'Blue_stone_dark_shadow1','Blue_stone_dark_shadow2','Blue_stone_vertical4',
      'Demon_hand_dark_shadow_frame1','Demon_head_dark_shadow_frame1',
      'gates1',
      'gray_stalagmites_dark_shadow1','gray_stalagmites_dark_shadow2',
      'Green_stone_dark_shadow1','Green_stone_dark_shadow2',
      'Orange_stone_dark_shadow1',
      'Red_stone_dark_shadow1',
      'Slime_musroom_dark_shadow1','Slime_musroom_dark_shadow2',
      'small_mushrooms_dark_shadow1','small_mushrooms_white_dark_shadow1',
      'spider_element1_light_shadow','spider_element2_light_shadow','spider_element3_dark_shadow',
      'the_spider',
      'Volcano2_light_shadow_frame6','Volcano3_dark_shadow_frame1',
      'Volcano3_light_shadow_frame6','Volcano4_dark_shadow_frame5',
      'Walls_elements11',
      'Water_rocks2_frame5','Water_rocks3_frame5',
      'web1',
      'Yellow_stone_light_shadow2','Yellow_stone_light_shadow4',
    ].forEach(f => _dp(`assets/world/top_map_extension/map/PNG/Objects_separately/${f}.png`));

    // ── LEFT-MAP EXTENSION dynamic prop objects ───────────────────────────
    [
      'Arthropods_grass_shadow1','Arthropods_sand_shadow2',
      'Bones_grass_shadow2','Bones_grass_shadow3',
      'Bones_sand_shadow1','Bones_sand_shadow2',
      'Cactus2_grass_shadow1','Cactus2_grass_shadow2','Cactus2_sand_shadow2',
      'Flower_grass_shadow2','Flower_grass_shadow3',
      'House_stump_grass_shadow',
      'Plant_grass_shadow1','Plant_grass_shadow2','Plant_sand_shadow1',
      'Roots_grass_shadow1',
      'Scarabaeus_house_sand_shadow',
      'Statues_grass_shadow1','Statues_sand_shadow2',
      'The_beast_grass_shadow1','The_beast_grass_shadow6',
      'Trees2_sand_shadow2','Trees2_sand_shadow3',
      'Trees41','Trees43',
      'trilobite_house_grass_shadow',
    ].forEach(f => _dp(`assets/world/left_map_extention/objects/PNG/Objects_separately/${f}.png`));

    // ── Desert extension props (from craftpix desert pack PNG/Objects_separately) ─
    [
      'Bone_element_grass_shadow1','Bone_element_grass_shadow4',
      'Bone_sand_shadpw',
      'Bones_sand_shadow5',
      'Cactus1_grass_shadow1','Cactus1_grass_shadow2',
      'Grass_element3','Grass_element3_3_sand_shadow',
      'pyramid_sand_shadow1',
      'Red_flower1','Red_flower3',
      'Rock14_6',
      'Sand_element4','Sand_element6',
      'Small_bush3',
      'Tree2_grass_shadow2','Tree2_sand_shadow2',
      'Violet_flower1','Violet_flower3',
      'White_flower1',
    ].forEach(f => _dp(`assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/PNG/Objects_separately/${f}.png`));

    // ── RIGHT-MAP EXTENSION dynamic prop objects (Skeleton Dungeon) ───────
    // objects/PNG/Objects_separately
    [
      'bone_arm_sword_shadow1',
      'bone_monster_head_shadow2','bone_monster_head_shadow3',
      'bone_monster_paw_shadow3',
      'bone_pelvis_shadow3',
      'coffin1_shadow1',
      'excavated_grave4_shadow3',
      'grave1_shadow2','grave2_shadow2','grave3_shadow3',
      'grave4_shadow3','grave5_shadow3','grave6_shadow3',
      'lich_shadow1',
      'monster_tree1_shadow3',
      'mushroom1_2_shadow2','mushroom2_2_shadow3',
      'scolopendra_shadow3','scolopendra_tail_shadow3',
      'skull_chasm_shadow2','skull_chasm_shadow3',
      'skull_pile_shadow1','skull_pile_shadow3',
      'undead_plant1_shadow1',
      'web_rock1_shadow1','web_rock1_shadow3',
      'web_tree1_shadow1','web_tree1_shadow3',
    ].forEach(f => _dp(`assets/world/right_map_extention/Skeleton Dungeon/objects/PNG/Objects_separately/${f}.png`));

    // map/PNG/Objects_separately
    [
      'Bones_shadow1_1','Bones_shadow1_4','Bones_shadow1_9',
      'Bones_shadow1_10','Bones_shadow1_12',
      'Bones_shadow3_1','Bones_shadow3_2','Bones_shadow3_3','Bones_shadow3_12',
      'Crystal_shadow3_1','Crystal_shadow3_2',
      'Dead_arm_shadow2_3',
      'Lich_shadow2',
      'Pile_sculls_shadow2',
      'Plant__shadow2_2',
      'Plant_shadow3_1','Plant_shadow3_5',
      'Rock_shadow1_5',
      'Ruin_shadow1_3',
      'Scull_door_shadow3',
      'Thorn_palnt_shadow2_2','Thorn_palnt_shadow2_4',
      // ── Undead ore visuals (crystal) ────────────────────────────────────
      'Crystal_shadow1_1','Crystal_shadow1_2',   // big ore prop
      'Crystal_shadow1_3','Crystal_shadow1_4',   // small leftover
      // ── Undead tree (cuttable with gold_axe) ────────────────────────────
      'Tree_shadow2_1','Tree_shadow2_2','Tree_shadow2_3',
      // ── Undead tree stump ────────────────────────────────────────────────
      'Broken_tree_shadow2_1','Broken_tree_shadow2_1-1',
      'Broken_tree_shadow2_2','Broken_tree_shadow2_2-1',
      'Broken_tree_shadow2_3','Broken_tree_shadow2_3-1',
      'Broken_tree_shadow2_4','Broken_tree_shadow2_5',
      'Broken_tree_shadow2_6','Broken_tree_shadow2_7',
    ].forEach(f => _dp(`assets/world/right_map_extention/Skeleton Dungeon/map/PNG/Objects_separately/${f}.png`));

    // ── Desert extension cuttable trees ───────────────────────────────────
    [
      'Cactus3_ground_shadow1','Cactus3_ground_shadow2','Cactus3_ground_shadow3',
      'Tree4_sand_shadow1','Tree4_sand_shadow2','Tree4_sand_shadow3',
    ].forEach(f => _dp(`assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/PNG/Objects_separately/${f}.png`));
  }

  create() {
    this.scene.launch('GameScene');
    this.scene.launch('UIScene');
    this.scene.bringToTop('UIScene');
    this.scene.stop('BootScene');
  }

  _buildLoadingBar() {
    const W = this.scale.width, H = this.scale.height;
    this.add.rectangle(0, 0, W, H, 0x0f172a).setOrigin(0, 0);
    this.add.graphics()
      .fillStyle(0x1e293b, 1)
      .fillRoundedRect(W/2 - 200, H/2 - 20, 400, 40, 20);
    this._barFill = this.add.graphics();
    this._pct = this.add.text(W/2, H/2, '0%', {
      fontFamily: 'Montserrat, "Segoe UI", sans-serif',
      fontSize: '16px', fontStyle: 'bold', fill: '#ffffff', resolution: 2
    }).setOrigin(0.5);
    this.add.text(W/2, H/2 - 50, "⚔️  Loading Vally Game...", {
      fontFamily: 'Montserrat, "Segoe UI", sans-serif',
      fontSize: '22px', fontStyle: 'bold', fill: '#facc15',
      stroke: '#000000', strokeThickness: 4, resolution: 2
    }).setOrigin(0.5);
  }
}