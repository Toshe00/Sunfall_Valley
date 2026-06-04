// js/systems/HotbarSystem.js
class HotbarSystem {

  static IMG_W = 2130;
  static IMG_H = 1198;
  static STRIP = { x:16, y:531, w:2094, h:259 };
  static SEPS  = [24,265,469,672,876,1079,1267,1470,1673,1864,2102];
  static N     = 10;
  static HOTBAR_KEYS = {
    '&': 0, '\u00e9': 1, '"': 2, "'": 3, '(': 4,
    '-': 5, '\u00e8': 6, '_': 7, '\u00e7': 8, '\u00e0': 9,
  };
  static HOTBAR_CODES = {
    Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4,
    Digit6: 5, Digit7: 6, Digit8: 7, Digit9: 8, Digit0: 9,
  };

  static get SC() { return 72 / 207; }
  static get DW() { return Math.round(2094 * HotbarSystem.SC); }
  static get DH() { return Math.round(HotbarSystem.STRIP.h * HotbarSystem.SC); }
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
    this._layoutHotbar = () => this._layout();

    this._build();
  }

  get activeIndex() { return this._active; }

  get activeItem() {
    return (this._active !== null) ? this._slots[this._active] : null;
  }

  selectHotbarSlot(idx) {
    this._onSlotClick(idx);
  }

  beginInventoryDrag(key, label, iconKey, qty, px, py) {
    this._startDrag({ key, label, iconKey, qty: Math.max(1, qty ?? 1), src:'inventory', srcIdx:-1 }, px, py);
    this._setSlotGlow(true);
  }

  addItem(key, label, iconKey, qty = 1) {
    const i = this._slots.findIndex(s => s === null);
    if (i < 0) return false;
    this._slots[i] = { key, label, iconKey: iconKey ?? null, qty: Math.max(1, qty ?? 1) };
    this._render();
    return true;
  }

  refresh() { this._render(); }

  hasItem(key, qty = 1) {
    return (this._slots.find(slot => slot?.key === key)?.qty ?? 0) >= qty;
  }

  addQuantityToExisting(key, qty = 1, label = null, iconKey = null) {
    const slot = this._slots.find(item => item?.key === key);
    if (!slot) return false;
    slot.qty = Math.max(0, (slot.qty ?? 0) + qty);
    if (label) slot.label = label;
    if (iconKey) slot.iconKey = iconKey;
    this._render();
    return true;
  }

  consumeActiveItem(qty = 1) {
    if (this._active === null) return false;
    const item = this._slots[this._active];
    if (!item || (item.qty ?? 0) < qty) return false;
    item.qty -= qty;
    if (item.qty <= 0) this._clearSlot(this._active);
    this._render();
    return true;
  }

  consumeItem(key, qty = 1) {
    const idx = this._slots.findIndex(item => item?.key === key && (item.qty ?? 0) >= qty);
    if (idx < 0) return false;
    this._slots[idx].qty -= qty;
    if (this._slots[idx].qty <= 0) this._clearSlot(idx);
    this._render();
    return true;
  }

  clearActiveIfKey(key) {
    if (this._active === null) return false;
    return this._clearSlotIfKey(this._active, key);
  }

  _build() {
    const S  = HotbarSystem.STRIP;
    const SZ = HotbarSystem.SZ;

    const tex = this.scene.textures.get('ui_hotbar');
    if (tex && !tex.frames.hotbar_strip) {
      tex.add('hotbar_strip', 0, S.x, S.y, S.w, S.h);
    }

    this._bg = this.scene.add.image(0, 0, 'ui_hotbar', 'hotbar_strip')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(80);

    for (let i = 0; i < HotbarSystem.N; i++) {
      const hl = this.scene.add.graphics()
        .setScrollFactor(0).setDepth(82);
      hl.setVisible(false);

      const icon = this.scene.add.image(0, 0, '__DEFAULT')
        .setScrollFactor(0).setDepth(83)
        .setVisible(false);

      const qty = this.scene.add.text(
        0, 0, '',
        { fontFamily:'Arial', fontSize:'30px', fontStyle:'bold', resolution:2,
          color:'#ffffff', stroke:'#000000', strokeThickness:6 }
      ).setOrigin(1, 1).setScrollFactor(0).setDepth(84).setScale(0.5);

      const keyLabel = this.scene.add.text(
        0, 0, `${i + 1}`,
        { fontFamily:'Arial', fontSize:'28px', fontStyle:'bold', resolution:2,
          color:'#ffffff', stroke:'#000000', strokeThickness:6,
          shadow: { offsetX:1, offsetY:2, color:'#000000', blur:2, fill:true } }
      ).setOrigin(0.5, 1).setScrollFactor(0).setDepth(86).setScale(0.5);

      const zone = this.scene.add.rectangle(0, 0, SZ, SZ)
        .setScrollFactor(0).setDepth(85)
        .setInteractive({ useHandCursor: true, draggable: true });

      this.scene.input.setDraggable(zone);

      zone.on('pointerdown', (ptr) => {
        if (!ptr.leftButtonDown()) return;
        if (this._drag) return;
        this.selectHotbarSlot(i);
      });

      zone.on('dragstart', (ptr) => this._onSlotDragStart(i, ptr));
      zone.on('drag',      (ptr) => this._onPointerMove(ptr));
      zone.on('dragend',   (ptr) => this._onPointerUp(ptr));

      this._ui.push({ hl, icon, qty, keyLabel, zone, cx:0, cy:0, rect:new Phaser.Geom.Rectangle(0, 0, SZ, SZ) });
    }

    this.scene.input.on('pointermove', (ptr) => {
      if (this._drag?.src === 'inventory') this._onPointerMove(ptr);
    });
    this.scene.input.on('pointerup', (ptr) => {
      if (this._drag?.src === 'inventory') this._onPointerUp(ptr);
    });
    this.scene.input.keyboard.on('keydown', (event) => this._onHotbarKeyDown(event));
    this.scene.scale.on('resize', this._layoutHotbar);

    this._built = true;
    this._layout();
    this._render();
  }

  _layout() {
    if (!this._bg || !this._ui) return;

    const { width:W, height:H } = this.scene.scale;
    const S  = HotbarSystem.STRIP;
    const DW = HotbarSystem.DW;
    const DH = HotbarSystem.DH;
    const SZ = HotbarSystem.SZ;

    this._ox = Math.round((W - DW) / 2);
    this._oy = H - DH;
    this._imgSX = DW / S.w;
    this._imgSY = DH / S.h;

    this._bg
      .setPosition(this._ox, this._oy)
      .setDisplaySize(DW, DH)
      .setScrollFactor(0);

    for (let i = 0; i < HotbarSystem.N; i++) {
      const ui = this._ui[i];
      const nCX = (HotbarSystem.SEPS[i] + HotbarSystem.SEPS[i+1]) / 2;
      const nCY = 670;
      const cx = this._ox + Math.round((nCX - S.x) * this._imgSX);
      const cy = this._oy + Math.round((nCY - S.y) * this._imgSY);

      ui.cx = cx;
      ui.cy = cy;
      ui.rect.setTo(cx - SZ / 2, cy - SZ / 2, SZ, SZ);

      ui.hl.clear();
      ui.hl.lineStyle(5, 0xFFD700, 1.0);
      ui.hl.strokeRect(cx - SZ/2 + 1, cy - SZ/2 + 1, SZ - 2, SZ - 2);

      ui.icon.setPosition(cx, cy).setScrollFactor(0);
      ui.qty.setPosition(cx + SZ/2 - 1, cy + SZ/2 - 1).setScrollFactor(0);
      ui.keyLabel.setPosition(cx, cy - SZ/2 - 5).setScrollFactor(0);
      ui.zone.setPosition(cx, cy).setScrollFactor(0);
      ui.glowRect?.setPosition(cx, cy).setScrollFactor(0);
    }

    this._render();
  }

  _render() {
    if (!this._built) return;
    const SZ = HotbarSystem.SZ;

    for (let i = 0; i < HotbarSystem.N; i++) {
      const slot = this._slots[i];
      const ui   = this._ui[i];

      if (!slot) {
        ui.hl.setVisible(false);
        ui.icon.setVisible(false);
        ui.qty.setText('');
        continue;
      }

      if ((slot.qty ?? 0) <= 0) {
        this._clearSlot(i);
        ui.hl.setVisible(false);
        ui.icon.setVisible(false);
        ui.qty.setText('');
        continue;
      }

      ui.hl.setVisible(this._active === i);

      const tex = this._resolveIcon(slot.key, slot.iconKey);
      if (tex && this.scene.textures.exists(tex)) {
        const src  = this.scene.textures.get(tex).source[0];
        const maxS = this._isOreIconItem(slot.key) ? 48 : SZ - 8;
        const sc   = Math.min(maxS / src.width, maxS / src.height, 2.0);
        ui.icon
          .setTexture(tex)
          .setOrigin(0.5)
          .setDisplaySize(Math.round(src.width * sc), Math.round(src.height * sc))
          .setPosition(ui.cx, ui.cy)
          .setVisible(true);
      } else {
        ui.icon.setVisible(false);
      }

      const qtyNum = slot.qty ?? 1;
      ui.qty.setText(qtyNum > 1 ? `${qtyNum}` : '');
    }
  }

  _isInventoryBacked(key) {
    return !!FarmingSystem?.CROP_TYPES?.[key] || !!CFG.CONSUMABLES?.[key];
  }

  _clearSlot(idx) {
    const wasActive = this._active === idx;
    this._slots[idx] = null;
    if (wasActive) {
      this._active = null;
      this._applyActive(null);
    }
  }

  _clearSlotIfKey(idx, key) {
    const item = this._slots[idx];
    if (!item || item.key !== key) return false;
    this._clearSlot(idx);
    this._render();
    return true;
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

  _onHotbarKeyDown(event) {
    if (this.scene.registry.get('playerInputLocked')) return;
    if (this._drag) return;

    const keyIndex = HotbarSystem.HOTBAR_KEYS[event.key];
    const codeIndex = HotbarSystem.HOTBAR_CODES[event.code];
    const idx = keyIndex ?? codeIndex;
    if (idx === undefined) return;

    event.preventDefault?.();
    this.selectHotbarSlot(idx);
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
    const isConsumable = !!CFG.CONSUMABLES?.[item.key];
    // ── FIX: match new key patterns (oak_axe / pine_axe / walnut_axe)
    const isAxe  = item.key.endsWith('_axe');
    const isPick = item.key.endsWith('_pickaxe');
    const isSword = item.key === 'sword';
    const isScythe = item.key === 'harvest_scythe';

    if (isSeed) {
      farming?.selectSeed?.(item.key);
      gs?.registry?.set?.('activeSeed', item.key);
      gs?.registry?.set?.('activeTool', null);
    } else if (isConsumable) {
      farming?.clearSelectedSeed?.();
      gs?.registry?.set?.('activeSeed', null);
      gs?.registry?.set?.('activeTool', null);
    } else {
      farming?.clearSelectedSeed?.();
      gs?.registry?.set?.('activeSeed', null);
      gs?.registry?.set?.('activeTool', item.key);
      if (isAxe || isPick || isSword || isScythe) {
        const label = item.label ?? item.key;
        const prefix = (isSword || isScythe) ? '' : '🪓 ';
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
        .setScrollFactor(0).setDepth(200).setAlpha(0.88);
      if (this._isOreIconItem(info.key)) {
        this._fitImageInBox(this._dragImg, tex, 48, 48);
      } else {
        this._dragImg.setScale(3.0);
      }
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
        this._startDrag({ key:item.key, label:item.label, iconKey:item.iconKey, qty:item.qty ?? 1,
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
        inv.addItem(drag.key, drag.qty ?? 1, drag.label, drag.iconKey, { forceInventory: true });
        this._slots[drag.srcIdx] = null;
        if (this._active === drag.srcIdx) {
          this._active = null;
          this._applyActive(null);
        }
      } else if (drag.src === 'hotbar') {
        // Dropped in dead space — put it back in its original slot
        this._slots[drag.srcIdx] = { key:drag.key, label:drag.label, iconKey:drag.iconKey, qty:drag.qty ?? 1 };
      }
      // inventory-src drag that misses all hotbar slots: ghost just disappears
      this._setSlotGlow(false);
    } else {
      const existing = this._slots[target];

      if (drag.src === 'hotbar' && drag.srcIdx === target) {
        this._slots[target] = { key:drag.key, label:drag.label, iconKey:drag.iconKey, qty:drag.qty ?? 1 };
      } else if (drag.src === 'hotbar') {
        this._slots[target]      = { key:drag.key, label:drag.label, iconKey:drag.iconKey, qty:drag.qty ?? 1 };
        this._slots[drag.srcIdx] = existing;
      } else {
        // ── Dragged from inventory into hotbar slot ──────────────────────
        const inv = this.scene._inventory ?? this.scene.scene?.get('UIScene')?._inventory;
        const moved = inv?.takeItemCompletely?.(drag.key);
        if (!moved) {
          this._setSlotGlow(false);
          this._dragImg?.destroy(); this._dragImg = null;
          this._drag = null;
          this._render();
          return;
        }

        if (existing?.key === moved.key) {
          existing.qty = (existing.qty ?? 1) + (moved.qty ?? drag.qty ?? 1);
          if (moved.label) existing.label = moved.label;
          if (moved.iconKey) existing.iconKey = moved.iconKey;
          this._slots[target] = existing;
        } else {
          if (existing) {
            inv?.addItem?.(existing.key, existing.qty ?? 1, existing.label, existing.iconKey, { forceInventory: true });
          }
          this._slots[target] = {
            key: moved.key,
            label: moved.label,
            iconKey: moved.iconKey ?? drag.iconKey ?? null,
            qty: Math.max(1, moved.qty ?? drag.qty ?? 1),
          };
        }

        // Auto-activate the slot so the tool is immediately usable
        this._active = target;
        this._applyActive(this._slots[target]);

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
    const oreIconOverride = {
      bronze: 'inv_icon_bronze_ore_v2',
      iron: 'inv_icon_iron_ore_v2',
      gold: 'inv_icon_gold_ore_v2',
    }[base];
    const tries = oreIconOverride ? [oreIconOverride] : [];
    if (passedKey) tries.push(passedKey);
    const configuredIconKey = CFG.ITEMS?.[key]?.iconKey;
    if (configuredIconKey) tries.push(configuredIconKey);
    tries.push(`seed_icon_${key}`, `inv_icon_${base}`, key);
    return tries.find(k => k && this.scene.textures.exists(k)) ?? null;
  }

  _isOreIconItem(itemKey) {
    return ['bronze', 'iron', 'gold'].includes(itemKey);
  }

  _fitImageInBox(image, textureKey, maxW, maxH) {
    const src = this.scene.textures.get(textureKey)?.source?.[0];
    if (!src?.width || !src?.height) return image;

    const scale = Math.min(maxW / src.width, maxH / src.height);
    const displayW = Math.max(1, Math.round(src.width * scale));
    const displayH = Math.max(1, Math.round(src.height * scale));
    return image
      .setOrigin(0.5)
      .setDisplaySize(displayW, displayH);
  }

}
