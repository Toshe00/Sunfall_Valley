class HealthBarHUD {
  static SCALE = 2.7;
  static PAD_X = 12;
  static PAD_Y = 12;
  static DEPTH = 9110;

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
    this._hpText = this._makeText(PAD_X + 92, PAD_Y + 15, 'HP 100 / 100', 10);
    this._levelText = this._makeText(PAD_X + 16, PAD_Y + 82, 'Level 1', 14);
    this._xpText = this._makeText(PAD_X + 92, PAD_Y + 52, 'XP 0 / 150', 10);

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
      tex.add('empty_panel', 0, 0, 0, 96, 40);
    }
  }

  _barRect(sourceY) {
    const scale = HealthBarHUD.SCALE;
    return {
      x: HealthBarHUD.PAD_X + 32 * scale,
      y: HealthBarHUD.PAD_Y + sourceY * scale,
      w: 50 * scale,
      h: 3 * scale,
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
    this._drawBar(this._barRect(7), hpPct, 0xd9362e);
    this._drawBar(this._barRect(13), staminaPct, 0x2f80ff);
    this._drawBar(this._barRect(19), xpPct, 0x30c85a);

    this._hpText?.setText(`HP ${Math.round(this._health.current)} / ${Math.round(this._health.max)}`);
    this._levelText?.setText(`Level ${this._xp.level}`);
    this._xpText?.setText(this._xp.isMax ? 'XP MAX' : `XP ${Math.round(this._xp.xp)} / ${Math.round(this._xp.xpToNext ?? 0)}`);
  }
}
