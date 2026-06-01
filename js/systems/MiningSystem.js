// js/systems/MiningSystem.js
// ─────────────────────────────────────────────────────────────────────────────
// Pickaxe matching:
//   stone_pickaxe  → mineable_stones, mineable_bronzes
//   bronze_pickaxe → mineable_iron
//   iron_pickaxe   → mineable_gold
//   gold_pickaxe   → undead_minable_stones (skeleton dungeon)
//                  → mineable_lava_ores    (top extension / volcano area)
// ─────────────────────────────────────────────────────────────────────────────
class MiningSystem {

  static ORE_TYPES = {
    mineable_stones:        { label:'Stone',         drop:'stone',       yield:2, hits:3, pickKey:'stone_pickaxe',  color:0x9aabbf, respawnMs: 60_000, iconKey:'inv_icon_stone'       },
    mineable_bronzes:       { label:'Bronze',        drop:'bronze',      yield:2, hits:3, pickKey:'stone_pickaxe',  color:0xcd7f32, respawnMs: 75_000, iconKey:'inv_icon_bronze'      },
    mineable_iron:          { label:'Iron',          drop:'iron',        yield:2, hits:4, pickKey:'bronze_pickaxe', color:0xa8a9ad, respawnMs: 90_000, iconKey:'inv_icon_iron'        },
    mineable_gold:          { label:'Gold',          drop:'gold',        yield:1, hits:5, pickKey:'iron_pickaxe',   color:0xffd700, respawnMs:120_000, iconKey:'inv_icon_gold'        },
    // ── Right extension ore (skeleton dungeon) ────────────────────────────
    undead_minable_stones:  { label:'Undead Crystal',drop:'undead_ore',  yield:2, hits:4, pickKey:'gold_pickaxe',   color:0x6a4c7c, respawnMs:150_000, iconKey:'inv_icon_undead_ore'  },
    // ── Top extension ore (volcano / lava area) ───────────────────────────
    mineable_lava_ores:     { label:'Lava Rock',     drop:'lava_ore',    yield:2, hits:4, pickKey:'gold_pickaxe',   color:0xff4400, respawnMs:150_000, iconKey:'inv_icon_lava_ore'    },
  };

  // Per-ore base scales
  static ORE_SCALES = {
    mineable_stones:       0.6,
    mineable_bronzes:      1.0,
    mineable_iron:         1.0,
    mineable_gold:         1.0,
    undead_minable_stones: 1.0,
    mineable_lava_ores:    1.0,
  };

  // Big prop image for each ore type (shown while alive)
  static ORE_BIG_TEX = {
    mineable_stones:       'dp_assets/items/ore_tree/PNG/rocks/rock_big.png',
    mineable_bronzes:      'dp_assets/items/ore_tree/PNG/bronze/Bronze_big.png',
    mineable_iron:         'dp_assets/items/ore_tree/PNG/Iron/iron_big.png',
    mineable_gold:         'dp_assets/items/ore_tree/PNG/gold/gold_big.png',
    undead_minable_stones: 'dp_assets/world/craftpix-net-695666-free-undead-tileset-top-down-pixel-art/PNG/Objects_separately/Crystal_shadow1_1.png',
    mineable_lava_ores:    'dp_assets/world/craftpix-net-688848-cave-tileset-top-down-pixel-art/PNG/Objects_separately/Volcano4_dark_shadow_frame5.png',
  };

  // Small leftover image (shown after mining, while respawning)
  static ORE_SMALL_TEX = {
    mineable_stones:       'dp_assets/items/ore_tree/PNG/rocks/rock_small.png',
    mineable_bronzes:      'dp_assets/items/ore_tree/PNG/bronze/Bronze_small.png',
    mineable_iron:         'dp_assets/items/ore_tree/PNG/Iron/Iron_small.png',
    mineable_gold:         'dp_assets/items/ore_tree/PNG/gold/gold_small.png',
    undead_minable_stones: 'dp_assets/world/craftpix-net-695666-free-undead-tileset-top-down-pixel-art/PNG/Objects_separately/Crystal_shadow1_3.png',
    mineable_lava_ores:    'dp_assets/world/craftpix-net-688848-cave-tileset-top-down-pixel-art/PNG/Objects_separately/Volcano4_dark_shadow_frame5.png',
  };

  constructor(scene, spawnPoints, inventory, player) {
    this.scene     = scene;
    this.inventory = inventory;
    this.player    = player;
    this._nodes    = [];

    // Static crystal decorations placed in Dynamic_props_right_extention on top of
    // undead ore spawn points.  We track them here so we can hide them while the
    // interactive ore node is alive and show a small remnant when it's gone.
    // Key = "x,y" rounded to nearest 16px → Phaser Image object (set after create).
    this._staticOreProps = new Map();

    spawnPoints.forEach(sp => {
      // Skip malformed objects (width=0 / height=0 / no name) — these are Tiled
      // accidents and must not default to mineable_stones.
      if (!sp.name || (sp.w === 0 && sp.h === 0)) return;
      this._spawnNode(sp);
    });
  }

  // ── Call this from GameScene after _buildDynamicProps so we can grab the
  //    Phaser Image objects for the static decorations that sit on top of
  //    interactive ore nodes.  We hide them while the ore is alive and show a
  //    small remnant once it's mined.
  //
  //    Covers:
  //      undead_minable_stones → Crystal_shadow1_1.png  (right extension)
  //      mineable_lava_ores    → Volcano4_dark_shadow_frame5.png (top extension)
  linkStaticProps(childList) {
    const STATIC_KEYS = {
      undead_minable_stones: 'dp_assets/world/craftpix-net-695666-free-undead-tileset-top-down-pixel-art/PNG/Objects_separately/Crystal_shadow1_1.png',
      mineable_lava_ores:    'dp_assets/world/craftpix-net-688848-cave-tileset-top-down-pixel-art/PNG/Objects_separately/Volcano4_dark_shadow_frame5.png',
    };

    // Build a set of images already owned by a node as n.img — never link those.
    const ownedImgs = new Set(this._nodes.map(n => n.img).filter(Boolean));

    for (const node of this._nodes) {
      const staticKey = STATIC_KEYS[node.oreType];
      if (!staticKey) continue;

      for (const child of childList) {
        if (child.type !== 'Image') continue;
        if (child.texture?.key !== staticKey) continue;
        if (ownedImgs.has(child)) continue;   // skip the ore's own image
        const dx = child.x - node.cx;
        const dy = child.y - node.cy;
        if (Math.sqrt(dx * dx + dy * dy) < 80) {
          child.setVisible(false);
          node.staticProp = child;
          break;
        }
      }
    }
  }

  tryMine() {
    const px = this.player.x, py = this.player.y;
    const uiScene   = this.scene.scene.get('UIScene');
    const activeKey = uiScene?._hotbar?.activeItem?.key ?? null;

    let closest = null, closestDist = CFG.PLAYER.INTERACT_DIST;
    for (const n of this._nodes) {
      if (!n.active) continue;
      const d = Phaser.Math.Distance.Between(px, py, n.cx, n.cy);
      if (d < closestDist) { closestDist = d; closest = n; }
    }
    if (!closest) return false;

    const def = MiningSystem.ORE_TYPES[closest.oreType];

    if (activeKey !== def.pickKey) {
      const label = this._pickLabel(def.pickKey);
      uiScene?._showNotif?.(`Need ${label} to mine ${def.label}!`, '#ff8888');
      return true;
    }

    this._hit(closest);
    return true;
  }

  update() {
    const now = Date.now();
    for (const n of this._nodes)
      if (!n.active && n.respawnAt && now >= n.respawnAt) this._revive(n);
  }

  updateLabels() {
    const px = this.player.x, py = this.player.y;
    const uiScene   = this.scene.scene.get('UIScene');
    const activeKey = uiScene?._hotbar?.activeItem?.key ?? null;
    const dist      = CFG.PLAYER.INTERACT_DIST * 1.4;

    let closest = null, closestDist = dist;
    for (const n of this._nodes) {
      if (!n.active) continue;
      const d = Phaser.Math.Distance.Between(px, py, n.cx, n.cy);
      if (d < closestDist) { closestDist = d; closest = n; }
    }

    for (const n of this._nodes) {
      if (!n.label) continue;
      if (n !== closest || !n.active) { n.label.setVisible(false); continue; }

      const def = MiningSystem.ORE_TYPES[n.oreType];
      const can = activeKey === def.pickKey;

      n.label.setText(can ? `[F] Mine ${def.label}` : `Need ${this._pickLabel(def.pickKey)}`)
             .setStyle({
               fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold',
               fill: can ? '#ffffff' : '#ff8888', stroke: '#000000', strokeThickness: 3, resolution: 2
             }).setVisible(true);
    }
  }

  // ── internals ─────────────────────────────────────────────────────────────

  _pickLabel(key) {
    const labels = {
      stone_pickaxe:  'Stone Pickaxe',
      bronze_pickaxe: 'Bronze Pickaxe',
      iron_pickaxe:   'Iron Pickaxe',
      gold_pickaxe:   'Gold Pickaxe',
    };
    return labels[key] ?? 'Pickaxe';
  }

  _spawnNode(sp) {
    const oreType = MiningSystem.ORE_TYPES[sp.name] ? sp.name : 'mineable_stones';
    const def     = MiningSystem.ORE_TYPES[oreType];
    const cx      = sp.x + sp.w / 2;
    const cy      = sp.y + sp.h / 2;

    const texKey    = MiningSystem.ORE_BIG_TEX[oreType];
    const baseScale = MiningSystem.ORE_SCALES[oreType] ?? 1.0;

    let img = null;
    if (this.scene.textures.exists(texKey)) {
      img = this.scene.add.image(cx, cy, texKey)
        .setScale(baseScale).setOrigin(0.5, 0.5).setDepth(cy);
    } else {
      const g = this.scene.add.graphics().setDepth(cy);
      g.fillStyle(def.color, 0.9); g.fillCircle(cx, cy, 14);
      img = g;
    }

    const label = this.scene.add.text(cx, cy - 38, '', {})
      .setOrigin(0.5).setDepth(9200).setVisible(false).setScale(0.5);
    const hpBar = this.scene.add.graphics().setDepth(9201);

    const node = {
      cx, cy, img, label, hpBar, stump: null,
      oreType, texKey, baseScale,
      hp: def.hits, maxHp: def.hits,
      active: true, respawnAt: null,
      respawnGfx: null, respawnTween: null,
      staticProp: null   // linked to static crystal decoration if applicable
    };
    this._nodes.push(node);
  }

  _hit(n) {
    n.hp--;
    const def = MiningSystem.ORE_TYPES[n.oreType];

    if (n.img) {
      this.scene.tweens.killTweensOf(n.img);
      n.img.setScale(n.baseScale);
      this.scene.tweens.add({
        targets: n.img,
        scaleX: n.baseScale * 1.2,
        scaleY: n.baseScale * 0.8,
        duration: 70, yoyo: true, ease: 'Quad.easeOut'
      });
    }

    this._emitSparks(n.cx, n.cy, def.color);
    this._drawHpBar(n);
    this._float(n.cx, n.cy, '-1', '#ff5555');

    if (n.hp <= 0) this._destroy(n);
  }

  _destroy(n) {
    n.active = false;
    const def = MiningSystem.ORE_TYPES[n.oreType];
    n.respawnAt = Date.now() + def.respawnMs;

    if (n.img) {
      this.scene.tweens.add({
        targets: n.img, scale: 0, alpha: 0, duration: 150, ease: 'Back.easeIn',
        onComplete: () => {
          n.img.destroy(); n.img = null;
          this._spawnLeftoverRock(n);
        }
      });
    } else {
      this._spawnLeftoverRock(n);
    }

    this._emitSparks(n.cx, n.cy, def.color, 8);
    n.label.setVisible(false);
    n.hpBar.clear();

    this.inventory.addItem(def.drop, def.yield, def.label + ' Ore', def.iconKey);
    this.scene.time.delayedCall(150, () => {
      this._float(n.cx, n.cy, `+${def.yield} ${def.label}`, '#FFD700', true);
    });

    // Show the static decoration as a small remnant while the node respawns
    if (n.staticProp) {
      n.staticProp.setVisible(true).setScale(0.35).setDepth(n.cy - 1);
    }

    this._showRespawnTimer(n, def.respawnMs);
  }

  _spawnLeftoverRock(n) {
    const texKey = MiningSystem.ORE_SMALL_TEX[n.oreType];

    if (this.scene.textures.exists(texKey)) {
      n.stump = this.scene.add.image(n.cx, n.cy, texKey)
        .setOrigin(0.5, 0.5).setScale(0).setDepth(n.cy - 1);
      this.scene.tweens.add({ targets: n.stump, scale: 1.0, duration: 350, ease: 'Back.easeOut' });
    }
  }

  _revive(n) {
    n.active = true; n.respawnAt = null;
    const def = MiningSystem.ORE_TYPES[n.oreType];
    n.hp = def.hits; n.maxHp = def.hits;

    if (n.respawnGfx)   { n.respawnGfx.destroy();   n.respawnGfx   = null; }
    if (n.respawnTween) { n.respawnTween.stop();     n.respawnTween = null; }

    // Hide static prop again — the interactive ore is back
    if (n.staticProp) n.staticProp.setVisible(false);

    if (n.stump) {
      this.scene.tweens.add({
        targets: n.stump, scale: 0, duration: 200,
        onComplete: () => { n.stump.destroy(); n.stump = null; }
      });
    }

    const texKey = n.texKey;
    if (this.scene.textures.exists(texKey)) {
      n.img = this.scene.add.image(n.cx, n.cy, texKey)
        .setScale(0).setOrigin(0.5, 0.5).setDepth(n.cy);
      this.scene.tweens.add({ targets: n.img, scale: n.baseScale, duration: 400, ease: 'Back.easeOut' });
    } else {
      const g = this.scene.add.graphics().setDepth(n.cy);
      g.fillStyle(def.color, 0.9); g.fillCircle(n.cx, n.cy, 14); n.img = g;
    }
  }

  _drawHpBar(n) {
    const g = n.hpBar, pct = n.hp / n.maxHp;
    g.clear();
    if (!n.active || pct === 1) return;

    const bw = 36, bh = 6, bx = n.cx - bw / 2, by = n.cy - 30;
    g.fillStyle(0x1a1a1a, 0.8);
    g.fillRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, 3);
    const color = pct > 0.5 ? 0x44ff44 : pct > 0.25 ? 0xffaa00 : 0xff2222;
    g.fillStyle(color, 1);
    g.fillRoundedRect(bx, by, Math.max(2, bw * pct), bh, 2);
    this.scene.tweens.killTweensOf(g);
    g.setAlpha(1);
    this.scene.tweens.add({ targets: g, alpha: 0, delay: 3000, duration: 500 });
  }

  _showRespawnTimer(n, totalMs) {
    const g = this.scene.add.graphics().setDepth(9202);
    n.respawnGfx = g;
    const progress = { val: 0 };
    n.respawnTween = this.scene.tweens.add({
      targets: progress, val: 360, duration: totalMs,
      onUpdate: () => {
        if (!n.active && g.active) {
          g.clear();
          g.lineStyle(4, 0x111111, 0.7);
          g.beginPath(); g.arc(n.cx, n.cy - 10, 8, 0, Math.PI * 2); g.strokePath();
          g.lineStyle(3, 0xFFD700, 1.0);
          g.beginPath();
          g.arc(n.cx, n.cy - 10, 8, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + progress.val));
          g.strokePath();
        }
      },
      onComplete: () => { if (g.active) g.destroy(); n.respawnGfx = null; }
    });
  }

  _float(x, y, msg, color = '#ffffff', isLoot = false) {
    const t = this.scene.add.text(x, y - 20, msg, {
      fontFamily: 'Arial, sans-serif', fontSize: isLoot ? '22px' : '18px', fontStyle: 'bold',
      fill: color, stroke: '#111111', strokeThickness: 5, resolution: 2
    }).setOrigin(0.5).setDepth(9999).setScale(0.2);

    this.scene.tweens.add({
      targets: t, scale: 0.5, y: y - 35, duration: 300, ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: t, y: y - 60, alpha: 0,
          delay: isLoot ? 600 : 200, duration: 500, ease: 'Power2',
          onComplete: () => t.destroy()
        });
      }
    });
  }

  _emitSparks(x, y, color, count = 4) {
    for (let i = 0; i < count; i++) {
      const spark = this.scene.add.rectangle(x, y, 4, 4, color).setDepth(9050);
      const angle = Math.random() * Math.PI * 2;
      const dist  = 10 + Math.random() * 20;
      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist - 15,
        alpha: { from: 1, to: 0 }, scale: { from: 1, to: 0.2 },
        duration: 300 + Math.random() * 200, ease: 'Cubic.easeOut',
        onComplete: () => spark.destroy()
      });
    }
  }
}
