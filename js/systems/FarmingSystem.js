// js/systems/FarmingSystem.js
// ─────────────────────────────────────────────────────────────────────────────
// Upgraded: Pop-in planting, Growth bouncing, Harvest plucking animations,
// Dirt/Crop particle bursts, and RPG floating text.
// ─────────────────────────────────────────────────────────────────────────────
class FarmingSystem {
  constructor(scene, inventory, player, _unused) {
    this.scene         = scene;
    this.inventory     = inventory;
    this.player        = player;
    this._plots        = [];
    this._selectedSeed = null;   
    this._seedHudText  = null;
    this._stageCache   = {};

    this._buildTextures();
    this._buildSeedHUD();
    FarmingSystem.PLOT_DEFS.forEach(def => this._makePlot(def));
  }

  // GLOBAL PLOT OFFSET
  // Change this value if you need to slide the entire farm left or right later
  static PLOT_OFFSET_X = 640; 

  static PLOT_DEFS = [
    // cy values shifted +640px for the new 100x140 map (cave extension added 40 tiles above farm)
    {cx:448,  cy:1440, w:84,  h:64,  capacity:2},
    {cx:576,  cy:1448, w:128, h:80,  capacity:4},
    {cx:424,  cy:1536, w:176, h:64,  capacity:4},
    {cx:590,  cy:1568, w:176, h:96,  capacity:6},
    {cx:416,  cy:1608, w:160, h:48,  capacity:6},
    {cx:500,  cy:1688, w:200, h:80,  capacity:6},
    {cx:616,  cy:1688, w:100, h:80,  capacity:4},
    {cx:712,  cy:1688, w:100, h:80,  capacity:4},
  ];

  static CROP_TYPES = {
    blue_berries: { label:'Blue Berries', growthMs:15_000, stages:3, iconKey:'seed_icon_blue_berries', color: 0x4a7eb0 },
    brinjal:      { label:'Egg Plant',    growthMs:25_000, stages:4, iconKey:'seed_icon_EggPlant',     color: 0x7a4382 },
    corn:         { label:'Corn',         growthMs:30_000, stages:4, iconKey:'seed_icon_corn',         color: 0xffd700 },
    pumpkin:      { label:'Pumpkin',      growthMs:40_000, stages:3, iconKey:'seed_icon_pumpkin',      color: 0xe67e22 },
    red_berries:  { label:'Red Berries',  growthMs:12_000, stages:3, iconKey:'seed_icon_red_berries',  color: 0xe74c3c },
    spinach:      { label:'Spinach',      growthMs:10_000, stages:3, iconKey:'seed_icon_spinach',      color: 0x2ecc71 },
    tomato:       { label:'Tomato',       growthMs:35_000, stages:4, iconKey:'seed_icon_tomato',       color: 0xff4747 },
    watermelon:   { label:'Watermelon',   growthMs:50_000, stages:3, iconKey:'seed_icon_watermelon',   color: 0x27ae60 },
  };

  selectSeed(key) {
    this._selectedSeed = key;
    const def = FarmingSystem.CROP_TYPES[key];
    this._updateSeedHUD(key);
    
    // Smooth ping to UI
    const uiScene = this.scene.scene.get('UIScene');
    if (uiScene && uiScene._seedHudText) {
      this.scene.tweens.add({
        targets: uiScene._seedHudText, scale: { from: 0.7, to: 0.5 }, duration: 300, ease: 'Back.easeOut'
      });
    }
  }

  clearSelectedSeed() {
    this._selectedSeed = null;
    this._updateSeedHUD(null);
  }

  enableMousePlanting() {
    this.scene.input.on('pointerdown', (pointer) => {
      // Only act on left-click and only when a seed is selected
      if (pointer.button !== 0 || !this._selectedSeed) return;

      // Convert screen pointer → world coordinates (handles camera scroll)
      const worldX = pointer.worldX;
      const worldY = pointer.worldY;

      for (const plot of this._plots) {
        // Quick bounding-box pre-check to skip distant plots cheaply
        // (plot.cx already includes the 640 offset here)
        const halfW = plot.w / 2 + 16;
        const halfH = plot.h / 2 + 16;
        if (
          worldX < plot.cx - halfW || worldX > plot.cx + halfW ||
          worldY < plot.cy - halfH || worldY > plot.cy + halfH
        ) continue;

        // Check each hole with ellipse overlap (26×14 outer radius, same as drawn)
        const hitHole = this._holeAtPoint(plot, worldX, worldY);
        if (!hitHole) continue;

        // Hole found — validate before planting
        if (this._isHoleOccupied(plot, hitHole)) {
          this._showNotif('That hole already has a crop!', '#ffcc44');
          return;
        }
        if (!this._hasSeedStock(this._selectedSeed)) {
          this._showNotif('No seeds left!', '#ff8888');
          return;
        }
        if (plot.crops.length >= plot.capacity) {
          this._showNotif('Plot is full!', '#ff8888');
          return;
        }

        // Plant exactly at this hole's coordinate
        this._plant(plot, this._selectedSeed, { x: hitHole.x, y: hitHole.y });
        return; // one seed per click
      }
    });
  }

  _holeAtPoint(plot, wx, wy) {
    const rx = 13, ry = 6; 
    for (const hole of plot.holes) {
      const dx = (wx - hole.x) / rx;
      const dy = (wy - hole.y) / ry;
      if (dx * dx + dy * dy <= 1) return hole;
    }
    return null;
  }

  _isHoleOccupied(plot, hole) {
    return plot.crops.some(
      c => Math.abs(c.slotX - hole.x) < 2 && Math.abs(c.slotY - hole.y) < 2
    );
  }

  update() {
    const now = Date.now();
    for (const plot of this._plots) {
      for (const crop of plot.crops) {
        const def = FarmingSystem.CROP_TYPES[crop.key];
        if (!def) continue;
        // Redraw progress bar every tick (smooth fill)
        if (crop.barGfx && !crop.barFlash) this._drawCropBar(crop);
        if (crop.stage >= def.stages) continue;
        if (now >= crop.nextAt) {
          crop.stage++;
          crop.nextAt = crop.stage < def.stages ? now + def.growthMs : null;
          this._refreshCropSprite(crop, plot);
          
          // Growth Bounce Animation
          if (crop.sprite) {
            this.scene.tweens.killTweensOf(crop.sprite);
            crop.sprite.setScale(1); // Reset
            this.scene.tweens.add({
              targets: crop.sprite,
              scaleY: 1.3,
              scaleX: 0.8,
              duration: 200,
              yoyo: true,
              ease: 'Quad.easeOut'
            });
            // Tiny leaf poof on growth
            this._emitParticles(crop.slotX, crop.slotY - 5, 0x4caf50, 2);

            // When final stage reached — start blink indicator
            if (crop.stage >= def.stages) {
              this._startBlinkIndicator(crop);
            }

            // Flash the bar bright on advance, then redraw
            crop.barFlash = true;
            this._drawCropBar(crop);
            // Reset flash after one frame
            this.scene.time.delayedCall(180, () => {
              if (crop.barGfx) { crop.barFlash = false; this._drawCropBar(crop); }
            });
          }
        }
      }
    }
  }

  tryInteract() {
    const px = this.player.x, py = this.player.y;
    let closest = null, closestDist = CFG.PLAYER.INTERACT_DIST;
    for (const p of this._plots) {
      // p.cx includes the 640 offset, so distance checking aligns with visual position
      const d = Phaser.Math.Distance.Between(px, py, p.cx, p.cy);
      if (d < closestDist) { closestDist = d; closest = p; }
    }
    if (!closest) return false;

    const harvestable = closest.crops.find(c => {
      const def = FarmingSystem.CROP_TYPES[c.key];
      return def && c.stage >= def.stages;
    });
    
    if (harvestable) {
      this._harvest(closest, harvestable);
      return true;
    }

    return false;
  }

  updateLabels() {
    for (const p of this._plots) {
      if (!p.label) continue;
      p.label.setVisible(false);
    }
  }

  _plant(plot, seedKey, specificSlot = null) {
    const def = FarmingSystem.CROP_TYPES[seedKey];
    if (!def) return;

    if (!this._consumeSeed(seedKey)) return;

    const slot = specificSlot ?? this._nextSlot(plot);
    const crop = {
      key:   seedKey,
      stage: 0,
      nextAt: Date.now() + def.growthMs,
      slotX: slot.x,
      slotY: slot.y,
      sprite: null,
    };
    plot.crops.push(crop);
    this._refreshCropSprite(crop, plot);

    const holeIdx = plot.holes.findIndex(
      h => Math.abs(h.x - slot.x) < 4 && Math.abs(h.y - slot.y) < 4
    );
    crop.holeIndex = holeIdx; 
    if (holeIdx !== -1) plot.holeSprites[holeIdx].setVisible(false);

    if (crop.sprite) {
      crop.sprite.setScale(0);
      this.scene.tweens.add({
        targets: crop.sprite, scale: 1, duration: 400, ease: 'Back.easeOut'
      });
    }

    this._emitParticles(slot.x, slot.y, 0x5c3a21, 5);

    crop.barGfx   = this.scene.add.graphics().setDepth(9050);
    crop.barFlash = false; 
    this._drawCropBar(crop);

    this._drawCapacityDots(plot.dots, plot.cx, plot.cy + plot.h/2 + 4, plot.capacity, plot.crops.length);

    if (!this._hasSeedStock(seedKey)) this.clearSelectedSeed();
  }

  _getHotbar() {
    return this.scene.scene?.get?.('UIScene')?._hotbar ?? null;
  }

  _hasSeedStock(seedKey) {
    const hotbar = this._getHotbar();
    return hotbar?.hasItem?.(seedKey, 1) || this.inventory.hasItem(seedKey, 1);
  }

  _consumeSeed(seedKey) {
    const hotbar = this._getHotbar();
    if (hotbar?.activeItem?.key === seedKey) return hotbar.consumeActiveItem(1);
    if (hotbar?.consumeItem?.(seedKey, 1)) return true;
    return this.inventory.removeItem(seedKey, 1);
  }

  _harvest(plot, crop) {
    const def   = FarmingSystem.CROP_TYPES[crop.key];
    const label = def?.label ?? crop.key;
    const qty   = CFG.FARMING.YIELD;

    const iconKey = 'inv_icon_' + crop.key;
    this.inventory.addItem(crop.key + '_harvested', qty, 'Harvested ' + label, iconKey);
    this.inventory.addItem(crop.key, 1, label + ' Seed', 'seed_icon_' + crop.key);

    if (crop.barGfx) { crop.barGfx.destroy(); crop.barGfx = null; }
    if (crop.blinkTween) { crop.blinkTween.remove(); crop.blinkTween = null; }
    crop.blinkBright = false;

    if (crop.sprite) {
      this.scene.tweens.killTweensOf(crop.sprite);
      this.scene.tweens.add({
        targets: crop.sprite,
        y: crop.sprite.y - 40,
        scale: 1.5,
        alpha: 0,
        duration: 350,
        ease: 'Cubic.easeOut',
        onComplete: () => crop.sprite.destroy()
      });
    }

    this._emitParticles(crop.slotX, crop.slotY - 10, def?.color || 0x4caf50, 8);
    this._emitParticles(crop.slotX, crop.slotY, 0x5c3a21, 4); 

    this.scene.time.delayedCall(150, () => {
      this._float(crop.slotX, crop.slotY, `+${qty} ${label}`, '#aaffaa', true);
    });

    plot.crops = plot.crops.filter(c => c !== crop);

    if (crop.holeIndex !== -1 && plot.holeSprites[crop.holeIndex]) {
      plot.holeSprites[crop.holeIndex].setVisible(true);
    }
    
    this._drawCapacityDots(plot.dots, plot.cx, plot.cy + plot.h/2 + 4, plot.capacity, plot.crops.length);
  }

  _nextSlot(plot) {
    return this._slotPosition(plot, plot.crops.length, plot.capacity);
  }

  _slotPosition(plot, index, total) {
    const cols = Math.ceil(Math.sqrt(total));
    const rows = Math.ceil(total / cols);
    const col  = index % cols;
    const row  = Math.floor(index / cols);
    const padX = plot.w / (cols + 1);
    const padY = plot.h / (rows + 1);
    return {
      x: plot.cx - plot.w/2 + padX * (col + 1), // plot.cx already has the offset!
      y: plot.cy - plot.h/2 + padY * (row + 1),
    };
  }

  _buildTextures() {
    for (const key of Object.keys(FarmingSystem.CROP_TYPES)) {
      const texKey = 'crop_' + key;
      if (this.scene.textures.exists(texKey)) {
        this._stageCache[key] = this._detectStages(texKey, key);
      }
    }
  }

  _detectStages(texKey, cropKey) {
    if (this._stageCache[cropKey]?.length) return this._stageCache[cropKey];
    const src = this.scene.textures.get(texKey)?.source?.[0]?.image;
    if (!src) return [];
    const canvas = document.createElement('canvas');
    canvas.width = src.naturalWidth; canvas.height = src.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const W = canvas.width, H = canvas.height;
    const colHas = new Uint8Array(W);
    for (let x = 0; x < W; x++)
      for (let y = 0; y < H; y++) {
        const i = (y*W+x)*4;
        if (data[i]+data[i+1]+data[i+2] > 30 && data[i+3] > 20) { colHas[x]=1; break; }
      }
    const runs = [];
    let inRun=false, rs=0;
    for (let x=0; x<=W; x++) {
      if (colHas[x]&&!inRun){rs=x;inRun=true;}
      else if (!colHas[x]&&inRun){runs.push([rs,x-1]);inRun=false;}
    }
    const stages = [];
    runs.forEach(([x0,x1],si)=>{
      let minY=H,maxY=0,minX=x1,maxX=x0;
      for(let x=x0;x<=x1;x++) for(let y=0;y<H;y++){
        const i=(y*W+x)*4;
        if(data[i]+data[i+1]+data[i+2]>30&&data[i+3]>20){
          if(y<minY)minY=y;if(y>maxY)maxY=y;if(x<minX)minX=x;if(x>maxX)maxX=x;
        }
      }
      if(maxY<=minY)return;
      const sw=maxX-minX+1,sh=maxY-minY+1;
      const key=`${cropKey}_s${si}`;
      if(!this.scene.textures.exists(key)){
        const out=document.createElement('canvas');
        out.width=sw;out.height=sh;
        out.getContext('2d').drawImage(src,minX,minY,sw,sh,0,0,sw,sh);
        this.scene.textures.addCanvas(key,out);
      }
      stages.push({key,w:sw,h:sh});
    });
    return (this._stageCache[cropKey]=stages);
  }

  _refreshCropSprite(crop, plot) {
    const stages = this._detectStages('crop_' + crop.key, crop.key);
    if (!stages.length) return;
    const def     = FarmingSystem.CROP_TYPES[crop.key];
    const numS    = stages.length;
    const sheetSi = Math.min(Math.round((crop.stage/Math.max(1,def.stages-1))*(numS-1)), numS-1);
    const {key, w:nw, h:nh} = stages[sheetSi];

    if (!crop.sprite) {
      crop.sprite = this.scene.add.image(crop.slotX, crop.slotY, key)
        .setOrigin(0.5, 1.0)          
        .setDepth(crop.slotY);        
    } else {
      crop.sprite.setTexture(key);
      crop.sprite.setDepth(crop.slotY); 
    }
  }

  _makePlot(def) {
    // 🔥 We apply the offset strictly here!
    const cx = def.cx + FarmingSystem.PLOT_OFFSET_X; 
    const cy = def.cy;
    const w = def.w;
    const h = def.h;
    const capacity = def.capacity;

    const labelY = cy - h / 2 - 20;
    const label = this.scene.add.text(cx, labelY, '', {})
      .setOrigin(0.5).setDepth(9999).setVisible(false).setScale(0.5);

    const dots = this.scene.add.graphics().setDepth(9050).setVisible(false);
    this._drawCapacityDots(dots, cx, cy + h/2 + 4, capacity, 0);

    const tempPlot = { cx, cy, w, h }; // Everything else now builds off this new shifted `cx`

    const HOLE_RX = 13, HOLE_RY = 6;
    const hasDigHoles = this.scene.textures.exists('dig_holes');

    const holes       = [];
    const holeSprites = [];

    for (let i = 0; i < capacity; i++) {
      const slot = this._slotPosition(tempPlot, i, capacity);
      holes.push({ x: slot.x, y: slot.y, index: i });

      if (hasDigHoles) {
        const img = this.scene.add.image(slot.x, slot.y, 'dig_holes')
          .setOrigin(0.5, 0.5)
          .setDisplaySize(HOLE_RX * 2, HOLE_RY * 2)
          .setDepth(slot.y - 1)
          .setAlpha(0.92);
        holeSprites.push(img);
      } else {
        const g = this.scene.add.graphics().setDepth(slot.y - 1);
        g.fillStyle(0x1a0f0a, 0.5);
        g.fillEllipse(slot.x, slot.y, HOLE_RX * 2, HOLE_RY * 2);
        g.fillStyle(0x0e0704, 0.7);
        g.fillEllipse(slot.x, slot.y, HOLE_RX, HOLE_RY);
        holeSprites.push(g);
      }
    }

    this._plots.push({ cx, cy, w, h, capacity, label, dots, crops:[], holes, holeSprites });
  }

  _drawCapacityDots(g, x, y, total, filled) {
    g.clear();
    g.setVisible(false);
  }

  _buildSeedHUD() {}
  isReady() { return true; }

  _updateSeedHUD(key) {
    const uiScene = this.scene.scene.get('UIScene');
    uiScene?._setSeedHUD?.(key);
  }

  _showNotif(msg, color='#ffffff') {
    const uiScene = this.scene.scene.get('UIScene');
    if (uiScene?._showNotif) {
      uiScene._showNotif(msg, color);
    }
  }

  _float(x, y, msg, color='#ffffff', isLoot = false){
    const t = this.scene.add.text(x, y - 20, msg, {
      fontFamily: 'Arial, sans-serif', fontSize: isLoot ? '22px' : '18px', fontStyle: 'bold',
      fill: color, stroke: '#111111', strokeThickness: 5, resolution: 2
    }).setOrigin(0.5).setDepth(9999).setScale(0.2); 

    this.scene.tweens.add({
      targets: t, scale: 0.5, y: y - 40, duration: 300, ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: t, y: y - 70, alpha: 0, delay: isLoot ? 600 : 200, duration: 500, ease: 'Power2',
          onComplete: () => t.destroy()
        });
      }
    });
  }

  _drawCropBar(crop) {
    const g   = crop.barGfx;
    const def = FarmingSystem.CROP_TYPES[crop.key];
    if (!g || !def) return;

    g.clear();

    const BAR_W  = 20;  
    const BAR_H  = 3;   
    const BAR_OY = 4;    
    const bx     = crop.slotX - BAR_W / 2;
    const by     = crop.slotY + BAR_OY;

    const isReady = crop.stage >= def.stages;

    if (isReady) {
      const bright = crop.blinkBright !== false; 
      g.fillStyle(0x111111, 0.75);
      g.fillRoundedRect(bx - 1, by - 1, BAR_W + 2, BAR_H + 2, 2);
      g.fillStyle(bright ? 0x00ff88 : 0x005533, 1);
      g.fillRoundedRect(bx, by, BAR_W, BAR_H, 1);
      if (bright) {
        g.fillStyle(0xffffff, 0.3);
        g.fillRoundedRect(bx, by, BAR_W, Math.ceil(BAR_H / 2), 1);
      }
      return;
    }

    g.fillStyle(0x111111, 0.75);
    g.fillRoundedRect(bx - 1, by - 1, BAR_W + 2, BAR_H + 2, 2);

    const stageProgress = crop.nextAt !== null
      ? 1 - Math.max(0, (crop.nextAt - Date.now()) / def.growthMs)
      : 1;

    const totalProgress = (crop.stage + stageProgress) / def.stages;
    const fillW = Math.max(1, Math.round(BAR_W * totalProgress));

    const fillColor = crop.barFlash
      ? 0xffffff                       
      : Phaser.Display.Color.HSVToRGB(
          0.33 - totalProgress * 0.25, 
          0.9,
          1.0
        ).color;

    g.fillStyle(fillColor, 1);
    g.fillRoundedRect(bx, by, fillW, BAR_H, 1);

    for (let s = 1; s < def.stages; s++) {
      const tx = bx + Math.round(BAR_W * (s / def.stages));
      g.fillStyle(0x000000, 0.6);
      g.fillRect(tx, by, 1, BAR_H);
    }
  }

  _startBlinkIndicator(crop) {
    crop.blinkBright = true;
    crop.blinkTween  = this.scene.time.addEvent({
      delay    : 500,
      loop     : true,
      callback : () => {
        crop.blinkBright = !crop.blinkBright;
        this._drawCropBar(crop);
      },
    });
    this._emitParticles(crop.slotX, crop.slotY - 8, 0xffd700, 5);
  }

  _emitParticles(x, y, color, count = 4) {
    for (let i = 0; i < count; i++) {
      const spark = this.scene.add.rectangle(x, y, 4, 4, color).setDepth(y + 20);
      const angle = Math.random() * Math.PI; 
      const dist  = 15 + Math.random() * 20;
      
      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y - Math.sin(angle) * dist + 15, 
        alpha: { from: 1, to: 0 },
        scale: { from: 1, to: 0.2 },
        angle: 180 + Math.random() * 180, 
        duration: 300 + Math.random() * 200,
        ease: 'Quad.easeOut',
        onComplete: () => spark.destroy()
      });
    }
  }
}
