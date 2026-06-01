// js/systems/HotbarSystem.js
class HotbarSystem {

  static IMG_W = 2130;
  static IMG_H = 1198;
  static STRIP = { x:16, y:531, w:2094, h:423 };
  static SEPS  = [24,265,469,672,876,1079,1267,1470,1673,1864,2102];
  static N     = 10;

  static get SC() { return 72 / 207; }
  static get DW() { return Math.round(2094 * HotbarSystem.SC); }
  static get DH() { return Math.round(423  * HotbarSystem.SC); }
  static get SZ() { return 72; }

  constructor(scene, inventorySystem) {
    this.scene     = scene;
    this.inventory = inventorySystem;

    this._slots    = Array(HotbarSystem.N).fill(null);
    this._active   = null;
    this._drag     = null;
    this._dragImg  = null;

    this._ui       = [];
    this._built    = false;

    this._build();
  }

  get activeIndex() { return this._active; }

  get activeItem() {
    return (this._active !== null) ? this._slots[this._active] : null;
  }

  beginInventoryDrag(key, label, iconKey, px, py) {
    this._startDrag({ key, label, iconKey, src:'inventory', srcIdx:-1 }, px, py);
    this._setSlotGlow(true);
  }

  addItem(key, label, iconKey) {
    const i = this._slots.findIndex(s => s === null);
    if (i < 0) return false;
    this._slots[i] = { key, label, iconKey: iconKey ?? null };
    this._render();
    return true;
  }

  refresh() { this._render(); }

  _build() {
    const { width:W, height:H } = this.scene.scale;
    const SC = HotbarSystem.SC;
    const S  = HotbarSystem.STRIP;
    const DW = HotbarSystem.DW;
    const DH = HotbarSystem.DH;
    const SZ = HotbarSystem.SZ;

    this._ox = Math.round((W - DW) / 2);
    this._oy = H - DH;

    const imgSX = DW / S.w;
    const imgSY = DH / S.h;
    const bgX   = this._ox - Math.round(S.x * imgSX);
    const bgY   = this._oy - Math.round(S.y * imgSY);

    this._bgX = bgX; this._bgY = bgY;
    this._imgSX = imgSX; this._imgSY = imgSY;

    this._bg = this.scene.add.image(bgX, bgY, 'ui_hotbar')
      .setOrigin(0, 0)
      .setDisplaySize(Math.round(HotbarSystem.IMG_W * imgSX),
                      Math.round(HotbarSystem.IMG_H * imgSY))
      .setScrollFactor(0)
      .setDepth(80);

    const SEPS = HotbarSystem.SEPS;

    for (let i = 0; i < HotbarSystem.N; i++) {
      const nCX = (SEPS[i] + SEPS[i+1]) / 2;
      const nCY = 670;

      const cx = bgX + Math.round(nCX * imgSX);
      const cy = bgY + Math.round(nCY * imgSY);

      const rect = new Phaser.Geom.Rectangle(cx - SZ/2, cy - SZ/2, SZ, SZ);

      const hl = this.scene.add.graphics()
        .setScrollFactor(0).setDepth(82);
      hl.lineStyle(5, 0xFFD700, 1.0);
      hl.strokeRect(cx - SZ/2 + 1, cy - SZ/2 + 1, SZ - 2, SZ - 2);
      hl.setVisible(false);

      const icon = this.scene.add.image(cx, cy, '__DEFAULT')
        .setScrollFactor(0).setDepth(83)
        .setVisible(false);

      const qty = this.scene.add.text(
        cx + SZ/2 - 1, cy + SZ/2 - 1, '',
        { fontFamily:'Arial', fontSize:'30px', fontStyle:'bold', resolution:2,
          color:'#ffffff', stroke:'#000000', strokeThickness:6 }
      ).setOrigin(1, 1).setScrollFactor(0).setDepth(84).setScale(0.5);

      const zone = this.scene.add.rectangle(cx, cy, SZ, SZ)
        .setScrollFactor(0).setDepth(85)
        .setInteractive({ useHandCursor: true, draggable: true });

      this.scene.input.setDraggable(zone);

      zone.on('pointerdown', (ptr) => {
        if (!ptr.leftButtonDown()) return;
        if (this._drag) return;
        this._onSlotClick(i);
      });

      zone.on('dragstart', (ptr) => this._onSlotDragStart(i, ptr));
      zone.on('drag',      (ptr) => this._onPointerMove(ptr));
      zone.on('dragend',   (ptr) => this._onPointerUp(ptr));

      this._ui.push({ hl, icon, qty, zone, cx, cy, rect });
    }

    this.scene.input.on('pointermove', (ptr) => {
      if (this._drag?.src === 'inventory') this._onPointerMove(ptr);
    });
    this.scene.input.on('pointerup', (ptr) => {
      if (this._drag?.src === 'inventory') this._onPointerUp(ptr);
    });

    this._built = true;
    this._render();
  }

  _render() {
    if (!this._built) return;
    const SZ = HotbarSystem.SZ;

    for (let i = 0; i < HotbarSystem.N; i++) {
      const slot = this._slots[i];
      const ui   = this._ui[i];

      ui.hl.setVisible(this._active === i);

      if (!slot) {
        ui.icon.setVisible(false);
        ui.qty.setText('');
        continue;
      }

      const tex = this._resolveIcon(slot.key, slot.iconKey);
      if (tex && this.scene.textures.exists(tex)) {
        const src  = this.scene.textures.get(tex).source[0];
        const maxS = SZ - 8;
        const sc   = Math.min(maxS / src.width, maxS / src.height, 2.0);
        ui.icon
          .setTexture(tex)
          .setDisplaySize(Math.round(src.width * sc), Math.round(src.height * sc))
          .setPosition(ui.cx, ui.cy)
          .setVisible(true);
      } else {
        ui.icon.setVisible(false);
      }

      // Always resolve inventory from UIScene so seeds planted while closed update instantly
      const liveInv = this.inventory
        ?? this.scene.scene?.get?.('UIScene')?._inventory;
      const invItem = liveInv?._items?.find(it => it.key === slot.key);
      const qtyNum  = invItem?.qty ?? 0;
      // Show badge; hide slot icon if item is fully consumed
      if (qtyNum <= 0 && invItem === undefined) {
        ui.qty.setText('');
      } else {
        ui.qty.setText(qtyNum > 1 ? `${qtyNum}` : '');
      }
    }
  }

  _onSlotClick(idx) {
    const item = this._slots[idx];
    if (!item) return;

    if (this._active === idx) {
      this._active = null;
      this._applyActive(null);
    } else {
      this._active = idx;
      this._applyActive(item);
    }
    this._render();
  }

  _applyActive(item) {
    const gs      = this.scene.scene.get('GameScene');
    const farming = gs?._farming;
    const uiScene = this.scene;

    if (!item) {
      farming?.clearSelectedSeed?.();
      gs?.registry?.set?.('activeTool', null);
      gs?.registry?.set?.('activeSeed', null);
      uiScene._setSeedHUD?.(null);
      return;
    }

    const isSeed = !!FarmingSystem?.CROP_TYPES?.[item.key];
    // ── FIX: match new key patterns (oak_axe / pine_axe / walnut_axe)
    const isAxe  = item.key.endsWith('_axe');
    const isPick = item.key.endsWith('_pickaxe');
    const isSword = item.key === 'sword';

    if (isSeed) {
      farming?.selectSeed?.(item.key);
      gs?.registry?.set?.('activeSeed', item.key);
      gs?.registry?.set?.('activeTool', null);
    } else {
      farming?.clearSelectedSeed?.();
      gs?.registry?.set?.('activeSeed', null);
      gs?.registry?.set?.('activeTool', item.key);
      if (isAxe || isPick || isSword) {
        const label = item.label ?? item.key;
        const prefix = isSword ? '' : '🪓 ';
        uiScene._showNotif?.(`${prefix}${label} equipped`, '#ffdd44');
      }
    }
  }

  _onSlotDragStart(idx, ptr) {
    const item = this._slots[idx];
    if (!item) return;

    this._pendingDrag = {
      item, idx,
      startX: ptr.x, startY: ptr.y,
      committed: false,
    };
  }

  _startDrag(info, px, py) {
    this._drag = info;
    this._dragImg?.destroy();
    this._dragImg = null;

    const tex = this._resolveIcon(info.key, info.iconKey);
    if (tex && this.scene.textures.exists(tex)) {
      this._dragImg = this.scene.add.image(px, py, tex)
        .setScrollFactor(0).setDepth(200).setAlpha(0.88).setScale(3.0);
    }
  }

  _onPointerMove(ptr) {
    if (this._pendingDrag && !this._pendingDrag.committed) {
      const dx = ptr.x - this._pendingDrag.startX;
      const dy = ptr.y - this._pendingDrag.startY;
      if (Math.sqrt(dx*dx + dy*dy) > 6) {
        const { item, idx } = this._pendingDrag;
        this._pendingDrag.committed = true;
        this._slots[idx] = null;
        if (this._active === idx) { this._active = null; this._applyActive(null); }
        this._render();
        this._startDrag({ key:item.key, label:item.label, iconKey:item.iconKey,
                          src:'hotbar', srcIdx:idx }, ptr.x, ptr.y);
      }
    }
    this._dragImg?.setPosition(ptr.x, ptr.y);
  }

  _onPointerUp(ptr) {
    if (this._pendingDrag && !this._pendingDrag.committed) {
      this._pendingDrag = null;
      return;
    }
    this._pendingDrag = null;

    if (!this._drag) return;
    const drag = this._drag;

    let target = -1;
    for (let i = 0; i < HotbarSystem.N; i++) {
      if (Phaser.Geom.Rectangle.Contains(this._ui[i].rect, ptr.x, ptr.y)) {
        target = i; break;
      }
    }

    if (target === -1) {
      // Check if dropped onto the open inventory panel
      const inv = this.scene._inventory
        ?? this.scene.scene?.get?.('UIScene')?._inventory;
      const bounds = inv?.getPanelBounds?.();
      const droppedOnInventory = bounds
        && Phaser.Geom.Rectangle.Contains(bounds, ptr.x, ptr.y);

      if (droppedOnInventory && drag.src === 'hotbar') {
        // Return hotbar item back into inventory
        inv.addItem(drag.key, 1, drag.label, drag.iconKey);
        this._slots[drag.srcIdx] = null;
        if (this._active === drag.srcIdx) {
          this._active = null;
          this._applyActive(null);
        }
      } else if (drag.src === 'hotbar') {
        // Dropped in dead space — put it back in its original slot
        this._slots[drag.srcIdx] = { key:drag.key, label:drag.label, iconKey:drag.iconKey };
      }
      // inventory-src drag that misses all hotbar slots: ghost just disappears
      this._setSlotGlow(false);
    } else {
      const existing = this._slots[target];

      if (drag.src === 'hotbar' && drag.srcIdx === target) {
        this._slots[target] = { key:drag.key, label:drag.label, iconKey:drag.iconKey };
      } else if (drag.src === 'hotbar') {
        this._slots[target]      = { key:drag.key, label:drag.label, iconKey:drag.iconKey };
        this._slots[drag.srcIdx] = existing;
      } else {
        // ── Dragged from inventory into hotbar slot ──────────────────────
        this._slots[target] = { key:drag.key, label:drag.label, iconKey:drag.iconKey };

        // Auto-activate the slot so the tool is immediately usable
        this._active = target;
        this._applyActive(this._slots[target]);

        // Only remove non-seed tools from inventory (seeds stay)
        const isSeed = !!FarmingSystem?.CROP_TYPES?.[drag.key];
        if (!isSeed) {
          const inv = this.scene._inventory ?? this.scene.scene?.get('UIScene')?._inventory;
          inv?.removeItemCompletely?.(drag.key);
        }
      }
    }

    this._setSlotGlow(false);
    this._dragImg?.destroy(); this._dragImg = null;
    this._drag = null;
    this._render();
  }

  _setSlotGlow(on) {
    if (!this._built) return;
    for (let i = 0; i < HotbarSystem.N; i++) {
      const ui = this._ui[i];
      if (!ui.glowRect) {
        ui.glowRect = this.scene.add.rectangle(
          ui.cx, ui.cy, HotbarSystem.SZ + 18, HotbarSystem.SZ + 18
        )
          .setScrollFactor(0)
          .setDepth(81)
          .setFillStyle(0xFFD700, 0.4)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setVisible(false);
      }
      ui.glowRect.setVisible(on);

      if (on) {
        this.scene.tweens.killTweensOf(ui.glowRect);
        this.scene.tweens.add({
          targets: ui.glowRect,
          alpha: { from: 0.1, to: 0.8 },
          scale: { from: 0.9, to: 1.1 },
          duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
      } else {
        this.scene.tweens.killTweensOf(ui.glowRect);
      }
    }
  }

  _resolveIcon(key, passedKey) {
    if (!key) return null;
    const base = key.replace(/_harvested$|_crop$/, '');
    const tries = [];
    if (passedKey) tries.push(passedKey);
    tries.push(`seed_icon_${key}`, `inv_icon_${base}`, key);
    return tries.find(k => k && this.scene.textures.exists(k)) ?? null;
  }
}
