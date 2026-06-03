// js/systems/TreeSystem.js
// ─────────────────────────────────────────────────────────────────────────────
// Axe matching:
//   oak_axe    → oak trees
//   pine_axe   → pine trees
//   walnut_axe → walnut trees
//   gold_axe   → desert_tree, cactus, undead_tree, ext_tree  (extension regions)
//
// GID → tree type mapping (Cuttable_trees_object layer):
//   38570 (Tree2.png)                  → ext_tree   (gold_axe)
//   38580 (pine_tree.png)              → pine
//   38581 (walnut_tree.png)            → walnut
//   41062 (Cactus3_ground_shadow1.png) → cactus      (gold_axe)
//   41278 (Tree4_sand_shadow2.png)     → desert_tree (gold_axe)
//   41662 (Tree_shadow2_2.png)         → undead_tree (gold_axe)
//   all others (no GID)                → oak / auto-cycle
// ─────────────────────────────────────────────────────────────────────────────
class TreeSystem {
  constructor(scene, spawnPoints, inventory, player) {
    this.scene     = scene;
    this.inventory = inventory;
    this.player    = player;
    this._trees    = [];

    this.DEBUG_SHOW_HITBOX = false;

    this.TREE_TYPES = {
      // ── Original trees ───────────────────────────────────────────────────
      oak:    { axeKey:'oak_axe',    label:'Oak',         hitR:22, yieldWood:3, respawnMs: 60_000, stumpOffsetY:27, dropKey:'oak_wood',       iconKey:'inv_icon_oak_wood'    },
      pine:   { axeKey:'pine_axe',   label:'Pine',        hitR:20, yieldWood:4, respawnMs: 90_000, stumpOffsetY: 0, dropKey:'pine_wood',      iconKey:'inv_icon_pine_wood'   },
      walnut: { axeKey:'walnut_axe', label:'Walnut',      hitR:24, yieldWood:5, respawnMs:120_000, stumpOffsetY: 0, dropKey:'walnut_wood',    iconKey:'inv_icon_walnut_wood' },

      // ── Extension trees (all require gold_axe) ───────────────────────────
      ext_tree:      { axeKey:'gold_axe', label:'Ancient',      hitR:26, yieldWood:4, respawnMs:150_000, stumpOffsetY: 0,               dropKey:'ancient_wood',     iconKey:'inv_icon_ancient_wood' },
      desert_tree:   { axeKey:'gold_axe', label:'Desert',       hitR:20, yieldWood:3, respawnMs:120_000, stumpOffsetY: 0,               dropKey:'desert_wood',      iconKey:'dp_assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/PNG/Objects_separately/Tree4_sand_shadow2.png' },
      cactus:        { axeKey:'gold_axe', label:'Cactus',       hitR:18, yieldWood:2, respawnMs: 90_000, stumpOffsetY: 0, noStump:true,  dropKey:'cactus_wood',      iconKey:'dp_assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/PNG/Objects_separately/Cactus3_ground_shadow1.png' },
      undead_tree:   { axeKey:'gold_axe', label:'Undead',       hitR:22, yieldWood:5, respawnMs:180_000, stumpOffsetY: 0,               dropKey:'undead_wood',      iconKey:'dp_assets/world/craftpix-net-695666-free-undead-tileset-top-down-pixel-art/PNG/Objects_separately/Tree_shadow2_2.png' },
      // ── Top extension (volcano / lava area) ──────────────────────────────
      slime_mushroom:{ axeKey:'gold_axe', label:'Slime Shroom', hitR:18, yieldWood:3, respawnMs:120_000, stumpOffsetY: 0, noStump:true,  dropKey:'slime_mushroom',   iconKey:'dp_assets/world/craftpix-net-688848-cave-tileset-top-down-pixel-art/PNG/Objects_separately/Slime_musroom_dark_shadow1.png' },
    };
    this.TREE_TYPE_KEYS = Object.keys(this.TREE_TYPES);

    // GID → tree-type name (for extension trees placed via object GIDs)
    this.GID_TYPE_MAP = {
      38570: 'ext_tree',
      38580: 'pine',
      38581: 'walnut',
      40901: 'slime_mushroom',
      41062: 'cactus',
      41278: 'desert_tree',
      41662: 'undead_tree',
    };

    this._stumpTexKey = this._bakeStump();

    spawnPoints.forEach((sp, idx) => {
      const cx = sp.x + sp.w / 2;
      const cy = sp.y + sp.h / 2;

      // Prefer type explicitly set via object name/type, then GID lookup, then auto-cycle
      let treeType = this.TREE_TYPES[sp.type]  ? sp.type
                   : this.TREE_TYPES[sp.name]  ? sp.name
                   : sp.gid ? (this.GID_TYPE_MAP[sp.gid & 0x1FFFFFFF] ?? null)
                   : null;
      treeType = treeType ?? this.TREE_TYPE_KEYS[idx % 3]; // fallback: oak/pine/walnut cycle

      this._spawnTree(cx, cy, treeType, sp.gid ?? 0);
    });
  }

  tryChop() {
    const px = this.player.x, py = this.player.y;
    const uiScene   = this.scene.scene.get('UIScene');
    const activeKey = uiScene?._hotbar?.activeItem?.key ?? null;

    let closest = null, closestDist = CFG.PLAYER.INTERACT_DIST;
    for (const t of this._trees) {
      if (!t.active) continue;
      const d = Phaser.Math.Distance.Between(px, py, t.cx, t.cy);
      if (d < closestDist) { closestDist = d; closest = t; }
    }
    if (!closest) return false;

    const def = this.TREE_TYPES[closest.type];

    if (activeKey !== def.axeKey) {
      uiScene?._showNotif?.(`Need ${def.label} Axe to chop ${def.label} tree!`, '#ff8888');
      return true;
    }

    this._hitTree(closest);
    return true;
  }

  update() {
    const now = Date.now();
    for (const t of this._trees)
      if (!t.active && t.respawnAt && now >= t.respawnAt) this._revive(t);
  }

  updateLabels() {
    const px = this.player.x, py = this.player.y;
    const uiScene   = this.scene.scene.get('UIScene');
    const activeKey = uiScene?._hotbar?.activeItem?.key ?? null;

    let closest = null, closestDist = Infinity;
    for (const t of this._trees) {
      if (!t.active) continue;
      const d = Phaser.Math.Distance.Between(px, py, t.cx, t.cy);
      if (d <= 45 && d < closestDist) { closestDist = d; closest = t; }
    }

    for (const t of this._trees) {
      if (!t.label) continue;
      if (t !== closest || !t.active) { t.label.setVisible(false); continue; }
      const def = this.TREE_TYPES[t.type];
      const can = activeKey === def.axeKey;

      const axeLabel = def.axeKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      t.label.setText(can ? `[F] Chop ${def.label}` : `Need ${axeLabel}`)
             .setStyle({
               fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold',
               fill: can ? '#ffffff' : '#ff8888', stroke: '#000000', strokeThickness: 3, resolution: 2
             }).setVisible(true);
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  _spawnTree(cx, cy, type, gid = 0) {
    const hitGfx = this.scene.add.graphics().setDepth(cy + 99);

    // The set of dp_ texture keys that are valid cuttable-tree images.
    // ONLY link to one of these — never to mushrooms, bones, graves, etc.
    const VALID_TREE_KEYS = new Set([
      // Original trees
      'dp_assets/world/dynamic_props/Tree1.png',
      'dp_assets/world/dynamic_props/Tree2.png',
      'dp_assets/world/dynamic_props/Tree3.png',
      'dp_assets/world/dynamic_props/Tree4.png',
      'dp_assets/world/dynamic_props/Tree5.png',
      // Pine / walnut
      'dp_assets/items/trees/pine_tree.png',
      'dp_assets/items/trees/walnut_tree.png',
      // Right extension — undead tree (GID 41662)
      'dp_assets/world/craftpix-net-695666-free-undead-tileset-top-down-pixel-art/PNG/Objects_separately/Tree_shadow2_1.png',
      'dp_assets/world/craftpix-net-695666-free-undead-tileset-top-down-pixel-art/PNG/Objects_separately/Tree_shadow2_2.png',
      'dp_assets/world/craftpix-net-695666-free-undead-tileset-top-down-pixel-art/PNG/Objects_separately/Tree_shadow2_3.png',
      // Left extension — desert tree (GID 41278)
      'dp_assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/PNG/Objects_separately/Tree4_sand_shadow1.png',
      'dp_assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/PNG/Objects_separately/Tree4_sand_shadow2.png',
      'dp_assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/PNG/Objects_separately/Tree4_sand_shadow3.png',
      // Left extension — cactus (GID 41062)
      'dp_assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/PNG/Objects_separately/Cactus3_ground_shadow1.png',
      'dp_assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/PNG/Objects_separately/Cactus3_ground_shadow2.png',
      'dp_assets/world/craftpix-net-874337-desert-tileset-top-down-pixel-art/PNG/Objects_separately/Cactus3_ground_shadow3.png',
      // Top extension — slime mushroom (GID 40901)
      'dp_assets/world/craftpix-net-688848-cave-tileset-top-down-pixel-art/PNG/Objects_separately/Slime_musroom_dark_shadow1.png',
      'dp_assets/world/craftpix-net-688848-cave-tileset-top-down-pixel-art/PNG/Objects_separately/Slime_musroom_dark_shadow2.png',
    ]);

    let linkedImg = null;
    let bestDist  = 80; // max 80px between spawn-point centre and image bottom-centre

    for (const child of this.scene.children.list) {
      if (child.type !== 'Image') continue;
      const key = child.texture?.key;
      if (!key || !key.startsWith('dp_')) continue;
      if (!VALID_TREE_KEYS.has(key)) continue;   // ← only valid tree images
      if (child.getData('linkedTree')) continue;

      const bounds        = child.getBounds();
      const bottomCenterX = bounds.centerX;
      const bottomCenterY = bounds.bottom;
      const dist = Phaser.Math.Distance.Between(cx, cy, bottomCenterX, bottomCenterY);
      if (dist < bestDist) { bestDist = dist; linkedImg = child; }
    }

    let actualType = type;
    if (linkedImg) {
      linkedImg.setData('linkedTree', true);
      linkedImg.setData('startX',     linkedImg.x);
      linkedImg.setData('startY',     linkedImg.y);
      linkedImg.setData('baseScaleX', linkedImg.scaleX);
      linkedImg.setData('baseScaleY', linkedImg.scaleY);

      // If we already have a GID-derived type, keep it; otherwise detect from key
      if (!this.TREE_TYPES[actualType]) {
        const key = linkedImg.texture.key.toLowerCase();
        if      (key.includes('slime_musroom') || key.includes('slime_mushroom')) actualType = 'slime_mushroom';
        else if (key.includes('cactus'))                                          actualType = 'cactus';
        else if (key.includes('pine'))                                            actualType = 'pine';
        else if (key.includes('walnut'))                                          actualType = 'walnut';
        else if (key.includes('tree_shadow') || key.includes('shadow2'))          actualType = 'undead_tree';
        else if (key.includes('sand') || key.includes('tree4'))                   actualType = 'desert_tree';
        else if (key.includes('tree2'))                                           actualType = 'ext_tree';
        else                                                                      actualType = 'oak';
      }
    }

    const label = this.scene.add.text(cx, cy - 10, '', {})
      .setOrigin(0.5, 1).setDepth(cy + 100).setVisible(false).setScale(0.5);

    this._trees.push({
      cx, cy, type: actualType, label, hitGfx,
      hp: CFG.TREES.CHOP_HITS, maxHp: CFG.TREES.CHOP_HITS,
      active: true, respawnAt: null,
      stump: null,
      img: linkedImg,
    });
  }

  _hitTree(t) {
    t.hp--;

    if (t.img) {
      this.scene.tweens.killTweensOf(t.img);
      t.img.setAngle(0);
      this.scene.tweens.add({
        targets: t.img,
        angle: { from: -4, to: 4 },
        duration: 45,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeInOut',
        onComplete: () => { t.img.setAngle(0); }
      });
    }

    const yBase = t.img ? t.img.getBounds().centerY : t.cy - 30;
    this._emitParticles(t.cx, yBase - 15, 0x4caf50, 4);
    this._emitParticles(t.cx, yBase + 10, 0x8d6e63, 3);
    this._float(t.cx, t.cy, '-1', '#ff5555');

    if (t.hp <= 0) this._fell(t);
  }

  _fell(t) {
    t.active = false;
    const def = this.TREE_TYPES[t.type];
    t.respawnAt = Date.now() + def.respawnMs;
    t.label.setVisible(false);

    if (t.img) {
      this.scene.tweens.killTweensOf(t.img);
      this.scene.tweens.add({
        targets: t.img,
        angle: 85, alpha: 0, y: t.img.y + 15,
        duration: 450, ease: 'Cubic.easeIn',
        onComplete: () => {
          t.img.setVisible(false);
          this._spawnStump(t, def);
        }
      });
    } else {
      this._spawnStump(t, def);
    }

    const yBase = t.img ? t.img.getBounds().centerY : t.cy - 30;
    this._emitParticles(t.cx, yBase, 0x4caf50, 15);
    this._emitParticles(t.cx, t.cy - 10, 0x8d6e63, 8);

    const dropLabel = `${def.label} Wood`;
    this.inventory.addItem(def.dropKey, def.yieldWood, dropLabel, def.iconKey);
    this.scene.time.delayedCall(200, () => {
      this._float(t.cx, t.cy, `+${def.yieldWood} ${dropLabel}`, '#88ff88', true);
    });
  }

  _spawnStump(t, def) {
    // Some types (e.g. cactus) don't leave a stump
    if (def.noStump) return;

    let stumpX = t.cx, stumpY = t.cy;
    if (t.img) {
      const bounds = t.img.getBounds();
      stumpX = bounds.centerX;
      const baseY = t.img.getData('startY') ?? bounds.bottom;
      stumpY = baseY - def.stumpOffsetY - 8;
    }

    // undead_tree uses its own broken-tree stump image
    const stumpKey = (t.type === 'undead_tree')
      ? 'dp_assets/world/craftpix-net-695666-free-undead-tileset-top-down-pixel-art/PNG/Objects_separately/Broken_tree_shadow2_4.png'
      : this._stumpTexKey;

    if (stumpKey && this.scene.textures.exists(stumpKey)) {
      t.stump = this.scene.add.image(stumpX, stumpY, stumpKey)
        .setOrigin(0.5, 1).setScale(0).setDepth(stumpY);
      this.scene.tweens.add({ targets: t.stump, scale: 0.8, duration: 350, ease: 'Back.easeOut' });
    }
  }

  _revive(t) {
    t.active = true; t.hp = t.maxHp; t.respawnAt = null;

    if (t.stump) {
      this.scene.tweens.add({
        targets: t.stump, scale: 0, duration: 200,
        onComplete: () => { t.stump.destroy(); t.stump = null; }
      });
    }

    if (t.img) {
      t.img.setAngle(0).setAlpha(1);
      t.img.y = t.img.getData('startY');
      t.img.x = t.img.getData('startX');

      const targetSX = t.img.getData('baseScaleX') || 1;
      const targetSY = t.img.getData('baseScaleY') || 1;
      t.img.setScale(0).setVisible(true);

      this.scene.tweens.add({
        targets: t.img, scaleX: targetSX, scaleY: targetSY,
        duration: 700, ease: 'Elastic.easeOut'
      });
      this._emitParticles(t.cx, t.cy - 20, 0x4caf50, 6);
    }
  }

  _bakeStump() {
    const key = 'baked_stump';
    if (this.scene.textures.exists(key)) return key;
    const src = this.scene.textures.get('forest_and_bricks')?.source?.[0]?.image;
    if (!src) return null;
    const TW = 16, COLS = 16;
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    [[167, 168], [183, 184]].forEach(([l, r], ri) => {
      [l, r].forEach((lid, ci) => {
        ctx.drawImage(src, (lid % COLS) * TW, Math.floor(lid / COLS) * TW, TW, TW, ci * TW, ri * TW, TW, TW);
      });
    });
    this.scene.textures.addCanvas(key, c);
    return key;
  }

  _float(x, y, msg, color = '#ffffff', isLoot = false) {
    const t = this.scene.add.text(x, y - 20, msg, {
      fontFamily: 'Arial, sans-serif', fontSize: isLoot ? '22px' : '18px', fontStyle: 'bold',
      fill: color, stroke: '#111111', strokeThickness: 5, resolution: 2
    }).setOrigin(0.5).setDepth(9999).setScale(0.2);

    this.scene.tweens.add({
      targets: t, scale: 0.5, y: y - 40, duration: 300, ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: t, y: y - 70, alpha: 0,
          delay: isLoot ? 600 : 200, duration: 500, ease: 'Power2',
          onComplete: () => t.destroy()
        });
      }
    });
  }

  _emitParticles(x, y, color, count = 4) {
    for (let i = 0; i < count; i++) {
      const spark = this.scene.add.rectangle(x, y, 5, 5, color).setDepth(y + 20);
      const angle = Math.random() * Math.PI;
      const dist  = 20 + Math.random() * 30;
      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y - Math.sin(angle) * dist + 20,
        alpha: { from: 1, to: 0 }, scale: { from: 1, to: 0.2 },
        angle: 180 + Math.random() * 180,
        duration: 400 + Math.random() * 200, ease: 'Quad.easeOut',
        onComplete: () => spark.destroy()
      });
    }
  }
}
