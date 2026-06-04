// js/scenes/BootScene.js
class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    this._queuedImageKeys = new Set();

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
    for (const [assetKey, assetDef] of Object.entries(p.HERO_ASSETS ?? {})) {
      for (const [animKey, sheet] of Object.entries(assetDef.sheets ?? {})) {
        this.load.spritesheet(`${assetKey}_${animKey}`, assetDef.basePath + sheet.file, {
          frameWidth: assetDef.frameW ?? p.FRAME_W,
          frameHeight: assetDef.frameH ?? p.FRAME_H,
        });
      }
    }

    // Enemy spritesheets
    for (const [enemyKey, assetDef] of Object.entries(CFG.ENEMIES?.ASSETS ?? {})) {
      for (const [animKey, sheet] of Object.entries(assetDef.sheets ?? {})) {
        this.load.spritesheet(`enemy_${enemyKey}_${animKey}`, assetDef.basePath + sheet.file, {
          frameWidth: assetDef.frameW,
          frameHeight: assetDef.frameH,
        });
      }
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
    this.load.image('ui_character_panel',  'assets/ui/PNG/character_panel.png');

    // ── Axes ──────────────────────────────────────────────────────────────
    this.load.image('oak_axe',    'assets/items/weapons/gold_axe.png');
    this.load.image('pine_axe',   'assets/items/weapons/pine_axe.png');
    this.load.image('walnut_axe', 'assets/items/weapons/walnut_axe.png');
    this.load.image('gold_axe',   'assets/items/weapons/gold_axe_icon_4_12.png');

    // ── Pickaxes ──────────────────────────────────────────────────────────
    this.load.image('stone_pickaxe',  'assets/items/weapons/stone_pick_Axe.png');
    this.load.image('bronze_pickaxe', 'assets/items/weapons/Bronze_pick_Axe.png');
    this.load.image('iron_pickaxe',   'assets/items/weapons/iron_pick_axe.png');
    this.load.image('gold_pickaxe',   'assets/items/weapons/gold_pick.png');

    // Sword
    this.load.image('sword', 'assets/items/weapon_icon_2/Icons/Icon_4_06.png');
    this.load.image('harvest_scythe', 'assets/items/weapons/icons_29_03.png');

    // ── Crop sheets + harvest icons ───────────────────────────────────────
    const cropKeys = Object.keys(FarmingSystem.CROP_TYPES);
    for (const key of cropKeys) {
      this.load.image('crop_'     + key, `assets/items/farm/${key}.png`);
      this.load.image('inv_icon_' + key, `assets/items/inventory/${key}.png`);
    }

    // ── Seed icons ────────────────────────────────────────────────────────
    const seedIconMap = {
      blue_berries: 'blueberry_seeds',
      brinjal:      'icons_29_100',
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
    this.load.image('inv_icon_bronze_ore_v2', 'assets/items/ore_tree/PNG/bronze_ore_icon.png?v=ore-icons-20260603');
    this.load.image('inv_icon_iron_ore_v2',   'assets/items/ore_tree/PNG/iron_ore_icon.png?v=ore-icons-20260603');
    this.load.image('inv_icon_gold_ore_v2',   'assets/items/ore_tree/PNG/gold_ore_icon.png?v=ore-icons-20260603');
    // Undead ore inventory icon — the small crystal from the right extension
    this.load.image('inv_icon_undead_ore',
      'assets/world/craftpix-net-695666-free-undead-tileset-top-down-pixel-art/PNG/Objects_separately/Crystal_shadow1_3.png');
    // Lava ore inventory icon — same Volcano4 image used as the ore prop
    this.load.image('inv_icon_lava_ore',
      'assets/world/craftpix-net-688848-cave-tileset-top-down-pixel-art/PNG/Objects_separately/Volcano4_dark_shadow_frame5.png');

    // ── Wood inventory icons ──────────────────────────────────────────────
    this.load.image('inv_icon_oak_wood',    'assets/items/ore_tree/PNG/oak_wood_icon.png');
    this.load.image('inv_icon_pine_wood',   'assets/items/ore_tree/PNG/pine_wood_icon.png');
    this.load.image('inv_icon_walnut_wood', 'assets/items/ore_tree/PNG/wallnut_wood_icon.png');
    this.load.image('inv_icon_ancient_wood','assets/items/ore_tree/PNG/ancient_wood_icon.png');
    this.load.image('inv_icon_apple',       'assets/items/inventory/Apple_HL.png');

    // ── Helper: register a dynamic-prop image under key "dp_<resolvedPath>" ─
    const _dp = (path) => this._queueImageOnce('dp_' + path, path);

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
    ].forEach(f => _dp(`assets/world/craftpix-net-688848-cave-tileset-top-down-pixel-art/PNG/Objects_separately/${f}.png`));

    // ── LEFT-MAP EXTENSION dynamic prop objects ───────────────────────────
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
    ].forEach(f => _dp(`assets/world/craftpix-net-695666-free-undead-tileset-top-down-pixel-art/PNG/Objects_separately/${f}.png`));

    // ── Desert extension cuttable trees ───────────────────────────────────
    [
      'Cactus3_ground_shadow1','Cactus3_ground_shadow2','Cactus3_ground_shadow3',
      'Tree4_sand_shadow1','Tree4_sand_shadow2','Tree4_sand_shadow3',
    ].forEach(f => _dp(`assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/PNG/Objects_separately/${f}.png`));
  }

  create() {
    const queuedDecorImages = this._queueDynamicPropImages(this.cache.json.get('mapjson'));
    if (queuedDecorImages > 0) {
      this._pct?.setText('decor');
      this.load.once('complete', () => this._launchGameScenes());
      this.load.start();
      return;
    }
    this._launchGameScenes();
  }

  _launchGameScenes() {
    this.scene.launch('GameScene');
    this.scene.launch('UIScene');
    this.scene.bringToTop('UIScene');
    this.scene.stop('BootScene');
  }

  _queueImageOnce(key, path) {
    if (!key || !path) return false;
    if (this.textures.exists(key) || this._queuedImageKeys?.has(key)) return false;
    this._queuedImageKeys.add(key);
    this.load.image(key, path);
    return true;
  }

  _queueDynamicPropImages(mapData) {
    if (!mapData?.tilesets) return 0;
    const propLayerNames = new Set([
      'dynamic_props_object',
      'dynamic_props_top_extenstion',
      'dynamic_props_right_extention',
      'dynamic_props_left_extention',
      'cuttable_trees_object',
    ]);
    const defs = new Map();
    const usedPaths = new Set();
    let queued = 0;

    for (const tileset of mapData.tilesets) {
      if (tileset.image || !Array.isArray(tileset.tiles)) continue;

      for (const tile of tileset.tiles) {
        if (!tile.image) continue;
        defs.set(tileset.firstgid + tile.id, this._resolveTiledImagePath(tile.image));
      }
    }

    const walk = (layers) => {
      for (const layer of layers ?? []) {
        const layerName = (layer.name || '').toLowerCase().trim();
        if (layer.type === 'objectgroup' && propLayerNames.has(layerName)) {
          for (const obj of layer.objects ?? []) {
            if (!obj.gid) continue;
            const raw = obj.gid & ~(0x80000000|0x40000000|0x20000000);
            const path = defs.get(raw);
            if (path) usedPaths.add(path);
          }
        }
        if (layer.layers) walk(layer.layers);
      }
    };
    walk(mapData.layers);

    for (const path of usedPaths) {
      if (this._queueImageOnce('dp_' + path, path)) queued++;
    }
    return queued;
  }

  _resolveTiledImagePath(imagePath) {
    return imagePath.startsWith('../')
      ? 'assets/' + imagePath.slice(3)
      : 'assets/world/' + imagePath;
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
