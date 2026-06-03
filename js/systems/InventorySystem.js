// js/systems/InventorySystem.js
class InventorySystem {
  constructor(scene) {
    this.scene         = scene;
    this._open         = false;
    this._items        = [];
    this._page         = 0;
    this._onSelectSeed = null;
    this._icons        = [];
    this._slotRects    = [];
    this._drag         = null;
    this._build();
  }

  toggle()     { this._open ? this.close() : this.open(); }
  isOpen()     { return this._open; }
  onSelect(cb) { this._onSelectSeed = cb; }

  open() {
    this._open = true;
    this._container.setVisible(true);
    
    // Start small and transparent
    this._container.setAlpha(0);
    this._container.setScale(0.8);

    // Spring animation
    this.scene.tweens.add({
      targets: this._container,
      alpha: 1,
      scale: 1,
      duration: 350,
      ease: 'Back.easeOut'
    });

    this._updatePageIndicator();
    this.refresh();
  }

  close() {
    this._open = false;
    
    // Shrink and fade out
    this.scene.tweens.add({
      targets: this._container,
      alpha: 0,
      scale: 0.8,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this._container.setVisible(false);
        this._clearIcons();
      }
    });
  }

  addItem(key, qty, label, iconKey = null, options = {}) {
    const hotbar = this.scene._hotbar
      ?? this.scene.scene?.get?.('UIScene')?._hotbar;
    if (!options.forceInventory && hotbar?.addQuantityToExisting?.(key, qty, label, iconKey)) {
      this._notifyHotbar();
      return;
    }

    const ex = this._items.find(i => i?.key === key);
    if (ex) { ex.qty += qty; ex.label = label; if (iconKey) ex.iconKey = iconKey; }
    else {
      const emptyIdx = this._items.findIndex(i => !i);
      const nextItem = { key, qty, label, iconKey: iconKey || null };
      if (emptyIdx >= 0) this._items[emptyIdx] = nextItem;
      else this._items.push(nextItem);
    }
    if (this._open) this.refresh();
  }

  hasItem(key, qty = 1) {
    return (this._items.find(i => i?.key === key)?.qty ?? 0) >= qty;
  }

  removeItem(key, qty = 1) {
    const idx = this._items.findIndex(i => i?.key === key);
    const item = this._items[idx];
    if (!item) return false;
    item.qty -= qty;
    if (item.qty <= 0) {
      this._items[idx] = null;
      this._trimEmptyTail();
    }
    if (this._open) this.refresh();
    // Always sync hotbar qty badges even when inventory panel is closed
    this._notifyHotbar();
    return true;
  }

  removeItemCompletely(key) {
    this._items = this._items.filter(i => i?.key !== key);
    if (this._open) this.refresh();
    this._notifyHotbar();
  }

  takeItemCompletely(key) {
    const idx = this._items.findIndex(i => i?.key === key);
    if (idx < 0) return null;
    const [item] = this._items.splice(idx, 1);
    this._trimEmptyTail();
    if (this._open) this.refresh();
    this._notifyHotbar();
    return item;
  }

  // Expose panel bounds so HotbarSystem can detect drops back onto inventory
  getPanelBounds() {
    if (!this._container?.visible) return null;
    const SC = this._SC;
    const PW = Math.round(200 * SC);
    const PH = Math.round(200 * SC);
    const { x, y } = this._container;
    return new Phaser.Geom.Rectangle(x, y, PW, PH);
  }

  _notifyHotbar() {
    // UIScene holds _hotbar; reach it from either UIScene or GameScene context
    const hotbar = this.scene._hotbar
      ?? this.scene.scene?.get?.('UIScene')?._hotbar;
    if (hotbar) hotbar.refresh();
  }

  _trimEmptyTail() {
    while (this._items.length > 0 && !this._items[this._items.length - 1]) {
      this._items.pop();
    }
  }

  _moveItemWithinInventory(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return false;

    const source = this._items[fromIndex];
    if (!source || (source.qty ?? 0) <= 0) return false;

    while (this._items.length <= toIndex) this._items.push(null);

    const target = this._items[toIndex] ?? null;
    if (target && target.key === source.key) {
      target.qty = (target.qty ?? 0) + (source.qty ?? 0);
      if (source.label) target.label = source.label;
      if (source.iconKey) target.iconKey = source.iconKey;
      this._items[fromIndex] = null;
    } else {
      this._items[toIndex] = source;
      this._items[fromIndex] = target;
    }

    this._trimEmptyTail();
    if (this._open) this.refresh();
    this._notifyHotbar();
    return true;
  }

  _getSlotIndexAt(px, py) {
    if (!this._open) return -1;
    const { cols, rows, colCx, rowCy } = this._gridLayout();
    this._buildSlotRects(cols, rows, colCx, rowCy);
    return this._slotRects.find((slot) => (
      Phaser.Geom.Rectangle.Contains(slot.rect, px, py)
    ))?.index ?? -1;
  }

  _gridLayout() {
    const SC = this._SC;
    return {
      cols: 5,
      rows: 4,
      colCx: [47, 75, 101, 126, 153].map(v => Math.round(v * SC)),
      rowCy: [57, 82, 107, 132].map(v => Math.round(v * SC)),
    };
  }

  _buildSlotRects(cols, rows, colCx, rowCy) {
    const size = Math.round(24 * this._SC);
    this._slotRects = [];
    const scaleX = this._container.scaleX || 1;
    const scaleY = this._container.scaleY || 1;
    const pageStart = this._page * cols * rows;

    for (let i = 0; i < cols * rows; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = this._container.x + colCx[col] * scaleX;
      const cy = this._container.y + rowCy[row] * scaleY;
      this._slotRects.push({
        index: pageStart + i,
        rect: new Phaser.Geom.Rectangle(
          cx - (size * scaleX) / 2,
          cy - (size * scaleY) / 2,
          size * scaleX,
          size * scaleY
        ),
      });
    }
  }

  _resolveIcon(itemKey, passedIconKey) {
    const base = itemKey.replace(/_harvested$|_crop$/, '');
    const isHarvested = itemKey.endsWith('_harvested') || itemKey.endsWith('_crop');
    const oreIconOverride = {
      bronze: 'inv_icon_bronze',
      iron: 'inv_icon_iron',
      gold: 'inv_icon_gold',
    }[base];
    const candidates = oreIconOverride ? [oreIconOverride] : [];
    if (passedIconKey) candidates.push(passedIconKey);
    if (isHarvested) {
      candidates.push(`inv_icon_${base}`, `crop_${base}`, `seed_icon_${base}`);
    } else {
      candidates.push(`seed_icon_${itemKey}`, `inv_icon_${itemKey}`, itemKey);
    }
    for (const k of candidates) {
      if (k && this.scene.textures.exists(k)) return k;
    }
    return null;
  }

  refresh() {
    this._clearIcons();
    const SC   = this._SC;
    const { cols: COLS, rows: ROWS, colCx: COL_CX, rowCy: ROW_CY } = this._gridLayout();
    const PER_PAGE = COLS * ROWS;

    const ICON_MAX = Math.round(14 * SC);   
    const ICON_OY  = Math.round(-3 * SC);   
    const TEXT_OY  = Math.round( 5 * SC);   

    const pageStart = this._page * PER_PAGE;
    const pageItems = this._items.slice(pageStart, pageStart + PER_PAGE);
    this._buildSlotRects(COLS, ROWS, COL_CX, ROW_CY);

    pageItems.forEach((item, i) => {
      if (!item || (item.qty ?? 0) <= 0) return;

      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx  = COL_CX[col];
      const cy  = ROW_CY[row];

      const texKey = this._resolveIcon(item.key, item.iconKey);

      let icon;
      if (texKey) {
        const src  = this.scene.textures.get(texKey).source[0];
        const natW = src.width, natH = src.height;
        const maxScale = Math.min(ICON_MAX / natW, ICON_MAX / natH);
        const scale    = Math.max(1, Math.floor(maxScale));
        icon = this.scene.add.image(cx, cy + ICON_OY, texKey)
          .setScale(scale)
          .setDepth(52)
          .setInteractive({ useHandCursor: true });
      } else {
        const color = CFG.FARMING?.SEEDS?.[item.key]?.color ?? 0x888888;
        const hs = ICON_MAX / 2;
        const g = this.scene.add.graphics().setDepth(52);
        g.fillStyle(color, 0.9);
        g.fillRoundedRect(cx - hs, cy + ICON_OY - hs, ICON_MAX, ICON_MAX, 3);
        g.setInteractive(
          new Phaser.Geom.Rectangle(cx - hs, cy + ICON_OY - hs, ICON_MAX, ICON_MAX),
          Phaser.Geom.Rectangle.Contains
        );
        icon = g;
      }

      const lines = this._formatLabel(item.label);
      const lbl = this.scene.add.text(cx, cy + TEXT_OY, lines, {
        fontFamily      : 'Arial, sans-serif',
        fontSize        : '18px',
        fontStyle       : 'bold',
        resolution      : 2,
        color           : '#fffcd9',
        stroke          : '#2e1800',
        strokeThickness : 4,
        align           : 'center',
      }).setOrigin(0.5, 0).setDepth(53).setScale(0.5);

      const qtyBadge = this.scene.add.text(
        Math.round(cx + 8 * SC), Math.round(cy - 10 * SC),
        `×${item.qty}`,
        {
          fontFamily      : 'Arial, sans-serif',
          fontSize        : '20px',
          fontStyle       : 'bold',
          resolution      : 2,
          color           : '#55ff55',
          stroke          : '#003300',
          strokeThickness : 4,
        }
      ).setOrigin(1, 0).setDepth(53).setScale(0.5);

      const capturedKey   = item.key;
      const capturedLabel = item.label;
      const capturedIcon  = item.iconKey;
      const capturedQty   = item.qty;
      const capturedIndex = pageStart + i;
      let wasDragging = false;

      icon.setInteractive({ useHandCursor: true, draggable: true });
      this.scene.input.setDraggable(icon);

      icon.on('dragstart', (ptr) => {
        wasDragging = true;
        this._drag = { srcIndex: capturedIndex, key: capturedKey };
        const hotbar = this.scene._hotbar;
        if (hotbar) {
          hotbar.beginInventoryDrag(capturedKey, capturedLabel, capturedIcon, capturedQty, ptr.x, ptr.y);
        }
      });

      icon.on('drag', (ptr) => {
        const hotbar = this.scene._hotbar;
        if (hotbar?._drag?.src === 'inventory') hotbar._onPointerMove(ptr);
      });

      icon.on('dragend', (ptr) => this._onInventoryDragEnd(ptr));

      icon.on('pointerup', () => {
        if (wasDragging) {
          wasDragging = false;
          return;
        }
        this._onSelectSeed?.(capturedKey);
        this.close();
      });

      icon.on('pointerover', () => { if (icon.setTint)   icon.setTint(0xdddddd); });
      icon.on('pointerout',  () => { if (icon.clearTint) icon.clearTint(); });

      this._icons.push(icon, lbl, qtyBadge);
      this._container.add([icon, lbl, qtyBadge]);
    });

    this._prevBtn.setVisible(this._page > 0);
    this._nextBtn.setVisible(true);
    this._updatePageIndicator();
  }

  _formatLabel(label) {
    if (!label) return '';
    let s = label.replace(' Seed', '').replace(' Lv1', '').replace(' Plant', 'plant');
    if (s === 'Watermelon')   return 'W.Melon';
    if (s === 'Blue Berries') return 'Blueberry';
    if (s === 'Red Berries')  return 'Redberry';
    if (s === 'Eggplant' || s === 'Egg plant') return 'Eggplant';
    if (s.includes('Harvested')) return s.replace('Harvested ', '').substring(0, 9);
    return s.substring(0, 9);
  }

  _clearIcons() {
    this._icons.forEach(o => { this._container.remove(o); o.destroy(); });
    this._icons = [];
  }

  _onInventoryDragEnd(ptr) {
    if (!this._drag) return;

    const drag = this._drag;
    this._drag = null;
    const targetIndex = this._getSlotIndexAt(ptr.x, ptr.y);
    if (targetIndex < 0) return;

    this._moveItemWithinInventory(drag.srcIndex, targetIndex);
  }

  _updatePageIndicator() {
    const PER_PAGE = 20;
    const total = Math.max(this._page + 2, Math.ceil(this._items.length / PER_PAGE));
    this._pageIndicator?.setText(
      Array.from({ length: total }, (_, i) => i === this._page ? '●' : '○').join(' ')
    );
  }

  _build() {
    const { width: W, height: H } = this.scene.scale;

    const SC = this._SC = 3;
    const PW = Math.round(200 * SC);
    const PH = Math.round(200 * SC);

    const panelX = Math.round((W - PW) / 2);
    const panelY = Math.round((H - PH) / 2 - 20);

    this._container = this.scene.add.container(panelX, panelY)
      .setDepth(50).setVisible(false);

    this._container.add(
      this.scene.add.image(PW / 2, PH / 2, 'ui_inventory_custom')
        .setDisplaySize(PW, PH)
        .setOrigin(0.5)
    );

    this._pageIndicator = this.scene.add.text(PW / 2, PH - 14, '● ○', {
      fontFamily: 'monospace', fontSize: '48px', fontStyle: 'bold',
      resolution: 2, color: '#5c3a1e', align: 'center',
    }).setOrigin(0.5, 1).setDepth(53).setScale(0.25);
    this._container.add(this._pageIndicator);

    this._prevBtn = this._makeArrowBtn(
      Math.round(18 * SC), Math.round(PH - 28), '◄',
      () => { if (this._page > 0) { this._page--; this.refresh(); } }
    );
    this._nextBtn = this._makeArrowBtn(
      Math.round(PW - 18 * SC), Math.round(PH - 28), '►',
      () => { this._page++; this.refresh(); }
    );

    const xBtn = this.scene.add.rectangle(
      Math.round(167 * SC), Math.round(26 * SC),
      Math.round(26 * SC), Math.round(26 * SC)
    ).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .setDepth(54).setFillStyle(0, 0);
    xBtn.on('pointerdown', () => this.close());
    xBtn.on('pointerover', () => xBtn.setFillStyle(0xffffff, 0.12));
    xBtn.on('pointerout',  () => xBtn.setFillStyle(0, 0));
    this._container.add(xBtn);

    this.scene.input.keyboard.on('keydown-ESC',   () => { if (this._open) this.close(); });
    this.scene.input.keyboard.on('keydown-LEFT',  () => { if (this._open && this._page > 0) { this._page--; this.refresh(); } });
    this.scene.input.keyboard.on('keydown-RIGHT', () => { if (this._open) { this._page++; this.refresh(); } });
  }

  _makeArrowBtn(x, y, symbol, onClick) {
    const bg = this.scene.add.graphics().setDepth(53);
    const w = 64;
    const h = 40;
    const r = 8;
    const draw = (hover) => {
      bg.clear();
      bg.fillStyle(hover ? 0x7a5030 : 0x5c3a1e, hover ? 0.95 : 0.85);
      bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, r);
      bg.lineStyle(2, hover ? 0xffd700 : 0xd4a84b, hover ? 1 : 0.8);
      bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, r);
    };
    draw(false);

    const txt = this.scene.add.text(x, y, symbol, {
      fontFamily: 'monospace', fontSize: '48px', fontStyle: 'bold',
      resolution: 2, color: '#f5dfa0',
    }).setOrigin(0.5).setDepth(54).setScale(0.5);

    const hit = this.scene.add.rectangle(x, y, w, h)
      .setOrigin(0.5)
      .setDepth(55)
      .setFillStyle(0, 0)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerdown', onClick);
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout',  () => draw(false));

    this._container.add([bg, txt, hit]);
    const btn = { bg, txt, hit, setVisible: (v) => { bg.setVisible(v); txt.setVisible(v); hit.setVisible(v); } };
    btn.setVisible(false);
    return btn;
  }
}
