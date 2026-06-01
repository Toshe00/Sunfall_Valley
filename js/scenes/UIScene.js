// js/scenes/UIScene.js
class UIScene extends Phaser.Scene {
  constructor() { super({ key:'UIScene', active:false }); }

  create() {
    this._healthBar = new HealthBarHUD(this);
    this._clock = new ClockHUD(this);
    // ── Inventory ─────────────────────────────────────────────────────────
    this._inventory = new InventorySystem(this);

    // Give 5 of each seed type at start
    for (const [key, def] of Object.entries(FarmingSystem.CROP_TYPES)) {
      this._inventory.addItem(key, 5, def.label + ' Seed', 'seed_icon_' + key);
    }

    // ── Starting tools ────────────────────────────────────────────────────
    // Pickaxes
    this._inventory.addItem('stone_pickaxe',  1, 'Stone Pickaxe',  'stone_pickaxe');
    this._inventory.addItem('bronze_pickaxe', 1, 'Bronze Pickaxe', 'bronze_pickaxe');
    this._inventory.addItem('iron_pickaxe',   1, 'Iron Pickaxe',   'iron_pickaxe');
    this._inventory.addItem('gold_pickaxe',   1, 'Gold Pickaxe',   'gold_pickaxe');

    // Axes
    this._inventory.addItem('oak_axe',    1, 'Oak Axe',    'oak_axe');
    this._inventory.addItem('pine_axe',   1, 'Pine Axe',   'pine_axe');
    this._inventory.addItem('walnut_axe', 1, 'Walnut Axe', 'walnut_axe');
    this._inventory.addItem('gold_axe',   1, 'Gold Axe',   'gold_axe');

    // ── Hotbar ────────────────────────────────────────────────────────────
    this._hotbar = new HotbarSystem(this, this._inventory);

    // When player clicks a seed in inventory, tell FarmingSystem
    this._inventory.onSelect(key => {
      const farming = this.scene.get('GameScene')?._farming;
      if (FarmingSystem.CROP_TYPES[key]) {
        farming?.selectSeed(key);
      }
    });

    // Toggle key
    const inventoryKeyCode = Phaser.Input.Keyboard.KeyCodes[CFG.KEY_INVENTORY] ?? CFG.KEY_INVENTORY;
    this.input.keyboard.addCapture(inventoryKeyCode);
    this.input.keyboard.addKey(inventoryKeyCode, true)
      .on('down', (_key, event) => {
        event?.preventDefault();
        this._inventory.toggle();
      });


  }

  update() {
    this._clock?.update();
  }

  // ── Seed HUD ──────────────────────────────────────────────────────────────
  _setSeedHUD(key) {
    if (!this._seedHudText) {
      const W = this.scale.width;
      this._seedHudText = this.add.text(W / 2, 52, '', {
        fontFamily      : 'Arial, sans-serif',
        fontSize        : '26px',
        fontStyle       : 'bold',
        resolution      : 2,
        color           : '#ffff44',
        stroke          : '#000000',
        strokeThickness : 6,
        backgroundColor : '#00000088',
        padding         : { x: 14, y: 6 },
      })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(150)
        .setScale(0.5)
        .setVisible(false);
    }
    if (!key) {
      this._seedHudText.setVisible(false);
      return;
    }
    const def = FarmingSystem?.CROP_TYPES?.[key];
    this._seedHudText
      .setText(`🌱 ${def?.label ?? key} selected — click a hole to plant`)
      .setVisible(true);
  }

  // ── Notification toast ────────────────────────────────────────────────────
  _showNotif(msg, color = '#ffffff') {
    const W = this.scale.width;
    const H = this.scale.height;
    const cy = H - 90;

    const t = this.add.text(W / 2, cy, msg, {
      fontFamily      : 'Arial, sans-serif',
      fontSize        : '26px',
      fontStyle       : 'bold',
      resolution      : 2,
      color           : color,
      stroke          : '#000000',
      strokeThickness : 6,
      backgroundColor : '#00000099',
      padding         : { x: 14, y: 7 },
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200)
      .setScale(0.5);

    this.tweens.add({
      targets  : t,
      y        : cy - 50,
      alpha    : 0,
      delay    : 1400,
      duration : 500,
      onComplete: () => t.destroy(),
    });
  }

  _showTutorial() {
    const W = this.scale.width, H = this.scale.height;

    const msgs = [
      { text:'🎮 Welcome! Use Arrow Keys / WASD / ZQSD to move',                                    delay:500   },
      { text:'🎒 Press [TAB] to open your Inventory',                                          delay:3000  },
      { text:'🌱 Select a seed → walk to a farm plot → click a hole to plant',               delay:6000  },
      { text:'⛏️  [F] near rocks to mine  |  Match the exact pickaxe to the ore',            delay:9500  },
      { text:'🪓 [F] near trees to chop  |  Oak/Pine/Walnut Axe, or Gold Axe for ext. trees', delay:13000 },
      { text:'⚒️  Gold Axe → Ext. trees, Cactus, Slime Shroom  |  Gold Pickaxe → Undead Crystal, Lava Rock', delay:16500 },
    ];

    msgs.forEach(({text, delay}) => {
      this.time.delayedCall(delay, () => {
        const t = this.add.text(W/2, H - 80, text,
          { font:'bold 12px monospace', fill:'#ffffff', stroke:'#000', strokeThickness:3,
            backgroundColor:'#00000099', padding:{x:12,y:6} })
          .setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);

        this.tweens.add({ targets:t, alpha:1, duration:400 });
        this.tweens.add({
          targets:t, alpha:0, delay:2200, duration:500,
          onComplete:()=>t.destroy()
        });
      });
    });
  }
}
