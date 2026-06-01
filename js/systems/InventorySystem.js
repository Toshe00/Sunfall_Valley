// js/systems/InventorySystem.js
class InventorySystem {
  constructor(scene) {
    this.scene         = scene;
    this._open         = false;
    this._items        = [];
    this._page         = 0;
    this._onSelectSeed = null;
    this._icons        = [];
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

  addItem(key, qty, label, iconKey = null) {
    const ex = this._items.find(i => i.key === key);
    if (ex) { ex.qty += qty; ex.label = label; if (iconKey) ex.iconKey = iconKey; }
    else     this._items.push({ key, qty, label, iconKey: iconKey || null });
    if (this._open) this.refresh();
  }

  hasItem(key, qty = 1) {
    return (this._items.find(i => i.key === key)?.qty ?? 0) >= qty;
  }

  removeItem(key, qty = 1) {
    const item = this._items.find(i => i.key === key);
    if (!item) return false;
    item.qty -= qty;
    if (item.qty <= 0) this._items = this._items.filter(i => i.key !== key);
    if (this._open) this.refresh();
    // Always sync hotbar qty badges even when inventory panel is closed
    this._notifyHotbar();
    return true;
  }

  removeItemCompletely(key) {
    this._items = this._items.filter(i => i.key !== key);
    if (this._open) this.refresh();
    this._notifyHotbar();
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

  _resolveIcon(itemKey, passedIconKey) {
    const base = itemKey.replace(/_harvested$|_crop$/, '');
    const isHarvested = itemKey.endsWith('_harvested') || itemKey.endsWith('_crop');
    const candidates = passedIconKey ? [passedIconKey] : [];
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
    const COLS = 5, ROWS = 4, PER_PAGE = COLS * ROWS;

    const COL_CX = [47, 75, 101, 126, 153].map(v => Math.round(v * SC));
    const ROW_CY = [57, 82, 107, 132].map(v  => Math.round(v * SC));

    const ICON_MAX = Math.round(14 * SC);   
    const ICON_OY  = Math.round(-3 * SC);   
    const TEXT_OY  = Math.round( 5 * SC);   

    const pageStart = this._page * PER_PAGE;
    const pageItems = this._items.slice(pageStart, pageStart + PER_PAGE);

    pageItems.forEach((item, i) => {
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
      let wasDragging = false;

      icon.setInteractive({ useHandCursor: true, draggable: true });
      this.scene.input.setDraggable(icon);

      icon.on('dragstart', (ptr) => {
        wasDragging = true;
        const hotbar = this.scene._hotbar;
        if (hotbar) {
          hotbar.beginInventoryDrag(capturedKey, capturedLabel, capturedIcon, ptr.x, ptr.y);
        }
      });

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

    const totalPages = Math.ceil(this._items.length / PER_PAGE);
    this._prevBtn.setVisible(this._page > 0);
    this._nextBtn.setVisible(this._items.length > PER_PAGE && this._page < totalPages - 1);
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

  _updatePageIndicator() {
    const PER_PAGE = 20;
    const total = Math.max(2, Math.ceil(this._items.length / PER_PAGE));
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
      Math.round(18 * SC), Math.round(PH - 12), '◄',
      () => { if (this._page > 0) { this._page--; this.refresh(); } }
    );
    this._nextBtn = this._makeArrowBtn(
      Math.round(PW - 18 * SC), Math.round(PH - 12), '►',
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
    const draw = (hover) => {
      bg.clear();
      bg.fillStyle(hover ? 0x7a5030 : 0x5c3a1e, hover ? 0.95 : 0.85);
      bg.fillRoundedRect(x - 16, y - 10, 32, 20, 5);
      bg.lineStyle(1, hover ? 0xffd700 : 0xd4a84b, hover ? 1 : 0.8);
      bg.strokeRoundedRect(x - 16, y - 10, 32, 20, 5);
    };
    draw(false);

    const txt = this.scene.add.text(x, y, symbol, {
      fontFamily: 'monospace', fontSize: '48px', fontStyle: 'bold',
      resolution: 2, color: '#f5dfa0',
    }).setOrigin(0.5).setDepth(54).setInteractive({ useHandCursor: true }).setScale(0.25);

    txt.on('pointerdown', onClick);
    txt.on('pointerover', () => draw(true));
    txt.on('pointerout',  () => draw(false));

    this._container.add([bg, txt]);
    const btn = { setVisible: (v) => { bg.setVisible(v); txt.setVisible(v); } };
    btn.setVisible(false);
    return btn;
  }
}
