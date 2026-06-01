// js/systems/FruitTreeSystem.js
class FruitTreeSystem {
  constructor(scene, dynamicProps, inventory, player) {
    this.scene     = scene;
    this.inventory = inventory;
    this.player    = player;
    this._trees    = [];

    const jsonData  = scene.cache.json.get('mapjson');
    const F_ALL     = 0x80000000 | 0x40000000 | 0x20000000;
    const tree3Gids = new Set();

    // Only look for Tree3 (Apples)
    for (const ts of jsonData.tilesets) {
      for (const t of (ts.tiles || [])) {
        const img = t.image || '';
        if (img.includes('Tree3')) tree3Gids.add(ts.firstgid + t.id);
      }
    }

    const fruitObjs = dynamicProps.filter(o => {
      if (!o.gid) return false;
      const raw = o.gid & ~F_ALL;
      return tree3Gids.has(raw);
    });

    console.log(`[FruitTreeSystem] ${fruitObjs.length} apple trees detected.`);

    fruitObjs.forEach(obj => {
      this._spawnTree(obj);
    });
  }

  _spawnTree(obj) {
    const w  = obj.width  || 128;
    const h  = obj.height || 128;
    const cx = obj.x + w / 2;
    const cy = obj.y; // Tiled GID objects: y = bottom edge

    // Hardcoded to Apples since Oranges are removed
    const fruitedTex = 'dp_assets/world/dynamic_props/Tree3.png';
    const fruitKey   = 'apple';
    const fruitIcon  = 'inv_icon_apple';
    const fruitLabel = 'Apple';

    // Tree always starts with fruit — no bare-tree state needed
    const img = this.scene.add.image(cx, cy, fruitedTex)
      .setOrigin(0.5, 1)
      .setDisplaySize(w, h)
      .setDepth(cy);

    // Idle "Breathing" Animation
    this.scene.tweens.add({
      targets: img,
      scaleX: 0.98,
      scaleY: 1.02,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Harvest label
    const label = this.scene.add.text(cx, cy - h * 0.72, '', {
      fontFamily      : 'Arial, sans-serif',
      fontSize        : '11px',
      fontStyle       : 'bold',
      fill            : '#ffee55',
      stroke          : '#000000',
      strokeThickness : 3,
      resolution      : 2,
      backgroundColor : '#00000066',
      padding         : { x: 6, y: 3 },
    })
      .setOrigin(0.5).setDepth(cy + 200).setVisible(false).setScale(0.5);

    this._trees.push({
      cx, cy, w, h,
      img, label,
      fruitedTex, fruitKey, fruitIcon, fruitLabel,
      isReady  : true,
      growthMs : 30_000,
      readyAt  : 0,
    });
  }

  update() {
    const now = Date.now();
    for (const t of this._trees) {
      if (!t.isReady && now >= t.readyAt) this._growFruit(t);
    }
  }

  updateLabels() {
    const px = this.player.x, py = this.player.y;
    const LABEL_DIST = CFG.PLAYER.INTERACT_DIST * 1.4;

    let closest = null, closestDist = LABEL_DIST;
    for (const t of this._trees) {
      if (!t.isReady) continue;
      const d = Phaser.Math.Distance.Between(px, py, t.cx, t.cy);
      if (d < closestDist) { closestDist = d; closest = t; }
    }

    for (const t of this._trees) {
      // If tree is on cooldown, ensure label is hidden and move on
      if (!t.isReady) {
        t.label.setVisible(false);
        continue;
      }

      // Show interaction label only for the closest ready tree
      if (t === closest) {
        t.label.setText(`[F]  Harvest ${t.fruitLabel}  x10`).setVisible(true);
      } else {
        t.label.setVisible(false);
      }
    }
  }

  _growFruit(t) {
    t.isReady = true;
    t.img.setTexture(t.fruitedTex).setDisplaySize(t.w, t.h).setVisible(true);

    this.scene.tweens.add({
      targets : t.img, scaleY: 1.08, scaleX: 0.94,
      duration: 220, yoyo: true, ease: 'Quad.easeOut',
    });

    this._floatText(t.cx, t.cy - t.h * 0.8, '🍎 Ready!', '#ffee55');
  }

  tryHarvest() {
    const px = this.player.x, py = this.player.y;
    let closest = null, closestDist = CFG.PLAYER.INTERACT_DIST;

    for (const t of this._trees) {
      if (!t.isReady) continue;
      const d = Phaser.Math.Distance.Between(px, py, t.cx, t.cy);
      if (d < closestDist) { closestDist = d; closest = t; }
    }

    if (!closest) return false;
    this._harvest(closest);
    return true;
  }

  _harvest(t) {
    t.isReady = false;
    t.readyAt = Date.now() + t.growthMs;
    t.label.setVisible(false);

    // Shake before hiding
    this.scene.tweens.add({
      targets : t.img,
      angle   : { from: -6, to: 6 },
      duration: 50, yoyo: true, repeat: 4,
      ease    : 'Sine.easeInOut',
      onComplete: () => { 
        t.img.setAngle(0); 
        t.img.setVisible(false);
      },
    });

    // Drop 10 fruits
    for (let i = 0; i < 10; i++) {
      this.scene.time.delayedCall(i * 70, () => this._dropFruit(t));
    }

    this.scene.time.delayedCall(400, () => {
      this._floatText(t.cx, t.cy - t.h * 0.85, `+10 ${t.fruitLabel}`, '#88ff88', true);
    });
  }

  _dropFruit(t) {
    const spawnX = t.cx + Phaser.Math.Between(-24, 24);
    const spawnY = t.cy - t.h * 0.5;
    const tex    = this.scene.textures.exists(t.fruitIcon) ? t.fruitIcon : 'crop_red_berries';

    const fruit = this.scene.physics.add.sprite(spawnX, spawnY, tex);
    fruit
      .setDepth(spawnY + 60)
      .setDisplaySize(14, 14)
      .setVelocity(Phaser.Math.Between(-90, 90), Phaser.Math.Between(-70, -10))
      .setDrag(60, 0)
      .setBounce(0.5)
      .setGravityY(380);

    // Spin
    this.scene.tweens.add({
      targets : fruit,
      angle   : Phaser.Math.Between(200, 400) * (Math.random() > 0.5 ? 1 : -1),
      duration: 900,
      ease    : 'Linear',
    });

    // Fly dynamically to player's CURRENT position
    this.scene.time.delayedCall(1100, () => {
      if (!fruit.active) return;
      
      const startX = fruit.x;
      const startY = fruit.y;

      this.scene.tweens.add({
        targets  : fruit,
        alpha    : 0,
        scale    : 0.3,
        duration : 350, 
        onUpdate : (tween) => {
          const easeProgress = Phaser.Math.Easing.Cubic.In(tween.progress);
          
          fruit.x = Phaser.Math.Linear(startX, this.player.x, easeProgress);
          fruit.y = Phaser.Math.Linear(startY, this.player.y - 16, easeProgress);
        },
        onComplete: () => {
          fruit.destroy();
          this.inventory?.addItem(t.fruitKey, 1, t.fruitLabel, t.fruitIcon);
        },
      });
    });
  }

  _floatText(x, y, msg, color = '#ffffff', big = false) {
    const txt = this.scene.add.text(x, y, msg, {
      fontFamily      : 'Arial, sans-serif',
      fontSize        : big ? '22px' : '16px',
      fontStyle       : 'bold',
      fill            : color,
      stroke          : '#111111',
      strokeThickness : 5,
      resolution      : 2,
    }).setOrigin(0.5).setDepth(9999).setScale(0.25);

    this.scene.tweens.add({
      targets : txt, scale: big ? 0.55 : 0.45, y: y - 16,
      duration: 260, ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: txt, y: y - 44, alpha: 0,
          delay: big ? 700 : 350, duration: 450, ease: 'Power2',
          onComplete: () => txt.destroy(),
        });
      },
    });
  }
}