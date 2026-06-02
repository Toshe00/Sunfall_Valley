class HealthBarHUD {
  static SCALE = 3.25;
  static PAD_X = 12;
  static PAD_Y = 12;
  static DEPTH = 9110;
  static PANEL = { x: 0, y: 0, w: 96, h: 32 };

  constructor(scene) {
    this.scene = scene;
    this._health = { current: 100, max: 100 };
    this._stamina = { current: 100, max: 100 };
    this._xp = { level: 1, xp: 0, xpToNext: 150, isMax: false };

    this._ensurePanelFrame();

    const { SCALE, PAD_X, PAD_Y, DEPTH } = HealthBarHUD;
    this._panel = scene.add.image(PAD_X, PAD_Y, 'ui_character_panel', 'empty_panel')
      .setOrigin(0, 0)
      .setScale(SCALE)
      .setScrollFactor(0)
      .setDepth(DEPTH);
    this._barFull = this._panel;

    this._bars = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1);
    this._hpText = this._makeText(this._screenX(34), this._screenY(6.8), 'HP 100 / 100', 12);
    this._levelText = this._makeText(this._screenX(5), this._screenY(36), 'Level 1', 17);
    this._xpText = this._makeText(this._screenX(34), this._screenY(18.8), 'XP 0 / 150', 12);

    this._draw();
  }

  setHealth(current, max) {
    this._health = { current: Math.max(0, current ?? 0), max: Math.max(1, max ?? 1) };
    this._draw();
  }

  setStamina(current, max) {
    this._stamina = { current: Math.max(0, current ?? 0), max: Math.max(1, max ?? 1) };
    this._draw();
  }

  setXP(state) {
    if (!state) return;
    this._xp = {
      level: state.level ?? 1,
      xp: Math.max(0, state.xp ?? 0),
      xpToNext: state.xpToNext ?? null,
      isMax: state.isMax === true,
    };
    this._draw();
  }

  _makeText(x, y, text, fontSize) {
    return this.scene.add.text(x, y, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize: `${fontSize}px`,
      fontStyle: 'bold',
      resolution: 2,
      color: '#ffffff',
      stroke: '#110804',
      strokeThickness: 3,
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(HealthBarHUD.DEPTH + 2);
  }

  _ensurePanelFrame() {
    const tex = this.scene.textures.get('ui_character_panel');
    if (tex && !tex.frames.empty_panel) {
      const p = HealthBarHUD.PANEL;
      tex.add('empty_panel', 0, p.x, p.y, p.w, p.h);
    }
  }

  _screenX(sourceX) {
    const scale = HealthBarHUD.SCALE;
    return HealthBarHUD.PAD_X + sourceX * scale;
  }

  _screenY(sourceY) {
    const scale = HealthBarHUD.SCALE;
    return HealthBarHUD.PAD_Y + sourceY * scale;
  }

  _barRect(sourceY) {
    return {
      x: this._screenX(31),
      y: this._screenY(sourceY),
      w: 53 * HealthBarHUD.SCALE,
      h: 3.2 * HealthBarHUD.SCALE,
    };
  }

  _drawBar(rect, pct, color, backColor = 0x2a180f) {
    this._bars.fillStyle(backColor, 0.95);
    this._bars.fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 3);
    this._bars.fillStyle(color, 1);
    this._bars.fillRoundedRect(rect.x, rect.y, Math.max(0, rect.w * pct), rect.h, 3);
  }

  _draw() {
    if (!this._bars) return;
    const hpPct = Phaser.Math.Clamp(this._health.current / this._health.max, 0, 1);
    const staminaPct = Phaser.Math.Clamp(this._stamina.current / this._stamina.max, 0, 1);
    const xpPct = this._xp.isMax || !this._xp.xpToNext
      ? 1
      : Phaser.Math.Clamp(this._xp.xp / this._xp.xpToNext, 0, 1);

    this._bars.clear();
    this._drawBar(this._barRect(5.1), hpPct, 0xd9362e);
    this._drawBar(this._barRect(11.2), staminaPct, 0x2f80ff);
    this._drawBar(this._barRect(17.3), xpPct, 0x30c85a);

    this._hpText?.setText(`HP ${Math.round(this._health.current)} / ${Math.round(this._health.max)}`);
    this._levelText?.setText(`Level ${this._xp.level}`);
    this._xpText?.setText(this._xp.isMax ? 'XP MAX' : `XP ${Math.round(this._xp.xp)} / ${Math.round(this._xp.xpToNext ?? 0)}`);
  }
}
